const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateProfile,
  toggleFollow,
  getFavorites,
  toggleFavorite,
  searchUsers
} = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validate, userValidation } = require('../utils/validators');

/**
 * @route   GET /api/v1/users/search
 * @desc    Search users
 * @access  Public
 */
router.get('/search', searchUsers);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user profile by ID
 * @access  Public
 */
router.get('/:id', getUserProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, validate(userValidation.updateProfile), updateProfile);

/**
 * @route   POST /api/v1/users/:id/follow
 * @desc    Follow/Unfollow user
 * @access  Private
 */
router.post('/:id/follow', authenticate, toggleFollow);

/**
 * @route   GET /api/v1/users/favorites
 * @desc    Get user's favorites
 * @access  Private
 */
router.get('/favorites', authenticate, getFavorites);

/**
 * @route   POST /api/v1/users/favorites/:nftId
 * @desc    Add/Remove NFT from favorites
 * @access  Private
 */
router.post('/favorites/:nftId', authenticate, toggleFavorite);

module.exports = router;
