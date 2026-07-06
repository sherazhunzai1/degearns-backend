const { MemeCoinChatMessage, MemeCoin, MemeCoinPool, User } = require('../models');
const sequelize = require('sequelize');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { resolvePrimaryWallet, getActiveSubscriptionsForWallets } = require('../utils/userHelpers');

// Attributes returned for a meme coin in chat headers / room listings.
const COIN_ATTRS = [
  'id', 'tokenName', 'tokenSymbol', 'network', 'mintAddress', 'currencyHex',
  'issuerWalletAddress', 'logo', 'creatorWalletAddress'
];

/**
 * Load a meme coin by id and tell whether it is "listed" (has an active liquidity
 * pool — the same condition GET /memecoins/listed uses). Open chat is only allowed
 * for listed meme coins.
 * @returns {Promise<{coin: object|null, isListed: boolean}>}
 */
const loadListedCoin = async (memeCoinId) => {
  const coin = await MemeCoin.findByPk(memeCoinId, { attributes: COIN_ATTRS });
  if (!coin) return { coin: null, isListed: false };
  const activePool = await MemeCoinPool.findOne({
    where: { memeCoinId, status: 'active' },
    attributes: ['id']
  });
  return { coin, isListed: !!activePool };
};

/**
 * POST /api/v1/memecoin-chat/send
 * Send a message to a listed meme coin's open chatroom. Anyone with a user profile
 * can post; the meme coin must be listed (have an active pool).
 */
