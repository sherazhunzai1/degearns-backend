const { Op } = require('sequelize');
const {
  User,
  Drop,
  DropMint,
  Collection,
  Follow,
  Post,
  PostLike,
  PostComment,
  AdminWallet,
  RewardDistribution,
  AdminActivity,
  MonthlyRanking,
  sequelize
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const xrplService = require('../../services/xrplService');
const xrplConfig = require('../../config/xrpl');

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
 * Get top 10 traders (users who spent the most on minting NFTs)
 */
const getTopTraders = async (req, res) => {
  const { month, year, limit = 10 } = req.query;

  // Default to current month/year if not specified
  const targetMonth = parseInt(month) || new Date().getMonth() + 1;
  const targetYear = parseInt(year) || new Date().getFullYear();

  // Calculate date range for the month
  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  // Get top traders by total mint spending
  const topTraders = await DropMint.findAll({
    attributes: [
      'minterWalletAddress',
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('mintPrice'), 'UNSIGNED')), 'totalSpent'],
      [sequelize.fn('COUNT', sequelize.col('DropMint.id')), 'mintCount']
    ],
    where: {
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    },
    group: ['minterWalletAddress'],
    order: [[sequelize.literal('totalSpent'), 'DESC']],
    limit: parseInt(limit),
    raw: true
  });

  // Get user details for each trader
  const tradersWithDetails = await Promise.all(topTraders.map(async (trader, index) => {
    const user = await User.findOne({
      where: { walletAddress: trader.minterWalletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    return {
      rank: index + 1,
      walletAddress: trader.minterWalletAddress,
      totalSpent: trader.totalSpent || '0',
      totalSpentXrp: ((parseFloat(trader.totalSpent) || 0) / 1000000).toFixed(6),
      mintCount: parseInt(trader.mintCount),
      user: user ? user.toJSON() : null
    };
  }));

  res.status(200).json(new ApiResponse(200, {
    category: 'trader',
    period: {
      month: targetMonth,
      year: targetYear
    },
    topPerformers: tradersWithDetails
  }, 'Top traders retrieved successfully'));
};

/**
 * Get top 10 creators (users with highest revenue from drops)
 */
const getTopCreators = async (req, res) => {
  const { month, year, limit = 10 } = req.query;

  // Default to current month/year if not specified
  const targetMonth = parseInt(month) || new Date().getMonth() + 1;
  const targetYear = parseInt(year) || new Date().getFullYear();

  // Calculate date range for the month
  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  // Get top creators by revenue from mints in their drops
  const topCreators = await DropMint.findAll({
    attributes: [
      [sequelize.col('drop.creatorWalletAddress'), 'creatorWalletAddress'],
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('mintPrice'), 'UNSIGNED')), 'totalRevenue'],
      [sequelize.fn('COUNT', sequelize.col('DropMint.id')), 'totalMints']
    ],
    include: [
      {
        model: Drop,
        as: 'drop',
        attributes: [],
        required: true
      }
    ],
    where: {
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    },
    group: ['drop.creatorWalletAddress'],
    order: [[sequelize.literal('totalRevenue'), 'DESC']],
    limit: parseInt(limit),
    raw: true
  });

  // Get user details and drop count for each creator
  const creatorsWithDetails = await Promise.all(topCreators.map(async (creator, index) => {
    const [user, dropCount, collectionCount] = await Promise.all([
      User.findOne({
        where: { walletAddress: creator.creatorWalletAddress },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }),
      Drop.count({
        where: {
          creatorWalletAddress: creator.creatorWalletAddress,
          createdAt: { [Op.between]: [startDate, endDate] }
        }
      }),
      Collection.count({
        where: { creatorWalletAddress: creator.creatorWalletAddress }
      })
    ]);

    return {
      rank: index + 1,
      walletAddress: creator.creatorWalletAddress,
      totalRevenue: creator.totalRevenue || '0',
      totalRevenueXrp: ((parseFloat(creator.totalRevenue) || 0) / 1000000).toFixed(6),
      totalMints: parseInt(creator.totalMints),
      dropCount,
      collectionCount,
      user: user ? user.toJSON() : null
    };
  }));

  res.status(200).json(new ApiResponse(200, {
    category: 'creator',
    period: {
      month: targetMonth,
      year: targetYear
    },
    topPerformers: creatorsWithDetails
  }, 'Top creators retrieved successfully'));
};

/**
 * Get top 10 influencers (users with most followers + engagement)
 */
const getTopInfluencers = async (req, res) => {
  const { month, year, limit = 10 } = req.query;

  // Default to current month/year if not specified
  const targetMonth = parseInt(month) || new Date().getMonth() + 1;
  const targetYear = parseInt(year) || new Date().getFullYear();

  // Calculate date range for the month
  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  // Get users with followers count gained during the period
  const influencerStats = await Follow.findAll({
    attributes: [
      'followingWalletAddress',
      [sequelize.fn('COUNT', sequelize.col('id')), 'newFollowers']
    ],
    where: {
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    },
    group: ['followingWalletAddress'],
    order: [[sequelize.literal('newFollowers'), 'DESC']],
    limit: parseInt(limit) * 2, // Get more to account for engagement filtering
    raw: true
  });

  // Calculate engagement score for each influencer
  const influencersWithEngagement = await Promise.all(influencerStats.map(async (influencer) => {
    const [
      totalFollowers,
      postsInPeriod,
      likesReceived,
      commentsReceived,
      user
    ] = await Promise.all([
      Follow.count({ where: { followingWalletAddress: influencer.followingWalletAddress } }),
      Post.count({
        where: {
          authorWalletAddress: influencer.followingWalletAddress,
          createdAt: { [Op.between]: [startDate, endDate] },
          isActive: true
        }
      }),
      PostLike.count({
        include: [{
          model: Post,
          as: 'post',
          attributes: [],
          where: {
            authorWalletAddress: influencer.followingWalletAddress,
            createdAt: { [Op.between]: [startDate, endDate] }
          },
          required: true
        }]
      }),
      PostComment.count({
        include: [{
          model: Post,
          as: 'post',
          attributes: [],
          where: {
            authorWalletAddress: influencer.followingWalletAddress,
            createdAt: { [Op.between]: [startDate, endDate] }
          },
          required: true
        }]
      }),
      User.findOne({
        where: { walletAddress: influencer.followingWalletAddress },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      })
    ]);

    // Calculate engagement score: followers * 1 + likes * 2 + comments * 3 + posts * 5
    const engagementScore = (parseInt(influencer.newFollowers) * 1) +
                           (likesReceived * 2) +
                           (commentsReceived * 3) +
                           (postsInPeriod * 5);

    return {
      walletAddress: influencer.followingWalletAddress,
      newFollowers: parseInt(influencer.newFollowers),
      totalFollowers,
      postsInPeriod,
      likesReceived,
      commentsReceived,
      engagementScore,
      user: user ? user.toJSON() : null
    };
  }));

  // Sort by engagement score and take top performers
  const sortedInfluencers = influencersWithEngagement
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, parseInt(limit))
    .map((inf, index) => ({
      rank: index + 1,
      ...inf
    }));

  res.status(200).json(new ApiResponse(200, {
    category: 'influencer',
    period: {
      month: targetMonth,
      year: targetYear
    },
    topPerformers: sortedInfluencers
  }, 'Top influencers retrieved successfully'));
};

/**
 * Get all top performers combined (traders, creators, influencers)
 */
const getAllTopPerformers = async (req, res) => {
  const { month, year, limit = 10 } = req.query;

  const targetMonth = parseInt(month) || new Date().getMonth() + 1;
  const targetYear = parseInt(year) || new Date().getFullYear();

  // Fetch all categories in parallel
  const [tradersRes, creatorsRes, influencersRes] = await Promise.all([
    getTopTradersData(targetMonth, targetYear, limit),
    getTopCreatorsData(targetMonth, targetYear, limit),
    getTopInfluencersData(targetMonth, targetYear, limit)
  ]);

  res.status(200).json(new ApiResponse(200, {
    period: {
      month: targetMonth,
      year: targetYear
    },
    traders: tradersRes,
    creators: creatorsRes,
    influencers: influencersRes
  }, 'All top performers retrieved successfully'));
};

// Helper functions to get data without response
const getTopTradersData = async (month, year, limit) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const topTraders = await DropMint.findAll({
    attributes: [
      'minterWalletAddress',
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('mintPrice'), 'UNSIGNED')), 'totalSpent'],
      [sequelize.fn('COUNT', sequelize.col('DropMint.id')), 'mintCount']
    ],
    where: { createdAt: { [Op.between]: [startDate, endDate] } },
    group: ['minterWalletAddress'],
    order: [[sequelize.literal('totalSpent'), 'DESC']],
    limit: parseInt(limit),
    raw: true
  });

  return Promise.all(topTraders.map(async (trader, index) => {
    const user = await User.findOne({
      where: { walletAddress: trader.minterWalletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });
    return {
      rank: index + 1,
      walletAddress: trader.minterWalletAddress,
      totalSpent: trader.totalSpent || '0',
      totalSpentXrp: ((parseFloat(trader.totalSpent) || 0) / 1000000).toFixed(6),
      mintCount: parseInt(trader.mintCount),
      user: user ? user.toJSON() : null
    };
  }));
};

