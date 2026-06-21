const { User, Post, PostMedia, PostLike, PostComment, PostView, Follow, ActivityLog, Subscription, PostBoost, Repost } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { initBoostEngine } = require('../services/boostEngine');
const {
  getActiveSubscriptionsForWallets,
  enrichItemsWithSubscriptions,
  resolvePrimaryWallet,
  checkPinPostEligibility
} = require('../utils/userHelpers');

/**
 * Helper function to log activity (async, non-blocking)
 */
const logActivity = async (data) => {
  try {
    await ActivityLog.logActivity(data);
  } catch (error) {
    logger.error('Error logging activity:', error);
    // Don't throw - activity logging should not block the main operation
  }
};

/**
 * Helper function to return IPFS URLs as-is
 * No conversion - keep original IPFS hash/URL
 */
const convertIpfsUrl = (url) => {
  // Return URL as-is without any conversion
  return url;
};

/**
 * Helper function to determine post type based on media
 */
const determinePostType = (media) => {
  if (!media || media.length === 0) {
    return 'text';
  }

  const hasImages = media.some(m => m.mediaType === 'image');
  const hasVideos = media.some(m => m.mediaType === 'video');

  if (hasImages && hasVideos) {
    return 'mixed';
  } else if (hasImages) {
    return 'image';
  } else if (hasVideos) {
    return 'video';
  }

  return 'text';
};

/**
 * Helper function to check if user has liked a post
 */
const checkUserLiked = async (postId, userWalletAddress) => {
  if (!userWalletAddress) return false;
  const like = await PostLike.findOne({
    where: { postId, userWalletAddress }
  });
  return !!like;
};

/**
 * Helper function to get recent comments for a post
 */
const getRecentComments = async (postId, limit = 3) => {
  const comments = await PostComment.findAll({
    where: {
      postId,
      isActive: true,
      parentCommentId: null // Only top-level comments
    },
    order: [['createdAt', 'DESC']],
    limit
  });

  if (comments.length === 0) return [];

  // Get comment authors
  const authorAddresses = [...new Set(comments.map(c => c.authorWalletAddress))];
  const authors = await User.findAll({
    where: { walletAddress: { [Op.in]: authorAddresses } },
    attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
  });

  const authorMap = {};
  authors.forEach(a => { authorMap[a.walletAddress] = a; });

  // Fetch subscription plans for comment authors
  const subscriptionMap = await getActiveSubscriptionsForWallets(authorAddresses);

  return comments.map(comment => {
    const author = authorMap[comment.authorWalletAddress];
    return {
      id: comment.id,
      authorWalletAddress: comment.authorWalletAddress,
      author: author ? {
        walletAddress: author.walletAddress,
        username: author.username,
        profileImage: author.profileImage,
        isVerified: author.isVerified,
        subscriptionPlan: subscriptionMap[author.walletAddress] || 'free'
      } : null,
      content: comment.content,
      likesCount: comment.likesCount,
      repliesCount: comment.repliesCount,
      createdAt: comment.createdAt
    };
  }).reverse(); // Oldest first for display
};

/**
 * Helper function to format post with likes/comments info
 */
const formatPostWithEngagement = async (post, author, userWalletAddress = null, includeRecentComments = true, subscriptionPlan = null) => {
  const isLiked = await checkUserLiked(post.id, userWalletAddress);
  const recentComments = includeRecentComments ? await getRecentComments(post.id, 3) : [];

  // Calculate edit window (10 minutes from creation)
  const postCreatedAt = new Date(post.createdAt);
  const editableUntil = new Date(postCreatedAt.getTime() + 10 * 60 * 1000);
  const isEditable = new Date() < editableUntil;

  return {
    id: post.id,
    authorWalletAddress: post.authorWalletAddress,
    author: author ? {
      walletAddress: author.walletAddress,
      username: author.username,
      profileImage: author.profileImage,
      isVerified: author.isVerified,
      subscriptionPlan: subscriptionPlan || 'free',
      ...(author.bio !== undefined && { bio: author.bio })
    } : null,
    content: post.content,
    postType: post.postType,
    visibility: post.visibility,
    media: post.media ? post.media.map(m => ({
      id: m.id,
      mediaType: m.mediaType,
      mediaUrl: m.mediaUrl,
      thumbnailUrl: m.thumbnailUrl,
      mimeType: m.mimeType,
      fileSize: m.fileSize,
      width: m.width,
      height: m.height,
      duration: m.duration,
      displayOrder: m.displayOrder,
      altText: m.altText
    })).sort((a, b) => a.displayOrder - b.displayOrder) : [],
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    sharesCount: post.sharesCount,
    viewsCount: post.viewsCount || 0,
    repostsCount: post.repostsCount || 0,
    isPinned: post.isPinned || false,
    pinnedAt: post.pinnedAt || null,
    isEditable,
    editableUntil,
    isLiked,
    recentComments,
    metadata: post.metadata,
    createdAt: post.createdAt,
    ...(post.updatedAt && { updatedAt: post.updatedAt })
  };
};

/**
 * Create a new post
 * Supports text only, single/multiple images, single/multiple videos, or any combination
 */