const sendMessage = async (req, res, next) => {
  try {
    let { memeCoinId, walletAddress, content, messageType = 'text', metadata, replyToMessageId } = req.body;

    if (!memeCoinId) throw new ApiError(400, 'memeCoinId is required');
    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');
    if (!content || content.trim() === '') throw new ApiError(400, 'Message content is required');

    memeCoinId = String(memeCoinId).trim();
    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Sender must be a known user (for profile/identity).
    const user = await User.findOne({ where: { walletAddress } });
    if (!user) throw new ApiError(404, 'User not found');

    // Chat is only open for LISTED meme coins (must exist and have an active pool).
    const { coin, isListed } = await loadListedCoin(memeCoinId);
    if (!coin) throw new ApiError(404, 'Meme coin not found');
    if (!isListed) throw new ApiError(403, 'Open chat is only available for listed meme coins (no active liquidity pool)');

    // Verify reply target belongs to the same chatroom if provided.
    if (replyToMessageId) {
      const replyTarget = await MemeCoinChatMessage.findByPk(replyToMessageId);
      if (!replyTarget || replyTarget.memeCoinId !== memeCoinId) {
        throw new ApiError(400, 'Reply target message not found in this chatroom');
      }
    }

    const message = await MemeCoinChatMessage.create({
      memeCoinId,
      senderWalletAddress: walletAddress,
      content: content.trim(),
      messageType,
      metadata: metadata || null,
      replyToMessageId: replyToMessageId || null
    });

    logger.info(`MemeCoin chat message sent: coin=${memeCoinId} by ${walletAddress}`);

    const fullMessage = await MemeCoinChatMessage.findByPk(message.id, {
      include: [{
        association: 'sender',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }]
    });

    const subscriptionMap = await getActiveSubscriptionsForWallets([walletAddress]);

    res.status(201).json(
      new ApiResponse(201, {
        ...fullMessage.toJSON(),
        sender: {
          ...fullMessage.sender?.toJSON(),
          subscriptionPlan: subscriptionMap[walletAddress] || 'free'
        }
      }, 'Message sent successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/memecoin-chat/:memeCoinId/messages
 * Get messages for a meme coin chatroom (paginated; returned oldest-first for display).
 * Public — everyone can read.
 */
const getMessages = async (req, res, next) => {
  try {
    const { memeCoinId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!memeCoinId) throw new ApiError(400, 'memeCoinId is required');

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: messages } = await MemeCoinChatMessage.findAndCountAll({
      where: { memeCoinId },
      include: [
        {
          association: 'sender',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        },
        {
          model: MemeCoinChatMessage,
          as: 'replyTo',
          required: false,
          attributes: ['id', 'content', 'senderWalletAddress', 'messageType'],
          include: [{
            association: 'sender',
            attributes: ['walletAddress', 'username', 'profileImage']
          }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Enrich senders with subscription plans
    const senderAddresses = [...new Set(messages.map(m => m.senderWalletAddress))];
    const subscriptionMap = await getActiveSubscriptionsForWallets(senderAddresses);

    const enrichedMessages = messages.map(m => {
      const json = m.toJSON();
      return {
        ...json,
        sender: json.sender ? {
          ...json.sender,
          subscriptionPlan: subscriptionMap[json.senderWalletAddress] || 'free'
        } : null
      };
    });

    // Reverse for display (oldest first in UI)
    enrichedMessages.reverse();

    // Meme coin info + listed status for the chat header
    const { coin, isListed } = await loadListedCoin(memeCoinId);

    res.status(200).json(
      new ApiResponse(200, {
        memeCoin: coin ? { ...coin.toJSON(), isListed } : { id: memeCoinId, isListed: false },
        messages: enrichedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Chat messages retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/memecoin-chat/message/:messageId
 * Delete a message — sender, or the meme coin's creator, only.
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    let { walletAddress } = req.body;

    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const message = await MemeCoinChatMessage.findByPk(messageId);
    if (!message) throw new ApiError(404, 'Message not found');

    let canDelete = message.senderWalletAddress === walletAddress;

    // The meme coin's creator can also moderate its chatroom.
    if (!canDelete) {
      const coin = await MemeCoin.findByPk(message.memeCoinId, { attributes: ['creatorWalletAddress'] });
      if (coin && coin.creatorWalletAddress === walletAddress) {
        canDelete = true;
      }
    }

    if (!canDelete) throw new ApiError(403, 'You can only delete your own messages');

    await message.destroy();

    logger.info(`MemeCoin chat message deleted: ${messageId} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Message deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/memecoin-chat/rooms
 * List meme coins that have chat activity (active chatrooms), enriched with meme coin
 * info + chat stats, newest activity first. Optional ?network filter.
 */
const getChatrooms = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const network = req.query.network === 'solana' || req.query.network === 'xrpl' ? req.query.network : null;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Distinct meme coins with messages, ordered by most recent activity.
    const grouped = await MemeCoinChatMessage.findAll({
      attributes: [
        'memeCoinId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'messageCount'],
        [sequelize.fn('MAX', sequelize.col('createdAt')), 'lastMessageAt']
      ],
      group: ['memeCoinId'],
      order: [[sequelize.fn('MAX', sequelize.col('createdAt')), 'DESC']],
      raw: true
    });

    // Load the meme coins (optionally filtered by network), preserving activity order.
    const coinIds = grouped.map(g => g.memeCoinId);
    const coinWhere = { id: { [Op.in]: coinIds.length ? coinIds : ['00000000-0000-0000-0000-000000000000'] } };
    if (network) coinWhere.network = network;

    const coins = await MemeCoin.findAll({ where: coinWhere, attributes: COIN_ATTRS });
    const coinById = {};
    for (const c of coins) coinById[c.id] = c;

    const roomsAll = grouped
      .filter(g => coinById[g.memeCoinId]) // drop rooms whose coin is gone / filtered out
      .map(g => ({
        memeCoinId: g.memeCoinId,
        memeCoin: coinById[g.memeCoinId].toJSON(),
        chat: {
          messageCount: parseInt(g.messageCount),
          lastMessageAt: g.lastMessageAt
        }
      }));

    const total = roomsAll.length;
    const rooms = roomsAll.slice(offset, offset + parseInt(limit));

    res.status(200).json(
      new ApiResponse(200, {
        chatrooms: rooms,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }, 'Meme coin chatrooms retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getMessages,
  deleteMessage,
  getChatrooms
};