const getTopCreatorsData = async (month, year, limit) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const topCreators = await DropMint.findAll({
    attributes: [
      [sequelize.col('drop.creatorWalletAddress'), 'creatorWalletAddress'],
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('mintPrice'), 'UNSIGNED')), 'totalRevenue'],
      [sequelize.fn('COUNT', sequelize.col('DropMint.id')), 'totalMints']
    ],
    include: [{ model: Drop, as: 'drop', attributes: [], required: true }],
    where: { createdAt: { [Op.between]: [startDate, endDate] } },
    group: ['drop.creatorWalletAddress'],
    order: [[sequelize.literal('totalRevenue'), 'DESC']],
    limit: parseInt(limit),
    raw: true
  });

  return Promise.all(topCreators.map(async (creator, index) => {
    const user = await User.findOne({
      where: { walletAddress: creator.creatorWalletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });
    return {
      rank: index + 1,
      walletAddress: creator.creatorWalletAddress,
      totalRevenue: creator.totalRevenue || '0',
      totalRevenueXrp: ((parseFloat(creator.totalRevenue) || 0) / 1000000).toFixed(6),
      totalMints: parseInt(creator.totalMints),
      user: user ? user.toJSON() : null
    };
  }));
};

const getTopInfluencersData = async (month, year, limit) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const influencerStats = await Follow.findAll({
    attributes: [
      'followingWalletAddress',
      [sequelize.fn('COUNT', sequelize.col('id')), 'newFollowers']
    ],
    where: { createdAt: { [Op.between]: [startDate, endDate] } },
    group: ['followingWalletAddress'],
    order: [[sequelize.literal('newFollowers'), 'DESC']],
    limit: parseInt(limit) * 2,
    raw: true
  });

  const influencersWithEngagement = await Promise.all(influencerStats.map(async (influencer) => {
    const [totalFollowers, user] = await Promise.all([
      Follow.count({ where: { followingWalletAddress: influencer.followingWalletAddress } }),
      User.findOne({
        where: { walletAddress: influencer.followingWalletAddress },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      })
    ]);

    return {
      walletAddress: influencer.followingWalletAddress,
      newFollowers: parseInt(influencer.newFollowers),
      totalFollowers,
      engagementScore: parseInt(influencer.newFollowers),
      user: user ? user.toJSON() : null
    };
  }));

  return influencersWithEngagement
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, parseInt(limit))
    .map((inf, index) => ({ rank: index + 1, ...inf }));
};

/**
 * Configure reward amounts for each category and rank
 */
const getRewardConfig = async (req, res) => {
  // Default reward configuration (in XRP)
  const defaultConfig = {
    trader: {
      1: 100, 2: 80, 3: 60, 4: 50, 5: 40,
      6: 30, 7: 25, 8: 20, 9: 15, 10: 10
    },
    creator: {
      1: 150, 2: 120, 3: 100, 4: 80, 5: 60,
      6: 50, 7: 40, 8: 30, 9: 25, 10: 20
    },
    influencer: {
      1: 80, 2: 60, 3: 50, 4: 40, 5: 35,
      6: 30, 7: 25, 8: 20, 9: 15, 10: 10
    }
  };

  res.status(200).json(new ApiResponse(200, {
    rewardConfig: defaultConfig,
    note: 'Amounts are in XRP. Can be customized via platform settings.'
  }, 'Reward configuration retrieved successfully'));
};

/**
 * Distribute rewards to top performers
 */
const distributeRewards = async (req, res) => {
  const {
    month,
    year,
    category, // 'trader', 'creator', 'influencer', or 'all'
    rewards, // Array of { rank, walletAddress, amount (in XRP) }
    dryRun = false // If true, just preview without sending
  } = req.body;

  if (!month || !year) {
    throw new ApiError(400, 'Month and year are required');
  }

  if (!category || !['trader', 'creator', 'influencer', 'all'].includes(category)) {
    throw new ApiError(400, 'Valid category is required (trader, creator, influencer, or all)');
  }

  if (!rewards || !Array.isArray(rewards) || rewards.length === 0) {
    throw new ApiError(400, 'Rewards array is required');
  }

  // Check if rewards already distributed for this period and category
  const existingRewards = await RewardDistribution.findOne({
    where: {
      periodMonth: month,
      periodYear: year,
      category: category === 'all' ? { [Op.in]: ['trader', 'creator', 'influencer'] } : category,
      transactionStatus: 'completed'
    }
  });

  if (existingRewards && !dryRun) {
    throw new ApiError(400, `Rewards already distributed for ${category} in ${month}/${year}`);
  }

  const adminWallet = getAdminWallet(req);
  const results = {
    successful: [],
    failed: [],
    totalAmount: 0,
    totalAmountXrp: '0'
  };

  // Process each reward
  for (const reward of rewards) {
    const { rank, walletAddress, amount } = reward;

    if (!rank || !walletAddress || !amount) {
      results.failed.push({
        rank,
        walletAddress,
        error: 'Missing required fields (rank, walletAddress, amount)'
      });
      continue;
    }

    const amountInDrops = (parseFloat(amount) * 1000000).toString();
    const rewardCategory = category === 'all' ? reward.category : category;

    if (dryRun) {
      // Just preview
      results.successful.push({
        rank,
        walletAddress,
        category: rewardCategory,
        amount,
        amountDrops: amountInDrops
      });
      results.totalAmount += parseFloat(amount);
    } else {
      // Create reward record
      const rewardRecord = await RewardDistribution.create({
        periodMonth: month,
        periodYear: year,
        category: rewardCategory,
        rank,
        recipientWalletAddress: walletAddress,
        rewardAmount: amountInDrops,
        metricValue: reward.metricValue || null,
        metricType: reward.metricType || null,
        transactionStatus: 'pending',
        initiatedBy: adminWallet
      });

      try {
        // Send XRP payment
        const paymentResult = await xrplService.sendPayment(
          walletAddress,
          amountInDrops
        );

        // Update record with transaction result
        await rewardRecord.update({
          transactionHash: paymentResult.hash,
          transactionStatus: 'completed',
          paidAt: new Date()
        });

        results.successful.push({
          rank,
          walletAddress,
          category: rewardCategory,
          amount,
          amountDrops: amountInDrops,
          transactionHash: paymentResult.hash
        });
        results.totalAmount += parseFloat(amount);
      } catch (error) {
        // Update record with failure
        await rewardRecord.update({
          transactionStatus: 'failed',
          transactionError: error.message
        });

        results.failed.push({
          rank,
          walletAddress,
          category: rewardCategory,
          error: error.message
        });
      }
    }
  }

  results.totalAmountXrp = results.totalAmount.toFixed(6);

  // Log activity
  await logActivity(
    adminWallet,
    'fee_update',
    'reward',
    null,
    `Rewards ${dryRun ? '(preview)' : 'distributed'}: ${category} ${month}/${year}`,
    {
      newValue: {
        category,
        month,
        year,
        successCount: results.successful.length,
        failedCount: results.failed.length,
        totalAmount: results.totalAmountXrp,
        dryRun
      }
    }
  );

  res.status(200).json(new ApiResponse(200, {
    dryRun,
    period: { month, year },
    category,
    results
  }, dryRun ? 'Reward distribution preview generated' : 'Rewards distributed successfully'));
};

/**
 * Get reward distribution history
 */
const getRewardHistory = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    month,
    year,
    category,
    walletAddress,
    status
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (month) where.periodMonth = parseInt(month);
  if (year) where.periodYear = parseInt(year);
  if (category) where.category = category;
  if (walletAddress) where.recipientWalletAddress = walletAddress;
  if (status) where.transactionStatus = status;

  const { count, rows: rewards } = await RewardDistribution.findAndCountAll({
    where,
    include: [{
      model: User,
      as: 'recipient',
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    }],
    order: [
      ['periodYear', 'DESC'],
      ['periodMonth', 'DESC'],
      ['category', 'ASC'],
      ['rank', 'ASC']
    ],
    limit: parseInt(limit),
    offset
  });

  // Calculate totals
  const totals = await RewardDistribution.findAll({
    attributes: [
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalCount']
    ],
    where: { ...where, transactionStatus: 'completed' },
    raw: true
  });

  res.status(200).json(new ApiResponse(200, {
    rewards,
    totals: {
      totalDistributed: totals[0]?.totalAmount || '0',
      totalDistributedXrp: ((parseFloat(totals[0]?.totalAmount) || 0) / 1000000).toFixed(6),
      totalRewards: parseInt(totals[0]?.totalCount) || 0
    },
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Reward history retrieved successfully'));
};

/**
 * Get reward summary by period
 */
const getRewardSummary = async (req, res) => {
  const { year } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();

  // Get monthly summary for the year
  const monthlySummary = await RewardDistribution.findAll({
    attributes: [
      'periodMonth',
      'category',
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'rewardCount']
    ],
    where: {
      periodYear: targetYear,
      transactionStatus: 'completed'
    },
    group: ['periodMonth', 'category'],
    order: [['periodMonth', 'ASC'], ['category', 'ASC']],
    raw: true
  });

  // Organize by month
  const byMonth = {};
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = {
      trader: { amount: '0', count: 0 },
      creator: { amount: '0', count: 0 },
      influencer: { amount: '0', count: 0 },
      total: { amount: '0', count: 0 }
    };
  }

  let yearTotal = BigInt(0);
  let yearCount = 0;

  monthlySummary.forEach(row => {
    const month = row.periodMonth;
    const category = row.category;
    byMonth[month][category] = {
      amount: row.totalAmount || '0',
      amountXrp: ((parseFloat(row.totalAmount) || 0) / 1000000).toFixed(6),
      count: parseInt(row.rewardCount)
    };

    // Update month total
    const currentTotal = BigInt(byMonth[month].total.amount);
    byMonth[month].total.amount = (currentTotal + BigInt(row.totalAmount || 0)).toString();
    byMonth[month].total.count += parseInt(row.rewardCount);

    yearTotal += BigInt(row.totalAmount || 0);
    yearCount += parseInt(row.rewardCount);
  });

  // Add XRP values for totals
  Object.keys(byMonth).forEach(m => {
    byMonth[m].total.amountXrp = (parseFloat(byMonth[m].total.amount) / 1000000).toFixed(6);
  });

  res.status(200).json(new ApiResponse(200, {
    year: targetYear,
    monthlyBreakdown: byMonth,
    yearTotal: {
      amount: yearTotal.toString(),
      amountXrp: (Number(yearTotal) / 1000000).toFixed(6),
      count: yearCount
    }
  }, 'Reward summary retrieved successfully'));
};

