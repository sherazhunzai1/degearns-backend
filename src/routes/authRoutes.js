const express = require('express');
const router = express.Router();
const {
  getOrCreateUser,
  getMe,
  updateProfile,
  updateProfilePicture,
  updateCoverPicture
} = require('../controllers/authController');
// const { authLimiter } = require('../middleware/rateLimiter'); // Rate limiting disabled

/**
 * @route   POST /api/v1/auth/wallet
 * @desc    Get or create user by wallet address (XAMAN login)
 * @access  Public
 */
router.post('/wallet', getOrCreateUser);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Public
 */
router.get('/me', getMe);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile (displayName, username, bio, email, social links)
 * @access  Public
 */
router.put('/profile', updateProfile);

/**
 * @route   PUT /api/v1/auth/profile-picture
 * @desc    Update user profile picture
 * @access  Public
 */
router.put('/profile-picture', updateProfilePicture);

/**
 * @route   PUT /api/v1/auth/cover-picture
 * @desc    Update user cover picture
 * @access  Public
 */
router.put('/cover-picture', updateCoverPicture);

module.exports = router;
