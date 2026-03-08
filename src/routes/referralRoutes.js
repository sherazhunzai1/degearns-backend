const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getTransactionHistory,
  getLeaderboard,
  claimRewards,
  getClaimHistory,
  getAuditLog,
  freezeUserRewards,
  unfreezeUserRewards
} = require('../controllers/referralController');
const { adminAuthenticate } = require('../middleware/adminAuth');

/**
 * @route   GET /api/v1/referrals/dashboard
 * @desc    Get referral dashboard (stats, earnings, transactions)
 * @access  Public
 */
router.get('/dashboard', getDashboard);

/**
 * @route   GET /api/v1/referrals/transactions
 * @desc    Get detailed transaction history with transparency info
 * @access  Public
 */
router.get('/transactions', getTransactionHistory);

/**
 * @route   GET /api/v1/referrals/leaderboard
 * @desc    Get referral leaderboard (all referrers ranked)
 * @access  Public
 */
router.get('/leaderboard', getLeaderboard);

/**
 * @route   POST /api/v1/referrals/claim
 * @desc    Claim all claimable referral rewards
 * @access  Public
 */
router.post('/claim', claimRewards);

/**
 * @route   GET /api/v1/referrals/claims
 * @desc    Get claim/payout history
 * @access  Public
 */
router.get('/claims', getClaimHistory);

/**
 * @route   GET /api/v1/referrals/audit-log
 * @desc    Get referral audit log
 * @access  Public
 */
router.get('/audit-log', getAuditLog);

/**
 * @route   POST /api/v1/referrals/freeze
 * @desc    Freeze rewards for a user (anti-abuse, admin only)
 * @access  Admin
 */
router.post('/freeze', adminAuthenticate, freezeUserRewards);

/**
 * @route   POST /api/v1/referrals/unfreeze
 * @desc    Unfreeze rewards for a user (admin only)
 * @access  Admin
 */
router.post('/unfreeze', adminAuthenticate, unfreezeUserRewards);

module.exports = router;
