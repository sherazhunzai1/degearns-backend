const express = require('express');
const router = express.Router();
const {
  createPost,
  getUserPosts,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost
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

module.exports = router;
