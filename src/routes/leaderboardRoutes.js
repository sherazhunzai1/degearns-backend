/**
 * Leaderboard Routes
 *
 * Public and authenticated endpoints for leaderboard and scoring
 * All endpoints support monthly-based rankings via month/year query params
 */

const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const { optionalAuth, authenticate } = require('../middleware/auth');

// ===== PUBLIC ROUTES =====

/**
 * GET /leaderboard/plans
 * Get available subscription plans and their boost multipliers
 */
router.get('/plans', leaderboardController.getSubscriptionPlans);

/**
 * GET /leaderboard/periods
 * Get available periods (months) for historical leaderboard data
 */
router.get('/periods', leaderboardController.getAvailablePeriods);

/**
 * GET /leaderboard/stats
 * Get overall leaderboard statistics
 * Query params: month, year
 */
router.get('/stats', leaderboardController.getLeaderboardStats);

/**
 * GET /leaderboard/:type
 * Get leaderboard for a category (traders, creators, influencers)
 * Query params: page, limit, month, year
 */
router.get('/:type(traders|creators|influencers)', leaderboardController.getLeaderboard);

/**
 * GET /leaderboard/user/:walletAddress
 * Get detailed stats for a specific user
 * Query params: month, year
 */
router.get('/user/:walletAddress', leaderboardController.getUserStats);

/**
 * GET /leaderboard/user/:walletAddress/ranks
 * Get user's rank in each category
 * Query params: month, year
 */
router.get('/user/:walletAddress/ranks', leaderboardController.getUserRanks);

/**
 * GET /leaderboard/user/:walletAddress/badges
 * Get user's badge info for profile display (rank, score, badge tier per category)
 * Query params: month, year
 */
router.get('/user/:walletAddress/badges', leaderboardController.getUserBadges);

/**
 * GET /leaderboard/compare/:walletAddress1/:walletAddress2
 * Compare two users' stats
 * Query params: month, year
 */
router.get('/compare/:walletAddress1/:walletAddress2', leaderboardController.compareUsers);

// ===== AUTHENTICATED ROUTES =====

/**
 * GET /leaderboard/subscription
 * Get authenticated user's active subscription
 */
router.get('/subscription', authenticate, leaderboardController.getMySubscription);

/**
 * POST /leaderboard/recalculate
 * Trigger score recalculation for authenticated user
 * Query params: month, year (optional, defaults to current month)
 */
router.post('/recalculate', authenticate, leaderboardController.recalculateMyScores);

module.exports = router;
