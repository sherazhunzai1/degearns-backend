const express = require('express');
const router = express.Router();

const { adminAuthenticate, superAdminAuthenticate } = require('../middleware/adminAuth');
const {
  adminUserController,
  adminDropController,
  adminCollectionController,
  adminPostController,
  adminDashboardController,
  adminSettingsController,
  adminFeeController
} = require('../controllers/admin');

// ============================================
// DASHBOARD & ANALYTICS ROUTES
// ============================================

// GET /admin/dashboard - Get overall platform dashboard
router.get('/dashboard', adminAuthenticate, adminDashboardController.getDashboardOverview);

// GET /admin/dashboard/growth - Get growth analytics
router.get('/dashboard/growth', adminAuthenticate, adminDashboardController.getGrowthAnalytics);

// GET /admin/dashboard/top-creators - Get top creators
router.get('/dashboard/top-creators', adminAuthenticate, adminDashboardController.getTopCreators);

// GET /admin/dashboard/activities - Get recent admin activities
router.get('/dashboard/activities', adminAuthenticate, adminDashboardController.getRecentActivities);

// GET /admin/dashboard/health - Get platform health metrics
router.get('/dashboard/health', adminAuthenticate, adminDashboardController.getPlatformHealth);

// GET /admin/dashboard/revenue - Get revenue breakdown
router.get('/dashboard/revenue', adminAuthenticate, adminDashboardController.getRevenueBreakdown);

// ============================================
// USER MANAGEMENT ROUTES
// ============================================

// GET /admin/users - Get all users with filters
router.get('/users', adminAuthenticate, adminUserController.getUsers);

// GET /admin/users/statistics - Get user statistics
router.get('/users/statistics', adminAuthenticate, adminUserController.getUserStatistics);

// POST /admin/users/bulk-verify - Bulk verify/unverify users
router.post('/users/bulk-verify', adminAuthenticate, adminUserController.bulkUpdateVerification);

// GET /admin/users/:walletAddress - Get user by wallet
router.get('/users/:walletAddress', adminAuthenticate, adminUserController.getUserByWallet);

// PUT /admin/users/:walletAddress/role - Update user role (super admin only)
router.put('/users/:walletAddress/role', superAdminAuthenticate, adminUserController.updateUserRole);

// PUT /admin/users/:walletAddress/verify - Verify/unverify user
router.put('/users/:walletAddress/verify', adminAuthenticate, adminUserController.updateUserVerification);

// PUT /admin/users/:walletAddress/ban - Ban user
router.put('/users/:walletAddress/ban', adminAuthenticate, adminUserController.banUser);

// PUT /admin/users/:walletAddress/unban - Unban user
router.put('/users/:walletAddress/unban', adminAuthenticate, adminUserController.unbanUser);

// DELETE /admin/users/:walletAddress - Delete user
router.delete('/users/:walletAddress', superAdminAuthenticate, adminUserController.deleteUser);

// ============================================
// DROP MANAGEMENT ROUTES
// ============================================

// GET /admin/drops - Get all drops with filters
router.get('/drops', adminAuthenticate, adminDropController.getDrops);

// GET /admin/drops/statistics - Get drop statistics
router.get('/drops/statistics', adminAuthenticate, adminDropController.getDropStatistics);

// GET /admin/drops/pending-fees - Get drops with pending fees
router.get('/drops/pending-fees', adminAuthenticate, adminDropController.getDropsWithPendingFees);

// GET /admin/drops/:dropId - Get drop by ID
router.get('/drops/:dropId', adminAuthenticate, adminDropController.getDropById);

// PUT /admin/drops/:dropId - Update drop
router.put('/drops/:dropId', adminAuthenticate, adminDropController.updateDrop);

// PUT /admin/drops/:dropId/status - Update drop status
router.put('/drops/:dropId/status', adminAuthenticate, adminDropController.updateDropStatus);

// PUT /admin/drops/:dropId/pause - Pause drop
router.put('/drops/:dropId/pause', adminAuthenticate, adminDropController.pauseDrop);

// PUT /admin/drops/:dropId/resume - Resume drop
router.put('/drops/:dropId/resume', adminAuthenticate, adminDropController.resumeDrop);

// PUT /admin/drops/:dropId/fees-status - Update platform fees status
router.put('/drops/:dropId/fees-status', adminAuthenticate, adminDropController.updateDropFeesStatus);

// DELETE /admin/drops/:dropId - Delete drop
router.delete('/drops/:dropId', superAdminAuthenticate, adminDropController.deleteDrop);

// GET /admin/drops/:dropId/mints - Get drop mints
router.get('/drops/:dropId/mints', adminAuthenticate, adminDropController.getDropMints);

// GET /admin/drops/:dropId/allowlist - Get drop allowlist
router.get('/drops/:dropId/allowlist', adminAuthenticate, adminDropController.getDropAllowlist);

// ============================================
// COLLECTION MANAGEMENT ROUTES
// ============================================

// GET /admin/collections - Get all collections with filters
router.get('/collections', adminAuthenticate, adminCollectionController.getCollections);

// GET /admin/collections/statistics - Get collection statistics
router.get('/collections/statistics', adminAuthenticate, adminCollectionController.getCollectionStatistics);

