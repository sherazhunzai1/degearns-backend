const { Op } = require('sequelize');
const {
  User,
  Collection,
  Drop,
  DropMint,
  DropNft,
  Post,
  PostComment,
  Follow,
  Notification,
  AdminActivity,
  sequelize
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get overall platform dashboard statistics
 */
const getDashboardOverview = async (req, res) => {
  // Get all stats in parallel
  const [
    // User stats
    totalUsers,
    verifiedUsers,
    bannedUsers,
    adminUsers,
    newUsersToday,
    newUsersThisWeek,

    // Collection stats
    totalCollections,
    verifiedCollections,

    // Drop stats
    totalDrops,
    activeDrops,
    totalMints,

    // Post stats
    totalPosts,
    activePosts,
    totalComments,

    // Follow stats
    totalFollows
  ] = await Promise.all([
    // Users
    User.count(),
    User.count({ where: { isVerified: true } }),
    User.count({ where: { isBanned: true } }),
    User.count({ where: { role: 'admin' } }),
    User.count({ where: { createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    User.count({ where: { createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),

    // Collections
    Collection.count(),
    Collection.count({ where: { isVerified: true } }),

    // Drops
    Drop.count(),
    Drop.count({ where: { status: 'active' } }),
    DropMint.count(),

    // Posts
    Post.count(),
    Post.count({ where: { isActive: true } }),
    PostComment.count({ where: { isActive: true } }),

    // Follows
    Follow.count()
  ]);

  // Calculate revenue stats
  const [totalMintRevenue, totalPlatformFees] = await Promise.all([
    Drop.sum('totalRevenue'),
    Drop.sum('totalPlatformFees', { where: { platformFeesStatus: 'paid' } })
  ]);

  // Get total volume from collections
  const totalVolume = await Collection.sum('totalVolume');

  res.status(200).json(new ApiResponse(200, {
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      banned: bannedUsers,
      admins: adminUsers,
      newToday: newUsersToday,
      newThisWeek: newUsersThisWeek
    },
    collections: {
      total: totalCollections,
      verified: verifiedCollections
    },
    drops: {
      total: totalDrops,
      active: activeDrops,
      totalMints
    },
    social: {
      posts: totalPosts,
      activePosts,
      comments: totalComments,
      follows: totalFollows
    },
    revenue: {
      totalMintRevenue: totalMintRevenue || '0',
      totalMintRevenueXrp: ((parseFloat(totalMintRevenue) || 0) / 1000000).toFixed(6),
      totalPlatformFees: totalPlatformFees || '0',
      totalPlatformFeesXrp: ((parseFloat(totalPlatformFees) || 0) / 1000000).toFixed(6),
      totalVolume: totalVolume || '0',
      totalVolumeXrp: ((parseFloat(totalVolume) || 0) / 1000000).toFixed(6)
    }
  }, 'Dashboard overview retrieved successfully'));
};

/**
 * Get growth analytics over time
 */
const getGrowthAnalytics = async (req, res) => {
  const { period = '30d' } = req.query;

  // Calculate date range
  let days;
  switch (period) {
    case '7d':
      days = 7;
      break;
    case '30d':
      days = 30;
      break;
    case '90d':
      days = 90;
      break;
    case '365d':
      days = 365;
      break;
    default:
      days = 30;
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get daily user registrations
  const userGrowth = await User.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      createdAt: { [Op.gte]: startDate }
    },
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
  });

  // Get daily drop creations
  const dropGrowth = await Drop.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      createdAt: { [Op.gte]: startDate }
    },
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
  });

  // Get daily mints
  const mintGrowth = await DropMint.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('mintPrice')), 'revenue']
    ],
    where: {
      createdAt: { [Op.gte]: startDate }
    },
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
  });

  // Get daily posts
  const postGrowth = await Post.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      createdAt: { [Op.gte]: startDate }
    },
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
  });

  res.status(200).json(new ApiResponse(200, {
    period,
    days,
    userGrowth: userGrowth.map(u => ({
      date: u.get('date'),
      count: parseInt(u.get('count'))
    })),
    dropGrowth: dropGrowth.map(d => ({
      date: d.get('date'),
      count: parseInt(d.get('count'))
    })),
    mintGrowth: mintGrowth.map(m => ({
      date: m.get('date'),
      count: parseInt(m.get('count')),
      revenue: m.get('revenue') || '0'
    })),
    postGrowth: postGrowth.map(p => ({
      date: p.get('date'),
      count: parseInt(p.get('count'))
    }))
  }, 'Growth analytics retrieved successfully'));
};

