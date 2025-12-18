const { Op } = require('sequelize');
const { Post, PostMedia, PostComment, PostLike, User, AdminActivity, sequelize } = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Log admin activity
 */
const logActivity = async (adminWallet, action, targetType, targetId, targetIdentifier, data = {}) => {
  try {
    await AdminActivity.create({
      adminWalletAddress: adminWallet,
      action,
      targetType,
      targetId,
      targetIdentifier,
      previousValue: data.previousValue ? JSON.stringify(data.previousValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      reason: data.reason || null,
      metadata: data.metadata || null
    });
  } catch (error) {
    console.error('Failed to log admin activity:', error);
  }
};

/**
 * Get all posts with filters and pagination
 */
const getPosts = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    postType,
    visibility,
    isActive,
    authorWallet,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};

  if (search) {
    where.content = { [Op.like]: `%${search}%` };
  }

  if (postType) {
    where.postType = postType;
  }

  if (visibility) {
    where.visibility = visibility;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (authorWallet) {
    where.authorWalletAddress = authorWallet;
  }

  // Valid sort fields
  const validSortFields = ['createdAt', 'likesCount', 'commentsCount', 'sharesCount', 'postType'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows: posts } = await Post.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'isBanned']
      },
      {
        model: PostMedia,
        as: 'media',
        attributes: ['id', 'mediaType', 'mediaUrl', 'thumbnailUrl', 'displayOrder']
      }
    ],
    order: [[sortField, order]],
    limit: parseInt(limit),
    offset
  });

  res.status(200).json(new ApiResponse(200, {
    posts,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Posts retrieved successfully'));
};

/**
 * Get post by ID with full details
 */
const getPostById = async (req, res) => {
  const { postId } = req.params;

  const post = await Post.findByPk(postId, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'isBanned']
      },
      {
        model: PostMedia,
        as: 'media'
      },
      {
        model: PostComment,
        as: 'comments',
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['walletAddress', 'username', 'profileImage']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 10
      }
    ]
  });

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Get total comment count
  const totalComments = await PostComment.count({ where: { postId } });

  res.status(200).json(new ApiResponse(200, {
    post: post.toJSON(),
    totalComments
  }, 'Post details retrieved successfully'));
};

/**
 * Hide/Unhide post (soft delete)
 */
const togglePostVisibility = async (req, res) => {
  const { postId } = req.params;
  const { isActive, reason } = req.body;

  const post = await Post.findByPk(postId);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const wasActive = post.isActive;

  await post.update({ isActive });

  // Log activity
  await logActivity(
    req.user.walletAddress,
    isActive ? 'post_hide' : 'post_hide',
    'post',
    post.id,
    `Post by ${post.authorWalletAddress}`,
    {
      previousValue: { isActive: wasActive },
      newValue: { isActive },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    post: post.toJSON()
  }, isActive ? 'Post unhidden successfully' : 'Post hidden successfully'));
};

/**
 * Delete post permanently
 */
const deletePost = async (req, res) => {
  const { postId } = req.params;
  const { reason } = req.body;

  const post = await Post.findByPk(postId, {
    include: [
      { model: PostMedia, as: 'media' }
    ]
  });

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Log activity before deletion
  await logActivity(
    req.user.walletAddress,
    'post_delete',
    'post',
    post.id,
    `Post by ${post.authorWalletAddress}`,
    {
      previousValue: post.toJSON(),
      reason
    }
  );

  // Delete associated data
  await Promise.all([
    PostMedia.destroy({ where: { postId } }),
    PostComment.destroy({ where: { postId } }),
    PostLike.destroy({ where: { postId } })
  ]);

  // Delete the post
  await post.destroy();

  res.status(200).json(new ApiResponse(200, null, 'Post deleted successfully'));
};

/**
 * Get all comments with filters and pagination
 */
