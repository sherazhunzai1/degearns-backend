const express = require('express');
const router = express.Router();

// NOTE: Authentication temporarily disabled for development
// TODO: Re-enable authentication before production deployment
// const { adminAuthenticate, superAdminAuthenticate } = require('../middleware/adminAuth');

const {
  adminUserController,
  adminDropController,
  adminCollectionController,
  adminPostController,
  adminDashboardController,
  adminSettingsController,
  adminFeeController,
  adminRewardsController,
  adminBannerController
} = require('../controllers/admin');
const adminScoringController = require('../controllers/admin/adminScoringController');

const withdrawalController = require('../controllers/withdrawalController');

const xrplConfig = require('../config/xrpl');
const xrplService = require('../services/xrplService');

// ============================================
// DEBUG / DIAGNOSTIC ROUTES
// ============================================

// GET /admin/debug/platform-wallet - Debug platform wallet configuration
router.get('/debug/platform-wallet', async (req, res) => {
  try {
    const hasSeed = !!process.env.ADMIN_WALLET_SEED;
    const hasSecretNumbers = !!process.env.ADMIN_WALLET_SECRET_NUMBERS;
    const secretNumbersLength = process.env.ADMIN_WALLET_SECRET_NUMBERS
      ? process.env.ADMIN_WALLET_SECRET_NUMBERS.split(',').length
      : 0;
    const configuredAlgorithm = process.env.ADMIN_WALLET_ALGORITHM || (hasSecretNumbers ? 'secp256k1' : 'auto');

    let walletAddress = null;
    let walletError = null;
    let balance = null;
    let balanceXrp = null;
    let balanceError = null;

    try {
      const wallet = xrplConfig.getAdminWallet();
      walletAddress = wallet?.address;
    } catch (e) {
      walletError = e.message;
    }

    // Get addresses for both algorithms (for debugging)
    const bothAlgorithms = xrplConfig.getWalletAddressesForBothAlgorithms();

    // Fetch balance if wallet address is available
    if (walletAddress) {
      try {
        const accountInfo = await xrplService.getAccountInfo(walletAddress);
        if (accountInfo && accountInfo.result && accountInfo.result.account_data) {
          balance = accountInfo.result.account_data.Balance;
          balanceXrp = (parseInt(balance) / 1000000).toFixed(6);
        }
      } catch (e) {
        balanceError = e.message;
      }
    }

    res.json({
      success: true,
      data: {
        configuration: {
          ADMIN_WALLET_SEED_SET: hasSeed,
          ADMIN_WALLET_SECRET_NUMBERS_SET: hasSecretNumbers,
          SECRET_NUMBERS_GROUPS_COUNT: secretNumbersLength,
          ADMIN_WALLET_ALGORITHM: configuredAlgorithm,
          ACTIVE_METHOD: hasSeed ? 'SEED (takes priority)' : (hasSecretNumbers ? 'SECRET_NUMBERS' : 'NONE')
        },
        derivedWallet: {
          address: walletAddress,
          algorithm: configuredAlgorithm,
          error: walletError
        },
        bothAlgorithms: bothAlgorithms,
        balance: {
          drops: balance,
          xrp: balanceXrp,
          error: balanceError
        },
        hint: bothAlgorithms && !bothAlgorithms.error
          ? `If your wallet is not "${walletAddress}", check bothAlgorithms above. Set ADMIN_WALLET_ALGORITHM=secp256k1 or ADMIN_WALLET_ALGORITHM=ed25519 in .env`
          : (hasSeed && hasSecretNumbers ? 'Both SEED and SECRET_NUMBERS are set. SEED takes priority!' : null)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// DASHBOARD & ANALYTICS ROUTES
// ============================================

// GET /admin/dashboard - Get overall platform dashboard
router.get('/dashboard', adminDashboardController.getDashboardOverview);

// GET /admin/dashboard/growth - Get growth analytics
router.get('/dashboard/growth', adminDashboardController.getGrowthAnalytics);

// GET /admin/dashboard/top-creators - Get top creators
router.get('/dashboard/top-creators', adminDashboardController.getTopCreators);

// GET /admin/dashboard/activities - Get recent admin activities
router.get('/dashboard/activities', adminDashboardController.getRecentActivities);

// GET /admin/dashboard/health - Get platform health metrics
router.get('/dashboard/health', adminDashboardController.getPlatformHealth);

// GET /admin/dashboard/revenue - Get revenue breakdown
router.get('/dashboard/revenue', adminDashboardController.getRevenueBreakdown);

// ============================================
// USER MANAGEMENT ROUTES
// ============================================

// GET /admin/users - Get all users with filters
router.get('/users', adminUserController.getUsers);

// GET /admin/users/statistics - Get user statistics
router.get('/users/statistics', adminUserController.getUserStatistics);

// POST /admin/users/bulk-verify - Bulk verify/unverify users
router.post('/users/bulk-verify', adminUserController.bulkUpdateVerification);

// GET /admin/users/:walletAddress - Get user by wallet
router.get('/users/:walletAddress', adminUserController.getUserByWallet);

// PUT /admin/users/:walletAddress/role - Update user role
router.put('/users/:walletAddress/role', adminUserController.updateUserRole);

// PUT /admin/users/:walletAddress/verify - Verify/unverify user
router.put('/users/:walletAddress/verify', adminUserController.updateUserVerification);

// PUT /admin/users/:walletAddress/ban - Ban user
router.put('/users/:walletAddress/ban', adminUserController.banUser);

// PUT /admin/users/:walletAddress/unban - Unban user
router.put('/users/:walletAddress/unban', adminUserController.unbanUser);

// DELETE /admin/users/:walletAddress - Delete user
router.delete('/users/:walletAddress', adminUserController.deleteUser);

// ============================================
// DROP MANAGEMENT ROUTES
// ============================================

// GET /admin/drops - Get all drops with filters
router.get('/drops', adminDropController.getDrops);

// GET /admin/drops/statistics - Get drop statistics
router.get('/drops/statistics', adminDropController.getDropStatistics);

// GET /admin/drops/pending-fees - Get drops with pending fees
router.get('/drops/pending-fees', adminDropController.getDropsWithPendingFees);

// GET /admin/drops/:dropId - Get drop by ID
router.get('/drops/:dropId', adminDropController.getDropById);

// PUT /admin/drops/:dropId - Update drop
router.put('/drops/:dropId', adminDropController.updateDrop);

// PUT /admin/drops/:dropId/status - Update drop status
router.put('/drops/:dropId/status', adminDropController.updateDropStatus);

// PUT /admin/drops/:dropId/pause - Pause drop
router.put('/drops/:dropId/pause', adminDropController.pauseDrop);

// PUT /admin/drops/:dropId/resume - Resume drop
router.put('/drops/:dropId/resume', adminDropController.resumeDrop);

// PUT /admin/drops/:dropId/fees-status - Update platform fees status
router.put('/drops/:dropId/fees-status', adminDropController.updateDropFeesStatus);

// DELETE /admin/drops/:dropId - Delete drop
router.delete('/drops/:dropId', adminDropController.deleteDrop);

// GET /admin/drops/:dropId/mints - Get drop mints
router.get('/drops/:dropId/mints', adminDropController.getDropMints);

// GET /admin/drops/:dropId/allowlist - Get drop allowlist
router.get('/drops/:dropId/allowlist', adminDropController.getDropAllowlist);

// ============================================
// COLLECTION MANAGEMENT ROUTES
// ============================================

// GET /admin/collections - Get all collections with filters
router.get('/collections', adminCollectionController.getCollections);

// GET /admin/collections/statistics - Get collection statistics
router.get('/collections/statistics', adminCollectionController.getCollectionStatistics);

// GET /admin/collections/pending-verification - Get pending verification collections
router.get('/collections/pending-verification', adminCollectionController.getPendingVerificationCollections);

// POST /admin/collections/bulk-verify - Bulk verify collections
router.post('/collections/bulk-verify', adminCollectionController.bulkVerifyCollections);

// GET /admin/collections/:collectionId - Get collection by ID
router.get('/collections/:collectionId', adminCollectionController.getCollectionById);

// PUT /admin/collections/:collectionId - Update collection
router.put('/collections/:collectionId', adminCollectionController.updateCollection);

// PUT /admin/collections/:collectionId/verify - Verify/unverify collection
router.put('/collections/:collectionId/verify', adminCollectionController.updateCollectionVerification);

// DELETE /admin/collections/:collectionId - Delete collection
router.delete('/collections/:collectionId', adminCollectionController.deleteCollection);

// ============================================
// POST MODERATION ROUTES
// ============================================

// GET /admin/posts - Get all posts with filters
router.get('/posts', adminPostController.getPosts);

// GET /admin/posts/statistics - Get post statistics
router.get('/posts/statistics', adminPostController.getPostStatistics);

// GET /admin/posts/flagged - Get flagged/hidden content
router.get('/posts/flagged', adminPostController.getFlaggedContent);

// POST /admin/posts/bulk-delete - Bulk delete posts
router.post('/posts/bulk-delete', adminPostController.bulkDeletePosts);

// POST /admin/posts/bulk-hide - Bulk hide/unhide posts
router.post('/posts/bulk-hide', adminPostController.bulkHidePosts);

// GET /admin/posts/:postId - Get post by ID
router.get('/posts/:postId', adminPostController.getPostById);

// PUT /admin/posts/:postId/visibility - Toggle post visibility
router.put('/posts/:postId/visibility', adminPostController.togglePostVisibility);

// DELETE /admin/posts/:postId - Delete post
router.delete('/posts/:postId', adminPostController.deletePost);

// GET /admin/comments - Get all comments with filters
router.get('/comments', adminPostController.getComments);

// DELETE /admin/comments/:commentId - Delete comment
router.delete('/comments/:commentId', adminPostController.deleteComment);

// ============================================
// PLATFORM SETTINGS ROUTES
// ============================================

// POST /admin/settings/initialize - Initialize default settings
router.post('/settings/initialize', adminSettingsController.initializeSettings);

// GET /admin/settings - Get all settings
router.get('/settings', adminSettingsController.getAllSettings);

// GET /admin/settings/public - Get public settings (for frontend)
router.get('/settings/public', adminSettingsController.getPublicSettings);

// POST /admin/settings - Create new setting
router.post('/settings', adminSettingsController.createSetting);

// PUT /admin/settings/bulk - Bulk update settings
router.put('/settings/bulk', adminSettingsController.bulkUpdateSettings);

// GET /admin/settings/:key - Get setting by key
router.get('/settings/:key', adminSettingsController.getSettingByKey);

// PUT /admin/settings/:key - Update setting
router.put('/settings/:key', adminSettingsController.updateSetting);

// PUT /admin/settings/:key/reset - Reset setting to default
router.put('/settings/:key/reset', adminSettingsController.resetSettingToDefault);

// DELETE /admin/settings/:key - Delete setting
router.delete('/settings/:key', adminSettingsController.deleteSetting);

// ============================================
// FEE MANAGEMENT ROUTES
// ============================================

// GET /admin/fees - Get fees overview
router.get('/fees', adminFeeController.getFeesOverview);

// GET /admin/fees/transactions - Get fee transactions
router.get('/fees/transactions', adminFeeController.getFeeTransactions);

// GET /admin/fees/statistics - Get fee statistics
router.get('/fees/statistics', adminFeeController.getFeeStatistics);

// GET /admin/fees/pending - Get pending fees
router.get('/fees/pending', adminFeeController.getPendingFees);

// GET /admin/fees/failed - Get failed fees
router.get('/fees/failed', adminFeeController.getFailedFees);

// GET /admin/fees/export - Export fee report
router.get('/fees/export', adminFeeController.exportFeeReport);

// PUT /admin/fees/:dropId/mark-paid - Mark fees as paid
router.put('/fees/:dropId/mark-paid', adminFeeController.markFeesAsPaid);

// PUT /admin/fees/:dropId/mark-refunded - Mark fees as refunded
router.put('/fees/:dropId/mark-refunded', adminFeeController.markFeesAsRefunded);

// ============================================
// REWARDS & TOP PERFORMERS ROUTES
// ============================================

// GET /admin/rewards/top-performers - Get all top performers (traders, creators, influencers)
router.get('/rewards/top-performers', adminRewardsController.getAllTopPerformers);

// GET /admin/rewards/top-traders - Get top 10 traders
router.get('/rewards/top-traders', adminRewardsController.getTopTraders);

// GET /admin/rewards/top-creators - Get top 10 creators
router.get('/rewards/top-creators', adminRewardsController.getTopCreators);

// GET /admin/rewards/top-influencers - Get top 10 influencers
router.get('/rewards/top-influencers', adminRewardsController.getTopInfluencers);

// GET /admin/rewards/config - Get reward configuration
router.get('/rewards/config', adminRewardsController.getRewardConfig);

// POST /admin/rewards/distribute - Distribute rewards to top performers
router.post('/rewards/distribute', adminRewardsController.distributeRewards);

// GET /admin/rewards/history - Get reward distribution history
router.get('/rewards/history', adminRewardsController.getRewardHistory);

// GET /admin/rewards/summary - Get reward summary by period
router.get('/rewards/summary', adminRewardsController.getRewardSummary);

// ============================================
// ADMIN WALLET MANAGEMENT ROUTES
// ============================================

// GET /admin/wallets - Get all admin wallets
router.get('/wallets', adminRewardsController.getAllAdminWallets);

// GET /admin/wallets/platform-fees - Get platform fees wallet
router.get('/wallets/platform-fees', adminRewardsController.getPlatformFeesWallet);

// PUT /admin/wallets/platform-fees - Update platform fees wallet
router.put('/wallets/platform-fees', adminRewardsController.updatePlatformFeesWallet);

// POST /admin/wallets - Create or update admin wallet
router.post('/wallets', adminRewardsController.upsertAdminWallet);

// DELETE /admin/wallets/:walletId - Delete admin wallet
router.delete('/wallets/:walletId', adminRewardsController.deleteAdminWallet);

// ============================================
// TREASURY WALLET MANAGEMENT ROUTES
// ============================================

// GET /admin/treasury - Get treasury wallet details with balance and statistics
router.get('/treasury', adminRewardsController.getTreasuryWallet);

// GET /admin/treasury/statistics - Get detailed treasury wallet statistics
router.get('/treasury/statistics', adminRewardsController.getTreasuryWalletStatistics);

// GET /admin/treasury/history - Get treasury distribution history
router.get('/treasury/history', adminRewardsController.getTreasuryDistributionHistory);

// GET /admin/treasury/debug - Debug treasury wallet configuration
router.get('/treasury/debug', adminRewardsController.debugTreasuryWallet);

// PUT /admin/treasury - Update treasury wallet label/description
router.put('/treasury', adminRewardsController.updateTreasuryWallet);

// ============================================
// MONTHLY RANKING MANAGEMENT ROUTES
// ============================================

// GET /admin/rankings/formula - Get reward distribution formula
router.get('/rankings/formula', adminRewardsController.getDistributionFormula);

// GET /admin/rankings - Get all rankings for a period
router.get('/rankings', adminRewardsController.getMonthlyRankings);

// POST /admin/rankings - Set/update ranking for a category
router.post('/rankings', adminRewardsController.setMonthlyRanking);

// GET /admin/rankings/:year/:month/:category - Get specific category ranking
router.get('/rankings/:year/:month/:category', adminRewardsController.getCategoryRanking);

// DELETE /admin/rankings/:year/:month/:category - Delete a ranking
router.delete('/rankings/:year/:month/:category', adminRewardsController.deleteMonthlyRanking);

// POST /admin/rankings/finalize - Finalize a category ranking
router.post('/rankings/finalize', adminRewardsController.finalizeRanking);

// POST /admin/rankings/unfinalize - Revert ranking to draft
router.post('/rankings/unfinalize', adminRewardsController.unfinalizeRanking);

// ============================================
// REWARD DISTRIBUTION EXECUTION ROUTES
// ============================================

// GET /admin/distribution/status - Get distribution readiness status
router.get('/distribution/status', adminRewardsController.getDistributionStatus);

// POST /admin/distribution/execute - Execute reward distribution
router.post('/distribution/execute', adminRewardsController.executeDistribution);

// GET /admin/distribution/batch/:batchId - Get distribution batch details
router.get('/distribution/batch/:batchId', adminRewardsController.getDistributionBatch);

// POST /admin/distribution/retry - Retry failed distributions
router.post('/distribution/retry', adminRewardsController.retryFailedDistributions);

// ============================================
// REWARD STATISTICS ROUTES
// ============================================

// GET /admin/rewards/stats - Get comprehensive reward statistics
router.get('/rewards/stats', adminRewardsController.getRewardStats);

// GET /admin/rewards/transactions - Get reward transaction history
router.get('/rewards/transactions', adminRewardsController.getRewardTransactionHistory);

// GET /admin/rewards/monthly-breakdown - Get monthly reward breakdown for charts
router.get('/rewards/monthly-breakdown', adminRewardsController.getMonthlyRewardBreakdown);

// ============================================
// BANNER MANAGEMENT ROUTES
// ============================================

// GET /admin/banners - Get all banners with filters
router.get('/banners', adminBannerController.getBanners);

// GET /admin/banners/statistics - Get banner statistics
router.get('/banners/statistics', adminBannerController.getBannerStatistics);

// POST /admin/banners - Create new banner
router.post('/banners', adminBannerController.createBanner);

// PUT /admin/banners/reorder - Reorder banners
router.put('/banners/reorder', adminBannerController.reorderBanners);

// GET /admin/banners/:bannerId - Get banner by ID
router.get('/banners/:bannerId', adminBannerController.getBannerById);

// PUT /admin/banners/:bannerId - Update banner
router.put('/banners/:bannerId', adminBannerController.updateBanner);

// PUT /admin/banners/:bannerId/toggle - Toggle banner active status
router.put('/banners/:bannerId/toggle', adminBannerController.toggleBannerStatus);

// DELETE /admin/banners/:bannerId - Delete banner
router.delete('/banners/:bannerId', adminBannerController.deleteBanner);

// ============================================
// SCORING & LEADERBOARD MANAGEMENT ROUTES
// ============================================

// POST /admin/scoring/recalculate-all - Trigger full score recalculation
router.post('/scoring/recalculate-all', adminScoringController.recalculateAllScores);

// POST /admin/scoring/recalculate/:walletAddress - Recalculate scores for a specific user
router.post('/scoring/recalculate/:walletAddress', adminScoringController.recalculateUserScores);

// GET /admin/scoring/jobs/status - Get scoring jobs status
router.get('/scoring/jobs/status', adminScoringController.getScoringJobsStatus);

// GET /admin/scoring/config - Get scoring configuration
router.get('/scoring/config', adminScoringController.getScoringConfig);

// GET /admin/scoring/user/:walletAddress - Get detailed user stats with activity log
router.get('/scoring/user/:walletAddress', adminScoringController.getDetailedUserStats);

// ============================================
// SUBSCRIPTION MANAGEMENT ROUTES
// ============================================

// GET /admin/subscriptions - Get all subscriptions
router.get('/subscriptions', adminScoringController.getAllSubscriptions);

// GET /admin/subscriptions/stats - Get subscription statistics
router.get('/subscriptions/stats', adminScoringController.getSubscriptionStats);

// POST /admin/subscriptions - Create subscription for a user
router.post('/subscriptions', adminScoringController.createSubscription);

// POST /admin/subscriptions/:subscriptionId/cancel - Cancel subscription
router.post('/subscriptions/:subscriptionId/cancel', adminScoringController.cancelSubscription);

// POST /admin/subscriptions/:subscriptionId/extend - Extend subscription
router.post('/subscriptions/:subscriptionId/extend', adminScoringController.extendSubscription);

// ============================================
// WITHDRAWAL MANAGEMENT ROUTES
// ============================================

// GET /admin/withdrawals/owners/public - Public endpoint for login allowlist (no auth)
router.get('/withdrawals/owners/public', withdrawalController.getOwnersPublic);

// GET /admin/withdrawals/owners - Get all withdrawal owners
router.get('/withdrawals/owners', withdrawalController.getOwners);

// POST /admin/withdrawals/owners - Create a new withdrawal owner
router.post('/withdrawals/owners', withdrawalController.createOwner);

// PUT /admin/withdrawals/owners/:id - Update a withdrawal owner
router.put('/withdrawals/owners/:id', withdrawalController.updateOwner);

// DELETE /admin/withdrawals/owners/:id - Delete a withdrawal owner
router.delete('/withdrawals/owners/:id', withdrawalController.deleteOwner);

// GET /admin/withdrawals/source-wallets - Get source wallets with balances
router.get('/withdrawals/source-wallets', withdrawalController.getSourceWallets);

// GET /admin/withdrawals/stats - Get withdrawal statistics
router.get('/withdrawals/stats', withdrawalController.getStats);

// GET /admin/withdrawals - Get all withdrawals (paginated)
router.get('/withdrawals', withdrawalController.getWithdrawals);

// POST /admin/withdrawals - Create a new withdrawal request
router.post('/withdrawals', withdrawalController.createWithdrawal);

// POST /admin/withdrawals/:id/sign - Sign a withdrawal
router.post('/withdrawals/:id/sign', withdrawalController.signWithdrawal);

// POST /admin/withdrawals/:id/reject - Reject a withdrawal
router.post('/withdrawals/:id/reject', withdrawalController.rejectWithdrawal);

module.exports = router;
