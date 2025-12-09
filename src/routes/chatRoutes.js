const express = require('express');
const router = express.Router();
const {
  getChatUsers,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
  getAllUsers
} = require('../controllers/chatController');

/**
 * @route   GET /api/v1/chat/users/:walletAddress
 * @desc    Get all chat users for a specific logged-in user
 * @access  Public
 */
router.get('/users/:walletAddress', getChatUsers);

/**
 * @route   GET /api/v1/chat/all-users/:walletAddress
 * @desc    Get all available users for starting a new chat (excludes current user)
 * @access  Public
 */
router.get('/all-users/:walletAddress', getAllUsers);

/**
 * @route   GET /api/v1/chat/messages/:walletAddress/:otherWalletAddress
 * @desc    Get messages between two users
 * @access  Public
 */
router.get('/messages/:walletAddress/:otherWalletAddress', getMessages);

/**
 * @route   POST /api/v1/chat/send
 * @desc    Send a message to another user
 * @access  Public
 */
router.post('/send', sendMessage);

/**
 * @route   PUT /api/v1/chat/read
 * @desc    Mark messages as read
 * @access  Public
 */
router.put('/read', markMessagesAsRead);

/**
 * @route   GET /api/v1/chat/unread/:walletAddress
 * @desc    Get unread messages count for a user
 * @access  Public
 */
router.get('/unread/:walletAddress', getUnreadCount);

module.exports = router;