const getComments = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    postId,
    authorWallet,
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};

  if (search) {
    where.content = { [Op.like]: `%${search}%` };
  }

  if (postId) {
    where.postId = postId;
  }

  if (authorWallet) {
    where.authorWalletAddress = authorWallet;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  // Valid sort fields
  const validSortFields = ['createdAt', 'likesCount', 'repliesCount'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows: comments } = await PostComment.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'isBanned']
      },
      {
        model: Post,
        as: 'post',
        attributes: ['id', 'content', 'authorWalletAddress']
      }
    ],
    order: [[sortField, order]],
    limit: parseInt(limit),
    offset
  });

  res.status(200).json(new ApiResponse(200, {
    comments,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Comments retrieved successfully'));
};

/**
 * Delete comment
 */
const deleteComment = async (req, res) => {
  const { commentId } = req.params;
  const { reason } = req.body;

  const comment = await PostComment.findByPk(commentId, {
    include: [
      {
        model: Post,
        as: 'post',
        attributes: ['id', 'authorWalletAddress']
      }
    ]
  });

  if (!comment) {
    throw new ApiError(404, 'Comment not found');
  }

  // Log activity before deletion
  await logActivity(
    req.user.walletAddress,
    'comment_delete',
    'comment',
    comment.id,
    `Comment by ${comment.authorWalletAddress}`,
    {
      previousValue: comment.toJSON(),
      reason
    }
  );

  // Delete replies to this comment
  await PostComment.destroy({ where: { parentCommentId: commentId } });

  // Update parent post comment count
  if (comment.post) {
    await comment.post.decrement('commentsCount');
  }

  // Delete the comment
  await comment.destroy();

  res.status(200).json(new ApiResponse(200, null, 'Comment deleted successfully'));
};

/**
 * Get post statistics overview
 */
const getPostStatistics = async (req, res) => {
  const [
    totalPosts,
    activePosts,
    hiddenPosts,
    textPosts,
    imagePosts,
    videoPosts,
    mixedPosts,
    totalComments,
    activeComments,
    postsToday,
    postsThisWeek,
    postsThisMonth
  ] = await Promise.all([
    Post.count(),
    Post.count({ where: { isActive: true } }),
    Post.count({ where: { isActive: false } }),
    Post.count({ where: { postType: 'text' } }),
    Post.count({ where: { postType: 'image' } }),
    Post.count({ where: { postType: 'video' } }),
    Post.count({ where: { postType: 'mixed' } }),
    PostComment.count(),
    PostComment.count({ where: { isActive: true } }),
    Post.count({
      where: {
        createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    }),
    Post.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    }),
    Post.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  // Get total likes
  const totalLikes = await Post.sum('likesCount') || 0;

  res.status(200).json(new ApiResponse(200, {
    totalPosts,
    activePosts,
    hiddenPosts,
    postTypeBreakdown: {
      text: textPosts,
      image: imagePosts,
      video: videoPosts,
      mixed: mixedPosts
    },
    totalComments,
    activeComments,
    totalLikes,
    newPosts: {
      today: postsToday,
      thisWeek: postsThisWeek,
      thisMonth: postsThisMonth
    }
  }, 'Post statistics retrieved successfully'));
};

/**
 * Get reported or flagged content (posts with many hides/reports)
 * For now, we show posts with isActive = false as "flagged"
 */
const getFlaggedContent = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: posts } = await Post.findAndCountAll({
    where: { isActive: false },
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'isBanned']
      },
      {
        model: PostMedia,
        as: 'media'
      }
    ],
    order: [['updatedAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.status(200).json(new ApiResponse(200, {
    posts,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Flagged content retrieved successfully'));
};

/**
 * Bulk delete posts
 */
const bulkDeletePosts = async (req, res) => {
  const { postIds, reason } = req.body;

  if (!Array.isArray(postIds) || postIds.length === 0) {
    throw new ApiError(400, 'postIds must be a non-empty array');
  }

  // Log activity
  await logActivity(
    req.user.walletAddress,
    'post_delete',
    'post',
    null,
    `Bulk: ${postIds.length} posts`,
    {
      newValue: { postIds },
      reason
    }
  );

  // Delete associated data
  await Promise.all([
    PostMedia.destroy({ where: { postId: postIds } }),
    PostComment.destroy({ where: { postId: postIds } }),
    PostLike.destroy({ where: { postId: postIds } })
  ]);

  // Delete posts
  const result = await Post.destroy({ where: { id: postIds } });

  res.status(200).json(new ApiResponse(200, {
    deletedCount: result
  }, `${result} posts deleted successfully`));
};

/**
 * Bulk hide posts
 */
const bulkHidePosts = async (req, res) => {
  const { postIds, isActive, reason } = req.body;

  if (!Array.isArray(postIds) || postIds.length === 0) {
    throw new ApiError(400, 'postIds must be a non-empty array');
  }

  const result = await Post.update(
    { isActive },
    { where: { id: postIds } }
  );

  // Log activity
  await logActivity(
    req.user.walletAddress,
    'post_hide',
    'post',
    null,
    `Bulk: ${postIds.length} posts`,
    {
      newValue: { isActive, postIds },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    updatedCount: result[0]
  }, `${result[0]} posts updated successfully`));
};

module.exports = {
  getPosts,
  getPostById,
  togglePostVisibility,
  deletePost,
  getComments,
  deleteComment,
  getPostStatistics,
  getFlaggedContent,
  bulkDeletePosts,
  bulkHidePosts
};