/**
 * Get top creators by various metrics
 */
const getTopCreators = async (req, res) => {
  const { metric = 'drops', limit = 10 } = req.query;

  let topCreators;

  switch (metric) {
    case 'drops':
      // Top creators by number of drops
      topCreators = await Drop.findAll({
        attributes: [
          'creatorWalletAddress',
          [sequelize.fn('COUNT', sequelize.col('Drop.id')), 'dropCount'],
          [sequelize.fn('SUM', sequelize.col('mintedCount')), 'totalMints']
        ],
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['username', 'profileImage', 'isVerified']
          }
        ],
        group: ['creatorWalletAddress', 'creator.id'],
        order: [[sequelize.literal('dropCount'), 'DESC']],
        limit: parseInt(limit)
      });
      break;

    case 'mints':
      // Top creators by total mints
      topCreators = await Drop.findAll({
        attributes: [
          'creatorWalletAddress',
          [sequelize.fn('COUNT', sequelize.col('Drop.id')), 'dropCount'],
          [sequelize.fn('SUM', sequelize.col('mintedCount')), 'totalMints']
        ],
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['username', 'profileImage', 'isVerified']
          }
        ],
        group: ['creatorWalletAddress', 'creator.id'],
        order: [[sequelize.literal('totalMints'), 'DESC']],
        limit: parseInt(limit)
      });
      break;

    case 'revenue':
      // Top creators by revenue
      topCreators = await Drop.findAll({
        attributes: [
          'creatorWalletAddress',
          [sequelize.fn('COUNT', sequelize.col('Drop.id')), 'dropCount'],
          [sequelize.fn('SUM', sequelize.col('totalRevenue')), 'totalRevenue']
        ],
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['username', 'profileImage', 'isVerified']
          }
        ],
        group: ['creatorWalletAddress', 'creator.id'],
        order: [[sequelize.literal('totalRevenue'), 'DESC']],
        limit: parseInt(limit)
      });
      break;

    case 'collections':
      // Top creators by number of collections
      topCreators = await Collection.findAll({
        attributes: [
          'creatorWalletAddress',
          [sequelize.fn('COUNT', sequelize.col('Collection.id')), 'collectionCount']
        ],
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['username', 'profileImage', 'isVerified']
          }
        ],
        group: ['creatorWalletAddress', 'creator.id'],
        order: [[sequelize.literal('collectionCount'), 'DESC']],
        limit: parseInt(limit)
      });
      break;

    default:
      throw new ApiError(400, 'Invalid metric. Use: drops, mints, revenue, or collections');
  }

  res.status(200).json(new ApiResponse(200, {
    metric,
    topCreators
  }, 'Top creators retrieved successfully'));
};

/**
 * Get recent admin activities
 */
