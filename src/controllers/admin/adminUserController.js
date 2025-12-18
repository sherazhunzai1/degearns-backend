const { Op } = require('sequelize');
const { User, Follow, Post, Collection, Drop, DropMint, AdminActivity, sequelize } = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Log admin activity
 */
const logActivity = async (adminWallet, action, targetType, targetId, targetIdentifier, data = {}) => {
  try {
    await AdminActivity.create({
      adminWalletAddress: adminWallet,
      action,
      targetType,
      targetId,
      targetIdentifier,
      previousValue: data.previousValue ? JSON.stringify(data.previousValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      reason: data.reason || null,
      metadata: data.metadata || null
    });
  } catch (error) {
    console.error('Failed to log admin activity:', error);
  }
};

/**
 * Get all users with filters and pagination
 */
const getUsers = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    isVerified,
    isBanned,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};

  if (search) {
    where[Op.or] = [
      { walletAddress: { [Op.like]: `%${search}%` } },
      { username: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } }
    ];
  }

  if (role) {
    where.role = role;
  }

  if (isVerified !== undefined) {
    where.isVerified = isVerified === 'true';
  }

  if (isBanned !== undefined) {
    where.isBanned = isBanned === 'true';
  }

  // Valid sort fields
  const validSortFields = ['createdAt', 'username', 'walletAddress', 'role', 'isVerified', 'isBanned'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows: users } = await User.findAndCountAll({
    where,
    order: [[sortField, order]],
    limit: parseInt(limit),
    offset,
    attributes: { exclude: [] }
  });

  // Get additional stats for each user
  const usersWithStats = await Promise.all(users.map(async (user) => {
    const [followersCount, followingCount, postsCount, collectionsCount, dropsCount, mintsCount] = await Promise.all([
      Follow.count({ where: { followingWalletAddress: user.walletAddress } }),
      Follow.count({ where: { followerWalletAddress: user.walletAddress } }),
      Post.count({ where: { authorWalletAddress: user.walletAddress, isActive: true } }),
      Collection.count({ where: { creatorWalletAddress: user.walletAddress } }),
      Drop.count({ where: { creatorWalletAddress: user.walletAddress } }),
      DropMint.count({ where: { minterWalletAddress: user.walletAddress } })
    ]);

    return {
      ...user.toJSON(),
      stats: {
        followersCount,
        followingCount,
        postsCount,
        collectionsCount,
        dropsCount,
        mintsCount
      }
    };
  }));

  res.status(200).json(new ApiResponse(200, {
    users: usersWithStats,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Users retrieved successfully'));
};

/**
 * Get user by wallet address with full details
 */
const getUserByWallet = async (req, res) => {
  const { walletAddress } = req.params;

  const user = await User.findOne({
    where: { walletAddress }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Get comprehensive stats
  const [
    followersCount,
    followingCount,
    postsCount,
    collectionsCount,
    dropsCount,
    mintsCount,
    totalMintRevenue
  ] = await Promise.all([
    Follow.count({ where: { followingWalletAddress: walletAddress } }),
    Follow.count({ where: { followerWalletAddress: walletAddress } }),
    Post.count({ where: { authorWalletAddress: walletAddress, isActive: true } }),
    Collection.count({ where: { creatorWalletAddress: walletAddress } }),
    Drop.count({ where: { creatorWalletAddress: walletAddress } }),
    DropMint.count({ where: { minterWalletAddress: walletAddress } }),
    Drop.sum('totalRevenue', { where: { creatorWalletAddress: walletAddress } })
  ]);

  // Get recent collections
  const recentCollections = await Collection.findAll({
    where: { creatorWalletAddress: walletAddress },
    order: [['createdAt', 'DESC']],
    limit: 5
  });

  // Get recent drops
  const recentDrops = await Drop.findAll({
    where: { creatorWalletAddress: walletAddress },
    order: [['createdAt', 'DESC']],
    limit: 5
  });

  res.status(200).json(new ApiResponse(200, {
    user: user.toJSON(),
    stats: {
      followersCount,
      followingCount,
      postsCount,
      collectionsCount,
      dropsCount,
      mintsCount,
      totalMintRevenue: totalMintRevenue || '0'
    },
    recentCollections,
    recentDrops
  }, 'User details retrieved successfully'));
};

/**
 * Update user role (admin only)
 */
const updateUserRole = async (req, res) => {
  const { walletAddress } = req.params;
  const { role, reason } = req.body;

  if (!['user', 'admin'].includes(role)) {
    throw new ApiError(400, 'Invalid role. Must be "user" or "admin"');
  }

  const user = await User.findOne({
    where: { walletAddress }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent changing own role
  if (user.walletAddress === req.user.walletAddress) {
    throw new ApiError(400, 'Cannot change your own role');
  }

  const previousRole = user.role;

  await user.update({ role });

  // Log activity
  await logActivity(
    req.user.walletAddress,
    'user_role_change',
    'user',
    user.id,
    user.walletAddress,
    {
      previousValue: { role: previousRole },
      newValue: { role },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    user: user.toJSON()
  }, `User role updated to ${role}`));
};

/**
 * Verify/Unverify user
 */
const updateUserVerification = async (req, res) => {
  const { walletAddress } = req.params;
  const { isVerified, reason } = req.body;

  const user = await User.findOne({
    where: { walletAddress }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const wasVerified = user.isVerified;

  await user.update({ isVerified });

  // Log activity
  await logActivity(
    req.user.walletAddress,
    isVerified ? 'user_verify' : 'user_unverify',
    'user',
    user.id,
    user.walletAddress,
    {
      previousValue: { isVerified: wasVerified },
      newValue: { isVerified },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    user: user.toJSON()
  }, isVerified ? 'User verified successfully' : 'User unverified successfully'));
};

/**
 * Ban user
 */
const banUser = async (req, res) => {
  const { walletAddress } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Ban reason is required');
  }

  const user = await User.findOne({
    where: { walletAddress }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent banning yourself
  if (user.walletAddress === req.user.walletAddress) {
    throw new ApiError(400, 'Cannot ban yourself');
  }

  // Prevent banning other admins (unless super admin)
  if (user.role === 'admin' && !req.isSuperAdmin) {
    throw new ApiError(403, 'Only super admin can ban other admins');
  }

  await user.update({
    isBanned: true,
    banReason: reason,
    bannedAt: new Date(),
    bannedBy: req.user.walletAddress
  });

  // Log activity
  await logActivity(
    req.user.walletAddress,
    'user_ban',
    'user',
    user.id,
    user.walletAddress,
    {
      previousValue: { isBanned: false },
      newValue: { isBanned: true, banReason: reason },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    user: user.toJSON()
  }, 'User banned successfully'));
};

/**
 * Unban user
 */
const unbanUser = async (req, res) => {
  const { walletAddress } = req.params;
  const { reason } = req.body;

  const user = await User.findOne({
    where: { walletAddress }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.isBanned) {
    throw new ApiError(400, 'User is not banned');
  }

  const previousBanReason = user.banReason;

  await user.update({
    isBanned: false,
    banReason: null,
    bannedAt: null,
    bannedBy: null
  });

  // Log activity
  await logActivity(
    req.user.walletAddress,
    'user_unban',
    'user',
    user.id,
    user.walletAddress,
    {
      previousValue: { isBanned: true, banReason: previousBanReason },
      newValue: { isBanned: false },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    user: user.toJSON()
  }, 'User unbanned successfully'));
};

/**
 * Delete user (soft delete - marks as deleted)
 */
const deleteUser = async (req, res) => {
  const { walletAddress } = req.params;
  const { reason } = req.body;

  const user = await User.findOne({
    where: { walletAddress }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent deleting yourself
  if (user.walletAddress === req.user.walletAddress) {
    throw new ApiError(400, 'Cannot delete yourself');
  }

  // Prevent deleting other admins (unless super admin)
  if (user.role === 'admin' && !req.isSuperAdmin) {
    throw new ApiError(403, 'Only super admin can delete other admins');
  }

  // Log activity before deletion
  await logActivity(
    req.user.walletAddress,
    'user_delete',
    'user',
    user.id,
    user.walletAddress,
    {
      previousValue: user.toJSON(),
      reason
    }
  );

  // Delete the user
  await user.destroy();

  res.status(200).json(new ApiResponse(200, null, 'User deleted successfully'));
};

/**
 * Get user statistics overview
 */
const getUserStatistics = async (req, res) => {
  const [
    totalUsers,
    totalAdmins,
    verifiedUsers,
    bannedUsers,
    usersToday,
    usersThisWeek,
    usersThisMonth
  ] = await Promise.all([
    User.count(),
    User.count({ where: { role: 'admin' } }),
    User.count({ where: { isVerified: true } }),
    User.count({ where: { isBanned: true } }),
    User.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    }),
    User.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    User.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })
  ]);

  res.status(200).json(new ApiResponse(200, {
    totalUsers,
    totalAdmins,
    verifiedUsers,
    bannedUsers,
    newUsers: {
      today: usersToday,
      thisWeek: usersThisWeek,
      thisMonth: usersThisMonth
    }
  }, 'User statistics retrieved successfully'));
};

/**
 * Bulk update user verification status
 */
const bulkUpdateVerification = async (req, res) => {
  const { walletAddresses, isVerified, reason } = req.body;

  if (!Array.isArray(walletAddresses) || walletAddresses.length === 0) {
    throw new ApiError(400, 'walletAddresses must be a non-empty array');
  }

  const result = await User.update(
    { isVerified },
    { where: { walletAddress: walletAddresses } }
  );

  // Log activity
  await logActivity(
    req.user.walletAddress,
    isVerified ? 'user_verify' : 'user_unverify',
    'user',
    null,
    `Bulk: ${walletAddresses.length} users`,
    {
      newValue: { isVerified, walletAddresses },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    updatedCount: result[0]
  }, `${result[0]} users updated successfully`));
};

module.exports = {
  getUsers,
  getUserByWallet,
  updateUserRole,
  updateUserVerification,
  banUser,
  unbanUser,
  deleteUser,
  getUserStatistics,
  bulkUpdateVerification
};