const createPost = async (req, res, next) => {
  try {
    let {
      authorWalletAddress,
      content,
      media,
      visibility = 'public',
      metadata
    } = req.body;

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

    authorWalletAddress = await resolvePrimaryWallet(authorWalletAddress);

    authorWalletAddress = await resolvePrimaryWallet(authorWalletAddress);

    // Validate that post has content or media
    if ((!content || content.trim() === '') && (!media || media.length === 0)) {
      throw new ApiError(400, 'Post must have either text content or media');
    }

    // Verify author exists
    const author = await User.findOne({
      where: { walletAddress: authorWalletAddress }
    });

    if (!author) {
      throw new ApiError(404, 'Author not found');
    }

    // Validate media array if provided
    if (media && media.length > 0) {
      for (const item of media) {
        if (!item.mediaType || !['image', 'video'].includes(item.mediaType)) {
          throw new ApiError(400, 'Each media item must have a valid mediaType (image or video)');
        }
        if (!item.mediaUrl) {
          throw new ApiError(400, 'Each media item must have a mediaUrl');
        }
      }

      // Limit media count (optional, adjust as needed)
      if (media.length > 10) {
        throw new ApiError(400, 'Maximum 10 media items allowed per post');
      }
    }

    // Determine post type
    const postType = determinePostType(media);

    // Create the post
    const post = await Post.create({
      authorWalletAddress,
      content: content ? content.trim() : null,
      postType,
      visibility,
      metadata: metadata || null,
      isActive: true
    });

    // Create media attachments if provided
    // Convert IPFS URLs to HTTP gateway URLs for consistent access
    let mediaItems = [];
    if (media && media.length > 0) {
      mediaItems = await Promise.all(media.map(async (item, index) => {
        return await PostMedia.create({
          postId: post.id,
          mediaType: item.mediaType,
          mediaUrl: convertIpfsUrl(item.mediaUrl),
          thumbnailUrl: convertIpfsUrl(item.thumbnailUrl) || null,
          mimeType: item.mimeType || null,
          fileSize: item.fileSize || null,
          width: item.width || null,
          height: item.height || null,
          duration: item.duration || null,
          displayOrder: item.displayOrder !== undefined ? item.displayOrder : index,
          altText: item.altText || null
        });
      }));
    }

    // Attach media to post object for formatting
    post.media = mediaItems;

    // Log post_create activity (async, non-blocking)
    logActivity({
      userWalletAddress: authorWalletAddress,
      activityType: 'post_create',
      relatedId: post.id,
      relatedType: 'post',
      metadata: {
        postType: postType,
        hasMedia: mediaItems.length > 0
      }
    });

    logger.info(`New post created by ${authorWalletAddress}, type: ${postType}`);

    // Fetch subscription plan for author
    const subscriptionMap = await getActiveSubscriptionsForWallets([authorWalletAddress]);
    const subscriptionPlan = subscriptionMap[authorWalletAddress] || 'free';

    const formattedPost = await formatPostWithEngagement(post, author, authorWalletAddress, false, subscriptionPlan);

    res.status(201).json(
      new ApiResponse(201, { post: formattedPost }, 'Post created successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get posts by wallet address (user's timeline)
 * Includes user's own posts and reposts from other users
 * Pinned posts appear first, then sorted by date
 * Supports pagination
 */
const getUserPosts = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    const { page = 1, limit = 20, viewerWalletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get user's own posts
    const ownPosts = await Post.findAll({
      where: {
        authorWalletAddress: walletAddress,
        isActive: true
      },
      include: [
        {
          model: PostMedia,
          as: 'media',
          order: [['displayOrder', 'ASC']]
        }
      ]
    });

    // Get user's reposts with the original post data
    const reposts = await Repost.findAll({
      where: { userWalletAddress: walletAddress },
      include: [
        {
          model: Post,
          as: 'post',
          where: { isActive: true },
          required: true,
          include: [
            {
              model: PostMedia,
              as: 'media',
              order: [['displayOrder', 'ASC']]
            }
          ]
        }
      ]
    });

    // Get all author wallet addresses for user info lookup
    const authorAddresses = new Set([walletAddress]);
    ownPosts.forEach(p => authorAddresses.add(p.authorWalletAddress));
    reposts.forEach(r => {
      if (r.post) authorAddresses.add(r.post.authorWalletAddress);
    });

    // Fetch user info and subscriptions
    const [users, subscriptionMap] = await Promise.all([
      User.findAll({
        where: { walletAddress: { [Op.in]: [...authorAddresses] } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }),
      getActiveSubscriptionsForWallets([...authorAddresses])
    ]);

    const userMap = {};
    users.forEach(user => {
      userMap[user.walletAddress] = {
        ...user.toJSON(),
        subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
      };
    });

    // Fetch active post boosts
    const allPostIds = [
      ...ownPosts.map(p => p.id),
      ...reposts.filter(r => r.post).map(r => r.post.id)
    ];
    const activeBoosts = await PostBoost.findAll({
      where: {
        postId: { [Op.in]: allPostIds },
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      }
    });
    const boostedPostIds = new Set(activeBoosts.map(b => b.postId));

    // Combine own posts and reposts into timeline items
    const timelineItems = [];

    // Add own posts
    for (const post of ownPosts) {
      const author = userMap[post.authorWalletAddress];
      const subPlan = subscriptionMap[post.authorWalletAddress] || 'free';
      const formatted = await formatPostWithEngagement(post, author, viewerWalletAddress, true, subPlan);
      formatted.isBoosted = boostedPostIds.has(post.id);
      formatted.isRepost = false;
      formatted.repostInfo = null;
      formatted._sortDate = post.isPinned ? new Date('9999-12-31') : new Date(post.createdAt);
      formatted._isPinned = post.isPinned;
      timelineItems.push(formatted);
    }

    // Add reposts
    for (const repost of reposts) {
      if (!repost.post) continue;
      const originalPost = repost.post;
      const originalAuthor = userMap[originalPost.authorWalletAddress];
      const subPlan = subscriptionMap[originalPost.authorWalletAddress] || 'free';
      const formatted = await formatPostWithEngagement(originalPost, originalAuthor, viewerWalletAddress, true, subPlan);
      formatted.isBoosted = boostedPostIds.has(originalPost.id);
      formatted.isRepost = true;
      formatted.repostInfo = {
        repostId: repost.id,
        repostedBy: userMap[walletAddress] || {
          walletAddress,
          username: walletAddress,
          profileImage: null,
          isVerified: false,
          subscriptionPlan: 'free'
        },
        repostedAt: repost.createdAt,
        quote: repost.quote
      };
      formatted._sortDate = new Date(repost.createdAt);
      formatted._isPinned = false;
      timelineItems.push(formatted);
    }

    // Sort: pinned posts first, then by date (most recent first)
    timelineItems.sort((a, b) => {
      if (a._isPinned && !b._isPinned) return -1;
      if (!a._isPinned && b._isPinned) return 1;
      return b._sortDate - a._sortDate;
    });

    // Remove internal sort fields
    timelineItems.forEach(item => {
      delete item._sortDate;
      delete item._isPinned;
    });

    // Apply pagination
    const total = timelineItems.length;
    const paginatedItems = timelineItems.slice(offset, offset + parseInt(limit));

    // Count pinned posts for this user
    const pinnedCount = await Post.count({
      where: {
        authorWalletAddress: walletAddress,
        isPinned: true,
        isActive: true
      }
    });

    logger.info(`Timeline fetched for wallet: ${walletAddress} (${ownPosts.length} posts, ${reposts.length} reposts)`);

    res.status(200).json(
      new ApiResponse(200, {
        posts: paginatedItems,
        pinnedCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }, 'Posts retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all posts (feed)
 * Returns all public posts mixed with paid boosted posts (like ads)
 * Boosted posts appear after every 4 regular posts
 * Secondary sort options: 'recent' (default), 'popular'
 * Supports pagination
 */
const getAllPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      postType,
      viewerWalletAddress,
      sortBy = 'recent' // Secondary sort: 'recent' (default), 'popular'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause for regular posts
    const whereClause = {
      isActive: true,
      visibility: 'public'
    };

    // Exclude viewer's own posts from the feed
    if (viewerWalletAddress) {
      whereClause.authorWalletAddress = { [Op.ne]: viewerWalletAddress };
    }

    // Filter by post type if specified
    if (postType && ['text', 'image', 'video', 'mixed'].includes(postType)) {
      whereClause.postType = postType;
    }

    // Fetch more posts for boost sorting (we sort in memory after calculating boost)
    const fetchLimit = parseInt(limit) * 3;

    // Fetch active paid boosts from PostBoosts table (sorted by boostPercentage)
    const activeBoosts = await PostBoost.findAll({
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [['boostPercentage', 'DESC'], ['createdAt', 'DESC']]
    });

    // Get post IDs from active boosts
    const boostedPostIds = activeBoosts.map(b => b.postId);

    // Fetch boosted posts data (exclude viewer's own posts)
    let boostedPosts = [];
    if (boostedPostIds.length > 0) {
      const boostedWhereClause = {
        id: { [Op.in]: boostedPostIds },
        isActive: true
      };

      // Exclude viewer's own boosted posts from the feed
      if (viewerWalletAddress) {
        boostedWhereClause.authorWalletAddress = { [Op.ne]: viewerWalletAddress };
      }

      boostedPosts = await Post.findAll({
        where: boostedWhereClause,
        include: [
          {
            model: PostMedia,
            as: 'media',
            order: [['displayOrder', 'ASC']]
          }
        ]
      });

      // Sort boosted posts by their boost percentage
      const boostMap = {};
      activeBoosts.forEach(b => { boostMap[b.postId] = b; });
      boostedPosts.sort((a, b) => {
        const boostA = boostMap[a.id]?.boostPercentage || 0;
        const boostB = boostMap[b.id]?.boostPercentage || 0;
        return boostB - boostA;
      });

      // Attach boost info to posts
      boostedPosts = boostedPosts.map(post => {
        const boost = boostMap[post.id];
        return {
          ...post.toJSON(),
          _boost: boost,
          _isSponsored: true
        };
      });
    }

    // Get regular posts (exclude boosted posts to avoid duplicates)
    const { count, rows: posts } = await Post.findAndCountAll({
      where: {
        ...whereClause,
        id: { [Op.notIn]: boostedPostIds }
      },
      order: sortBy === 'popular'
        ? [['likesCount', 'DESC'], ['createdAt', 'DESC']]
        : [['createdAt', 'DESC']],
      limit: fetchLimit,
      offset: 0,
      include: [
        {
          model: PostMedia,
          as: 'media',
          order: [['displayOrder', 'ASC']]
        }
      ]
    });

    // Get all author wallet addresses (regular + boosted)
    const allPosts = [...posts, ...boostedPosts];
    const authorAddresses = [...new Set(allPosts.map(p => p.authorWalletAddress))];

    // Get author details
    const authors = await User.findAll({
      where: {
        walletAddress: { [Op.in]: authorAddresses }
      },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    // Create author map
    const authorMap = {};
    authors.forEach(author => {
      authorMap[author.walletAddress] = author;
    });

    // Fetch subscription plans for all authors
    const subscriptionMap = await getActiveSubscriptionsForWallets(authorAddresses);

    // Apply boost scoring to regular posts
    let processedPosts = posts;
    if (posts.length > 0) {
      const db = require('../models');
      const boostEngine = initBoostEngine(db);
      const boostedRegularPosts = await boostEngine.boostPosts(posts);

      // Sort by boost score (primary), then by secondary sort
      boostedRegularPosts.sort((a, b) => {
        const boostDiff = (b.boostScore || 0) - (a.boostScore || 0);
        if (Math.abs(boostDiff) > 0.01) return boostDiff;

        if (sortBy === 'popular') {
          return (b.likesCount || 0) - (a.likesCount || 0);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // Apply pagination after boost sorting
      processedPosts = boostedRegularPosts.slice(offset, offset + parseInt(limit));
    }

    // Mix regular posts with boosted posts (ads)
    // Higher boostPercentage = more visibility (appears earlier and more frequently)
    // Interval based on boost percentage: 100% -> every 2 posts, 20% -> every 6 posts
    const mixedPosts = [];
    let boostedIndex = 0;
    let postsSinceLastAd = 0;
    const boostsToShow = []; // Track which boosts were shown for impression counting

    // Calculate interval for next boosted post based on its percentage
    const getIntervalForBoost = (boostPercentage) => {
      // 100% -> 2, 80% -> 3, 60% -> 4, 40% -> 5, 20% -> 6
      return Math.max(2, 7 - Math.floor(boostPercentage / 20));
    };

    for (let i = 0; i < processedPosts.length; i++) {
      mixedPosts.push({ ...processedPosts[i], _isSponsored: false });
      postsSinceLastAd++;

      // Check if we should insert a boosted post
      if (boostedIndex < boostedPosts.length) {
        const nextBoost = boostedPosts[boostedIndex];
        const interval = getIntervalForBoost(nextBoost._boost?.boostPercentage || 20);

        if (postsSinceLastAd >= interval) {
          mixedPosts.push(nextBoost);
          if (nextBoost._boost) {
            boostsToShow.push(nextBoost._boost.id);
          }
          boostedIndex++;
          postsSinceLastAd = 0; // Reset counter after showing an ad
        }
      }
    }

    // Increment impressions for shown boosts (async, non-blocking)
    if (boostsToShow.length > 0) {
      PostBoost.increment('impressions', { where: { id: boostsToShow } }).catch(err => {
        logger.error('Error incrementing post boost impressions:', err);
      });
    }

    // Format all posts with engagement data
    const formattedPosts = await Promise.all(
      mixedPosts.map(async (post) => {
        const author = authorMap[post.authorWalletAddress];
        const subscriptionPlan = subscriptionMap[post.authorWalletAddress] || 'free';
        const formatted = await formatPostWithEngagement(
          post.toJSON ? post : { ...post, toJSON: () => post },
          author,
          viewerWalletAddress,
          true,
          subscriptionPlan
        );

        // Include boost info
        formatted.boostScore = post.boostScore || 1.0;
        formatted.boostDetails = post.boostDetails || null;

        // Mark sponsored posts
        formatted.isSponsored = post._isSponsored || false;
        if (post._isSponsored && post._boost) {
          formatted.sponsoredInfo = {
            boostId: post._boost.id,
            boostPercentage: post._boost.boostPercentage,
            boostEndDate: post._boost.endDate
          };
        }

        return formatted;
      })
    );

    logger.info(`Feed fetched: ${processedPosts.length} regular posts, ${boostsToShow.length} sponsored posts, page: ${page}`);

    res.status(200).json(
      new ApiResponse(200, {
        posts: formattedPosts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        },
        sorting: {
          primary: 'boost',
          secondary: sortBy
        }
      }, 'Posts retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single post by ID
 */
const getPostById = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { viewerWalletAddress } = req.query;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    const post = await Post.findOne({
      where: {
        id: postId,
        isActive: true
      },
      include: [
        {
          model: PostMedia,
          as: 'media',
          order: [['displayOrder', 'ASC']]
        }
      ]
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Get author info
    const author = await User.findOne({
      where: { walletAddress: post.authorWalletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
    });

    // Fetch subscription plan for author
    const subscriptionMap = await getActiveSubscriptionsForWallets([post.authorWalletAddress]);
    const subscriptionPlan = subscriptionMap[post.authorWalletAddress] || 'free';

    logger.info(`Post fetched: ${postId}`);

    const formattedPost = await formatPostWithEngagement(post, author, viewerWalletAddress, true, subscriptionPlan);

    res.status(200).json(
      new ApiResponse(200, { post: formattedPost }, 'Post retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update a post
 * Only the author can update their post
 */
const updatePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const {
      authorWalletAddress,
      content,
      media,
      visibility,
      metadata
    } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

    authorWalletAddress = await resolvePrimaryWallet(authorWalletAddress);

    const post = await Post.findOne({
      where: {
        id: postId,
        isActive: true
      }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Verify ownership
    if (post.authorWalletAddress !== authorWalletAddress) {
      throw new ApiError(403, 'You are not authorized to update this post');
    }

    // Check if post is within 10-minute edit window
    const postCreatedAt = new Date(post.createdAt);
    const now = new Date();
    const tenMinutesInMs = 10 * 60 * 1000;
    const timeSinceCreation = now - postCreatedAt;

    if (timeSinceCreation > tenMinutesInMs) {
      throw new ApiError(403, 'Posts can only be edited within 10 minutes of posting');
    }

    // Update content if provided
    if (content !== undefined) {
      post.content = content ? content.trim() : null;
    }

    // Update visibility if provided
    if (visibility !== undefined) {
      post.visibility = visibility;
    }

    // Update metadata if provided
    if (metadata !== undefined) {
      post.metadata = metadata;
    }

    // Handle media update if provided
    if (media !== undefined) {
      // Validate media
      if (media && media.length > 0) {
        for (const item of media) {
          if (!item.mediaType || !['image', 'video'].includes(item.mediaType)) {
            throw new ApiError(400, 'Each media item must have a valid mediaType (image or video)');
          }
          if (!item.mediaUrl) {
            throw new ApiError(400, 'Each media item must have a mediaUrl');
          }
        }

        if (media.length > 10) {
          throw new ApiError(400, 'Maximum 10 media items allowed per post');
        }
      }

      // Delete existing media
      await PostMedia.destroy({
        where: { postId: post.id }
      });

      // Create new media attachments with IPFS URL conversion
      if (media && media.length > 0) {
        await Promise.all(media.map(async (item, index) => {
          return await PostMedia.create({
            postId: post.id,
            mediaType: item.mediaType,
            mediaUrl: convertIpfsUrl(item.mediaUrl),
            thumbnailUrl: convertIpfsUrl(item.thumbnailUrl) || null,
            mimeType: item.mimeType || null,
            fileSize: item.fileSize || null,
            width: item.width || null,
            height: item.height || null,
            duration: item.duration || null,
            displayOrder: item.displayOrder !== undefined ? item.displayOrder : index,
            altText: item.altText || null
          });
        }));
      }

      // Update post type
      post.postType = determinePostType(media);
    }

    // Validate that post still has content or media
    const currentMedia = await PostMedia.findAll({ where: { postId: post.id } });
    if ((!post.content || post.content.trim() === '') && currentMedia.length === 0) {
      throw new ApiError(400, 'Post must have either text content or media');
    }

    await post.save();

    // Fetch updated post with media
    const updatedPost = await Post.findOne({
      where: { id: post.id },
      include: [
        {
          model: PostMedia,
          as: 'media',
          order: [['displayOrder', 'ASC']]
        }
      ]
    });

    // Get author info
    const author = await User.findOne({
      where: { walletAddress: post.authorWalletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    // Fetch subscription plan for author
    const subscriptionMap = await getActiveSubscriptionsForWallets([post.authorWalletAddress]);
    const subscriptionPlan = subscriptionMap[post.authorWalletAddress] || 'free';

    logger.info(`Post updated: ${postId} by ${authorWalletAddress}`);

    const formattedPost = await formatPostWithEngagement(updatedPost, author, authorWalletAddress, true, subscriptionPlan);

    res.status(200).json(
      new ApiResponse(200, { post: formattedPost }, 'Post updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a post (soft delete)
 * Only the author can delete their post
 */
const deletePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { authorWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

    authorWalletAddress = await resolvePrimaryWallet(authorWalletAddress);

    const post = await Post.findOne({
      where: {
        id: postId,
        isActive: true
      }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Verify ownership
    if (post.authorWalletAddress !== authorWalletAddress) {
      throw new ApiError(403, 'You are not authorized to delete this post');
    }

    // Soft delete
    post.isActive = false;
    await post.save();

    logger.info(`Post deleted: ${postId} by ${authorWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId: post.id
      }, 'Post deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Like a post
 */
const likePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { userWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!userWalletAddress) {
      throw new ApiError(400, 'User wallet address is required');
    }

    userWalletAddress = await resolvePrimaryWallet(userWalletAddress);

    // Check if post exists (include media for notification)
    const post = await Post.findOne({
      where: { id: postId, isActive: true },
      include: [
        {
          model: PostMedia,
          as: 'media',
          attributes: ['mediaUrl', 'thumbnailUrl', 'mediaType']
        }
      ]
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Check if user exists
    const user = await User.findOne({
      where: { walletAddress: userWalletAddress }
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if already liked
    const existingLike = await PostLike.findOne({
      where: { postId, userWalletAddress }
    });

    if (existingLike) {
      throw new ApiError(400, 'You have already liked this post');
    }

    // Create like
    await PostLike.create({ postId, userWalletAddress });

    // Increment likes count
    await post.increment('likesCount');
    await post.reload();

    // Create notification for post author (async, don't wait)
    notificationService.createLikeNotification({
      postId,
      postAuthorWalletAddress: post.authorWalletAddress,
      likerWalletAddress: userWalletAddress,
      likerUsername: user.username,
      postPreview: post.content,
      postType: post.postType,
      postMedia: post.media
    }).catch(err => logger.error('Error creating like notification:', err));

    // Log like_give activity for the user who liked (async, non-blocking)
    logActivity({
      userWalletAddress: userWalletAddress,
      activityType: 'like_give',
      relatedId: postId,
      relatedType: 'post',
      counterpartyWalletAddress: post.authorWalletAddress,
      metadata: {}
    });

    // Log like_receive activity for the post author (async, non-blocking)
    // Only if the liker is not the post author
    if (userWalletAddress !== post.authorWalletAddress) {
      logActivity({
        userWalletAddress: post.authorWalletAddress,
        activityType: 'like_receive',
        relatedId: postId,
        relatedType: 'post',
        counterpartyWalletAddress: userWalletAddress,
        metadata: {}
      });
    }

    logger.info(`Post ${postId} liked by ${userWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId,
        likesCount: post.likesCount,
        isLiked: true
      }, 'Post liked successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Unlike a post
 */
const unlikePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { userWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!userWalletAddress) {
      throw new ApiError(400, 'User wallet address is required');
    }

    userWalletAddress = await resolvePrimaryWallet(userWalletAddress);

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Check if like exists
    const existingLike = await PostLike.findOne({
      where: { postId, userWalletAddress }
    });

    if (!existingLike) {
      throw new ApiError(400, 'You have not liked this post');
    }

    // Remove like
    await existingLike.destroy();

    // Decrement likes count
    if (post.likesCount > 0) {
      await post.decrement('likesCount');
      await post.reload();
    }

    logger.info(`Post ${postId} unliked by ${userWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId,
        likesCount: post.likesCount,
        isLiked: false
      }, 'Post unliked successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get users who liked a post
 */
const getPostLikes = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get likes with pagination
    const { count, rows: likes } = await PostLike.findAndCountAll({
      where: { postId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get user details
    const userAddresses = likes.map(l => l.userWalletAddress);
    const users = await User.findAll({
      where: { walletAddress: { [Op.in]: userAddresses } },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    const userMap = {};
    users.forEach(u => { userMap[u.walletAddress] = u; });

    // Fetch subscription plans for all users who liked
    const subscriptionMap = await getActiveSubscriptionsForWallets(userAddresses);

    const formattedLikes = likes.map(like => {
      const user = userMap[like.userWalletAddress];
      return {
        userWalletAddress: like.userWalletAddress,
        user: user ? {
          walletAddress: user.walletAddress,
          username: user.username,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
        } : null,
        likedAt: like.createdAt
      };
    });

    logger.info(`Likes fetched for post: ${postId}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId,
        likes: formattedLikes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Likes retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Add a comment to a post
 */
const addComment = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { authorWalletAddress, content, parentCommentId } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

    authorWalletAddress = await resolvePrimaryWallet(authorWalletAddress);

    if (!content || content.trim() === '') {
      throw new ApiError(400, 'Comment content is required');
    }

    // Check if post exists (include media for notification)
    const post = await Post.findOne({
      where: { id: postId, isActive: true },
      include: [
        {
          model: PostMedia,
          as: 'media',
          attributes: ['mediaUrl', 'thumbnailUrl', 'mediaType']
        }
      ]
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Verify author exists
    const author = await User.findOne({
      where: { walletAddress: authorWalletAddress }
    });

    if (!author) {
      throw new ApiError(404, 'User not found');
    }

    // If replying to a comment, verify parent exists
    let parentComment = null;
    if (parentCommentId) {
      parentComment = await PostComment.findOne({
        where: { id: parentCommentId, postId, isActive: true }
      });

      if (!parentComment) {
        throw new ApiError(404, 'Parent comment not found');
      }
    }

    // Create comment
    const comment = await PostComment.create({
      postId,
      authorWalletAddress,
      content: content.trim(),
      parentCommentId: parentCommentId || null
    });

    // Increment comments count on post
    await post.increment('commentsCount');

    // If it's a reply, increment replies count on parent
    if (parentComment) {
      await parentComment.increment('repliesCount');

      // Create notification for parent comment author (reply notification)
      notificationService.createCommentReplyNotification({
        postId,
        commentId: comment.id,
        parentCommentId: parentCommentId,
        parentCommentAuthorWalletAddress: parentComment.authorWalletAddress,
        replierWalletAddress: authorWalletAddress,
        replierUsername: author.username,
        replyPreview: content.trim(),
        postType: post.postType,
        postMedia: post.media
      }).catch(err => logger.error('Error creating comment reply notification:', err));
    } else {
      // Create notification for post author (comment notification)
      notificationService.createCommentNotification({
        postId,
        commentId: comment.id,
        postAuthorWalletAddress: post.authorWalletAddress,
        commenterWalletAddress: authorWalletAddress,
        commenterUsername: author.username,
        commentPreview: content.trim(),
        postPreview: post.content,
        postType: post.postType,
        postMedia: post.media
      }).catch(err => logger.error('Error creating comment notification:', err));
    }

    // Log comment_create activity for the commenter (async, non-blocking)
    logActivity({
      userWalletAddress: authorWalletAddress,
      activityType: 'comment_create',
      relatedId: comment.id,
      relatedType: 'comment',
      counterpartyWalletAddress: post.authorWalletAddress,
      metadata: {
        postId: postId,
        commentId: comment.id,
        isReply: !!parentCommentId
      }
    });

    // Log comment_receive activity for the post author (async, non-blocking)
    // Only if the commenter is not the post author
    if (authorWalletAddress !== post.authorWalletAddress) {
      logActivity({
        userWalletAddress: post.authorWalletAddress,
        activityType: 'comment_receive',
        relatedId: postId,
        relatedType: 'post',
        counterpartyWalletAddress: authorWalletAddress,
        metadata: {
          postId: postId,
          commentId: comment.id
        }
      });
    }

    await post.reload();

    // Fetch subscription plan for comment author
    const subscriptionMap = await getActiveSubscriptionsForWallets([authorWalletAddress]);
    const subscriptionPlan = subscriptionMap[authorWalletAddress] || 'free';

    logger.info(`Comment added to post ${postId} by ${authorWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, {
        comment: {
          id: comment.id,
          postId: comment.postId,
          authorWalletAddress: comment.authorWalletAddress,
          author: {
            walletAddress: author.walletAddress,
            username: author.username,
            profileImage: author.profileImage,
            isVerified: author.isVerified,
            subscriptionPlan: subscriptionPlan
          },
          content: comment.content,
          parentCommentId: comment.parentCommentId,
          likesCount: comment.likesCount,
          repliesCount: comment.repliesCount,
          createdAt: comment.createdAt
        },
        postCommentsCount: post.commentsCount
      }, 'Comment added successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get comments for a post
 */
const getPostComments = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20, parentCommentId } = req.query;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {
      postId,
      isActive: true
    };

    // If parentCommentId is provided, get replies; otherwise get top-level comments
    if (parentCommentId) {
      whereClause.parentCommentId = parentCommentId;
    } else {
      whereClause.parentCommentId = null;
    }

    // Get comments with pagination
    const { count, rows: comments } = await PostComment.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    // Get author details
    const authorAddresses = [...new Set(comments.map(c => c.authorWalletAddress))];
    const authors = await User.findAll({
      where: { walletAddress: { [Op.in]: authorAddresses } },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    const authorMap = {};
    authors.forEach(a => { authorMap[a.walletAddress] = a; });

    // Fetch subscription plans for all comment authors
    const subscriptionMap = await getActiveSubscriptionsForWallets(authorAddresses);

    const formattedComments = comments.map(comment => {
      const author = authorMap[comment.authorWalletAddress];
      return {
        id: comment.id,
        postId: comment.postId,
        authorWalletAddress: comment.authorWalletAddress,
        author: author ? {
          walletAddress: author.walletAddress,
          username: author.username,
          profileImage: author.profileImage,
          isVerified: author.isVerified,
          subscriptionPlan: subscriptionMap[author.walletAddress] || 'free'
        } : null,
        content: comment.content,
        parentCommentId: comment.parentCommentId,
        likesCount: comment.likesCount,
        repliesCount: comment.repliesCount,
        isEdited: comment.isEdited,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      };
    });

    logger.info(`Comments fetched for post: ${postId}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId,
        comments: formattedComments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Comments retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update a comment
 */
const updateComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    let { authorWalletAddress, content } = req.body;

    if (!commentId) {
      throw new ApiError(400, 'Comment ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

    authorWalletAddress = await resolvePrimaryWallet(authorWalletAddress);

    if (!content || content.trim() === '') {
      throw new ApiError(400, 'Comment content is required');
    }

    const comment = await PostComment.findOne({
      where: { id: commentId, isActive: true }
    });

    if (!comment) {
      throw new ApiError(404, 'Comment not found');
    }

    // Verify ownership
    if (comment.authorWalletAddress !== authorWalletAddress) {
      throw new ApiError(403, 'You are not authorized to update this comment');
    }

    // Update comment
    comment.content = content.trim();
    comment.isEdited = true;
    await comment.save();

    // Get author info
    const author = await User.findOne({
      where: { walletAddress: authorWalletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    // Fetch subscription plan for comment author
    const subscriptionMap = await getActiveSubscriptionsForWallets([authorWalletAddress]);
    const subscriptionPlan = subscriptionMap[authorWalletAddress] || 'free';

    logger.info(`Comment ${commentId} updated by ${authorWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        comment: {
          id: comment.id,
          postId: comment.postId,
          authorWalletAddress: comment.authorWalletAddress,
          author: author ? {
            walletAddress: author.walletAddress,
            username: author.username,
            profileImage: author.profileImage,
            isVerified: author.isVerified,
            subscriptionPlan: subscriptionPlan
          } : null,
          content: comment.content,
          parentCommentId: comment.parentCommentId,
          likesCount: comment.likesCount,
          repliesCount: comment.repliesCount,
          isEdited: comment.isEdited,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt
        }
      }, 'Comment updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a comment (soft delete)
 */
const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    let { authorWalletAddress } = req.body;

    if (!commentId) {
      throw new ApiError(400, 'Comment ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

    authorWalletAddress = await resolvePrimaryWallet(authorWalletAddress);

    const comment = await PostComment.findOne({
      where: { id: commentId, isActive: true }
    });

    if (!comment) {
      throw new ApiError(404, 'Comment not found');
    }

    // Verify ownership
    if (comment.authorWalletAddress !== authorWalletAddress) {
      throw new ApiError(403, 'You are not authorized to delete this comment');
    }

    // Soft delete
    comment.isActive = false;
    await comment.save();

    // Decrement comments count on post
    const post = await Post.findByPk(comment.postId);
    if (post && post.commentsCount > 0) {
      await post.decrement('commentsCount');
    }

    // If it's a reply, decrement replies count on parent
    if (comment.parentCommentId) {
      const parentComment = await PostComment.findByPk(comment.parentCommentId);
      if (parentComment && parentComment.repliesCount > 0) {
        await parentComment.decrement('repliesCount');
      }
    }

    logger.info(`Comment ${commentId} deleted by ${authorWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        commentId: comment.id
      }, 'Comment deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get posts from users that the logged-in user follows (Following Feed)
 * Supports pagination
 */
const getFollowingPosts = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    const { page = 1, limit = 20, viewerWalletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Use viewerWalletAddress if provided, otherwise use walletAddress
    const viewerWallet = viewerWalletAddress || walletAddress;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get list of users that this user follows
    const following = await Follow.findAll({
      where: { followerWalletAddress: walletAddress },
      attributes: ['followingWalletAddress']
    });

    const followingAddresses = following.map(f => f.followingWalletAddress);

    // If user doesn't follow anyone, return empty feed
    if (followingAddresses.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, {
          posts: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
          }
        }, 'No posts found. Follow some users to see their posts.')
      );
    }

    // Get posts from followed users
    const { count, rows: posts } = await Post.findAndCountAll({
      where: {
        authorWalletAddress: { [Op.in]: followingAddresses },
        isActive: true,
        visibility: 'public'
      },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: PostMedia,
          as: 'media',
          attributes: ['id', 'mediaType', 'mediaUrl', 'thumbnailUrl', 'mimeType', 'width', 'height', 'duration', 'displayOrder', 'altText']
        }
      ]
    });

    // Get author details
    const authorAddresses = [...new Set(posts.map(p => p.authorWalletAddress))];

    let authorMap = {};
    if (authorAddresses.length > 0) {
      const authors = await User.findAll({
        where: { walletAddress: { [Op.in]: authorAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });

      authors.forEach(author => {
        authorMap[author.walletAddress] = author;
      });
    }

    // Fetch subscription plans for all authors
    const subscriptionMap = await getActiveSubscriptionsForWallets(authorAddresses);

    // Format posts with engagement data
    const formattedPosts = await Promise.all(posts.map(async (post) => {
      const author = authorMap[post.authorWalletAddress];
      const subscriptionPlan = subscriptionMap[post.authorWalletAddress] || 'free';
      return await formatPostWithEngagement(post, author, viewerWallet, true, subscriptionPlan);
    }));

    logger.info(`Following feed fetched for wallet: ${walletAddress}, following ${followingAddresses.length} users`);

    res.status(200).json(
      new ApiResponse(200, {
        posts: formattedPosts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Following feed retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Record a view for a post
 * Only counts unique views per user
 */
const recordPostView = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { userWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!userWalletAddress) {
      throw new ApiError(400, 'User wallet address is required');
    }

    userWalletAddress = await resolvePrimaryWallet(userWalletAddress);

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Check if user has already viewed this post
    const existingView = await PostView.findOne({
      where: { postId, userWalletAddress }
    });

    if (existingView) {
      // User has already viewed this post, return current count
      return res.status(200).json(
        new ApiResponse(200, {
          postId,
          viewsCount: post.viewsCount,
          isNewView: false
        }, 'Post already viewed')
      );
    }

    // Create view record
    await PostView.create({ postId, userWalletAddress });

    // Increment views count on post
    await post.increment('viewsCount');
    await post.reload();

    logger.info(`Post ${postId} viewed by ${userWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId,
        viewsCount: post.viewsCount,
        isNewView: true
      }, 'Post view recorded successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get users who viewed a post
 */
const getPostViews = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get views with pagination
    const { count, rows: views } = await PostView.findAndCountAll({
      where: { postId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get user details
    const userAddresses = views.map(v => v.userWalletAddress);
    const users = await User.findAll({
      where: { walletAddress: { [Op.in]: userAddresses } },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    const userMap = {};
    users.forEach(u => { userMap[u.walletAddress] = u; });

    // Fetch subscription plans for all users who viewed
    const subscriptionMap = await getActiveSubscriptionsForWallets(userAddresses);

    const formattedViews = views.map(view => {
      const user = userMap[view.userWalletAddress];
      return {
        userWalletAddress: view.userWalletAddress,
        user: user ? {
          walletAddress: user.walletAddress,
          username: user.username,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
        } : null,
        viewedAt: view.createdAt
      };
    });

    logger.info(`Views fetched for post: ${postId}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId,
        viewsCount: post.viewsCount,
        views: formattedViews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Views retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Pin a post to user's timeline
 * Limited by subscription plan:
 * - free: 0 pins
 * - BASIC: 1 pin
 * - DEGEN/DEGEN+: 3 pins
 */
const pinPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { userWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!userWalletAddress) {
      throw new ApiError(400, 'User wallet address is required');
    }

    userWalletAddress = await resolvePrimaryWallet(userWalletAddress);

    // Check if post exists and belongs to user
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Verify ownership
    if (post.authorWalletAddress !== userWalletAddress) {
      throw new ApiError(403, 'You can only pin your own posts');
    }

    // Check if post is already pinned
    if (post.isPinned) {
      throw new ApiError(400, 'Post is already pinned');
    }

    // Count current pinned posts for this user
    const currentPinnedCount = await Post.count({
      where: {
        authorWalletAddress: userWalletAddress,
        isPinned: true,
        isActive: true
      }
    });

    // Check if user can pin more posts based on subscription
    const eligibility = await checkPinPostEligibility(userWalletAddress, currentPinnedCount);

    if (!eligibility.canPin) {
      throw new ApiError(403, eligibility.message, {
        limit: eligibility.limit,
        currentCount: eligibility.currentCount,
        subscriptionPlan: eligibility.subscriptionPlan,
        upgradeMessage: eligibility.upgradeMessage
      });
    }

    // Pin the post
    post.isPinned = true;
    post.pinnedAt = new Date();
    await post.save();

    logger.info(`Post ${postId} pinned by ${userWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId,
        isPinned: true,
        pinnedAt: post.pinnedAt,
        pinnedCount: currentPinnedCount + 1,
        pinLimit: eligibility.limit,
        remaining: eligibility.limit - (currentPinnedCount + 1)
      }, 'Post pinned successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Unpin a post from user's timeline
 */
const unpinPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { userWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!userWalletAddress) {
      throw new ApiError(400, 'User wallet address is required');
    }

    userWalletAddress = await resolvePrimaryWallet(userWalletAddress);

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Verify ownership
    if (post.authorWalletAddress !== userWalletAddress) {
      throw new ApiError(403, 'You can only unpin your own posts');
    }

    // Check if post is pinned
    if (!post.isPinned) {
      throw new ApiError(400, 'Post is not pinned');
    }

    // Unpin the post
    post.isPinned = false;
    post.pinnedAt = null;
    await post.save();

    // Get updated pinned count
    const currentPinnedCount = await Post.count({
      where: {
        authorWalletAddress: userWalletAddress,
        isPinned: true,
        isActive: true
      }
    });

    // Get pin limit for response
    const eligibility = await checkPinPostEligibility(userWalletAddress, currentPinnedCount);

    logger.info(`Post ${postId} unpinned by ${userWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        postId,
        isPinned: false,
        pinnedCount: currentPinnedCount,
        pinLimit: eligibility.limit,
        remaining: eligibility.limit - currentPinnedCount
      }, 'Post unpinned successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's pinned posts count and limit
 */
const getPinStatus = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Count current pinned posts for this user
    const currentPinnedCount = await Post.count({
      where: {
        authorWalletAddress: walletAddress,
        isPinned: true,
        isActive: true
      }
    });

    // Get eligibility info
    const eligibility = await checkPinPostEligibility(walletAddress, currentPinnedCount);

    res.status(200).json(
      new ApiResponse(200, {
        walletAddress,
        pinnedCount: currentPinnedCount,
        pinLimit: eligibility.limit,
        remaining: eligibility.remaining,
        canPin: eligibility.canPin,
        subscriptionPlan: eligibility.subscriptionPlan,
        message: eligibility.message,
        upgradeMessage: eligibility.upgradeMessage
      }, 'Pin status retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Repost a post
 * Creates a repost entry and increments repostsCount on the original post
 */
const repostPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { walletAddress, quote } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Check if post exists
    const post = await Post.findByPk(postId);
    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Check if user is trying to repost their own post
    if (post.authorWalletAddress === walletAddress) {
      throw new ApiError(400, 'You cannot repost your own post');
    }

    // Check if user has already reposted this post
    const existingRepost = await Repost.findOne({
      where: {
        postId,
        userWalletAddress: walletAddress
      }
    });

    if (existingRepost) {
      throw new ApiError(400, 'You have already reposted this post');
    }

    // Create repost
    const repost = await Repost.create({
      postId,
      userWalletAddress: walletAddress,
      quote: quote || null
    });

    // Increment repostsCount on original post
    await post.increment('repostsCount');

    // Log activity
    logActivity({
      userWalletAddress: walletAddress,
      action: 'repost',
      entityType: 'post',
      entityId: postId,
      metadata: { quote: quote || null }
    });

    // Send notification to the post author
    try {
      await notificationService.createNotification({
        recipientWalletAddress: post.authorWalletAddress,
        senderWalletAddress: walletAddress,
        type: 'repost',
        message: 'reposted your post',
        entityType: 'post',
        entityId: postId
      });
    } catch (err) {
      logger.warn('Failed to create repost notification:', err.message);
    }

    logger.info(`Post ${postId} reposted by ${walletAddress}`);

    res.status(201).json(
      new ApiResponse(201, {
        repost,
        repostsCount: post.repostsCount + 1
      }, 'Post reposted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a repost
 * Deletes the repost entry and decrements repostsCount on the original post
 */
const unrepostPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { walletAddress } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Find the repost
    const repost = await Repost.findOne({
      where: {
        postId,
        userWalletAddress: walletAddress
      }
    });

    if (!repost) {
      throw new ApiError(404, 'Repost not found');
    }

    // Delete repost
    await repost.destroy();

    // Decrement repostsCount on original post
    const post = await Post.findByPk(postId);
    if (post && post.repostsCount > 0) {
      await post.decrement('repostsCount');
    }

    logger.info(`Repost removed for post ${postId} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Repost removed successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get reposts of a post
 * Returns list of users who reposted the post
 */
const getPostReposts = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Check if post exists
    const post = await Post.findByPk(postId);
    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Get reposts with pagination
    const { count, rows: reposts } = await Repost.findAndCountAll({
      where: { postId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get user info for reposters
    const walletAddresses = reposts.map(r => r.userWalletAddress);
    const [users, subscriptionMap] = await Promise.all([
      User.findAll({
        where: { walletAddress: { [Op.in]: walletAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }),
      getActiveSubscriptionsForWallets(walletAddresses)
    ]);

    const userMap = {};
    users.forEach(user => {
      userMap[user.walletAddress] = {
        ...user.toJSON(),
        subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
      };
    });

    // Format reposts with user info
    const formattedReposts = reposts.map(repost => ({
      id: repost.id,
      postId: repost.postId,
      user: userMap[repost.userWalletAddress] || {
        walletAddress: repost.userWalletAddress,
        username: repost.userWalletAddress,
        profileImage: null,
        isVerified: false,
        subscriptionPlan: 'free'
      },
      quote: repost.quote,
      createdAt: repost.createdAt
    }));

    res.status(200).json(
      new ApiResponse(200, {
        reposts: formattedReposts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Reposts retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has reposted a post
 */
const checkRepostStatus = async (req, res, next) => {
  try {
    const { postId } = req.params;
    let { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const repost = await Repost.findOne({
      where: {
        postId,
        userWalletAddress: walletAddress
      }
    });

    res.status(200).json(
      new ApiResponse(200, {
        hasReposted: !!repost,
        repost: repost || null
      }, 'Repost status retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPost,
  getUserPosts,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getPostLikes,
  addComment,
  getPostComments,
  updateComment,
  deleteComment,
  getFollowingPosts,
  recordPostView,
  getPostViews,
  pinPost,
  unpinPost,
  getPinStatus,
  repostPost,
  unrepostPost,
  getPostReposts,
  checkRepostStatus
};
