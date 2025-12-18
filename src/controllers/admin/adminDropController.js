const { Op } = require('sequelize');
const { Drop, DropNft, DropMint, DropAllowedWallet, User, Collection, AdminActivity, sequelize } = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

// Helper to get admin wallet (fallback for dev mode)
const getAdminWallet = (req) => req.user?.walletAddress || 'dev-admin';

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
 * Get all drops with filters and pagination
 */
const getDrops = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    platformFeesStatus,
    creatorWallet,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { creatorWalletAddress: { [Op.like]: `%${search}%` } }
    ];
  }

  if (status) {
    where.status = status;
  }

  if (platformFeesStatus) {
    where.platformFeesStatus = platformFeesStatus;
  }

  if (creatorWallet) {
    where.creatorWalletAddress = creatorWallet;
  }

  // Valid sort fields
  const validSortFields = ['createdAt', 'name', 'status', 'totalSupply', 'mintedCount', 'pricePerNft', 'startDate', 'endDate'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows: drops } = await Drop.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      },
      {
        model: Collection,
        as: 'collection',
        attributes: ['id', 'name', 'slug', 'image', 'isVerified'],
        required: false
      }
    ],
    order: [[sortField, order]],
    limit: parseInt(limit),
    offset
  });

  // Add computed fields
  const dropsWithStats = drops.map(drop => ({
    ...drop.toJSON(),
    remainingSupply: drop.getRemainingSupply(),
    feesBreakdown: drop.getFeesBreakdown()
  }));

  res.status(200).json(new ApiResponse(200, {
    drops: dropsWithStats,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Drops retrieved successfully'));
};

/**
 * Get drop by ID with full details
 */
const getDropById = async (req, res) => {
  const { dropId } = req.params;

  const drop = await Drop.findByPk(dropId, {
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      },
      {
        model: Collection,
        as: 'collection',
        required: false
      }
    ]
  });

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  // Get additional stats
  const [nftCount, mintCount, allowlistCount, totalRevenueSum] = await Promise.all([
    DropNft.count({ where: { dropId } }),
    DropMint.count({ where: { dropId } }),
    DropAllowedWallet.count({ where: { dropId } }),
    DropMint.sum('mintPrice', { where: { dropId } })
  ]);

  // Get NFT status breakdown
  const nftStatusBreakdown = await DropNft.findAll({
    where: { dropId },
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status']
  });

  res.status(200).json(new ApiResponse(200, {
    drop: {
      ...drop.toJSON(),
      remainingSupply: drop.getRemainingSupply(),
      feesBreakdown: drop.getFeesBreakdown()
    },
    stats: {
      nftCount,
      mintCount,
      allowlistCount,
      totalRevenue: totalRevenueSum || '0',
      nftStatusBreakdown: nftStatusBreakdown.reduce((acc, item) => {
        acc[item.status] = parseInt(item.get('count'));
        return acc;
      }, {})
    }
  }, 'Drop details retrieved successfully'));
};

/**
 * Update drop status (admin override)
 */
const updateDropStatus = async (req, res) => {
  const { dropId } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['draft', 'scheduled', 'active', 'paused', 'ended', 'sold_out'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const drop = await Drop.findByPk(dropId);

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  const previousStatus = drop.status;

  await drop.update({ status });

  // Log activity
  await logActivity(
    getAdminWallet(req),
    status === 'paused' ? 'drop_pause' : 'drop_update',
    'drop',
    drop.id,
    drop.name,
    {
      previousValue: { status: previousStatus },
      newValue: { status },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    drop: drop.toJSON()
  }, `Drop status updated to ${status}`));
};

/**
 * Pause a drop
 */
const pauseDrop = async (req, res) => {
  const { dropId } = req.params;
  const { reason } = req.body;

  const drop = await Drop.findByPk(dropId);

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  if (drop.status === 'paused') {
    throw new ApiError(400, 'Drop is already paused');
  }

  const previousStatus = drop.status;

  await drop.update({
    status: 'paused',
    isMintingEnabled: false
  });

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'drop_pause',
    'drop',
    drop.id,
    drop.name,
    {
      previousValue: { status: previousStatus, isMintingEnabled: true },
      newValue: { status: 'paused', isMintingEnabled: false },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    drop: drop.toJSON()
  }, 'Drop paused successfully'));
};

/**
 * Resume a paused drop
 */
