const notificationService = require('../services/notificationService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { resolvePrimaryWallet } = require('../utils/userHelpers');

/**
 * Get notifications for a user
 * Supports pagination and filtering
 */
const getNotifications = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    const { page = 1, limit = 20, unreadOnly = false, type } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const result = await notificationService.getUserNotifications(walletAddress, {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === 'true' || unreadOnly === true,
      type: type || null
    });

    logger.info(`Notifications fetched for wallet: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, result, 'Notifications retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count for a user
 */
const getUnreadCount = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const count = await notificationService.getUnreadCount(walletAddress);

    res.status(200).json(
      new ApiResponse(200, { unreadCount: count }, 'Unread count retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    let { walletAddress } = req.body;

    if (!notificationId) {
      throw new ApiError(400, 'Notification ID is required');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const notification = await notificationService.markAsRead(notificationId, walletAddress);

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    logger.info(`Notification ${notificationId} marked as read by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        id: notification.id,
        isRead: notification.isRead,
        readAt: notification.readAt
      }, 'Notification marked as read')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (req, res, next) => {
  try {
    let { walletAddress } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const updatedCount = await notificationService.markAllAsRead(walletAddress);

    logger.info(`All notifications marked as read for ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        updatedCount
      }, 'All notifications marked as read')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a single notification
 */
const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    let { walletAddress } = req.body;

    if (!notificationId) {
      throw new ApiError(400, 'Notification ID is required');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const deleted = await notificationService.deleteNotification(notificationId, walletAddress);

    if (!deleted) {
      throw new ApiError(404, 'Notification not found');
    }

    logger.info(`Notification ${notificationId} deleted by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        notificationId
      }, 'Notification deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all notifications for a user
 */
const deleteAllNotifications = async (req, res, next) => {
  try {
    let { walletAddress } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const deletedCount = await notificationService.deleteAllNotifications(walletAddress);

    logger.info(`All notifications deleted for ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        deletedCount
      }, 'All notifications deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
};