const getRecentActivities = async (req, res) => {
  const { page = 1, limit = 20, action, targetType, adminWallet } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (action) {
    where.action = action;
  }

  if (targetType) {
    where.targetType = targetType;
  }

  if (adminWallet) {
    where.adminWalletAddress = adminWallet;
  }

  const { count, rows: activities } = await AdminActivity.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'admin',
        attributes: ['walletAddress', 'username', 'profileImage']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.status(200).json(new ApiResponse(200, {
    activities,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Admin activities retrieved successfully'));
};

/**
 * Get platform health metrics
 */
const getPlatformHealth = async (req, res) => {
  // Get counts from last 24 hours
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);

  const [
    usersLast24h,
    usersLastHour,
    dropsLast24h,
    mintsLast24h,
    mintsLastHour,
    postsLast24h,
    activitiesLast24h
  ] = await Promise.all([
    User.count({ where: { createdAt: { [Op.gte]: last24h } } }),
    User.count({ where: { createdAt: { [Op.gte]: lastHour } } }),
    Drop.count({ where: { createdAt: { [Op.gte]: last24h } } }),
    DropMint.count({ where: { createdAt: { [Op.gte]: last24h } } }),
    DropMint.count({ where: { createdAt: { [Op.gte]: lastHour } } }),
    Post.count({ where: { createdAt: { [Op.gte]: last24h } } }),
    AdminActivity.count({ where: { createdAt: { [Op.gte]: last24h } } })
  ]);

  // Get pending items that need attention
  const [
    pendingFeesDrops,
    unverifiedCollections,
    hiddenPosts,
    bannedUsers
  ] = await Promise.all([
    Drop.count({ where: { platformFeesStatus: 'pending' } }),
    Collection.count({ where: { isVerified: false } }),
    Post.count({ where: { isActive: false } }),
    User.count({ where: { isBanned: true } })
  ]);

  res.status(200).json(new ApiResponse(200, {
    activity: {
      usersLast24h,
      usersLastHour,
      dropsLast24h,
      mintsLast24h,
      mintsLastHour,
      postsLast24h,
      adminActivitiesLast24h: activitiesLast24h
    },
    pendingItems: {
      pendingFeesDrops,
      unverifiedCollections,
      hiddenPosts,
      bannedUsers
    },
    timestamp: new Date().toISOString()
  }, 'Platform health metrics retrieved successfully'));
};

/**
 * Get revenue breakdown by period
 */
const getRevenueBreakdown = async (req, res) => {
  const { period = '30d' } = req.query;

  // Calculate date range
  let days;
  switch (period) {
    case '7d': days = 7; break;
    case '30d': days = 30; break;
    case '90d': days = 90; break;
    default: days = 30;
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get platform fees by day
  const feesByDay = await Drop.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('updatedAt')), 'date'],
      [sequelize.fn('SUM', sequelize.col('totalPlatformFees')), 'totalFees']
    ],
    where: {
      platformFeesStatus: 'paid',
      updatedAt: { [Op.gte]: startDate }
    },
    group: [sequelize.fn('DATE', sequelize.col('updatedAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('updatedAt')), 'ASC']]
  });

  // Get mint revenue by day
  const revenueByDay = await DropMint.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('SUM', sequelize.col('mintPrice')), 'revenue'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'mintCount']
    ],
    where: {
      createdAt: { [Op.gte]: startDate }
    },
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
  });

  // Calculate totals for the period
  const periodTotalFees = await Drop.sum('totalPlatformFees', {
    where: {
      platformFeesStatus: 'paid',
      updatedAt: { [Op.gte]: startDate }
    }
  });

  const periodTotalRevenue = await DropMint.sum('mintPrice', {
    where: { createdAt: { [Op.gte]: startDate } }
  });

  const periodTotalMints = await DropMint.count({
    where: { createdAt: { [Op.gte]: startDate } }
  });

  res.status(200).json(new ApiResponse(200, {
    period,
    days,
    summary: {
      totalPlatformFees: periodTotalFees || '0',
      totalPlatformFeesXrp: ((parseFloat(periodTotalFees) || 0) / 1000000).toFixed(6),
      totalMintRevenue: periodTotalRevenue || '0',
      totalMintRevenueXrp: ((parseFloat(periodTotalRevenue) || 0) / 1000000).toFixed(6),
      totalMints: periodTotalMints
    },
    daily: {
      platformFees: feesByDay.map(f => ({
        date: f.get('date'),
        fees: f.get('totalFees') || '0',
        feesXrp: ((parseFloat(f.get('totalFees')) || 0) / 1000000).toFixed(6)
      })),
      mintRevenue: revenueByDay.map(r => ({
        date: r.get('date'),
        revenue: r.get('revenue') || '0',
        revenueXrp: ((parseFloat(r.get('revenue')) || 0) / 1000000).toFixed(6),
        mintCount: parseInt(r.get('mintCount'))
      }))
    }
  }, 'Revenue breakdown retrieved successfully'));
};

module.exports = {
  getDashboardOverview,
  getGrowthAnalytics,
  getTopCreators,
  getRecentActivities,
  getPlatformHealth,
  getRevenueBreakdown
};
