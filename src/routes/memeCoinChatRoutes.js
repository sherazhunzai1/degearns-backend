const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  deleteMessage,
  getChatrooms
} = require('../controllers/memeCoinChatController');

/**
 * @route   GET /api/v1/memecoin-chat/rooms
 * @desc    Get active meme coin chatrooms (listed coins being chatted about), with
 *          chat stats. Optional ?network=solana|xrpl filter.
 * @query   page, limit, network
 * @access  Public
 */
router.get('/rooms', getChatrooms);

/**
 * @route   GET /api/v1/memecoin-chat/:memeCoinId/messages
 * @desc    Get messages for a listed meme coin's open chatroom (everyone can read).
 * @query   page, limit
 * @access  Public
 */
router.get('/:memeCoinId/messages', getMessages);

/**
 * @route   POST /api/v1/memecoin-chat/send
 * @desc    Send a message to a listed meme coin's open chatroom (anyone can post).
 * @body    memeCoinId, walletAddress, content, messageType, metadata, replyToMessageId
 * @access  Public
 */
router.post('/send', sendMessage);

/**
 * @route   DELETE /api/v1/memecoin-chat/message/:messageId
 * @desc    Delete a message (sender or the meme coin's creator only)
 * @body    walletAddress
 * @access  Public
 */
router.delete('/message/:messageId', deleteMessage);

module.exports = router;
