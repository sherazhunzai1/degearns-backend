const { Op } = require('sequelize');
const { Drop, DropMint, AdminWallet, AdminActivity, sequelize } = require('../../models');
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
 * Get platform fees overview
 */
const getFeesOverview = async (req, res) => {
  // Get totals
  const [
    totalPlatformFeesCollected,
    pendingPlatformFees,
    failedPlatformFees,
    refundedPlatformFees,
    totalMintRevenue,
    totalDropsWithPaidFees,
    totalDropsWithPendingFees
  ] = await Promise.all([
    Drop.sum('totalPlatformFees', { where: { platformFeesStatus: 'paid' } }),
    Drop.sum('totalPlatformFees', { where: { platformFeesStatus: 'pending' } }),
    Drop.sum('totalPlatformFees', { where: { platformFeesStatus: 'failed' } }),
    Drop.sum('totalPlatformFees', { where: { platformFeesStatus: 'refunded' } }),
    DropMint.sum('mintPrice'),
    Drop.count({ where: { platformFeesStatus: 'paid' } }),
    Drop.count({ where: { platformFeesStatus: 'pending' } })
  ]);

  // Get platform fees wallet
  const platformFeesWallet = await AdminWallet.findOne({
    where: { type: 'platformFees', isActive: true }
  });

  res.status(200).json(new ApiResponse(200, {
    platformFees: {
      collected: totalPlatformFeesCollected || '0',
      collectedXrp: ((parseFloat(totalPlatformFeesCollected) || 0) / 1000000).toFixed(6),
      pending: pendingPlatformFees || '0',
      pendingXrp: ((parseFloat(pendingPlatformFees) || 0) / 1000000).toFixed(6),
      failed: failedPlatformFees || '0',
      failedXrp: ((parseFloat(failedPlatformFees) || 0) / 1000000).toFixed(6),
      refunded: refundedPlatformFees || '0',
      refundedXrp: ((parseFloat(refundedPlatformFees) || 0) / 1000000).toFixed(6)
    },
    mintRevenue: {
      total: totalMintRevenue || '0',
      totalXrp: ((parseFloat(totalMintRevenue) || 0) / 1000000).toFixed(6)
    },
    drops: {
      paidFees: totalDropsWithPaidFees,
      pendingFees: totalDropsWithPendingFees
    },
    platformFeesWallet: platformFeesWallet ? {
      address: platformFeesWallet.walletAddress,
      label: platformFeesWallet.label
    } : null
  }, 'Fees overview retrieved successfully'));
};

/**
 * Get fee transactions history
 */
const getFeeTransactions = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    sortBy = 'updatedAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (status) {
    where.platformFeesStatus = status;
  }

  // Valid sort fields
  const validSortFields = ['createdAt', 'updatedAt', 'totalPlatformFees', 'name'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'updatedAt';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows: drops } = await Drop.findAndCountAll({
    where,
    attributes: [
      'id',
      'name',
      'creatorWalletAddress',
      'totalPlatformFees',
      'platformFeesStatus',
      'platformFeesTransactionHash',
      'setupFee',
      'platformFeePerNft',
      'totalSupply',
      'createdAt',
      'updatedAt'
    ],
    order: [[sortField, order]],
    limit: parseInt(limit),
    offset
  });

  const dropsWithFees = drops.map(drop => ({
    ...drop.toJSON(),
    feesBreakdown: drop.getFeesBreakdown()
  }));

  res.status(200).json(new ApiResponse(200, {
    transactions: dropsWithFees,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Fee transactions retrieved successfully'));
};

/**
 * Get fee statistics by period
 */
const getFeeStatistics = async (req, res) => {
  const { period = '30d' } = req.query;

  // Calculate date range
  let days;
  switch (period) {
    case '7d': days = 7; break;
    case '30d': days = 30; break;
    case '90d': days = 90; break;
    case '365d': days = 365; break;
    default: days = 30;
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get platform fees by day
  const feesByDay = await Drop.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('updatedAt')), 'date'],
      [sequelize.fn('SUM', sequelize.col('totalPlatformFees')), 'totalFees'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'dropCount']
    ],
    where: {
      platformFeesStatus: 'paid',
      updatedAt: { [Op.gte]: startDate }
    },
    group: [sequelize.fn('DATE', sequelize.col('updatedAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('updatedAt')), 'ASC']]
  });

  // Get mint fees by day
  const mintFeesByDay = await DropMint.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('SUM', sequelize.col('mintPrice')), 'totalMintRevenue'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'mintCount']
    ],
    where: {
      createdAt: { [Op.gte]: startDate }
    },
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
  });

  // Calculate period totals
  const [periodPlatformFees, periodMintRevenue, periodMintCount, periodDropCount] = await Promise.all([
    Drop.sum('totalPlatformFees', {
      where: {
        platformFeesStatus: 'paid',
        updatedAt: { [Op.gte]: startDate }
      }
    }),
    DropMint.sum('mintPrice', { where: { createdAt: { [Op.gte]: startDate } } }),
    DropMint.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Drop.count({
      where: {
        platformFeesStatus: 'paid',
        updatedAt: { [Op.gte]: startDate }
      }
    })
  ]);

  res.status(200).json(new ApiResponse(200, {
    period,
    days,
    summary: {
      platformFees: periodPlatformFees || '0',
      platformFeesXrp: ((parseFloat(periodPlatformFees) || 0) / 1000000).toFixed(6),
      mintRevenue: periodMintRevenue || '0',
      mintRevenueXrp: ((parseFloat(periodMintRevenue) || 0) / 1000000).toFixed(6),
      mintCount: periodMintCount,
      dropCount: periodDropCount
    },
    daily: {
      platformFees: feesByDay.map(f => ({
        date: f.get('date'),
        fees: f.get('totalFees') || '0',
        feesXrp: ((parseFloat(f.get('totalFees')) || 0) / 1000000).toFixed(6),
        dropCount: parseInt(f.get('dropCount'))
      })),
      mintFees: mintFeesByDay.map(m => ({
        date: m.get('date'),
        revenue: m.get('totalMintRevenue') || '0',
        revenueXrp: ((parseFloat(m.get('totalMintRevenue')) || 0) / 1000000).toFixed(6),
        mintCount: parseInt(m.get('mintCount'))
      }))
    }
  }, 'Fee statistics retrieved successfully'));
};