// GET /admin/collections/pending-verification - Get pending verification collections
router.get('/collections/pending-verification', adminAuthenticate, adminCollectionController.getPendingVerificationCollections);

// POST /admin/collections/bulk-verify - Bulk verify collections
router.post('/collections/bulk-verify', adminAuthenticate, adminCollectionController.bulkVerifyCollections);

// GET /admin/collections/:collectionId - Get collection by ID
router.get('/collections/:collectionId', adminAuthenticate, adminCollectionController.getCollectionById);

// PUT /admin/collections/:collectionId - Update collection
router.put('/collections/:collectionId', adminAuthenticate, adminCollectionController.updateCollection);

// PUT /admin/collections/:collectionId/verify - Verify/unverify collection
router.put('/collections/:collectionId/verify', adminAuthenticate, adminCollectionController.updateCollectionVerification);

// DELETE /admin/collections/:collectionId - Delete collection
router.delete('/collections/:collectionId', superAdminAuthenticate, adminCollectionController.deleteCollection);

// ============================================
// POST MODERATION ROUTES
// ============================================

// GET /admin/posts - Get all posts with filters
router.get('/posts', adminAuthenticate, adminPostController.getPosts);

// GET /admin/posts/statistics - Get post statistics
router.get('/posts/statistics', adminAuthenticate, adminPostController.getPostStatistics);

// GET /admin/posts/flagged - Get flagged/hidden content
router.get('/posts/flagged', adminAuthenticate, adminPostController.getFlaggedContent);

// POST /admin/posts/bulk-delete - Bulk delete posts
router.post('/posts/bulk-delete', adminAuthenticate, adminPostController.bulkDeletePosts);

// POST /admin/posts/bulk-hide - Bulk hide/unhide posts
router.post('/posts/bulk-hide', adminAuthenticate, adminPostController.bulkHidePosts);

// GET /admin/posts/:postId - Get post by ID
router.get('/posts/:postId', adminAuthenticate, adminPostController.getPostById);

// PUT /admin/posts/:postId/visibility - Toggle post visibility
router.put('/posts/:postId/visibility', adminAuthenticate, adminPostController.togglePostVisibility);

// DELETE /admin/posts/:postId - Delete post
router.delete('/posts/:postId', adminAuthenticate, adminPostController.deletePost);

// GET /admin/comments - Get all comments with filters
router.get('/comments', adminAuthenticate, adminPostController.getComments);

// DELETE /admin/comments/:commentId - Delete comment
router.delete('/comments/:commentId', adminAuthenticate, adminPostController.deleteComment);

// ============================================
// PLATFORM SETTINGS ROUTES
// ============================================

// POST /admin/settings/initialize - Initialize default settings
router.post('/settings/initialize', superAdminAuthenticate, adminSettingsController.initializeSettings);

// GET /admin/settings - Get all settings (admin)
router.get('/settings', adminAuthenticate, adminSettingsController.getAllSettings);

// GET /admin/settings/public - Get public settings (no auth required for frontend)
router.get('/settings/public', adminSettingsController.getPublicSettings);

// POST /admin/settings - Create new setting
router.post('/settings', superAdminAuthenticate, adminSettingsController.createSetting);

// PUT /admin/settings/bulk - Bulk update settings
router.put('/settings/bulk', superAdminAuthenticate, adminSettingsController.bulkUpdateSettings);

// GET /admin/settings/:key - Get setting by key
router.get('/settings/:key', adminAuthenticate, adminSettingsController.getSettingByKey);

// PUT /admin/settings/:key - Update setting
router.put('/settings/:key', superAdminAuthenticate, adminSettingsController.updateSetting);

// PUT /admin/settings/:key/reset - Reset setting to default
router.put('/settings/:key/reset', superAdminAuthenticate, adminSettingsController.resetSettingToDefault);

// DELETE /admin/settings/:key - Delete setting
router.delete('/settings/:key', superAdminAuthenticate, adminSettingsController.deleteSetting);

// ============================================
// FEE MANAGEMENT ROUTES
// ============================================

// GET /admin/fees - Get fees overview
router.get('/fees', adminAuthenticate, adminFeeController.getFeesOverview);

// GET /admin/fees/transactions - Get fee transactions
router.get('/fees/transactions', adminAuthenticate, adminFeeController.getFeeTransactions);

// GET /admin/fees/statistics - Get fee statistics
router.get('/fees/statistics', adminAuthenticate, adminFeeController.getFeeStatistics);

// GET /admin/fees/pending - Get pending fees
router.get('/fees/pending', adminAuthenticate, adminFeeController.getPendingFees);

// GET /admin/fees/failed - Get failed fees
router.get('/fees/failed', adminAuthenticate, adminFeeController.getFailedFees);

// GET /admin/fees/export - Export fee report
router.get('/fees/export', adminAuthenticate, adminFeeController.exportFeeReport);

// PUT /admin/fees/:dropId/mark-paid - Mark fees as paid
router.put('/fees/:dropId/mark-paid', adminAuthenticate, adminFeeController.markFeesAsPaid);

// PUT /admin/fees/:dropId/mark-refunded - Mark fees as refunded
router.put('/fees/:dropId/mark-refunded', superAdminAuthenticate, adminFeeController.markFeesAsRefunded);

module.exports = router;
