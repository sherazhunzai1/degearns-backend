const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
} = require('../controllers/notificationController');

/**
 * @route   GET /api/v1/notifications/:walletAddress
 * @desc    Get notifications for a user (supports pagination and filtering)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   unreadOnly - Only return unread notifications (default: false)
 * @query   type - Filter by notification type (like, comment, comment_reply, follow, nft_listing)
 * @access  Public
 */
router.get('/:walletAddress', getNotifications);

/**
 * @route   GET /api/v1/notifications/:walletAddress/unread-count
 * @desc    Get unread notification count for a user
 * @access  Public
 */
router.get('/:walletAddress/unread-count', getUnreadCount);

/**
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @desc    Mark a single notification as read
 * @body    walletAddress - Wallet address of the notification recipient
 * @access  Public
 */
router.put('/:notificationId/read', markAsRead);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read for a user
 * @body    walletAddress - Wallet address of the user
 * @access  Public
 */
router.put('/read-all', markAllAsRead);

/**
 * @route   DELETE /api/v1/notifications/:notificationId
 * @desc    Delete a single notification
 * @body    walletAddress - Wallet address of the notification recipient
 * @access  Public
 */
router.delete('/:notificationId', deleteNotification);

/**
 * @route   DELETE /api/v1/notifications/delete-all
 * @desc    Delete all notifications for a user
 * @body    walletAddress - Wallet address of the user
 * @access  Public
 */
router.delete('/delete-all', deleteAllNotifications);

module.exports = router;