/**
 * Mark drop fees as paid (manual override)
 */
const markFeesAsPaid = async (req, res) => {
  const { dropId } = req.params;
  const { transactionHash, reason } = req.body;

  const drop = await Drop.findByPk(dropId);

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  if (drop.platformFeesStatus === 'paid') {
    throw new ApiError(400, 'Fees are already marked as paid');
  }

  const previousStatus = drop.platformFeesStatus;

  await drop.update({
    platformFeesStatus: 'paid',
    platformFeesTransactionHash: transactionHash || drop.platformFeesTransactionHash
  });

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'fee_update',
    'fee',
    drop.id,
    drop.name,
    {
      previousValue: { platformFeesStatus: previousStatus },
      newValue: { platformFeesStatus: 'paid', transactionHash },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    drop: {
      id: drop.id,
      name: drop.name,
      platformFeesStatus: drop.platformFeesStatus,
      platformFeesTransactionHash: drop.platformFeesTransactionHash,
      totalPlatformFees: drop.totalPlatformFees
    }
  }, 'Fees marked as paid successfully'));
};

/**
 * Mark drop fees as refunded
 */
const markFeesAsRefunded = async (req, res) => {
  const { dropId } = req.params;
  const { transactionHash, reason } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Reason for refund is required');
  }

  const drop = await Drop.findByPk(dropId);

  if (!drop) {
    throw new ApiError(404, 'Drop not found');
  }

  const previousStatus = drop.platformFeesStatus;

  await drop.update({
    platformFeesStatus: 'refunded',
    metadata: {
      ...drop.metadata,
      refundReason: reason,
      refundedAt: new Date().toISOString(),
      refundedBy: getAdminWallet(req),
      refundTransactionHash: transactionHash
    }
  });

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'drop_refund',
    'fee',
    drop.id,
    drop.name,
    {
      previousValue: { platformFeesStatus: previousStatus },
      newValue: { platformFeesStatus: 'refunded', transactionHash },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    drop: {
      id: drop.id,
      name: drop.name,
      platformFeesStatus: drop.platformFeesStatus,
      totalPlatformFees: drop.totalPlatformFees
    }
  }, 'Fees marked as refunded successfully'));
};

/**
 * Get drops with pending fees
 */