const resumeDrop = async (req, res) => {
  const { dropId } = req.params;
  const { status = 'active', enableMinting = true, reason } = req.body;

  const drop = await Drop.findByPk(dropId);

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  const previousStatus = drop.status;

  await drop.update({
    status,
    isMintingEnabled: enableMinting
  });

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'drop_resume',
    'drop',
    drop.id,
    drop.name,
    {
      previousValue: { status: previousStatus },
      newValue: { status, isMintingEnabled: enableMinting },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    drop: drop.toJSON()
  }, 'Drop resumed successfully'));
};

/**
 * Update drop platform fees status
 */
const updateDropFeesStatus = async (req, res) => {
  const { dropId } = req.params;
  const { platformFeesStatus, transactionHash, reason } = req.body;

  const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
  if (!validStatuses.includes(platformFeesStatus)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const drop = await Drop.findByPk(dropId);

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  const previousStatus = drop.platformFeesStatus;

  const updateData = { platformFeesStatus };
  if (transactionHash) {
    updateData.platformFeesTransactionHash = transactionHash;
  }

  await drop.update(updateData);

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'fee_update',
    'drop',
    drop.id,
    drop.name,
    {
      previousValue: { platformFeesStatus: previousStatus },
      newValue: updateData,
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    drop: drop.toJSON()
  }, `Platform fees status updated to ${platformFeesStatus}`));
};

/**
 * Delete drop (admin override)
 */
const deleteDrop = async (req, res) => {
  const { dropId } = req.params;
  const { reason } = req.body;

  const drop = await Drop.findByPk(dropId);

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  // Check if drop has mints - warn but allow deletion
  const mintCount = await DropMint.count({ where: { dropId } });

  // Log activity before deletion
  await logActivity(
    getAdminWallet(req),
    'drop_delete',
    'drop',
    drop.id,
    drop.name,
    {
      previousValue: drop.toJSON(),
      reason,
      metadata: { mintCount }
    }
  );

  // Delete associated records
  await Promise.all([
    DropNft.destroy({ where: { dropId } }),
    DropAllowedWallet.destroy({ where: { dropId } }),
    DropMint.destroy({ where: { dropId } })
  ]);

  // Delete the drop
  await drop.destroy();

  res.status(200).json(new ApiResponse(200, {
    deletedMints: mintCount
  }, 'Drop and associated data deleted successfully'));
};

/**
 * Update drop details (admin override)
 */
const updateDrop = async (req, res) => {
  const { dropId } = req.params;
  const {
    name,
    description,
    image,
    bannerImage,
    pricePerNft,
    limitPerWallet,
    startDate,
    endDate,
    isMintingEnabled,
    isAllowlistEnabled,
    isFreeMint,
    isBurnable,
    isTransferable,
    isOnlyXrp,
    websiteUrl,
    twitterUrl,
    discordUrl,
    telegramUrl,
    reason
  } = req.body;

  const drop = await Drop.findByPk(dropId);

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  const previousData = drop.toJSON();

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (image !== undefined) updateData.image = image;
  if (bannerImage !== undefined) updateData.bannerImage = bannerImage;
  if (pricePerNft !== undefined) updateData.pricePerNft = pricePerNft;
  if (limitPerWallet !== undefined) updateData.limitPerWallet = limitPerWallet;
  if (startDate !== undefined) updateData.startDate = startDate;
  if (endDate !== undefined) updateData.endDate = endDate;
  if (isMintingEnabled !== undefined) updateData.isMintingEnabled = isMintingEnabled;
  if (isAllowlistEnabled !== undefined) updateData.isAllowlistEnabled = isAllowlistEnabled;
  if (isFreeMint !== undefined) updateData.isFreeMint = isFreeMint;
  if (isBurnable !== undefined) updateData.isBurnable = isBurnable;
  if (isTransferable !== undefined) updateData.isTransferable = isTransferable;
  if (isOnlyXrp !== undefined) updateData.isOnlyXrp = isOnlyXrp;
  if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl;
  if (twitterUrl !== undefined) updateData.twitterUrl = twitterUrl;
  if (discordUrl !== undefined) updateData.discordUrl = discordUrl;
  if (telegramUrl !== undefined) updateData.telegramUrl = telegramUrl;

  await drop.update(updateData);

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'drop_update',
    'drop',
    drop.id,
    drop.name,
    {
      previousValue: previousData,
      newValue: updateData,
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    drop: drop.toJSON()
  }, 'Drop updated successfully'));
};

