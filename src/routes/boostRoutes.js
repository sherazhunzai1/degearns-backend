/**
 * Boost Routes
 *
 * API endpoints for boost-related operations:
 * - GET /boost/status/:walletAddress - Get user's boost status
 * - POST /boost/calculate - Calculate boost score for content
 * - POST /boost/preview - Preview boost with different tiers
 * - GET /boost/leaderboard - Get top boosted users
 */

const express = require('express');
const router = express.Router();
const boostController = require('../controllers/boostController');

/**
 * @route GET /api/v1/boost/status/:walletAddress
 * @desc Get user's current boost status
 * @access Public
 */
router.get('/status/:walletAddress', boostController.getUserBoostStatus);

/**
 * @route POST /api/v1/boost/calculate
 * @desc Calculate boost score for content
 * @access Public
 * @body {string} walletAddress - Content owner's wallet address (required)
 * @body {string} createdAt - Content creation date (optional, defaults to now)
 * @body {number} likesCount - Number of likes (optional)
 * @body {number} commentsCount - Number of comments (optional)
 * @body {number} sharesCount - Number of shares (optional)
 * @body {number} viewsCount - Number of views (optional)
 */
router.post('/calculate', boostController.calculateBoostScore);

/**
 * @route POST /api/v1/boost/preview
 * @desc Preview boost scores with different subscription tiers
 * @access Public
 * @body {string} createdAt - Content creation date (optional)
 * @body {number} likesCount - Number of likes (optional)
 * @body {number} commentsCount - Number of comments (optional)
 * @body {number} sharesCount - Number of shares (optional)
 * @body {number} viewsCount - Number of views (optional)
 */
router.post('/preview', boostController.previewBoostTiers);

/**
 * @route GET /api/v1/boost/leaderboard
 * @desc Get top boosted users (by subscription tier)
 * @access Public
 * @query {number} limit - Number of users to return (default: 10)
 */
router.get('/leaderboard', boostController.getBoostLeaderboard);

module.exports = router;
