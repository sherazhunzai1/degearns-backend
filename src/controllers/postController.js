const { User, Post, PostMedia, PostLike, PostComment } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

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

  return comments.map(comment => {
    const author = authorMap[comment.authorWalletAddress];
    return {
      id: comment.id,
      authorWalletAddress: comment.authorWalletAddress,
      author: author ? {
        walletAddress: author.walletAddress,
        username: author.username,
        profileImage: author.profileImage,
        isVerified: author.isVerified
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
const formatPostWithEngagement = async (post, author, userWalletAddress = null, includeRecentComments = true) => {
  const isLiked = await checkUserLiked(post.id, userWalletAddress);
  const recentComments = includeRecentComments ? await getRecentComments(post.id, 3) : [];

  return {
    id: post.id,
    authorWalletAddress: post.authorWalletAddress,
    author: author ? {
      walletAddress: author.walletAddress,
      username: author.username,
      profileImage: author.profileImage,
      isVerified: author.isVerified,
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
    const {
      authorWalletAddress,
      content,
      media,
      visibility = 'public',
      metadata
    } = req.body;

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

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
    let mediaItems = [];
    if (media && media.length > 0) {
      mediaItems = await Promise.all(media.map(async (item, index) => {
        return await PostMedia.create({
          postId: post.id,
          mediaType: item.mediaType,
          mediaUrl: item.mediaUrl,
          thumbnailUrl: item.thumbnailUrl || null,
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

    logger.info(`New post created by ${authorWalletAddress}, type: ${postType}`);

    const formattedPost = await formatPostWithEngagement(post, author, authorWalletAddress, false);

    res.status(201).json(
      new ApiResponse(201, { post: formattedPost }, 'Post created successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get posts by wallet address (user's posts)
 * Supports pagination
 */
const getUserPosts = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { page = 1, limit = 20, viewerWalletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get posts with pagination
    const { count, rows: posts } = await Post.findAndCountAll({
      where: {
        authorWalletAddress: walletAddress,
        isActive: true
      },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
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
      where: { walletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    // Format posts with engagement data
    const formattedPosts = await Promise.all(
      posts.map(post => formatPostWithEngagement(post, author, viewerWalletAddress))
    );

    logger.info(`Posts fetched for wallet: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        posts: formattedPosts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Posts retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all posts (feed)
 * Returns all public posts sorted by most recent
 * Supports pagination
 */
const getAllPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, postType, viewerWalletAddress } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {
      isActive: true,
      visibility: 'public'
    };

    // Filter by post type if specified
    if (postType && ['text', 'image', 'video', 'mixed'].includes(postType)) {
      whereClause.postType = postType;
    }

    // Get posts with pagination
    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: PostMedia,
          as: 'media',
          order: [['displayOrder', 'ASC']]
        }
      ]
    });

    // Get author wallet addresses
    const authorAddresses = [...new Set(posts.map(p => p.authorWalletAddress))];

    // Get author details
    const authors = await User.findAll({
      where: {
        walletAddress: {
          [Op.in]: authorAddresses
        }
      },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    // Create author map
    const authorMap = {};
    authors.forEach(author => {
      authorMap[author.walletAddress] = author;
    });

    // Format posts with engagement data
    const formattedPosts = await Promise.all(
      posts.map(post => {
        const author = authorMap[post.authorWalletAddress];
        return formatPostWithEngagement(post, author, viewerWalletAddress);
      })
    );

    logger.info(`All posts fetched, page: ${page}`);

    res.status(200).json(
      new ApiResponse(200, {
        posts: formattedPosts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
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

    logger.info(`Post fetched: ${postId}`);

    const formattedPost = await formatPostWithEngagement(post, author, viewerWalletAddress);

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

      // Create new media attachments
      if (media && media.length > 0) {
        await Promise.all(media.map(async (item, index) => {
          return await PostMedia.create({
            postId: post.id,
            mediaType: item.mediaType,
            mediaUrl: item.mediaUrl,
            thumbnailUrl: item.thumbnailUrl || null,
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

    logger.info(`Post updated: ${postId} by ${authorWalletAddress}`);

    const formattedPost = await formatPostWithEngagement(updatedPost, author, authorWalletAddress);

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
    const { authorWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

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
    const { userWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!userWalletAddress) {
      throw new ApiError(400, 'User wallet address is required');
    }

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
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
    const { userWalletAddress } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!userWalletAddress) {
      throw new ApiError(400, 'User wallet address is required');
    }

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

    const formattedLikes = likes.map(like => {
      const user = userMap[like.userWalletAddress];
      return {
        userWalletAddress: like.userWalletAddress,
        user: user ? {
          walletAddress: user.walletAddress,
          username: user.username,
          profileImage: user.profileImage,
          isVerified: user.isVerified
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
    const { authorWalletAddress, content, parentCommentId } = req.body;

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

    if (!content || content.trim() === '') {
      throw new ApiError(400, 'Comment content is required');
    }

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
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
    }

    await post.reload();

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
            isVerified: author.isVerified
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
          isVerified: author.isVerified
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
    const { authorWalletAddress, content } = req.body;

    if (!commentId) {
      throw new ApiError(400, 'Comment ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

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
            isVerified: author.isVerified
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
    const { authorWalletAddress } = req.body;

    if (!commentId) {
      throw new ApiError(400, 'Comment ID is required');
    }

    if (!authorWalletAddress) {
      throw new ApiError(400, 'Author wallet address is required');
    }

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
  deleteComment
};