/**
 * Get drop statistics overview
 */
const getDropStatistics = async (req, res) => {
  const [
    totalDrops,
    activeDrops,
    pausedDrops,
    draftDrops,
    endedDrops,
    soldOutDrops,
    paidFeesDrops,
    pendingFeesDrops,
    totalMints,
    dropsToday,
    dropsThisWeek,
    dropsThisMonth
  ] = await Promise.all([
    Drop.count(),
    Drop.count({ where: { status: 'active' } }),
    Drop.count({ where: { status: 'paused' } }),
    Drop.count({ where: { status: 'draft' } }),
    Drop.count({ where: { status: 'ended' } }),
    Drop.count({ where: { status: 'sold_out' } }),
    Drop.count({ where: { platformFeesStatus: 'paid' } }),
    Drop.count({ where: { platformFeesStatus: 'pending' } }),
    DropMint.count(),
    Drop.count({
      where: {
        createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    }),
    Drop.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    }),
    Drop.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  // Calculate total platform fees collected
  const paidDrops = await Drop.findAll({
    where: { platformFeesStatus: 'paid' },
    attributes: ['totalPlatformFees']
  });

  let totalPlatformFeesCollected = BigInt(0);
  paidDrops.forEach(drop => {
    if (drop.totalPlatformFees) {
      totalPlatformFeesCollected += BigInt(drop.totalPlatformFees);
    }
  });

  // Calculate total mint revenue
  const totalMintRevenue = await Drop.sum('totalRevenue') || '0';

  res.status(200).json(new ApiResponse(200, {
    totalDrops,
    statusBreakdown: {
      active: activeDrops,
      paused: pausedDrops,
      draft: draftDrops,
      ended: endedDrops,
      soldOut: soldOutDrops
    },
    feesStatus: {
      paid: paidFeesDrops,
      pending: pendingFeesDrops
    },
    totalMints,
    totalPlatformFeesCollected: totalPlatformFeesCollected.toString(),
    totalPlatformFeesCollectedXrp: (Number(totalPlatformFeesCollected) / 1000000).toFixed(6),
    totalMintRevenue,
    totalMintRevenueXrp: (parseFloat(totalMintRevenue) / 1000000).toFixed(6),
    newDrops: {
      today: dropsToday,
      thisWeek: dropsThisWeek,
      thisMonth: dropsThisMonth
    }
  }, 'Drop statistics retrieved successfully'));
};

/**
 * Get drops with pending fees
 */
const getDropsWithPendingFees = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: drops } = await Drop.findAndCountAll({
    where: { platformFeesStatus: 'pending' },
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage']
      }
    ],
    order: [['createdAt', 'ASC']],
    limit: parseInt(limit),
    offset
  });

  const dropsWithFees = drops.map(drop => ({
    ...drop.toJSON(),
    feesBreakdown: drop.getFeesBreakdown()
  }));

  res.status(200).json(new ApiResponse(200, {
    drops: dropsWithFees,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Drops with pending fees retrieved successfully'));
};

/**
 * Get drop mints
 */
const getDropMints = async (req, res) => {
  const { dropId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const drop = await Drop.findByPk(dropId);
  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  const { count, rows: mints } = await DropMint.findAndCountAll({
    where: { dropId },
    include: [
      {
        model: User,
        as: 'minter',
        attributes: ['walletAddress', 'username', 'profileImage']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.status(200).json(new ApiResponse(200, {
    drop: {
      id: drop.id,
      name: drop.name,
      totalSupply: drop.totalSupply,
      mintedCount: drop.mintedCount
    },
    mints,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Drop mints retrieved successfully'));
};

/**
 * Get drop allowlist
 */
const getDropAllowlist = async (req, res) => {
  const { dropId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const drop = await Drop.findByPk(dropId);
  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  const { count, rows: allowlist } = await DropAllowedWallet.findAndCountAll({
    where: { dropId },
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.status(200).json(new ApiResponse(200, {
    drop: {
      id: drop.id,
      name: drop.name,
      isAllowlistEnabled: drop.isAllowlistEnabled
    },
    allowlist,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Drop allowlist retrieved successfully'));
};

module.exports = {
  getDrops,
  getDropById,
  updateDropStatus,
  pauseDrop,
  resumeDrop,
  updateDropFeesStatus,
  deleteDrop,
  updateDrop,
  getDropStatistics,
  getDropsWithPendingFees,
  getDropMints,
  getDropAllowlist
};
