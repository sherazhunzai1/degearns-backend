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
  updateComment,
  deleteComment
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
 * @route   GET /api/v1/posts/user/:walletAddress
 * @desc    Get all posts by a specific user
 * @access  Public
 */
router.get('/user/:walletAddress', getUserPosts);

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

// ==================== COMMENT ROUTES ====================

/**
 * @route   POST /api/v1/posts/:postId/comments
 * @desc    Add a comment to a post
 * @access  Public
 */
router.post('/:postId/comments', addComment);

/**
 * @route   GET /api/v1/posts/:postId/comments
 * @desc    Get all comments for a post
 * @access  Public
 */
router.get('/:postId/comments', getPostComments);

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

module.exports = router;