// ============================================
// PLATFORM FEES WALLET MANAGEMENT
// ============================================

/**
 * Get platform fees wallet
 */
const getPlatformFeesWallet = async (req, res) => {
  const wallet = await AdminWallet.findOne({
    where: {
      type: 'platformFees',
      isActive: true
    }
  });

  if (!wallet) {
    return res.status(200).json(new ApiResponse(200, {
      wallet: null,
      message: 'No active platform fees wallet configured'
    }, 'Platform fees wallet not configured'));
  }

  res.status(200).json(new ApiResponse(200, {
    wallet: {
      id: wallet.id,
      walletAddress: wallet.walletAddress,
      type: wallet.type,
      label: wallet.label,
      description: wallet.description,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    }
  }, 'Platform fees wallet retrieved successfully'));
};

/**
 * Update platform fees wallet address
 */
const updatePlatformFeesWallet = async (req, res) => {
  const { walletAddress, label, description } = req.body;

  if (!walletAddress) {
    throw new ApiError(400, 'Wallet address is required');
  }

  // Validate wallet address format (basic XRPL validation)
  if (!walletAddress.startsWith('r') || walletAddress.length < 25 || walletAddress.length > 35) {
    throw new ApiError(400, 'Invalid XRPL wallet address format');
  }

  const adminWallet = getAdminWallet(req);

  // Deactivate any existing platform fees wallet
  await AdminWallet.update(
    { isActive: false },
    { where: { type: 'platformFees', isActive: true } }
  );

  // Check if this wallet already exists
  let wallet = await AdminWallet.findOne({
    where: { walletAddress, type: 'platformFees' }
  });

  let previousWallet = null;

  if (wallet) {
    // Reactivate existing wallet
    previousWallet = wallet.toJSON();
    await wallet.update({
      isActive: true,
      label: label || wallet.label,
      description: description || wallet.description
    });
  } else {
    // Create new wallet
    wallet = await AdminWallet.create({
      walletAddress,
      type: 'platformFees',
      label: label || 'Platform Fees Wallet',
      description: description || 'Wallet for receiving platform fees',
      isActive: true
    });
  }

  // Log activity
  await logActivity(
    adminWallet,
    previousWallet ? 'admin_wallet_update' : 'admin_wallet_create',
    'wallet',
    wallet.id,
    wallet.walletAddress,
    {
      previousValue: previousWallet,
      newValue: wallet.toJSON()
    }
  );

  res.status(200).json(new ApiResponse(200, {
    wallet: {
      id: wallet.id,
      walletAddress: wallet.walletAddress,
      type: wallet.type,
      label: wallet.label,
      description: wallet.description,
      isActive: wallet.isActive
    }
  }, 'Platform fees wallet updated successfully'));
};

/**
 * Get all admin wallets
 */
const getAllAdminWallets = async (req, res) => {
  const wallets = await AdminWallet.findAll({
    order: [['type', 'ASC'], ['isActive', 'DESC'], ['createdAt', 'DESC']]
  });

  res.status(200).json(new ApiResponse(200, {
    wallets
  }, 'Admin wallets retrieved successfully'));
};

/**
 * Create or update admin wallet
 */
const upsertAdminWallet = async (req, res) => {
  const { walletAddress, type, label, description, isActive = true } = req.body;

  if (!walletAddress) {
    throw new ApiError(400, 'Wallet address is required');
  }

  if (!type) {
    throw new ApiError(400, 'Wallet type is required');
  }

  const validTypes = ['platformFees', 'royalties', 'marketplace', 'treasury', 'rewards', 'other'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate wallet address format
  if (!walletAddress.startsWith('r') || walletAddress.length < 25 || walletAddress.length > 35) {
    throw new ApiError(400, 'Invalid XRPL wallet address format');
  }

  const adminWallet = getAdminWallet(req);

  // If setting as active, deactivate other wallets of same type
  if (isActive) {
    await AdminWallet.update(
      { isActive: false },
      { where: { type, isActive: true } }
    );
  }

  // Check if wallet exists
  let wallet = await AdminWallet.findOne({
    where: { walletAddress, type }
  });

  let previousWallet = null;

  if (wallet) {
    previousWallet = wallet.toJSON();
    await wallet.update({
      label: label || wallet.label,
      description: description || wallet.description,
      isActive
    });
  } else {
    wallet = await AdminWallet.create({
      walletAddress,
      type,
      label: label || `${type} Wallet`,
      description,
      isActive
    });
  }

  // Log activity
  await logActivity(
    adminWallet,
    previousWallet ? 'admin_wallet_update' : 'admin_wallet_create',
    'wallet',
    wallet.id,
    wallet.walletAddress,
    {
      previousValue: previousWallet,
      newValue: wallet.toJSON()
    }
  );

  res.status(200).json(new ApiResponse(200, {
    wallet
  }, `Admin wallet ${previousWallet ? 'updated' : 'created'} successfully`));
};

/**
 * Delete admin wallet
 */
const deleteAdminWallet = async (req, res) => {
  const { walletId } = req.params;

  const wallet = await AdminWallet.findByPk(walletId);

  if (!wallet) {
    throw new ApiError(404, 'Admin wallet not found');
  }

  const adminWallet = getAdminWallet(req);

  // Log activity before deletion
  await logActivity(
    adminWallet,
    'admin_wallet_delete',
    'wallet',
    wallet.id,
    wallet.walletAddress,
    {
      previousValue: wallet.toJSON()
    }
  );

  await wallet.destroy();

  res.status(200).json(new ApiResponse(200, null, 'Admin wallet deleted successfully'));
};

// ============================================
// TREASURY WALLET MANAGEMENT
// ============================================

/**
 * Get treasury wallet details with balance and statistics
 */
const getTreasuryWallet = async (req, res) => {
  // Check if treasury wallet is configured in .env
  const treasuryConfig = xrplConfig.getTreasuryWalletConfig();

  if (!treasuryConfig.configured) {
    return res.status(200).json(new ApiResponse(200, {
      configured: false,
      message: 'Treasury wallet not configured. Set TREASURY_WALLET_SEED or TREASURY_WALLET_SECRET_NUMBERS in .env file.'
    }, 'Treasury wallet not configured'));
  }

  const walletAddress = treasuryConfig.address;

  // Get database record for treasury wallet
  let dbWallet = await AdminWallet.findOne({
    where: { type: 'treasury', isActive: true }
  });

  // If no database record exists but wallet is configured, create one
  if (!dbWallet && walletAddress) {
    dbWallet = await AdminWallet.create({
      walletAddress,
      type: 'treasury',
      label: 'Treasury Wallet',
      description: 'Main wallet for reward distribution',
      isActive: true
    });
  }

  // Fetch balance from XRPL
  let balance = null;
  let balanceXrp = null;
  let balanceError = null;

  try {
    const accountInfo = await xrplService.getAccountInfo(walletAddress);
    if (accountInfo && accountInfo.result && accountInfo.result.account_data) {
      balance = accountInfo.result.account_data.Balance;
      balanceXrp = (parseInt(balance) / 1000000).toFixed(6);
    }
  } catch (error) {
    balanceError = error.message;
  }

  // Get this month's distribution statistics
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const thisMonthStats = await RewardDistribution.findAll({
    attributes: [
      'category',
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      periodMonth: currentMonth,
      periodYear: currentYear,
      transactionStatus: 'completed'
    },
    group: ['category'],
    raw: true
  });

  // Calculate totals
  let thisMonthTotalDrops = BigInt(0);
  let thisMonthTotalCount = 0;
  const categoryBreakdown = {};

  for (const stat of thisMonthStats) {
    thisMonthTotalDrops += BigInt(stat.totalAmount || 0);
    thisMonthTotalCount += parseInt(stat.count);
    categoryBreakdown[stat.category] = {
      amount: stat.totalAmount || '0',
      amountXrp: ((parseFloat(stat.totalAmount) || 0) / 1000000).toFixed(6),
      count: parseInt(stat.count)
    };
  }

  // Get all-time distribution statistics
  const allTimeStats = await RewardDistribution.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      transactionStatus: 'completed'
    },
    raw: true
  });

  res.status(200).json(new ApiResponse(200, {
    wallet: {
      address: walletAddress,
      type: 'treasury',
      label: dbWallet?.label || 'Treasury Wallet',
      description: dbWallet?.description || 'Main wallet for reward distribution',
      isActive: true,
      configMethod: treasuryConfig.method,
      algorithm: treasuryConfig.algorithm,
      databaseId: dbWallet?.id || null
    },
    balance: {
      drops: balance,
      xrp: balanceXrp,
      error: balanceError
    },
    thisMonth: {
      month: currentMonth,
      year: currentYear,
      totalDistributed: thisMonthTotalDrops.toString(),
      totalDistributedXrp: (Number(thisMonthTotalDrops) / 1000000).toFixed(6),
      totalRewards: thisMonthTotalCount,
      categoryBreakdown
    },
    allTime: {
      totalDistributed: allTimeStats?.totalAmount || '0',
      totalDistributedXrp: ((parseFloat(allTimeStats?.totalAmount) || 0) / 1000000).toFixed(6),
      totalRewards: parseInt(allTimeStats?.count) || 0
    }
  }, 'Treasury wallet retrieved successfully'));
};

