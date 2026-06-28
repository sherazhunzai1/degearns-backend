const { CollectionChatMessage, Collection, User } = require('../models');
const sequelize = require('sequelize');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { resolvePrimaryWallet, getActiveSubscriptionsForWallets } = require('../utils/userHelpers');

/**
 * Normalize a network value to the supported ENUM, or null.
 */
const normalizeNetwork = (network) => {
  return network === 'solana' || network === 'xrpl' ? network : null;
};

/**
 * Best-effort lookup of a DB collection for a chatroom identifier (for display
 * enrichment only — the chatroom works whether or not the collection is in the DB).
 *   - numeric identifier  -> XRPL taxon
 *   - everything else      -> Solana mint address
 */
const findDbCollection = async (collectionId, network) => {
  if (!collectionId) return null;
  const where = {};
  if (/^\d+$/.test(String(collectionId))) {
    where.taxon = parseInt(collectionId, 10);
  } else {
    where.mintAddress = collectionId;
  }
  if (network) where.network = network;
  try {
    return await Collection.findOne({
      where,
      attributes: ['id', 'name', 'slug', 'image', 'network', 'mintAddress', 'taxon', 'creatorWalletAddress']
    });
  } catch (e) {
    return null;
  }
};

/**
 * Send a message to a collection chatroom.
 *
 * The chatroom is keyed by an on-chain collection identifier (Solana mint address
 * or XRPL taxon) — the collection does NOT need to exist in our database, so anyone
 * can chat about any collection on either network. The sender must be a known user
 * (for identity).
 */
const sendMessage = async (req, res, next) => {
  try {
    let { collectionId, network, walletAddress, content, messageType = 'text', metadata, replyToMessageId } = req.body;

    if (!collectionId) throw new ApiError(400, 'collectionId is required (Solana mint address or XRPL taxon)');
    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');
    if (!content || content.trim() === '') throw new ApiError(400, 'Message content is required');

    collectionId = String(collectionId).trim();
    network = normalizeNetwork(network);
    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Sender must be a known user (for profile/identity). The collection itself
    // need NOT exist in our DB — chatrooms are open for any on-chain collection.
    const user = await User.findOne({ where: { walletAddress } });
    if (!user) throw new ApiError(404, 'User not found');

    // Verify reply target belongs to the same chatroom if provided
    if (replyToMessageId) {
      const replyTarget = await CollectionChatMessage.findByPk(replyToMessageId);
      if (!replyTarget || replyTarget.collectionId !== collectionId) {
        throw new ApiError(400, 'Reply target message not found in this chatroom');
      }
    }

    const message = await CollectionChatMessage.create({
      collectionId,
      network,
      senderWalletAddress: walletAddress,
      content: content.trim(),
      messageType,
      metadata: metadata || null,
      replyToMessageId: replyToMessageId || null
    });

    logger.info(`Collection chat message sent: ${collectionId} (${network || 'unknown'}) by ${walletAddress}`);

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
 * Get messages for a collection chatroom (paginated, newest first in DB; returned
 * oldest-first for display). Works for any on-chain collection identifier.
 */
const getMessages = async (req, res, next) => {
  try {
    const { collectionId } = req.params;
    const { page = 1, limit = 50, network } = req.query;

    if (!collectionId) throw new ApiError(400, 'collectionId is required');

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

    // Best-effort collection info for the chat header (may be null if not in DB)
    const resolvedNetwork = normalizeNetwork(network) || messages[0]?.network || null;
    const dbCollection = await findDbCollection(collectionId, resolvedNetwork);

    res.status(200).json(
      new ApiResponse(200, {
        collection: dbCollection ? dbCollection.toJSON() : { collectionId, network: resolvedNetwork },
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
 * Delete a message (only by the sender, or the DB collection's creator if it exists).
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    let { walletAddress } = req.body;

    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const message = await CollectionChatMessage.findByPk(messageId);
    if (!message) throw new ApiError(404, 'Message not found');

    let canDelete = message.senderWalletAddress === walletAddress;

    // If the collection happens to exist in our DB, its creator can also moderate
    if (!canDelete) {
      const dbCollection = await findDbCollection(message.collectionId, message.network);
      if (dbCollection && dbCollection.creatorWalletAddress === walletAddress) {
        canDelete = true;
      }
    }

    if (!canDelete) throw new ApiError(403, 'You can only delete your own messages');

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
 * Get the active chatrooms — i.e. collections people are actually chatting about
 * (distinct on-chain collection identifiers that have messages), regardless of
 * whether the collection exists in our DB. Enriched with DB collection info when
 * available.
 */
const getChatrooms = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, network } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    const normalizedNetwork = normalizeNetwork(network);
    if (normalizedNetwork) where.network = normalizedNetwork;

    const [rooms, total] = await Promise.all([
      CollectionChatMessage.findAll({
        attributes: [
          'collectionId',
          'network',
          [sequelize.fn('COUNT', sequelize.col('id')), 'messageCount'],
          [sequelize.fn('MAX', sequelize.col('createdAt')), 'lastMessageAt']
        ],
        where,
        group: ['collectionId', 'network'],
        order: [[sequelize.fn('MAX', sequelize.col('createdAt')), 'DESC']],
        limit: parseInt(limit),
        offset,
        raw: true
      }),
      CollectionChatMessage.count({ where, distinct: true, col: 'collectionId' })
    ]);

    // Enrich each room with DB collection info when it exists
    const enriched = await Promise.all(rooms.map(async (r) => {
      const dbCollection = await findDbCollection(r.collectionId, r.network);
      return {
        collectionId: r.collectionId,
        network: r.network || dbCollection?.network || null,
        collection: dbCollection ? dbCollection.toJSON() : null,
        chat: {
          messageCount: parseInt(r.messageCount),
          lastMessageAt: r.lastMessageAt
        }
      };
    }));

    res.status(200).json(
      new ApiResponse(200, {
        chatrooms: enriched,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
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
