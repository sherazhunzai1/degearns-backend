const express = require('express');
const router = express.Router();
const {
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
  getCommentReplies,
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
} = require('../controllers/postController');

/**
 * @route   POST /api/v1/posts
 * @desc    Create a new post (text, images, videos, or any combination)
 * @access  Public
 */
router.post('/', createPost);

/**
 * @route   GET /api/v1/posts/feed
 * @desc    Get all public posts (feed) sorted by most recent
 * @access  Public
 */
router.get('/feed', getAllPosts);

/**
 * @route   GET /api/v1/posts/following/:walletAddress
 * @desc    Get posts from users that the logged-in user follows
 * @access  Public
 */
router.get('/following/:walletAddress', getFollowingPosts);

/**
 * @route   GET /api/v1/posts/user/:walletAddress
 * @desc    Get all posts by a specific user (pinned posts first)
 * @access  Public
 */
router.get('/user/:walletAddress', getUserPosts);

/**
 * @route   GET /api/v1/posts/pin-status/:walletAddress
 * @desc    Get user's pin status (count, limit, remaining)
 * @access  Public
 */
router.get('/pin-status/:walletAddress', getPinStatus);

/**
 * @route   GET /api/v1/posts/:postId
 * @desc    Get a single post by ID
 * @access  Public
 */
router.get('/:postId', getPostById);

/**
 * @route   PUT /api/v1/posts/:postId
 * @desc    Update a post (only by author)
 * @access  Public
 */
router.put('/:postId', updatePost);

/**
 * @route   DELETE /api/v1/posts/:postId
 * @desc    Delete a post (only by author)
 * @access  Public
 */
router.delete('/:postId', deletePost);

// ==================== LIKE ROUTES ====================

/**
 * @route   POST /api/v1/posts/:postId/like
 * @desc    Like a post
 * @access  Public
 */
router.post('/:postId/like', likePost);

/**
 * @route   DELETE /api/v1/posts/:postId/like
 * @desc    Unlike a post
 * @access  Public
 */
router.delete('/:postId/like', unlikePost);

/**
 * @route   GET /api/v1/posts/:postId/likes
 * @desc    Get all users who liked a post
 * @access  Public
 */
router.get('/:postId/likes', getPostLikes);

// ==================== VIEW ROUTES ====================

/**
 * @route   POST /api/v1/posts/:postId/view
 * @desc    Record a view for a post (unique per user)
 * @access  Public
 */
router.post('/:postId/view', recordPostView);

/**
 * @route   GET /api/v1/posts/:postId/views
 * @desc    Get all users who viewed a post
 * @access  Public
 */
router.get('/:postId/views', getPostViews);

// ==================== PIN ROUTES ====================

/**
 * @route   POST /api/v1/posts/:postId/pin
 * @desc    Pin a post to user's timeline (limited by subscription)
 * @access  Public
 */
router.post('/:postId/pin', pinPost);

/**
 * @route   DELETE /api/v1/posts/:postId/pin
 * @desc    Unpin a post from user's timeline
 * @access  Public
 */
router.delete('/:postId/pin', unpinPost);

// ==================== COMMENT ROUTES ====================

/**
 * @route   POST /api/v1/posts/:postId/comments
 * @desc    Add a comment to a post
 * @access  Public
 */
router.post('/:postId/comments', addComment);

/**
 * @route   GET /api/v1/posts/:postId/comments
 * @desc    Get comments for a post (top-level by default; pass ?parentCommentId= for
 *          a thread's replies, or ?includeReplies=true&repliesLimit=2 to inline a
 *          preview of each top-level comment's latest replies)
 * @access  Public
 */
router.get('/:postId/comments', getPostComments);

/**
 * @route   GET /api/v1/posts/comments/:commentId/replies
 * @desc    Get all replies for a comment thread (flat, with @mention info)
 * @access  Public
 */
router.get('/comments/:commentId/replies', getCommentReplies);

/**
 * @route   PUT /api/v1/posts/comments/:commentId
 * @desc    Update a comment (only by author)
 * @access  Public
 */
router.put('/comments/:commentId', updateComment);

/**
 * @route   DELETE /api/v1/posts/comments/:commentId
 * @desc    Delete a comment (only by author)
 * @access  Public
 */
router.delete('/comments/:commentId', deleteComment);

// ==================== REPOST ROUTES ====================

/**
 * @route   POST /api/v1/posts/:postId/repost
 * @desc    Repost a post to user's timeline
 * @access  Public
 */
router.post('/:postId/repost', repostPost);

/**
 * @route   DELETE /api/v1/posts/:postId/repost
 * @desc    Remove a repost from user's timeline
 * @access  Public
 */
router.delete('/:postId/repost', unrepostPost);

/**
 * @route   GET /api/v1/posts/:postId/reposts
 * @desc    Get all users who reposted a post
 * @access  Public
 */
router.get('/:postId/reposts', getPostReposts);

/**
 * @route   GET /api/v1/posts/:postId/repost-status
 * @desc    Check if user has reposted a post
 * @access  Public
 */
router.get('/:postId/repost-status', checkRepostStatus);

module.exports = router;