/**
 * Get treasury wallet statistics (detailed)
 */
const getTreasuryWalletStatistics = async (req, res) => {
  const { year } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();

  // Check if treasury wallet is configured
  const treasuryConfig = xrplConfig.getTreasuryWalletConfig();

  if (!treasuryConfig.configured) {
    throw new ApiError(400, 'Treasury wallet not configured');
  }

  const walletAddress = treasuryConfig.address;

  // Fetch current balance
  let balance = null;
  let balanceXrp = null;

  try {
    const accountInfo = await xrplService.getAccountInfo(walletAddress);
    if (accountInfo && accountInfo.result && accountInfo.result.account_data) {
      balance = accountInfo.result.account_data.Balance;
      balanceXrp = (parseInt(balance) / 1000000).toFixed(6);
    }
  } catch (error) {
    // Continue without balance
  }

  // Get monthly breakdown for the year
  const monthlyStats = await RewardDistribution.findAll({
    attributes: [
      'periodMonth',
      'category',
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'rewardCount']
    ],
    where: {
      periodYear: targetYear,
      transactionStatus: 'completed'
    },
    group: ['periodMonth', 'category'],
    order: [['periodMonth', 'ASC']],
    raw: true
  });

  // Organize by month
  const byMonth = {};
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = {
      trader: { amount: '0', amountXrp: '0', count: 0 },
      creator: { amount: '0', amountXrp: '0', count: 0 },
      influencer: { amount: '0', amountXrp: '0', count: 0 },
      total: { amount: '0', amountXrp: '0', count: 0 }
    };
  }

  let yearTotal = BigInt(0);
  let yearCount = 0;

  for (const row of monthlyStats) {
    const month = row.periodMonth;
    const category = row.category;

    byMonth[month][category] = {
      amount: row.totalAmount || '0',
      amountXrp: ((parseFloat(row.totalAmount) || 0) / 1000000).toFixed(6),
      count: parseInt(row.rewardCount)
    };

    // Update month total
    const currentTotal = BigInt(byMonth[month].total.amount);
    byMonth[month].total.amount = (currentTotal + BigInt(row.totalAmount || 0)).toString();
    byMonth[month].total.count += parseInt(row.rewardCount);

    yearTotal += BigInt(row.totalAmount || 0);
    yearCount += parseInt(row.rewardCount);
  }

  // Add XRP values for totals
  for (const m of Object.keys(byMonth)) {
    byMonth[m].total.amountXrp = (parseFloat(byMonth[m].total.amount) / 1000000).toFixed(6);
  }

  // Get recent distributions
  const recentDistributions = await RewardDistribution.findAll({
    where: {
      transactionStatus: 'completed'
    },
    include: [{
      model: User,
      as: 'recipient',
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    }],
    order: [['paidAt', 'DESC']],
    limit: 20
  });

  // Get pending/failed distributions
  const pendingCount = await RewardDistribution.count({
    where: { transactionStatus: 'pending' }
  });

  const failedCount = await RewardDistribution.count({
    where: { transactionStatus: 'failed' }
  });

  res.status(200).json(new ApiResponse(200, {
    walletAddress,
    balance: {
      drops: balance,
      xrp: balanceXrp
    },
    year: targetYear,
    monthlyBreakdown: byMonth,
    yearTotal: {
      amount: yearTotal.toString(),
      amountXrp: (Number(yearTotal) / 1000000).toFixed(6),
      count: yearCount
    },
    recentDistributions: recentDistributions.map(d => ({
      id: d.id,
      category: d.category,
      rank: d.rank,
      recipientWallet: d.recipientWalletAddress,
      recipient: d.recipient,
      amount: d.rewardAmount,
      amountXrp: (parseInt(d.rewardAmount) / 1000000).toFixed(6),
      transactionHash: d.transactionHash,
      paidAt: d.paidAt,
      periodMonth: d.periodMonth,
      periodYear: d.periodYear
    })),
    pendingDistributions: pendingCount,
    failedDistributions: failedCount
  }, 'Treasury wallet statistics retrieved successfully'));
};

/**
 * Update treasury wallet in database
 */
const updateTreasuryWallet = async (req, res) => {
  const { label, description } = req.body;

  // Check if treasury wallet is configured in .env
  const treasuryConfig = xrplConfig.getTreasuryWalletConfig();

  if (!treasuryConfig.configured) {
    throw new ApiError(400, 'Treasury wallet not configured in environment. Set TREASURY_WALLET_SEED or TREASURY_WALLET_SECRET_NUMBERS in .env file.');
  }

  const walletAddress = treasuryConfig.address;
  const adminWallet = getAdminWallet(req);

  // Deactivate any other treasury wallets
  await AdminWallet.update(
    { isActive: false },
    { where: { type: 'treasury', isActive: true, walletAddress: { [Op.ne]: walletAddress } } }
  );

  // Find or create the treasury wallet record
  let wallet = await AdminWallet.findOne({
    where: { walletAddress, type: 'treasury' }
  });

  const previousData = wallet ? wallet.toJSON() : null;

  if (wallet) {
    await wallet.update({
      label: label || wallet.label,
      description: description || wallet.description,
      isActive: true
    });
  } else {
    wallet = await AdminWallet.create({
      walletAddress,
      type: 'treasury',
      label: label || 'Treasury Wallet',
      description: description || 'Main wallet for reward distribution',
      isActive: true
    });
  }

  // Log activity
  await logActivity(
    adminWallet,
    previousData ? 'admin_wallet_update' : 'admin_wallet_create',
    'wallet',
    wallet.id,
    wallet.walletAddress,
    {
      previousValue: previousData,
      newValue: wallet.toJSON()
    }
  );

  res.status(200).json(new ApiResponse(200, {
    wallet: {
      id: wallet.id,
      walletAddress: wallet.walletAddress,
      type: wallet.type,
      label: wallet.label,
      description: wallet.description,
      isActive: wallet.isActive,
      configMethod: treasuryConfig.method,
      algorithm: treasuryConfig.algorithm
    }
  }, 'Treasury wallet updated successfully'));
};

/**
 * Get treasury wallet distribution history
 */
