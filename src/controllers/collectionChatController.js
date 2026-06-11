const { CollectionChatMessage, Collection, User } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { resolvePrimaryWallet, getActiveSubscriptionsForWallets } = require('../utils/userHelpers');

/**
 * Send a message to a collection chatroom.
 * Any registered user can send a message to any collection's chatroom.
 */
const sendMessage = async (req, res, next) => {
  try {
    let { collectionId, walletAddress, content, messageType = 'text', metadata, replyToMessageId } = req.body;

    if (!collectionId) throw new ApiError(400, 'collectionId is required');
    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');
    if (!content || content.trim() === '') throw new ApiError(400, 'Message content is required');

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Verify collection exists
    const collection = await Collection.findByPk(collectionId);
    if (!collection) throw new ApiError(404, 'Collection not found');

    // Verify user exists
    const user = await User.findOne({ where: { walletAddress } });
    if (!user) throw new ApiError(404, 'User not found');

    // Verify reply target exists if provided
    if (replyToMessageId) {
      const replyTarget = await CollectionChatMessage.findByPk(replyToMessageId);
      if (!replyTarget || replyTarget.collectionId !== collectionId) {
        throw new ApiError(400, 'Reply target message not found in this chatroom');
      }
    }

    const message = await CollectionChatMessage.create({
      collectionId,
      senderWalletAddress: walletAddress,
      content: content.trim(),
      messageType,
      metadata: metadata || null,
      replyToMessageId: replyToMessageId || null
    });

    logger.info(`Collection chat message sent: ${collectionId} by ${walletAddress}`);

    // Fetch with sender info
    const fullMessage = await CollectionChatMessage.findByPk(message.id, {
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
 * Get messages for a collection chatroom (paginated, newest first).
 */
const getMessages = async (req, res, next) => {
  try {
    const { collectionId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!collectionId) throw new ApiError(400, 'collectionId is required');

    const collection = await Collection.findByPk(collectionId, {
      attributes: ['id', 'name', 'slug', 'image', 'network']
    });
    if (!collection) throw new ApiError(404, 'Collection not found');

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: messages } = await CollectionChatMessage.findAndCountAll({
      where: { collectionId },
      include: [
        {
          association: 'sender',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        },
        {
          model: CollectionChatMessage,
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

    res.status(200).json(
      new ApiResponse(200, {
        collection: collection.toJSON(),
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
 * Delete a message (only by the sender or collection creator).
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    let { walletAddress } = req.body;

    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const message = await CollectionChatMessage.findByPk(messageId);
    if (!message) throw new ApiError(404, 'Message not found');

    // Check if user is the sender or the collection creator
    const collection = await Collection.findByPk(message.collectionId);
    if (message.senderWalletAddress !== walletAddress && collection?.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only delete your own messages');
    }

    await message.destroy();

    logger.info(`Collection chat message deleted: ${messageId} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Message deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all collections that have chatrooms (collections in DB with message counts).
 */
const getChatrooms = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, network } = req.query;

    const where = {};
    if (network) where.network = network;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const collections = await Collection.findAll({
      where,
      attributes: [
        'id', 'name', 'slug', 'image', 'network', 'mintAddress', 'taxon',
        'creatorWalletAddress', 'category'
      ],
      include: [{
        association: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get message counts + last message for each collection
    const collectionIds = collections.map(c => c.id);
    const messageCounts = collectionIds.length > 0 ? await CollectionChatMessage.findAll({
      attributes: [
        'collectionId',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'messageCount'],
        [require('sequelize').fn('MAX', require('sequelize').col('createdAt')), 'lastMessageAt']
      ],
      where: { collectionId: { [Op.in]: collectionIds } },
      group: ['collectionId'],
      raw: true
    }) : [];

    const countMap = {};
    messageCounts.forEach(mc => {
      countMap[mc.collectionId] = {
        messageCount: parseInt(mc.messageCount),
        lastMessageAt: mc.lastMessageAt
      };
    });

    const enriched = collections.map(c => ({
      ...c.toJSON(),
      chat: countMap[c.id] || { messageCount: 0, lastMessageAt: null }
    }));

    // Sort: most recent chat activity first
    enriched.sort((a, b) => {
      if (a.chat.lastMessageAt && b.chat.lastMessageAt) {
        return new Date(b.chat.lastMessageAt) - new Date(a.chat.lastMessageAt);
      }
      if (a.chat.lastMessageAt) return -1;
      if (b.chat.lastMessageAt) return 1;
      return 0;
    });

    res.status(200).json(
      new ApiResponse(200, {
        chatrooms: enriched,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: collections.length,
          totalPages: 1
        }
      }, 'Collection chatrooms retrieved successfully')
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
