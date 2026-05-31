const { User, Conversation, Message } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const {
  getActiveSubscriptionsForWallets,
  enrichItemsWithSubscriptions,
  resolvePrimaryWallet
} = require('../utils/userHelpers');

/**
 * Get all chat users for a specific logged-in user
 * Returns list of users with whom the user has had conversations
 */
const getChatUsers = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Find all conversations where the user is a participant
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [
          { participant1WalletAddress: walletAddress },
          { participant2WalletAddress: walletAddress }
        ]
      },
      order: [['lastMessageAt', 'DESC']]
    });

    // Extract other participant wallet addresses
    const otherWalletAddresses = conversations.map(conv => {
      return conv.participant1WalletAddress === walletAddress
        ? conv.participant2WalletAddress
        : conv.participant1WalletAddress;
    });

    // Get user details for all chat participants
    const users = await User.findAll({
      where: {
        walletAddress: {
          [Op.in]: otherWalletAddresses
        }
      },
      attributes: ['id', 'walletAddress', 'username', 'profileImage', 'isVerified']
    });

    // Create a map for quick user lookup
    const userMap = {};
    users.forEach(user => {
      userMap[user.walletAddress] = user;
    });

    // Fetch subscription plans for all chat participants
    const subscriptionMap = await getActiveSubscriptionsForWallets(otherWalletAddresses);

    // Get unread count for each conversation
    const chatUsers = await Promise.all(conversations.map(async (conv) => {
      const otherWallet = conv.participant1WalletAddress === walletAddress
        ? conv.participant2WalletAddress
        : conv.participant1WalletAddress;

      const unreadCount = await Message.count({
        where: {
          conversationId: conv.id,
          receiverWalletAddress: walletAddress,
          isRead: false
        }
      });

      const user = userMap[otherWallet];

      return {
        conversationId: conv.id,
        user: user ? {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
        } : {
          walletAddress: otherWallet,
          username: otherWallet,
          subscriptionPlan: subscriptionMap[otherWallet] || 'free'
        },
        lastMessageAt: conv.lastMessageAt,
        lastMessagePreview: conv.lastMessagePreview,
        unreadCount
      };
    }));

    logger.info(`Chat users fetched for wallet: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        chatUsers,
        total: chatUsers.length
      }, 'Chat users retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages between two users
 * Supports pagination
 */
const getMessages = async (req, res, next) => {
  try {
    let { walletAddress, otherWalletAddress } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!walletAddress || !otherWalletAddress) {
      throw new ApiError(400, 'Both wallet addresses are required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);
    otherWalletAddress = await resolvePrimaryWallet(otherWalletAddress);

    // Normalize wallet addresses for conversation lookup
    const [addr1, addr2] = [walletAddress, otherWalletAddress].sort();

    // Find or get the conversation
    let conversation = await Conversation.findOne({
      where: {
        participant1WalletAddress: addr1,
        participant2WalletAddress: addr2
      }
    });

    if (!conversation) {
      // No conversation exists yet
      res.status(200).json(
        new ApiResponse(200, {
          messages: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
          }
        }, 'No messages found')
      );
      return;
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get messages with pagination
    const { count, rows: messages } = await Message.findAndCountAll({
      where: {
        conversationId: conversation.id
      },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get sender details
    const senderAddresses = [...new Set(messages.map(m => m.senderWalletAddress))];
    const senders = await User.findAll({
      where: {
        walletAddress: {
          [Op.in]: senderAddresses
        }
      },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    const senderMap = {};
    senders.forEach(sender => {
      senderMap[sender.walletAddress] = sender;
    });

    // Fetch subscription plans for all senders
    const subscriptionMap = await getActiveSubscriptionsForWallets(senderAddresses);

    // Format messages with sender info
    const formattedMessages = messages.map(msg => {
      const sender = senderMap[msg.senderWalletAddress];
      return {
        id: msg.id,
        conversationId: msg.conversationId,
        senderWalletAddress: msg.senderWalletAddress,
        receiverWalletAddress: msg.receiverWalletAddress,
        sender: sender ? {
          walletAddress: sender.walletAddress,
          username: sender.username,
          profileImage: sender.profileImage,
          isVerified: sender.isVerified,
          subscriptionPlan: subscriptionMap[sender.walletAddress] || 'free'
        } : null,
        content: msg.content,
        messageType: msg.messageType,
        metadata: msg.metadata,
        isRead: msg.isRead,
        readAt: msg.readAt,
        createdAt: msg.createdAt
      };
    });

    // Reverse to show oldest first in UI (DESC for pagination, reverse for display)
    formattedMessages.reverse();

    logger.info(`Messages fetched between ${walletAddress} and ${otherWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        messages: formattedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Messages retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message to another user
 */
const sendMessage = async (req, res, next) => {
  try {
    let {
      senderWalletAddress,
      receiverWalletAddress,
      content,
      messageType = 'text',
      metadata
    } = req.body;

    if (!senderWalletAddress || !receiverWalletAddress) {
      throw new ApiError(400, 'Both sender and receiver wallet addresses are required');
    }

    if (!content || content.trim() === '') {
      throw new ApiError(400, 'Message content is required');
    }

    senderWalletAddress = await resolvePrimaryWallet(senderWalletAddress);
    receiverWalletAddress = await resolvePrimaryWallet(receiverWalletAddress);

    // Verify sender exists
    const sender = await User.findOne({
      where: { walletAddress: senderWalletAddress }
    });

    if (!sender) {
      throw new ApiError(404, 'Sender not found');
    }

    // Auto-create receiver if doesn't exist (for new users receiving messages)
    let receiver = await User.findOne({
      where: { walletAddress: receiverWalletAddress }
    });

    if (!receiver) {
      // Create receiver as a new user
      receiver = await User.create({
        walletAddress: receiverWalletAddress,
        username: receiverWalletAddress,
        role: 'user'
      });
      logger.info(`New user created from message receive: ${receiverWalletAddress}`);
    }

    // Normalize wallet addresses for conversation (always store in sorted order)
    const [addr1, addr2] = [senderWalletAddress, receiverWalletAddress].sort();

    // Find or create conversation
    let conversation = await Conversation.findOne({
      where: {
        participant1WalletAddress: addr1,
        participant2WalletAddress: addr2
      }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participant1WalletAddress: addr1,
        participant2WalletAddress: addr2,
        lastMessageAt: new Date(),
        lastMessagePreview: content.substring(0, 100)
      });
      logger.info(`New conversation created between ${addr1} and ${addr2}`);
    }

    // Create the message
    const message = await Message.create({
      conversationId: conversation.id,
      senderWalletAddress,
      receiverWalletAddress,
      content: content.trim(),
      messageType,
      metadata: metadata || null,
      isRead: false
    });

    // Update conversation with last message info
    await conversation.update({
      lastMessageAt: message.createdAt,
      lastMessagePreview: content.substring(0, 100)
    });

    // Fetch subscription plan for sender
    const subscriptionMap = await getActiveSubscriptionsForWallets([senderWalletAddress]);

    logger.info(`Message sent from ${senderWalletAddress} to ${receiverWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, {
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderWalletAddress: message.senderWalletAddress,
          receiverWalletAddress: message.receiverWalletAddress,
          sender: {
            walletAddress: sender.walletAddress,
            username: sender.username,
            profileImage: sender.profileImage,
            isVerified: sender.isVerified,
            subscriptionPlan: subscriptionMap[sender.walletAddress] || 'free'
          },
          content: message.content,
          messageType: message.messageType,
          metadata: message.metadata,
          isRead: message.isRead,
          createdAt: message.createdAt
        }
      }, 'Message sent successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark messages as read
 * Marks all unread messages from a specific sender as read
 */
const markMessagesAsRead = async (req, res, next) => {
  try {
    let { walletAddress, senderWalletAddress } = req.body;

    if (!walletAddress || !senderWalletAddress) {
      throw new ApiError(400, 'Both wallet addresses are required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);
    senderWalletAddress = await resolvePrimaryWallet(senderWalletAddress);

    // Normalize wallet addresses for conversation lookup
    const [addr1, addr2] = [walletAddress, senderWalletAddress].sort();

    // Find the conversation
    const conversation = await Conversation.findOne({
      where: {
        participant1WalletAddress: addr1,
        participant2WalletAddress: addr2
      }
    });

    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }

    // Mark all unread messages from sender as read
    const [updatedCount] = await Message.update(
      {
        isRead: true,
        readAt: new Date()
      },
      {
        where: {
          conversationId: conversation.id,
          senderWalletAddress: senderWalletAddress,
          receiverWalletAddress: walletAddress,
          isRead: false
        }
      }
    );

    logger.info(`Marked ${updatedCount} messages as read for ${walletAddress} from ${senderWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        markedAsRead: updatedCount
      }, 'Messages marked as read successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread messages count for a user
 */
const getUnreadCount = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Get total unread count
    const totalUnread = await Message.count({
      where: {
        receiverWalletAddress: walletAddress,
        isRead: false
      }
    });

    // Get unread count per conversation/sender
    const unreadByConversation = await Message.findAll({
      attributes: [
        'conversationId',
        'senderWalletAddress',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'unreadCount']
      ],
      where: {
        receiverWalletAddress: walletAddress,
        isRead: false
      },
      group: ['conversationId', 'senderWalletAddress'],
      raw: true
    });

    // Get sender details
    const senderAddresses = [...new Set(unreadByConversation.map(u => u.senderWalletAddress))];

    let senderMap = {};
    if (senderAddresses.length > 0) {
      const senders = await User.findAll({
        where: {
          walletAddress: {
            [Op.in]: senderAddresses
          }
        },
        attributes: ['walletAddress', 'username', 'profileImage']
      });

      senders.forEach(sender => {
        senderMap[sender.walletAddress] = sender;
      });
    }

    // Fetch subscription plans for all senders
    const subscriptionMap = await getActiveSubscriptionsForWallets(senderAddresses);

    // Format unread by sender
    const unreadBySender = unreadByConversation.map(item => {
      const sender = senderMap[item.senderWalletAddress];
      return {
        conversationId: item.conversationId,
        senderWalletAddress: item.senderWalletAddress,
        sender: sender ? {
          walletAddress: sender.walletAddress,
          username: sender.username,
          profileImage: sender.profileImage,
          subscriptionPlan: subscriptionMap[sender.walletAddress] || 'free'
        } : null,
        unreadCount: parseInt(item.unreadCount)
      };
    });

    logger.info(`Unread count fetched for wallet: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        totalUnread,
        unreadBySender
      }, 'Unread count retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users available for chat (excluding the current user)
 * This returns all registered users that can be messaged
 */
const getAllUsers = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    const { search, page = 1, limit = 20 } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {
      walletAddress: {
        [Op.ne]: walletAddress // Exclude current user
      }
    };

    // Add search filter if provided
    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { walletAddress: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'walletAddress', 'username', 'profileImage', 'isVerified'],
      order: [['username', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    // Fetch subscription plans for all users
    const walletAddresses = users.map(user => user.walletAddress);
    const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

    // Enrich users with subscription plans
    const enrichedUsers = users.map(user => ({
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
    }));

    logger.info(`All users fetched for chat by wallet: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        users: enrichedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Users retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get total unread messages count only (for notification badge)
 * Returns just the count value for lightweight badge display
 */
const getTotalUnreadCount = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Get total unread count only
    const count = await Message.count({
      where: {
        receiverWalletAddress: walletAddress,
        isRead: false
      }
    });

    logger.info(`Total unread count fetched for badge: ${walletAddress}, count: ${count}`);

    res.status(200).json(
      new ApiResponse(200, {
        count
      }, 'Unread count retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatUsers,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
  getTotalUnreadCount,
  getAllUsers
};