const getTreasuryDistributionHistory = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    month,
    year,
    category,
    status
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (month) where.periodMonth = parseInt(month);
  if (year) where.periodYear = parseInt(year);
  if (category) where.category = category;
  if (status) where.transactionStatus = status;

  const { count, rows: distributions } = await RewardDistribution.findAndCountAll({
    where,
    include: [{
      model: User,
      as: 'recipient',
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    }],
    order: [
      ['paidAt', 'DESC'],
      ['createdAt', 'DESC']
    ],
    limit: parseInt(limit),
    offset
  });

  // Get summary stats for the filter
  const summaryStats = await RewardDistribution.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalCount']
    ],
    where: { ...where, transactionStatus: 'completed' },
    raw: true
  });

  res.status(200).json(new ApiResponse(200, {
    distributions: distributions.map(d => ({
      id: d.id,
      periodMonth: d.periodMonth,
      periodYear: d.periodYear,
      category: d.category,
      rank: d.rank,
      recipientWallet: d.recipientWalletAddress,
      recipient: d.recipient,
      amount: d.rewardAmount,
      amountXrp: (parseInt(d.rewardAmount) / 1000000).toFixed(6),
      metricValue: d.metricValue,
      metricType: d.metricType,
      transactionHash: d.transactionHash,
      transactionStatus: d.transactionStatus,
      transactionError: d.transactionError,
      paidAt: d.paidAt,
      initiatedBy: d.initiatedBy,
      createdAt: d.createdAt
    })),
    summary: {
      totalDistributed: summaryStats?.totalAmount || '0',
      totalDistributedXrp: ((parseFloat(summaryStats?.totalAmount) || 0) / 1000000).toFixed(6),
      totalRewards: parseInt(summaryStats?.totalCount) || 0
    },
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Distribution history retrieved successfully'));
};

/**
 * Debug/check treasury wallet configuration
 */
const debugTreasuryWallet = async (req, res) => {
  const treasuryConfig = xrplConfig.getTreasuryWalletConfig();

  const hasSeed = !!process.env.TREASURY_WALLET_SEED;
  const hasSecretNumbers = !!process.env.TREASURY_WALLET_SECRET_NUMBERS;
  const secretNumbersLength = process.env.TREASURY_WALLET_SECRET_NUMBERS
    ? process.env.TREASURY_WALLET_SECRET_NUMBERS.split(',').length
    : 0;

  let balance = null;
  let balanceXrp = null;
  let balanceError = null;

  if (treasuryConfig.address) {
    try {
      const accountInfo = await xrplService.getAccountInfo(treasuryConfig.address);
      if (accountInfo && accountInfo.result && accountInfo.result.account_data) {
        balance = accountInfo.result.account_data.Balance;
        balanceXrp = (parseInt(balance) / 1000000).toFixed(6);
      }
    } catch (error) {
      balanceError = error.message;
    }
  }

  res.json({
    success: true,
    data: {
      configuration: {
        TREASURY_WALLET_SEED_SET: hasSeed,
        TREASURY_WALLET_SECRET_NUMBERS_SET: hasSecretNumbers,
        SECRET_NUMBERS_GROUPS_COUNT: secretNumbersLength,
        TREASURY_WALLET_ALGORITHM: process.env.TREASURY_WALLET_ALGORITHM || (hasSecretNumbers ? 'secp256k1' : 'auto'),
        ACTIVE_METHOD: hasSeed ? 'SEED (takes priority)' : (hasSecretNumbers ? 'SECRET_NUMBERS' : 'NONE')
      },
      derivedWallet: {
        address: treasuryConfig.address,
        algorithm: treasuryConfig.algorithm,
        configured: treasuryConfig.configured
      },
      balance: {
        drops: balance,
        xrp: balanceXrp,
        error: balanceError
      },
      hint: !treasuryConfig.configured
        ? 'Set TREASURY_WALLET_SEED or TREASURY_WALLET_SECRET_NUMBERS in .env file'
        : null
    }
  });
};

// ============================================
// MONTHLY RANKING MANAGEMENT
// ============================================

/**
 * Reward distribution formula constants
 * Total wallet balance split: 33.33% each category
 * Within each category:
 * - Rank 1: 25%
 * - Rank 2: 15%
 * - Rank 3: 10%
 * - Ranks 4-10: 50% split equally (~7.14% each)
 */
const REWARD_DISTRIBUTION = {
  categoryPercentage: 33.33, // Each of the 3 categories gets 33.33%
  rankPercentages: {
    1: 25.00,
    2: 15.00,
    3: 10.00,
    4: 7.14,
    5: 7.14,
    6: 7.14,
    7: 7.14,
    8: 7.14,
    9: 7.14,
    10: 7.16  // Slightly more to account for rounding (50 / 7 = 7.142857...)
  }
};

/**
 * Get reward distribution formula/config
 */
const getDistributionFormula = async (req, res) => {
  res.status(200).json(new ApiResponse(200, {
    formula: {
      categories: ['trader', 'creator', 'influencer'],
      categoryAllocation: '33.33% each (1/3 of total wallet balance)',
      rankDistribution: {
        'Rank 1': '25% of category allocation',
        'Rank 2': '15% of category allocation',
        'Rank 3': '10% of category allocation',
        'Ranks 4-10': '50% split equally (~7.14% each)'
      },
      example: {
        walletBalance: '3000 XRP',
        perCategory: '1000 XRP (33.33%)',
        rank1: '250 XRP (25%)',
        rank2: '150 XRP (15%)',
        rank3: '100 XRP (10%)',
        rank4to10: '~71.43 XRP each (7.14%)'
      }
    },
    percentages: REWARD_DISTRIBUTION
  }, 'Distribution formula retrieved successfully'));
};

/**
 * Set or update monthly rankings for a category
 */
const setMonthlyRanking = async (req, res) => {
  const {
    month,
    year,
    category,
    rankings, // Array of { rank: 1-10, walletAddress, username (optional) }
    notes
  } = req.body;

  if (!month || !year) {
    throw new ApiError(400, 'Month and year are required');
  }

  if (!category || !['trader', 'creator', 'influencer'].includes(category)) {
    throw new ApiError(400, 'Valid category is required (trader, creator, influencer)');
  }

  if (!rankings || !Array.isArray(rankings) || rankings.length !== 10) {
    throw new ApiError(400, 'Rankings must be an array of exactly 10 entries');
  }

  // Validate rankings structure
  const ranks = rankings.map(r => r.rank);
  for (let i = 1; i <= 10; i++) {
    if (!ranks.includes(i)) {
      throw new ApiError(400, `Missing rank ${i} in rankings`);
    }
  }

  // Validate wallet addresses
  for (const ranking of rankings) {
    if (!ranking.walletAddress) {
      throw new ApiError(400, `Wallet address is required for rank ${ranking.rank}`);
    }
    if (!ranking.walletAddress.startsWith('r') || ranking.walletAddress.length < 25) {
      throw new ApiError(400, `Invalid wallet address for rank ${ranking.rank}`);
    }
  }

  const adminWallet = getAdminWallet(req);

  // Check if already distributed
  const existingRanking = await MonthlyRanking.findOne({
    where: {
      periodMonth: month,
      periodYear: year,
      category
    }
  });

  if (existingRanking && existingRanking.status === 'distributed') {
    throw new ApiError(400, 'Cannot modify rankings that have already been distributed');
  }

  // Enrich rankings with user data
  const enrichedRankings = await Promise.all(rankings.map(async (r) => {
    const user = await User.findOne({
      where: { walletAddress: r.walletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });
    return {
      rank: r.rank,
      walletAddress: r.walletAddress,
      username: user?.username || r.username || null,
      profileImage: user?.profileImage || null,
      isVerified: user?.isVerified || false
    };
  }));

  // Sort by rank
  enrichedRankings.sort((a, b) => a.rank - b.rank);

  let monthlyRanking;
  let previousData = null;

  if (existingRanking) {
    previousData = existingRanking.toJSON();
    await existingRanking.update({
      rankings: enrichedRankings,
      status: 'draft', // Reset to draft if edited
      notes: notes || existingRanking.notes,
      setBy: adminWallet,
      finalizedAt: null,
      finalizedBy: null
    });
    monthlyRanking = existingRanking;
  } else {
    monthlyRanking = await MonthlyRanking.create({
      periodMonth: month,
      periodYear: year,
      category,
      rankings: enrichedRankings,
      status: 'draft',
      notes,
      setBy: adminWallet
    });
  }

  // Log activity
  await logActivity(
    adminWallet,
    previousData ? 'ranking_update' : 'ranking_create',
    'ranking',
    monthlyRanking.id,
    `${category} ${month}/${year}`,
    {
      previousValue: previousData,
      newValue: monthlyRanking.toJSON()
    }
  );

  res.status(200).json(new ApiResponse(200, {
    ranking: monthlyRanking
  }, `${category} rankings ${previousData ? 'updated' : 'created'} successfully`));
};

/**
 * Get monthly rankings for a period
 */
const getMonthlyRankings = async (req, res) => {
  const { month, year, category } = req.query;

  if (!month || !year) {
    throw new ApiError(400, 'Month and year are required');
  }

  const where = {
    periodMonth: parseInt(month),
    periodYear: parseInt(year)
  };

  if (category) {
    where.category = category;
  }

  const rankings = await MonthlyRanking.findAll({
    where,
    order: [['category', 'ASC']]
  });

  // Check distribution readiness
  const categories = ['trader', 'creator', 'influencer'];
  const categoryStatus = {};
  let allFinalized = true;

  for (const cat of categories) {
    const ranking = rankings.find(r => r.category === cat);
    categoryStatus[cat] = {
      exists: !!ranking,
      status: ranking?.status || 'not_set',
      setBy: ranking?.setBy || null,
      setAt: ranking?.createdAt || null,
      finalizedBy: ranking?.finalizedBy || null,
      finalizedAt: ranking?.finalizedAt || null
    };
    if (!ranking || ranking.status !== 'finalized') {
      allFinalized = false;
    }
  }

  res.status(200).json(new ApiResponse(200, {
    period: {
      month: parseInt(month),
      year: parseInt(year)
    },
    rankings,
    categoryStatus,
    readyForDistribution: allFinalized,
    message: allFinalized
      ? 'All categories are finalized. Ready for distribution.'
      : 'Not all categories are finalized yet.'
  }, 'Monthly rankings retrieved successfully'));
};

/**
 * Get single category ranking
 */
const getCategoryRanking = async (req, res) => {
  const { month, year, category } = req.params;

  if (!['trader', 'creator', 'influencer'].includes(category)) {
    throw new ApiError(400, 'Invalid category');
  }

  const ranking = await MonthlyRanking.findOne({
    where: {
      periodMonth: parseInt(month),
      periodYear: parseInt(year),
      category
    }
  });

  if (!ranking) {
    return res.status(200).json(new ApiResponse(200, {
      ranking: null,
      message: `No ranking set for ${category} in ${month}/${year}`
    }, 'Ranking not found'));
  }

  res.status(200).json(new ApiResponse(200, {
    ranking
  }, 'Category ranking retrieved successfully'));
};

/**
 * Finalize rankings for a category
 */
const finalizeRanking = async (req, res) => {
  const { month, year, category } = req.body;

  if (!month || !year) {
    throw new ApiError(400, 'Month and year are required');
  }

  if (!category || !['trader', 'creator', 'influencer'].includes(category)) {
    throw new ApiError(400, 'Valid category is required');
  }

  const ranking = await MonthlyRanking.findOne({
    where: {
      periodMonth: month,
      periodYear: year,
      category
    }
  });

  if (!ranking) {
    throw new ApiError(404, `No ranking found for ${category} in ${month}/${year}`);
  }

  if (ranking.status === 'distributed') {
    throw new ApiError(400, 'Cannot modify rankings that have already been distributed');
  }

  if (ranking.status === 'finalized') {
    return res.status(200).json(new ApiResponse(200, {
      ranking,
      message: 'Ranking is already finalized'
    }, 'Ranking already finalized'));
  }

  const adminWallet = getAdminWallet(req);

  await ranking.update({
    status: 'finalized',
    finalizedBy: adminWallet,
    finalizedAt: new Date()
  });

  // Check if all categories are now finalized
  const allFinalized = await MonthlyRanking.areAllCategoriesFinalized(month, year);

  // Log activity
  await logActivity(
    adminWallet,
    'ranking_finalize',
    'ranking',
    ranking.id,
    `${category} ${month}/${year}`,
    {
      newValue: { status: 'finalized', finalizedAt: ranking.finalizedAt }
    }
  );

  res.status(200).json(new ApiResponse(200, {
    ranking,
    allCategoriesFinalized: allFinalized,
    message: allFinalized
      ? 'All categories are now finalized. Ready for distribution!'
      : `${category} ranking finalized. Other categories still pending.`
  }, 'Ranking finalized successfully'));
};

/**
 * Unfinalize ranking (revert to draft)
 */
const unfinalizeRanking = async (req, res) => {
  const { month, year, category } = req.body;

  const ranking = await MonthlyRanking.findOne({
    where: {
      periodMonth: month,
      periodYear: year,
      category
    }
  });

  if (!ranking) {
    throw new ApiError(404, 'Ranking not found');
  }

  if (ranking.status === 'distributed') {
    throw new ApiError(400, 'Cannot unfinalize rankings that have already been distributed');
  }

  const adminWallet = getAdminWallet(req);

  await ranking.update({
    status: 'draft',
    finalizedBy: null,
    finalizedAt: null
  });

  await logActivity(
    adminWallet,
    'ranking_unfinalize',
    'ranking',
    ranking.id,
    `${category} ${month}/${year}`,
    { newValue: { status: 'draft' } }
  );

  res.status(200).json(new ApiResponse(200, {
    ranking
  }, 'Ranking reverted to draft'));
};

/**
 * Delete monthly ranking
 */
const deleteMonthlyRanking = async (req, res) => {
  const { month, year, category } = req.params;

  const ranking = await MonthlyRanking.findOne({
    where: {
      periodMonth: parseInt(month),
      periodYear: parseInt(year),
      category
    }
  });

  if (!ranking) {
    throw new ApiError(404, 'Ranking not found');
  }

  if (ranking.status === 'distributed') {
    throw new ApiError(400, 'Cannot delete rankings that have already been distributed');
  }

  const adminWallet = getAdminWallet(req);

  await logActivity(
    adminWallet,
    'ranking_delete',
    'ranking',
    ranking.id,
    `${category} ${month}/${year}`,
    { previousValue: ranking.toJSON() }
  );

  await ranking.destroy();

  res.status(200).json(new ApiResponse(200, null, 'Ranking deleted successfully'));
};

/**
 * Get distribution readiness status
 */
const getDistributionStatus = async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    throw new ApiError(400, 'Month and year are required');
  }

  // Check treasury wallet configuration
  const treasuryConfig = xrplConfig.getTreasuryWalletConfig();

  // Get treasury balance
  let treasuryBalance = null;
  let treasuryBalanceXrp = null;
  let treasuryError = null;

  if (treasuryConfig.configured) {
    try {
      const accountInfo = await xrplService.getAccountInfo(treasuryConfig.address);
      if (accountInfo?.result?.account_data) {
        treasuryBalance = accountInfo.result.account_data.Balance;
        treasuryBalanceXrp = (parseInt(treasuryBalance) / 1000000).toFixed(6);
      }
    } catch (error) {
      treasuryError = error.message;
    }
  }

  // Get all rankings for the period
  const rankings = await MonthlyRanking.findAll({
    where: {
      periodMonth: parseInt(month),
      periodYear: parseInt(year)
    }
  });

  const categories = ['trader', 'creator', 'influencer'];
  const categoryDetails = {};
  let allFinalized = true;
  let anyDistributed = false;

  for (const cat of categories) {
    const ranking = rankings.find(r => r.category === cat);
    categoryDetails[cat] = {
      exists: !!ranking,
      status: ranking?.status || 'not_set',
      rankings: ranking?.rankings || [],
      setBy: ranking?.setBy || null,
      finalizedBy: ranking?.finalizedBy || null,
      finalizedAt: ranking?.finalizedAt || null,
      distributedAt: ranking?.distributedAt || null
    };

    if (!ranking || ranking.status !== 'finalized') {
      if (ranking?.status !== 'distributed') {
        allFinalized = false;
      }
    }
    if (ranking?.status === 'distributed') {
      anyDistributed = true;
    }
  }

  // Calculate expected distribution if we have balance
  let expectedDistribution = null;
  if (treasuryBalanceXrp && parseFloat(treasuryBalanceXrp) > 0) {
    const totalBalance = parseFloat(treasuryBalanceXrp);
    const perCategory = totalBalance * (REWARD_DISTRIBUTION.categoryPercentage / 100);

    expectedDistribution = {
      totalBalance: `${totalBalance.toFixed(6)} XRP`,
      perCategory: `${perCategory.toFixed(6)} XRP`,
      breakdown: {}
    };

    for (let rank = 1; rank <= 10; rank++) {
      const percentage = REWARD_DISTRIBUTION.rankPercentages[rank];
      const amount = perCategory * (percentage / 100);
      expectedDistribution.breakdown[`rank${rank}`] = {
        percentage: `${percentage}%`,
        amount: `${amount.toFixed(6)} XRP`
      };
    }
  }

  res.status(200).json(new ApiResponse(200, {
    period: {
      month: parseInt(month),
      year: parseInt(year)
    },
    treasury: {
      configured: treasuryConfig.configured,
      address: treasuryConfig.address,
      balance: treasuryBalance,
      balanceXrp: treasuryBalanceXrp,
      error: treasuryError
    },
    categories: categoryDetails,
    readyForDistribution: allFinalized && treasuryConfig.configured && !anyDistributed,
    alreadyDistributed: anyDistributed,
    expectedDistribution,
    requirements: {
      treasuryConfigured: treasuryConfig.configured,
      allCategoriesFinalized: allFinalized,
      notYetDistributed: !anyDistributed
    }
  }, 'Distribution status retrieved successfully'));
};

/**
 * Execute reward distribution from treasury wallet
 */
const executeDistribution = async (req, res) => {
  const { month, year, dryRun = false } = req.body;

  if (!month || !year) {
    throw new ApiError(400, 'Month and year are required');
  }

  // Check treasury wallet configuration
  const treasuryConfig = xrplConfig.getTreasuryWalletConfig();

  if (!treasuryConfig.configured) {
    throw new ApiError(400, 'Treasury wallet not configured. Set TREASURY_WALLET_SEED or TREASURY_WALLET_SECRET_NUMBERS in .env');
  }

  // Get treasury balance
  let treasuryBalance = 0;
  try {
    const accountInfo = await xrplService.getAccountInfo(treasuryConfig.address);
    if (accountInfo?.result?.account_data) {
      treasuryBalance = parseInt(accountInfo.result.account_data.Balance);
    }
  } catch (error) {
    throw new ApiError(500, `Failed to get treasury balance: ${error.message}`);
  }

  // Reserve 20 XRP for account reserve + fees
  const reserveDrops = 20 * 1000000;
  const availableBalance = treasuryBalance - reserveDrops;

  if (availableBalance <= 0) {
    throw new ApiError(400, `Insufficient treasury balance. Available: ${(treasuryBalance / 1000000).toFixed(6)} XRP, Reserve: 20 XRP`);
  }

  // Check all categories are finalized
  const rankings = await MonthlyRanking.findAll({
    where: {
      periodMonth: month,
      periodYear: year
    }
  });

  const categories = ['trader', 'creator', 'influencer'];

  for (const cat of categories) {
    const ranking = rankings.find(r => r.category === cat);
    if (!ranking) {
      throw new ApiError(400, `${cat} rankings not set for ${month}/${year}`);
    }
    if (ranking.status === 'distributed') {
      throw new ApiError(400, `${cat} rewards already distributed for ${month}/${year}`);
    }
    if (ranking.status !== 'finalized') {
      throw new ApiError(400, `${cat} rankings not finalized for ${month}/${year}`);
    }
  }

  const adminWallet = getAdminWallet(req);
  const batchId = require('crypto').randomUUID();

  // Calculate distribution amounts
  const perCategoryDrops = Math.floor(availableBalance * (REWARD_DISTRIBUTION.categoryPercentage / 100));

  const distributions = [];
  const results = {
    successful: [],
    failed: [],
    totalAmount: BigInt(0),
    batchId
  };

  // Prepare all distributions
  for (const ranking of rankings) {
    for (const entry of ranking.rankings) {
      const percentage = REWARD_DISTRIBUTION.rankPercentages[entry.rank];
      const amountDrops = Math.floor(perCategoryDrops * (percentage / 100));

      distributions.push({
        category: ranking.category,
        rank: entry.rank,
        walletAddress: entry.walletAddress,
        username: entry.username,
        amountDrops: amountDrops.toString(),
        amountXrp: (amountDrops / 1000000).toFixed(6),
        percentage
      });
    }
  }

  if (dryRun) {
    // Just return preview without sending
    return res.status(200).json(new ApiResponse(200, {
      dryRun: true,
      period: { month, year },
      treasury: {
        address: treasuryConfig.address,
        currentBalance: (treasuryBalance / 1000000).toFixed(6) + ' XRP',
        availableForDistribution: (availableBalance / 1000000).toFixed(6) + ' XRP',
        reserveHeld: '20 XRP'
      },
      distributions: distributions.map(d => ({
        ...d,
        transactionStatus: 'preview'
      })),
      summary: {
        totalRecipients: distributions.length,
        perCategory: categories.map(cat => ({
          category: cat,
          allocation: (perCategoryDrops / 1000000).toFixed(6) + ' XRP',
          recipients: 10
        })),
        totalToDistribute: ((perCategoryDrops * 3) / 1000000).toFixed(6) + ' XRP'
      }
    }, 'Distribution preview generated'));
  }

  // Execute actual distribution
  const treasuryWallet = xrplConfig.getTreasuryWallet();

  for (const dist of distributions) {
    // Create reward record
    const rewardRecord = await RewardDistribution.create({
      periodMonth: month,
      periodYear: year,
      category: dist.category,
      rank: dist.rank,
      recipientWalletAddress: dist.walletAddress,
      rewardAmount: dist.amountDrops,
      metricType: `${dist.category}_rank`,
      metricValue: dist.rank.toString(),
      transactionStatus: 'processing',
      initiatedBy: adminWallet,
      metadata: {
        batchId,
        percentage: dist.percentage,
        username: dist.username
      }
    });

    try {
      // Send XRP payment from treasury wallet
      const paymentResult = await xrplService.sendPaymentFromWallet(
        treasuryWallet,
        dist.walletAddress,
        dist.amountDrops
      );

      await rewardRecord.update({
        transactionHash: paymentResult.hash,
        transactionStatus: 'completed',
        paidAt: new Date()
      });

      results.successful.push({
        ...dist,
        transactionHash: paymentResult.hash,
        rewardId: rewardRecord.id
      });
      results.totalAmount += BigInt(dist.amountDrops);

    } catch (error) {
      await rewardRecord.update({
        transactionStatus: 'failed',
        transactionError: error.message
      });

      results.failed.push({
        ...dist,
        error: error.message,
        rewardId: rewardRecord.id
      });
    }
  }

  // Update rankings to distributed status
  for (const ranking of rankings) {
    await ranking.update({
      status: 'distributed',
      distributionBatchId: batchId,
      distributedAt: new Date()
    });
  }

  // Log activity
  await logActivity(
    adminWallet,
    'rewards_distribute',
    'distribution',
    batchId,
    `${month}/${year} distribution`,
    {
      newValue: {
        batchId,
        successCount: results.successful.length,
        failedCount: results.failed.length,
        totalAmount: (Number(results.totalAmount) / 1000000).toFixed(6) + ' XRP'
      }
    }
  );

  res.status(200).json(new ApiResponse(200, {
    batchId,
    period: { month, year },
    treasury: {
      address: treasuryConfig.address,
      previousBalance: (treasuryBalance / 1000000).toFixed(6) + ' XRP'
    },
    results: {
      successful: results.successful,
      failed: results.failed,
      totalDistributed: (Number(results.totalAmount) / 1000000).toFixed(6) + ' XRP',
      totalTransactions: results.successful.length + results.failed.length,
      successRate: `${((results.successful.length / (results.successful.length + results.failed.length)) * 100).toFixed(1)}%`
    }
  }, results.failed.length > 0
    ? `Distribution completed with ${results.failed.length} failures`
    : 'Distribution completed successfully'));
};

/**
 * Get distribution batch details
 */
const getDistributionBatch = async (req, res) => {
  const { batchId } = req.params;

  const distributions = await RewardDistribution.findAll({
    where: {
      metadata: {
        batchId
      }
    },
    include: [{
      model: User,
      as: 'recipient',
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    }],
    order: [['category', 'ASC'], ['rank', 'ASC']]
  });

  if (distributions.length === 0) {
    throw new ApiError(404, 'Distribution batch not found');
  }

  // Calculate summary
  const summary = {
    totalRecipients: distributions.length,
    successful: distributions.filter(d => d.transactionStatus === 'completed').length,
    failed: distributions.filter(d => d.transactionStatus === 'failed').length,
    pending: distributions.filter(d => d.transactionStatus === 'pending' || d.transactionStatus === 'processing').length,
    totalAmount: BigInt(0),
    byCategory: {}
  };

  for (const dist of distributions) {
    if (dist.transactionStatus === 'completed') {
      summary.totalAmount += BigInt(dist.rewardAmount);
    }

    if (!summary.byCategory[dist.category]) {
      summary.byCategory[dist.category] = {
        count: 0,
        amount: BigInt(0)
      };
    }
    summary.byCategory[dist.category].count++;
    if (dist.transactionStatus === 'completed') {
      summary.byCategory[dist.category].amount += BigInt(dist.rewardAmount);
    }
  }

  // Convert amounts to XRP
  summary.totalAmountXrp = (Number(summary.totalAmount) / 1000000).toFixed(6);
  for (const cat of Object.keys(summary.byCategory)) {
    summary.byCategory[cat].amountXrp = (Number(summary.byCategory[cat].amount) / 1000000).toFixed(6);
    summary.byCategory[cat].amount = summary.byCategory[cat].amount.toString();
  }
  summary.totalAmount = summary.totalAmount.toString();

  res.status(200).json(new ApiResponse(200, {
    batchId,
    period: {
      month: distributions[0].periodMonth,
      year: distributions[0].periodYear
    },
    initiatedBy: distributions[0].initiatedBy,
    createdAt: distributions[0].createdAt,
    distributions: distributions.map(d => ({
      id: d.id,
      category: d.category,
      rank: d.rank,
      recipientWallet: d.recipientWalletAddress,
      recipient: d.recipient,
      amount: d.rewardAmount,
      amountXrp: (parseInt(d.rewardAmount) / 1000000).toFixed(6),
      transactionHash: d.transactionHash,
      transactionStatus: d.transactionStatus,
      transactionError: d.transactionError,
      paidAt: d.paidAt
    })),
    summary
  }, 'Distribution batch retrieved successfully'));
};

/**
 * Retry failed distributions in a batch
 */
const retryFailedDistributions = async (req, res) => {
  const { batchId } = req.body;

  if (!batchId) {
    throw new ApiError(400, 'Batch ID is required');
  }

  // Check treasury wallet
  const treasuryConfig = xrplConfig.getTreasuryWalletConfig();
  if (!treasuryConfig.configured) {
    throw new ApiError(400, 'Treasury wallet not configured');
  }

  const failedDistributions = await RewardDistribution.findAll({
    where: {
      transactionStatus: 'failed',
      metadata: { batchId }
    }
  });

  if (failedDistributions.length === 0) {
    return res.status(200).json(new ApiResponse(200, {
      message: 'No failed distributions to retry',
      retried: 0
    }, 'No failed distributions found'));
  }

  const treasuryWallet = xrplConfig.getTreasuryWallet();
  const adminWallet = getAdminWallet(req);

  const results = {
    successful: [],
    stillFailed: []
  };

  for (const dist of failedDistributions) {
    try {
      const paymentResult = await xrplService.sendPaymentFromWallet(
        treasuryWallet,
        dist.recipientWalletAddress,
        dist.rewardAmount
      );

      await dist.update({
        transactionHash: paymentResult.hash,
        transactionStatus: 'completed',
        transactionError: null,
        paidAt: new Date()
      });

      results.successful.push({
        id: dist.id,
        category: dist.category,
        rank: dist.rank,
        walletAddress: dist.recipientWalletAddress,
        transactionHash: paymentResult.hash
      });

    } catch (error) {
      await dist.update({
        transactionError: error.message
      });

      results.stillFailed.push({
        id: dist.id,
        category: dist.category,
        rank: dist.rank,
        walletAddress: dist.recipientWalletAddress,
        error: error.message
      });
    }
  }

  await logActivity(
    adminWallet,
    'rewards_retry',
    'distribution',
    batchId,
    `Retry batch ${batchId}`,
    {
      newValue: {
        retried: failedDistributions.length,
        successful: results.successful.length,
        stillFailed: results.stillFailed.length
      }
    }
  );

  res.status(200).json(new ApiResponse(200, {
    batchId,
    totalRetried: failedDistributions.length,
    results
  }, `Retry completed: ${results.successful.length} successful, ${results.stillFailed.length} still failed`));
};

// ============================================
// REWARD STATISTICS
// ============================================

/**
 * Get comprehensive reward statistics
 */
const getRewardStats = async (req, res) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Get all-time statistics
  const allTimeStats = await RewardDistribution.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions']
    ],
    where: {
      transactionStatus: 'completed'
    },
    raw: true
  });

  // Get this month's statistics
  const thisMonthStats = await RewardDistribution.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions']
    ],
    where: {
      periodMonth: currentMonth,
      periodYear: currentYear,
      transactionStatus: 'completed'
    },
    raw: true
  });

  // Get last month's statistics for comparison
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const lastMonthStats = await RewardDistribution.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions']
    ],
    where: {
      periodMonth: lastMonth,
      periodYear: lastMonthYear,
      transactionStatus: 'completed'
    },
    raw: true
  });

  // Get statistics by category (all-time)
  const categoryStats = await RewardDistribution.findAll({
    attributes: [
      'category',
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions']
    ],
    where: {
      transactionStatus: 'completed'
    },
    group: ['category'],
    raw: true
  });

  // Get unique recipients count
  const uniqueRecipients = await RewardDistribution.count({
    distinct: true,
    col: 'recipientWalletAddress',
    where: {
      transactionStatus: 'completed'
    }
  });

  // Get pending and failed counts
  const pendingCount = await RewardDistribution.count({
    where: { transactionStatus: 'pending' }
  });

  const failedCount = await RewardDistribution.count({
    where: { transactionStatus: 'failed' }
  });

  // Get distribution batch count
  const batchCount = await MonthlyRanking.count({
    where: { status: 'distributed' }
  });

  // Calculate month-over-month change
  const thisMonthAmount = parseFloat(thisMonthStats?.totalAmount || 0);
  const lastMonthAmount = parseFloat(lastMonthStats?.totalAmount || 0);
  const monthOverMonthChange = lastMonthAmount > 0
    ? (((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100).toFixed(2)
    : thisMonthAmount > 0 ? '100.00' : '0.00';

  // Format category breakdown
  const categoryBreakdown = {};
  for (const stat of categoryStats) {
    categoryBreakdown[stat.category] = {
      totalAmount: stat.totalAmount || '0',
      totalAmountXrp: ((parseFloat(stat.totalAmount) || 0) / 1000000).toFixed(6),
      totalTransactions: parseInt(stat.totalTransactions) || 0
    };
  }

  res.status(200).json(new ApiResponse(200, {
    allTime: {
      totalRewardsDrops: allTimeStats?.totalAmount || '0',
      totalRewardsXrp: ((parseFloat(allTimeStats?.totalAmount) || 0) / 1000000).toFixed(6),
      totalTransactions: parseInt(allTimeStats?.totalTransactions) || 0,
      uniqueRecipients,
      distributionBatches: Math.floor(batchCount / 3) // 3 categories per batch
    },
    thisMonth: {
      month: currentMonth,
      year: currentYear,
      totalRewardsDrops: thisMonthStats?.totalAmount || '0',
      totalRewardsXrp: ((parseFloat(thisMonthStats?.totalAmount) || 0) / 1000000).toFixed(6),
      totalTransactions: parseInt(thisMonthStats?.totalTransactions) || 0
    },
    lastMonth: {
      month: lastMonth,
      year: lastMonthYear,
      totalRewardsDrops: lastMonthStats?.totalAmount || '0',
      totalRewardsXrp: ((parseFloat(lastMonthStats?.totalAmount) || 0) / 1000000).toFixed(6),
      totalTransactions: parseInt(lastMonthStats?.totalTransactions) || 0
    },
    monthOverMonthChange: `${monthOverMonthChange}%`,
    categoryBreakdown,
    status: {
      pending: pendingCount,
      failed: failedCount
    }
  }, 'Reward statistics retrieved successfully'));
};

/**
 * Get reward transaction history with pagination and filters
 */
const getRewardTransactionHistory = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    month,
    year,
    category,
    status,
    walletAddress,
    sortBy = 'paidAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (month) where.periodMonth = parseInt(month);
  if (year) where.periodYear = parseInt(year);
  if (category) where.category = category;
  if (status) where.transactionStatus = status;
  if (walletAddress) where.recipientWalletAddress = walletAddress;

  // Validate sort field
  const allowedSortFields = ['paidAt', 'createdAt', 'rewardAmount', 'rank', 'category'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'paidAt';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows: transactions } = await RewardDistribution.findAndCountAll({
    where,
    include: [{
      model: User,
      as: 'recipient',
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    }],
    order: [[sortField, order]],
    limit: parseInt(limit),
    offset
  });

  // Calculate summary for the filtered results
  const filteredSummary = await RewardDistribution.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalCount']
    ],
    where: { ...where, transactionStatus: 'completed' },
    raw: true
  });

  res.status(200).json(new ApiResponse(200, {
    transactions: transactions.map(t => ({
      id: t.id,
      periodMonth: t.periodMonth,
      periodYear: t.periodYear,
      category: t.category,
      rank: t.rank,
      recipientWallet: t.recipientWalletAddress,
      recipient: t.recipient,
      rewardAmount: t.rewardAmount,
      rewardAmountXrp: (parseInt(t.rewardAmount) / 1000000).toFixed(6),
      metricType: t.metricType,
      metricValue: t.metricValue,
      transactionHash: t.transactionHash,
      transactionStatus: t.transactionStatus,
      transactionError: t.transactionError,
      paidAt: t.paidAt,
      initiatedBy: t.initiatedBy,
      createdAt: t.createdAt
    })),
    summary: {
      totalAmount: filteredSummary?.totalAmount || '0',
      totalAmountXrp: ((parseFloat(filteredSummary?.totalAmount) || 0) / 1000000).toFixed(6),
      totalTransactions: parseInt(filteredSummary?.totalCount) || 0
    },
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    },
    filters: {
      month: month ? parseInt(month) : null,
      year: year ? parseInt(year) : null,
      category: category || null,
      status: status || null,
      walletAddress: walletAddress || null
    }
  }, 'Reward transaction history retrieved successfully'));
};

