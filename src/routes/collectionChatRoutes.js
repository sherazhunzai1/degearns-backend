const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  deleteMessage,
  getChatrooms
} = require('../controllers/collectionChatController');

/**
 * @route   GET /api/v1/collection-chat/rooms
 * @desc    Get active chatrooms (collections being chatted about, DB or on-chain)
 * @query   page, limit, network
 * @access  Public
 */
router.get('/rooms', getChatrooms);

/**
 * @route   GET /api/v1/collection-chat/:collectionId/messages
 * @desc    Get messages for a collection chatroom. collectionId is the on-chain
 *          identifier — Solana mint address or XRPL taxon (no DB record required).
 * @query   page, limit, network
 * @access  Public
 */
router.get('/:collectionId/messages', getMessages);

/**
 * @route   POST /api/v1/collection-chat/send
 * @desc    Send a message to any collection's chatroom. The collection need not
 *          exist in our DB — works for any Solana/XRPL collection on-chain.
 * @body    collectionId (mint address or taxon), network, walletAddress, content,
 *          messageType, metadata, replyToMessageId
 * @access  Public
 */
router.post('/send', sendMessage);

/**
 * @route   DELETE /api/v1/collection-chat/message/:messageId
 * @desc    Delete a message (sender or collection creator only)
 * @body    walletAddress
 * @access  Public
 */
router.delete('/message/:messageId', deleteMessage);

module.exports = router;
