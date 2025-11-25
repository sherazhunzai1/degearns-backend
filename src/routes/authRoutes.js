const express = require('express');
const router = express.Router();
const { getOrCreateUser, getMe } = require('../controllers/authController');
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

module.exports = router;