/**
 * Get monthly reward breakdown for charts
 */
const getMonthlyRewardBreakdown = async (req, res) => {
  const { year } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();

  // Get monthly breakdown
  const monthlyStats = await RewardDistribution.findAll({
    attributes: [
      'periodMonth',
      'category',
      [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'UNSIGNED')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'transactionCount']
    ],
    where: {
      periodYear: targetYear,
      transactionStatus: 'completed'
    },
    group: ['periodMonth', 'category'],
    order: [['periodMonth', 'ASC']],
    raw: true
  });

  // Organize by month
  const months = {};
  for (let m = 1; m <= 12; m++) {
    months[m] = {
      month: m,
      monthName: new Date(targetYear, m - 1, 1).toLocaleString('default', { month: 'long' }),
      trader: { amount: '0', amountXrp: '0.000000', transactions: 0 },
      creator: { amount: '0', amountXrp: '0.000000', transactions: 0 },
      influencer: { amount: '0', amountXrp: '0.000000', transactions: 0 },
      total: { amount: '0', amountXrp: '0.000000', transactions: 0 }
    };
  }

  let yearTotalDrops = BigInt(0);
  let yearTotalTransactions = 0;

  for (const stat of monthlyStats) {
    const month = stat.periodMonth;
    const category = stat.category;
    const amount = stat.totalAmount || '0';
    const transactions = parseInt(stat.transactionCount) || 0;

    months[month][category] = {
      amount,
      amountXrp: (parseFloat(amount) / 1000000).toFixed(6),
      transactions
    };

    // Update month total
    const currentTotal = BigInt(months[month].total.amount);
    months[month].total.amount = (currentTotal + BigInt(amount)).toString();
    months[month].total.transactions += transactions;

    yearTotalDrops += BigInt(amount);
    yearTotalTransactions += transactions;
  }

  // Calculate XRP for month totals
  for (const m of Object.keys(months)) {
    months[m].total.amountXrp = (parseFloat(months[m].total.amount) / 1000000).toFixed(6);
  }

  // Get distribution status for each month
  const distributedMonths = await MonthlyRanking.findAll({
    attributes: ['periodMonth', 'category', 'status', 'distributedAt'],
    where: {
      periodYear: targetYear,
      status: 'distributed'
    },
    raw: true
  });

  const monthlyDistributionStatus = {};
  for (let m = 1; m <= 12; m++) {
    const monthDistributions = distributedMonths.filter(d => d.periodMonth === m);
    monthlyDistributionStatus[m] = {
      distributed: monthDistributions.length === 3,
      categories: {
        trader: monthDistributions.some(d => d.category === 'trader'),
        creator: monthDistributions.some(d => d.category === 'creator'),
        influencer: monthDistributions.some(d => d.category === 'influencer')
      }
    };
  }

  res.status(200).json(new ApiResponse(200, {
    year: targetYear,
    monthlyBreakdown: Object.values(months),
    distributionStatus: monthlyDistributionStatus,
    yearTotal: {
      amount: yearTotalDrops.toString(),
      amountXrp: (Number(yearTotalDrops) / 1000000).toFixed(6),
      transactions: yearTotalTransactions
    }
  }, 'Monthly reward breakdown retrieved successfully'));
};

module.exports = {
  getTopTraders,
  getTopCreators,
  getTopInfluencers,
  getAllTopPerformers,
  getRewardConfig,
  distributeRewards,
  getRewardHistory,
  getRewardSummary,
  getPlatformFeesWallet,
  updatePlatformFeesWallet,
  getAllAdminWallets,
  upsertAdminWallet,
  deleteAdminWallet,
  // Treasury wallet management
  getTreasuryWallet,
  getTreasuryWalletStatistics,
  updateTreasuryWallet,
  getTreasuryDistributionHistory,
  debugTreasuryWallet,
  // Monthly ranking management
  getDistributionFormula,
  setMonthlyRanking,
  getMonthlyRankings,
  getCategoryRanking,
  finalizeRanking,
  unfinalizeRanking,
  deleteMonthlyRanking,
  // Distribution execution
  getDistributionStatus,
  executeDistribution,
  getDistributionBatch,
  retryFailedDistributions,
  // Reward statistics
  getRewardStats,
  getRewardTransactionHistory,
  getMonthlyRewardBreakdown
};