const getPendingFees = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: drops } = await Drop.findAndCountAll({
    where: { platformFeesStatus: 'pending' },
    attributes: [
      'id',
      'name',
      'creatorWalletAddress',
      'totalPlatformFees',
      'setupFee',
      'platformFeePerNft',
      'totalSupply',
      'status',
      'createdAt'
    ],
    order: [['createdAt', 'ASC']],
    limit: parseInt(limit),
    offset
  });

  const dropsWithFees = drops.map(drop => ({
    ...drop.toJSON(),
    feesBreakdown: drop.getFeesBreakdown()
  }));

  // Calculate total pending
  const totalPending = await Drop.sum('totalPlatformFees', { where: { platformFeesStatus: 'pending' } });

  res.status(200).json(new ApiResponse(200, {
    drops: dropsWithFees,
    totalPending: totalPending || '0',
    totalPendingXrp: ((parseFloat(totalPending) || 0) / 1000000).toFixed(6),
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Pending fees retrieved successfully'));
};

/**
 * Get drops with failed fee payments
 */
const getFailedFees = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: drops } = await Drop.findAndCountAll({
    where: { platformFeesStatus: 'failed' },
    attributes: [
      'id',
      'name',
      'creatorWalletAddress',
      'totalPlatformFees',
      'setupFee',
      'platformFeePerNft',
      'totalSupply',
      'status',
      'createdAt',
      'metadata'
    ],
    order: [['updatedAt', 'DESC']],
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
  }, 'Failed fees retrieved successfully'));
};

/**
 * Export fee report (returns data for CSV/Excel export)
 */
const exportFeeReport = async (req, res) => {
  const { startDate, endDate, status } = req.query;

  const where = {};

  if (startDate && endDate) {
    where.updatedAt = {
      [Op.between]: [new Date(startDate), new Date(endDate)]
    };
  } else if (startDate) {
    where.updatedAt = { [Op.gte]: new Date(startDate) };
  } else if (endDate) {
    where.updatedAt = { [Op.lte]: new Date(endDate) };
  }

  if (status) {
    where.platformFeesStatus = status;
  }

  const drops = await Drop.findAll({
    where,
    attributes: [
      'id',
      'name',
      'creatorWalletAddress',
      'totalPlatformFees',
      'platformFeesStatus',
      'platformFeesTransactionHash',
      'setupFee',
      'platformFeePerNft',
      'totalSupply',
      'mintedCount',
      'totalRevenue',
      'createdAt',
      'updatedAt'
    ],
    order: [['createdAt', 'DESC']]
  });

  const reportData = drops.map(drop => {
    const feesBreakdown = drop.getFeesBreakdown();
    return {
      dropId: drop.id,
      dropName: drop.name,
      creatorWallet: drop.creatorWalletAddress,
      totalPlatformFeesDrops: drop.totalPlatformFees,
      totalPlatformFeesXrp: feesBreakdown.totalPlatformFeesXrp,
      setupFeeDrops: drop.setupFee,
      setupFeeXrp: feesBreakdown.setupFeeXrp,
      feePerNftDrops: drop.platformFeePerNft,
      feePerNftXrp: feesBreakdown.platformFeePerNftXrp,
      totalSupply: drop.totalSupply,
      mintedCount: drop.mintedCount,
      totalRevenueDrops: drop.totalRevenue,
      totalRevenueXrp: ((parseFloat(drop.totalRevenue) || 0) / 1000000).toFixed(6),
      feesStatus: drop.platformFeesStatus,
      transactionHash: drop.platformFeesTransactionHash || '',
      createdAt: drop.createdAt,
      updatedAt: drop.updatedAt
    };
  });

  // Calculate summary
  const summary = {
    totalRecords: reportData.length,
    totalFeesCollected: drops
      .filter(d => d.platformFeesStatus === 'paid')
      .reduce((sum, d) => sum + (parseFloat(d.totalPlatformFees) || 0), 0),
    totalFeesPending: drops
      .filter(d => d.platformFeesStatus === 'pending')
      .reduce((sum, d) => sum + (parseFloat(d.totalPlatformFees) || 0), 0),
    totalMintRevenue: drops.reduce((sum, d) => sum + (parseFloat(d.totalRevenue) || 0), 0)
  };

  res.status(200).json(new ApiResponse(200, {
    report: reportData,
    summary: {
      ...summary,
      totalFeesCollectedXrp: (summary.totalFeesCollected / 1000000).toFixed(6),
      totalFeesPendingXrp: (summary.totalFeesPending / 1000000).toFixed(6),
      totalMintRevenueXrp: (summary.totalMintRevenue / 1000000).toFixed(6)
    },
    filters: { startDate, endDate, status }
  }, 'Fee report generated successfully'));
};

module.exports = {
  getFeesOverview,
  getFeeTransactions,
  getFeeStatistics,
  markFeesAsPaid,
  markFeesAsRefunded,
  getPendingFees,
  getFailedFees,
  exportFeeReport
};
