const express = require('express');
const router = express.Router();
const { getOrCreateUser, getMe, updateProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/v1/auth/wallet
 * @desc    Get or create user by wallet address (XAMAN login)
 * @access  Public
 */
router.post('/wallet', authLimiter, getOrCreateUser);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, getMe);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, updateProfile);

module.exports = router;
