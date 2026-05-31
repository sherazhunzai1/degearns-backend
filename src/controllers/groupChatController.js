const { User, Group, GroupMember, GroupMessage, sequelize } = require('../models');
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
 * Extract IPFS hash from full URL
 * Converts https://gateway.pinata.cloud/ipfs/bafybeibm3... to just bafybeibm3...
 */
const extractIpfsHash = (url) => {
  if (!url) return null;
  const ipfsMatch = url.match(/\/ipfs\/([^/?#]+)/);
  return ipfsMatch ? ipfsMatch[1] : url;
};

/**
 * Format group data with IPFS hash for groupImage
 */
const formatGroupData = (group) => {
  if (!group) return null;
  const data = group.toJSON ? group.toJSON() : { ...group };
  if (data.groupImage) {
    data.groupImage = extractIpfsHash(data.groupImage);
  }
  return data;
};

/**
 * Create a new group chat
 */
const createGroup = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      creatorWalletAddress,
      name,
      description,
      groupImage,
      memberWalletAddresses = []
    } = req.body;

    if (!creatorWalletAddress) {
      throw new ApiError(400, 'Creator wallet address is required');
    }

    if (!name || name.trim() === '') {
      throw new ApiError(400, 'Group name is required');
    }

    // Verify creator exists
    const creator = await User.findOne({
      where: { walletAddress: creatorWalletAddress }
    });

    if (!creator) {
      throw new ApiError(404, 'Creator not found');
    }

    // Create the group
    const group = await Group.create({
      name: name.trim(),
      description: description?.trim() || null,
      groupImage: groupImage || null,
      creatorWalletAddress,
      memberCount: 1 + memberWalletAddresses.length
    }, { transaction });

    // Add creator as admin
    await GroupMember.create({
      groupId: group.id,
      walletAddress: creatorWalletAddress,
      role: 'admin',
      joinedAt: new Date()
    }, { transaction });

    // Add initial members if provided
    if (memberWalletAddresses.length > 0) {
      const uniqueMembers = [...new Set(memberWalletAddresses.filter(addr => addr !== creatorWalletAddress))];

      for (const walletAddress of uniqueMembers) {
        // Verify member exists, auto-create if not
        let member = await User.findOne({
          where: { walletAddress }
        });

        if (!member) {
          member = await User.create({
            walletAddress,
            username: walletAddress,
            role: 'user'
          }, { transaction });
          logger.info(`New user created for group member: ${walletAddress}`);
        }

        await GroupMember.create({
          groupId: group.id,
          walletAddress,
          role: 'member',
          joinedAt: new Date(),
          addedByWalletAddress: creatorWalletAddress
        }, { transaction });
      }

      // Update member count
      await group.update({
        memberCount: 1 + uniqueMembers.length
      }, { transaction });
    }

    // Create system message for group creation
    await GroupMessage.create({
      groupId: group.id,
      senderWalletAddress: creatorWalletAddress,
      content: `${creator.username || creatorWalletAddress} created the group`,
      messageType: 'system'
    }, { transaction });

    await transaction.commit();

    // Get group with creator details
    const createdGroup = await Group.findByPk(group.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    // Get members count
    const members = await GroupMember.findAll({
      where: { groupId: group.id, isActive: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }]
    });

    // Collect wallet addresses and fetch subscriptions
    const walletAddresses = [
      createdGroup.creator?.walletAddress,
      ...members.map(m => m.user?.walletAddress)
    ].filter(Boolean);

    const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

    // Add subscription plans to creator and format group data
    const groupWithSubscription = formatGroupData(createdGroup);
    if (groupWithSubscription.creator) {
      groupWithSubscription.creator.subscriptionPlan = subscriptionMap[groupWithSubscription.creator.walletAddress] || 'free';
    }

    logger.info(`Group created: ${group.id} by ${creatorWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, {
        group: {
          ...groupWithSubscription,
          members: members.map(m => ({
            ...m.user?.toJSON(),
            role: m.role,
            joinedAt: m.joinedAt,
            subscriptionPlan: subscriptionMap[m.user?.walletAddress] || 'free'
          }))
        }
      }, 'Group created successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get all groups for a user
 */
const getGroups = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Find all groups where user is a member
    const memberGroups = await GroupMember.findAll({
      where: {
        walletAddress,
        isActive: true
      },
      attributes: ['groupId', 'role', 'lastReadAt']
    });

    const groupIds = memberGroups.map(m => m.groupId);

    if (groupIds.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, {
          groups: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
          }
        }, 'Groups retrieved successfully')
      );
    }

    // Create a map for quick lookup of member info
    const memberInfoMap = {};
    memberGroups.forEach(m => {
      memberInfoMap[m.groupId] = {
        role: m.role,
        lastReadAt: m.lastReadAt
      };
    });

    // Get groups with pagination
    const { count, rows: groups } = await Group.findAndCountAll({
      where: {
        id: { [Op.in]: groupIds },
        isActive: true
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ],
      order: [['lastMessageAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Collect wallet addresses from all creators and fetch subscriptions
    const creatorWalletAddresses = groups
      .map(g => g.creator?.walletAddress)
      .filter(Boolean);

    const subscriptionMap = await getActiveSubscriptionsForWallets(creatorWalletAddresses);

    // Get unread count for each group
    const groupsWithUnread = await Promise.all(groups.map(async (group) => {
      const memberInfo = memberInfoMap[group.id];

      // Count messages after last read
      const unreadCount = await GroupMessage.count({
        where: {
          groupId: group.id,
          createdAt: {
            [Op.gt]: memberInfo.lastReadAt || new Date(0)
          },
          senderWalletAddress: {
            [Op.ne]: walletAddress
          }
        }
      });

      const groupJson = formatGroupData(group);
      if (groupJson.creator) {
        groupJson.creator.subscriptionPlan = subscriptionMap[groupJson.creator.walletAddress] || 'free';
      }

      return {
        ...groupJson,
        myRole: memberInfo.role,
        unreadCount
      };
    }));

    logger.info(`Groups fetched for wallet: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        groups: groupsWithUnread,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Groups retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get group details
 */
const getGroupDetails = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let walletAddress = await resolvePrimaryWallet(req.params.walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    // Check if user is a member
    const membership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        isActive: true
      }
    });

    if (!membership) {
      throw new ApiError(403, 'You are not a member of this group');
    }

    const group = await Group.findByPk(groupId, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    // Get all active members
    const members = await GroupMember.findAll({
      where: { groupId, isActive: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }],
      order: [['role', 'ASC'], ['joinedAt', 'ASC']]
    });

    // Collect wallet addresses and fetch subscriptions
    const walletAddresses = [
      group.creator?.walletAddress,
      ...members.map(m => m.user?.walletAddress)
    ].filter(Boolean);

    const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

    // Add subscription plans to group creator
    const groupJson = formatGroupData(group);
    if (groupJson.creator) {
      groupJson.creator.subscriptionPlan = subscriptionMap[groupJson.creator.walletAddress] || 'free';
    }

    logger.info(`Group details fetched: ${groupId}`);

    res.status(200).json(
      new ApiResponse(200, {
        group: {
          ...groupJson,
          myRole: membership.role,
          members: members.map(m => ({
            ...m.user?.toJSON(),
            role: m.role,
            joinedAt: m.joinedAt,
            subscriptionPlan: subscriptionMap[m.user?.walletAddress] || 'free'
          }))
        }
      }, 'Group details retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update group details (admin only)
 */
const updateGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let { walletAddress, name, description, groupImage } = req.body;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Check if user is an admin
    const membership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        role: 'admin',
        isActive: true
      }
    });

    if (!membership) {
      throw new ApiError(403, 'Only admins can update group details');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    // Update group
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (groupImage !== undefined) updates.groupImage = groupImage || null;

    await group.update(updates);

    logger.info(`Group updated: ${groupId} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        group: formatGroupData(group)
      }, 'Group updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete/deactivate group (creator only)
 */
const deleteGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let { walletAddress } = req.body;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    if (group.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'Only the group creator can delete the group');
    }

    // Deactivate the group
    await group.update({ isActive: false });

    // Deactivate all memberships
    await GroupMember.update(
      { isActive: false },
      { where: { groupId } }
    );

    logger.info(`Group deleted: ${groupId} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Group deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Add members to group (admin only)
 */
const addMembers = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { groupId } = req.params;
    let { walletAddress, memberWalletAddresses } = req.body;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!memberWalletAddresses || memberWalletAddresses.length === 0) {
      throw new ApiError(400, 'Member wallet addresses are required');
    }

    // Check if user is an admin
    const membership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        role: 'admin',
        isActive: true
      }
    });

    if (!membership) {
      throw new ApiError(403, 'Only admins can add members');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    const addedMembers = [];
    const adder = await User.findOne({ where: { walletAddress } });

    for (const memberWallet of memberWalletAddresses) {
      // Check if already a member
      const existingMember = await GroupMember.findOne({
        where: { groupId, walletAddress: memberWallet }
      });

      if (existingMember) {
        if (!existingMember.isActive) {
          // Reactivate the member
          await existingMember.update({
            isActive: true,
            role: 'member',
            addedByWalletAddress: walletAddress,
            joinedAt: new Date()
          }, { transaction });
          addedMembers.push(memberWallet);
        }
        continue;
      }

      // Verify/create member user
      let member = await User.findOne({
        where: { walletAddress: memberWallet }
      });

      if (!member) {
        member = await User.create({
          walletAddress: memberWallet,
          username: memberWallet,
          role: 'user'
        }, { transaction });
        logger.info(`New user created for group member: ${memberWallet}`);
      }

      await GroupMember.create({
        groupId,
        walletAddress: memberWallet,
        role: 'member',
        joinedAt: new Date(),
        addedByWalletAddress: walletAddress
      }, { transaction });

      addedMembers.push(memberWallet);

      // Create system message
      await GroupMessage.create({
        groupId,
        senderWalletAddress: walletAddress,
        content: `${adder?.username || walletAddress} added ${member.username || memberWallet}`,
        messageType: 'system'
      }, { transaction });
    }

    // Update member count
    const newCount = await GroupMember.count({
      where: { groupId, isActive: true }
    });
    await group.update({ memberCount: newCount }, { transaction });

    await transaction.commit();

    logger.info(`Members added to group ${groupId}: ${addedMembers.join(', ')}`);

    res.status(200).json(
      new ApiResponse(200, {
        addedMembers,
        memberCount: newCount
      }, 'Members added successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Remove a member from group (admin only)
 */
const removeMember = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { groupId } = req.params;
    let { walletAddress, memberWalletAddress } = req.body;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!walletAddress || !memberWalletAddress) {
      throw new ApiError(400, 'Both admin and member wallet addresses are required');
    }

    // Check if user is an admin
    const adminMembership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        role: 'admin',
        isActive: true
      }
    });

    if (!adminMembership) {
      throw new ApiError(403, 'Only admins can remove members');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    // Cannot remove the creator
    if (memberWalletAddress === group.creatorWalletAddress) {
      throw new ApiError(403, 'Cannot remove the group creator');
    }

    // Find the member
    const memberToRemove = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress: memberWalletAddress,
        isActive: true
      }
    });

    if (!memberToRemove) {
      throw new ApiError(404, 'Member not found in the group');
    }

    // Deactivate the member
    await memberToRemove.update({ isActive: false }, { transaction });

    // Update member count
    const newCount = await GroupMember.count({
      where: { groupId, isActive: true }
    });
    await group.update({ memberCount: newCount }, { transaction });

    // Get user info for system message
    const admin = await User.findOne({ where: { walletAddress } });
    const removedUser = await User.findOne({ where: { walletAddress: memberWalletAddress } });

    // Create system message
    await GroupMessage.create({
      groupId,
      senderWalletAddress: walletAddress,
      content: `${admin?.username || walletAddress} removed ${removedUser?.username || memberWalletAddress}`,
      messageType: 'system'
    }, { transaction });

    await transaction.commit();

    logger.info(`Member ${memberWalletAddress} removed from group ${groupId}`);

    res.status(200).json(
      new ApiResponse(200, {
        removedMember: memberWalletAddress,
        memberCount: newCount
      }, 'Member removed successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Leave a group
 */
const leaveGroup = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { groupId } = req.params;
    let { walletAddress } = req.body;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    // Creator cannot leave (must delete the group instead)
    if (walletAddress === group.creatorWalletAddress) {
      throw new ApiError(403, 'Group creator cannot leave. Delete the group instead.');
    }

    const membership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        isActive: true
      }
    });

    if (!membership) {
      throw new ApiError(404, 'You are not a member of this group');
    }

    // Deactivate the membership
    await membership.update({ isActive: false }, { transaction });

    // Update member count
    const newCount = await GroupMember.count({
      where: { groupId, isActive: true }
    });
    await group.update({ memberCount: newCount }, { transaction });

    // Get user info for system message
    const user = await User.findOne({ where: { walletAddress } });

    // Create system message
    await GroupMessage.create({
      groupId,
      senderWalletAddress: walletAddress,
      content: `${user?.username || walletAddress} left the group`,
      messageType: 'system'
    }, { transaction });

    await transaction.commit();

    logger.info(`Member ${walletAddress} left group ${groupId}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Left the group successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Make a member an admin (admin only)
 */
const makeAdmin = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let { walletAddress, memberWalletAddress } = req.body;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!walletAddress || !memberWalletAddress) {
      throw new ApiError(400, 'Both admin and member wallet addresses are required');
    }

    // Check if user is an admin
    const adminMembership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        role: 'admin',
        isActive: true
      }
    });

    if (!adminMembership) {
      throw new ApiError(403, 'Only admins can make other members admin');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    // Find the member
    const memberToPromote = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress: memberWalletAddress,
        isActive: true
      }
    });

    if (!memberToPromote) {
      throw new ApiError(404, 'Member not found in the group');
    }

    if (memberToPromote.role === 'admin') {
      throw new ApiError(400, 'Member is already an admin');
    }

    // Make admin
    await memberToPromote.update({ role: 'admin' });

    logger.info(`Member ${memberWalletAddress} made admin in group ${groupId}`);

    res.status(200).json(
      new ApiResponse(200, {
        memberWalletAddress,
        newRole: 'admin'
      }, 'Member made admin successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Remove admin privileges (creator only)
 */
const removeAdmin = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let { walletAddress, memberWalletAddress } = req.body;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!walletAddress || !memberWalletAddress) {
      throw new ApiError(400, 'Both wallet addresses are required');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    // Only creator can remove admin
    if (walletAddress !== group.creatorWalletAddress) {
      throw new ApiError(403, 'Only the group creator can remove admin privileges');
    }

    // Cannot demote the creator
    if (memberWalletAddress === group.creatorWalletAddress) {
      throw new ApiError(403, 'Cannot remove admin from group creator');
    }

    // Find the admin member
    const memberToDemote = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress: memberWalletAddress,
        role: 'admin',
        isActive: true
      }
    });

    if (!memberToDemote) {
      throw new ApiError(404, 'Admin member not found');
    }

    // Remove admin
    await memberToDemote.update({ role: 'member' });

    logger.info(`Admin ${memberWalletAddress} demoted in group ${groupId}`);

    res.status(200).json(
      new ApiResponse(200, {
        memberWalletAddress,
        newRole: 'member'
      }, 'Admin privileges removed successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message in the group
 */
const sendMessage = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const {
      senderWalletAddress,
      content,
      messageType = 'text',
      metadata,
      replyToMessageId
    } = req.body;

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!senderWalletAddress) {
      throw new ApiError(400, 'Sender wallet address is required');
    }

    if (!content || content.trim() === '') {
      throw new ApiError(400, 'Message content is required');
    }

    // Check if user is a member
    const membership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress: senderWalletAddress,
        isActive: true
      }
    });

    if (!membership) {
      throw new ApiError(403, 'You are not a member of this group');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    // Verify reply message exists if provided
    if (replyToMessageId) {
      const replyMessage = await GroupMessage.findOne({
        where: { id: replyToMessageId, groupId }
      });
      if (!replyMessage) {
        throw new ApiError(404, 'Reply message not found');
      }
    }

    // Create the message
    const message = await GroupMessage.create({
      groupId,
      senderWalletAddress,
      content: content.trim(),
      messageType,
      metadata: metadata || null,
      replyToMessageId: replyToMessageId || null
    });

    // Update group with last message info
    await group.update({
      lastMessageAt: message.createdAt,
      lastMessagePreview: content.substring(0, 100),
      lastMessageSenderWallet: senderWalletAddress
    });

    // Update sender's last read
    await membership.update({ lastReadAt: new Date() });

    // Get sender details
    const sender = await User.findOne({
      where: { walletAddress: senderWalletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    // Get reply message details if applicable
    let replyToMessage = null;
    if (replyToMessageId) {
      const replyMsg = await GroupMessage.findByPk(replyToMessageId, {
        include: [{
          model: User,
          as: 'sender',
          attributes: ['walletAddress', 'username', 'profileImage']
        }]
      });
      if (replyMsg) {
        replyToMessage = {
          id: replyMsg.id,
          content: replyMsg.content,
          senderWalletAddress: replyMsg.senderWalletAddress,
          sender: replyMsg.sender
        };
      }
    }

    // Fetch subscription plans for sender and reply sender
    const walletAddresses = [
      sender?.walletAddress,
      replyToMessage?.sender?.walletAddress
    ].filter(Boolean);

    const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

    // Add subscription plan to sender
    const senderWithSubscription = sender ? {
      ...sender.toJSON(),
      subscriptionPlan: subscriptionMap[sender.walletAddress] || 'free'
    } : null;

    // Add subscription plan to reply message sender if exists
    if (replyToMessage?.sender) {
      replyToMessage.sender = {
        ...replyToMessage.sender.toJSON ? replyToMessage.sender.toJSON() : replyToMessage.sender,
        subscriptionPlan: subscriptionMap[replyToMessage.sender.walletAddress] || 'free'
      };
    }

    logger.info(`Message sent to group ${groupId} by ${senderWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, {
        message: {
          id: message.id,
          groupId: message.groupId,
          senderWalletAddress: message.senderWalletAddress,
          sender: senderWithSubscription,
          content: message.content,
          messageType: message.messageType,
          metadata: message.metadata,
          replyToMessageId: message.replyToMessageId,
          replyToMessage,
          createdAt: message.createdAt
        }
      }, 'Message sent successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages in a group
 */
const getMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let walletAddress = await resolvePrimaryWallet(req.params.walletAddress);
    const { page = 1, limit = 50 } = req.query;

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    // Check if user is a member
    const membership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        isActive: true
      }
    });

    if (!membership) {
      throw new ApiError(403, 'You are not a member of this group');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get messages with pagination
    const { count, rows: messages } = await GroupMessage.findAndCountAll({
      where: { groupId },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get reply message details
    const replyMessageIds = messages
      .filter(m => m.replyToMessageId)
      .map(m => m.replyToMessageId);

    let replyMessagesMap = {};
    if (replyMessageIds.length > 0) {
      const replyMessages = await GroupMessage.findAll({
        where: { id: { [Op.in]: replyMessageIds } },
        include: [{
          model: User,
          as: 'sender',
          attributes: ['walletAddress', 'username', 'profileImage']
        }]
      });
      replyMessages.forEach(msg => {
        replyMessagesMap[msg.id] = {
          id: msg.id,
          content: msg.content,
          senderWalletAddress: msg.senderWalletAddress,
          sender: msg.sender
        };
      });
    }

    // Collect all wallet addresses from messages and reply messages
    const walletAddresses = [
      ...messages.map(m => m.sender?.walletAddress),
      ...Object.values(replyMessagesMap).map(r => r.sender?.walletAddress)
    ].filter(Boolean);

    const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

    // Format messages
    const formattedMessages = messages.map(msg => {
      const senderJson = msg.sender ? msg.sender.toJSON() : null;
      if (senderJson) {
        senderJson.subscriptionPlan = subscriptionMap[senderJson.walletAddress] || 'free';
      }

      let replyToMessage = null;
      if (msg.replyToMessageId && replyMessagesMap[msg.replyToMessageId]) {
        const replyMsg = replyMessagesMap[msg.replyToMessageId];
        replyToMessage = {
          ...replyMsg,
          sender: replyMsg.sender ? {
            ...(replyMsg.sender.toJSON ? replyMsg.sender.toJSON() : replyMsg.sender),
            subscriptionPlan: subscriptionMap[replyMsg.sender.walletAddress] || 'free'
          } : null
        };
      }

      return {
        id: msg.id,
        groupId: msg.groupId,
        senderWalletAddress: msg.senderWalletAddress,
        sender: senderJson,
        content: msg.content,
        messageType: msg.messageType,
        metadata: msg.metadata,
        replyToMessageId: msg.replyToMessageId,
        replyToMessage,
        createdAt: msg.createdAt
      };
    });

    // Reverse to show oldest first
    formattedMessages.reverse();

    // Update last read
    await membership.update({ lastReadAt: new Date() });

    logger.info(`Messages fetched for group ${groupId} by ${walletAddress}`);

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
 * Get group members
 */
const getGroupMembers = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let walletAddress = await resolvePrimaryWallet(req.params.walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    // Check if user is a member
    const membership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        isActive: true
      }
    });

    if (!membership) {
      throw new ApiError(403, 'You are not a member of this group');
    }

    const group = await Group.findByPk(groupId);

    if (!group || !group.isActive) {
      throw new ApiError(404, 'Group not found');
    }

    // Get all active members
    const members = await GroupMember.findAll({
      where: { groupId, isActive: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }],
      order: [['role', 'ASC'], ['joinedAt', 'ASC']]
    });

    // Collect wallet addresses and fetch subscriptions
    const walletAddresses = members
      .map(m => m.user?.walletAddress)
      .filter(Boolean);

    const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

    logger.info(`Members fetched for group ${groupId}`);

    res.status(200).json(
      new ApiResponse(200, {
        members: members.map(m => ({
          ...m.user?.toJSON(),
          role: m.role,
          joinedAt: m.joinedAt,
          isCreator: m.walletAddress === group.creatorWalletAddress,
          subscriptionPlan: subscriptionMap[m.user?.walletAddress] || 'free'
        })),
        total: members.length
      }, 'Members retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark group messages as read
 */
const markMessagesAsRead = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let { walletAddress } = req.body;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!groupId) {
      throw new ApiError(400, 'Group ID is required');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Check if user is a member
    const membership = await GroupMember.findOne({
      where: {
        groupId,
        walletAddress,
        isActive: true
      }
    });

    if (!membership) {
      throw new ApiError(403, 'You are not a member of this group');
    }

    // Update last read timestamp
    await membership.update({ lastReadAt: new Date() });

    logger.info(`Messages marked as read for group ${groupId} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Messages marked as read')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread count for all groups
 */
const getUnreadCount = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Find all groups where user is a member
    const memberGroups = await GroupMember.findAll({
      where: {
        walletAddress,
        isActive: true
      },
      attributes: ['groupId', 'lastReadAt']
    });

    if (memberGroups.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, {
          totalUnread: 0,
          unreadByGroup: []
        }, 'Unread count retrieved successfully')
      );
    }

    // Calculate unread count for each group
    let totalUnread = 0;
    const unreadByGroup = await Promise.all(memberGroups.map(async (membership) => {
      const unreadCount = await GroupMessage.count({
        where: {
          groupId: membership.groupId,
          createdAt: {
            [Op.gt]: membership.lastReadAt || new Date(0)
          },
          senderWalletAddress: {
            [Op.ne]: walletAddress
          }
        }
      });

      totalUnread += unreadCount;

      if (unreadCount > 0) {
        const group = await Group.findByPk(membership.groupId, {
          attributes: ['id', 'name', 'groupImage']
        });
        return {
          groupId: membership.groupId,
          groupName: group?.name,
          groupImage: extractIpfsHash(group?.groupImage),
          unreadCount
        };
      }
      return null;
    }));

    logger.info(`Unread count fetched for wallet: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        totalUnread,
        unreadByGroup: unreadByGroup.filter(Boolean)
      }, 'Unread count retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get total unread count only (for notification badge)
 */
const getTotalUnreadCount = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    if (walletAddress) walletAddress = await resolvePrimaryWallet(walletAddress);

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Find all groups where user is a member
    const memberGroups = await GroupMember.findAll({
      where: {
        walletAddress,
        isActive: true
      },
      attributes: ['groupId', 'lastReadAt']
    });

    if (memberGroups.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, { count: 0 }, 'Unread count retrieved successfully')
      );
    }

    // Calculate total unread count
    let totalUnread = 0;
    for (const membership of memberGroups) {
      const unreadCount = await GroupMessage.count({
        where: {
          groupId: membership.groupId,
          createdAt: {
            [Op.gt]: membership.lastReadAt || new Date(0)
          },
          senderWalletAddress: {
            [Op.ne]: walletAddress
          }
        }
      });
      totalUnread += unreadCount;
    }

    logger.info(`Total unread count fetched for badge: ${walletAddress}, count: ${totalUnread}`);

    res.status(200).json(
      new ApiResponse(200, { count: totalUnread }, 'Unread count retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupDetails,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMember,
  leaveGroup,
  makeAdmin,
  removeAdmin,
  sendMessage,
  getMessages,
  getGroupMembers,
  markMessagesAsRead,
  getUnreadCount,
  getTotalUnreadCount
};
