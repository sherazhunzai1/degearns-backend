const { User, Post, PostMedia } = require('../models');
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

    logger.info(`New post created by ${authorWalletAddress}, type: ${postType}`);

    res.status(201).json(
      new ApiResponse(201, {
        post: {
          id: post.id,
          authorWalletAddress: post.authorWalletAddress,
          author: {
            walletAddress: author.walletAddress,
            username: author.username,
            profileImage: author.profileImage,
            isVerified: author.isVerified
          },
          content: post.content,
          postType: post.postType,
          visibility: post.visibility,
          media: mediaItems.map(m => ({
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
          })),
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          sharesCount: post.sharesCount,
          metadata: post.metadata,
          createdAt: post.createdAt
        }
      }, 'Post created successfully')
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
    const { page = 1, limit = 20 } = req.query;

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

    // Format posts
    const formattedPosts = posts.map(post => ({
      id: post.id,
      authorWalletAddress: post.authorWalletAddress,
      author: author ? {
        walletAddress: author.walletAddress,
        username: author.username,
        profileImage: author.profileImage,
        isVerified: author.isVerified
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
      metadata: post.metadata,
      createdAt: post.createdAt
    }));

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
    const { page = 1, limit = 20, postType } = req.query;

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

    // Format posts
    const formattedPosts = posts.map(post => {
      const author = authorMap[post.authorWalletAddress];
      return {
        id: post.id,
        authorWalletAddress: post.authorWalletAddress,
        author: author ? {
          walletAddress: author.walletAddress,
          username: author.username,
          profileImage: author.profileImage,
          isVerified: author.isVerified
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
        metadata: post.metadata,
        createdAt: post.createdAt
      };
    });

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

    res.status(200).json(
      new ApiResponse(200, {
        post: {
          id: post.id,
          authorWalletAddress: post.authorWalletAddress,
          author: author ? {
            walletAddress: author.walletAddress,
            username: author.username,
            profileImage: author.profileImage,
            isVerified: author.isVerified,
            bio: author.bio
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
          metadata: post.metadata,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt
        }
      }, 'Post retrieved successfully')
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

    res.status(200).json(
      new ApiResponse(200, {
        post: {
          id: updatedPost.id,
          authorWalletAddress: updatedPost.authorWalletAddress,
          author: author ? {
            walletAddress: author.walletAddress,
            username: author.username,
            profileImage: author.profileImage,
            isVerified: author.isVerified
          } : null,
          content: updatedPost.content,
          postType: updatedPost.postType,
          visibility: updatedPost.visibility,
          media: updatedPost.media ? updatedPost.media.map(m => ({
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
          likesCount: updatedPost.likesCount,
          commentsCount: updatedPost.commentsCount,
          sharesCount: updatedPost.sharesCount,
          metadata: updatedPost.metadata,
          createdAt: updatedPost.createdAt,
          updatedAt: updatedPost.updatedAt
        }
      }, 'Post updated successfully')
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

module.exports = {
  createPost,
  getUserPosts,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost
};
