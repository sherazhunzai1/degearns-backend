/**
 * Admin Scoring Controller
 *
 * Admin endpoints for managing scoring, subscriptions, and leaderboards
 */

const { Op } = require('sequelize');
const {
  User,
  UserStats,
  Subscription,
  ActivityLog,
  AdminActivity,
  sequelize
} = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const ScoringEngine = require('../../services/scoringEngine');
const { getScoringJobs } = require('../../jobs/scoringJobs');
const scoringConfig = require('../../config/scoring');

// Helper to get admin wallet
const getAdminWallet = (req) => req.user?.walletAddress || 'dev-admin';

// Log admin activity
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

// Get scoring engine instance
const getScoringEngine = () => {
  return new ScoringEngine({
    User,
    UserStats,
    Subscription,
    ActivityLog,
    ...require('../../models'),
    sequelize
  });
};

/**
 * Trigger full score recalculation for all users
 * POST /admin/scoring/recalculate-all
 */
const recalculateAllScores = async (req, res) => {
  const adminWallet = getAdminWallet(req);

  const scoringEngine = getScoringEngine();

  // Start recalculation in background
  const result = await scoringEngine.recalculateAllScores({
    onProgress: (progress) => {
      console.log(`Score recalculation: ${progress.processed}/${progress.total}`);
    }
  });

  await logActivity(adminWallet, 'recalculate_all_scores', 'system', null, null, {
    metadata: result
  });

  res.status(200).json(new ApiResponse(200, result, 'Score recalculation completed'));
};

/**
 * Recalculate scores for a specific user
 * POST /admin/scoring/recalculate/:walletAddress
 */
const recalculateUserScores = async (req, res) => {
  const { walletAddress } = req.params;
  const adminWallet = getAdminWallet(req);

  const user = await User.findOne({ where: { walletAddress } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const scoringEngine = getScoringEngine();
  const result = await scoringEngine.calculateUserScores(walletAddress);

  await logActivity(adminWallet, 'recalculate_user_scores', 'user', user.id, walletAddress, {
    metadata: result
  });

  res.status(200).json(new ApiResponse(200, result, 'User scores recalculated successfully'));
};

/**
 * Get scoring jobs status
 * GET /admin/scoring/jobs/status
 */
const getScoringJobsStatus = async (req, res) => {
  const scoringJobs = getScoringJobs();

  if (!scoringJobs) {
    throw new ApiError(500, 'Scoring jobs not initialized');
  }

  res.status(200).json(new ApiResponse(200, scoringJobs.getStatus(), 'Scoring jobs status retrieved'));
};

/**
 * Get all subscriptions with pagination
 * GET /admin/subscriptions
 */
const getAllSubscriptions = async (req, res) => {
  const { page = 1, limit = 20, status, planType, search } = req.query;

  const parsedPage = Math.max(1, parseInt(page));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (parsedPage - 1) * parsedLimit;

  const where = {};

  if (status === 'active') {
    where.isActive = true;
    where.endDate = { [Op.gt]: new Date() };
  } else if (status === 'expired') {
    where[Op.or] = [
      { isActive: false },
      { endDate: { [Op.lte]: new Date() } }
    ];
  }

  if (planType && ['free', 'basic', 'pro', 'premium'].includes(planType)) {
    where.planType = planType;
  }

  if (search) {
    where.userWalletAddress = { [Op.like]: `%${search}%` };
  }

  const { count, rows } = await Subscription.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parsedLimit,
    offset
  });

  res.status(200).json(new ApiResponse(200, {
    subscriptions: rows,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: count,
      totalPages: Math.ceil(count / parsedLimit)
    }
  }, 'Subscriptions retrieved successfully'));
};

/**
 * Create or update subscription for a user
 * POST /admin/subscriptions
 */
const createSubscription = async (req, res) => {
  const { walletAddress, planType, durationDays, paymentTransactionHash, paymentAmount, notes } = req.body;
  const adminWallet = getAdminWallet(req);

  // Validate plan type
  if (!['free', 'basic', 'pro', 'premium'].includes(planType)) {
    throw new ApiError(400, 'Invalid plan type');
  }

  // Verify user exists
  const user = await User.findOne({ where: { walletAddress } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (parseInt(durationDays) || 30));

  // Deactivate any existing active subscriptions
  await Subscription.update(
    { isActive: false },
    {
      where: {
        userWalletAddress: walletAddress,
        isActive: true
      }
    }
  );

  // Create new subscription
  const subscription = await Subscription.create({
    userWalletAddress: walletAddress,
    planType,
    startDate,
    endDate,
    isActive: true,
    paymentTransactionHash,
    paymentAmount,
    metadata: { notes, createdBy: adminWallet }
  });

  // Recalculate user scores with new boost
  const scoringEngine = getScoringEngine();
  await scoringEngine.calculateUserScores(walletAddress);

  await logActivity(adminWallet, 'create_subscription', 'subscription', subscription.id, walletAddress, {
    newValue: { planType, durationDays, startDate, endDate }
  });

  res.status(201).json(new ApiResponse(201, subscription, 'Subscription created successfully'));
};

/**
 * Cancel a subscription
 * POST /admin/subscriptions/:subscriptionId/cancel
 */
const cancelSubscription = async (req, res) => {
  const { subscriptionId } = req.params;
  const { reason } = req.body;
  const adminWallet = getAdminWallet(req);

  const subscription = await Subscription.findByPk(subscriptionId);
  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  const previousValue = subscription.toJSON();

  await subscription.update({
    isActive: false,
    cancelledAt: new Date(),
    cancelReason: reason || 'Cancelled by admin'
  });

  // Recalculate user scores (will use free multiplier now)
  const scoringEngine = getScoringEngine();
  await scoringEngine.calculateUserScores(subscription.userWalletAddress);

  await logActivity(adminWallet, 'cancel_subscription', 'subscription', subscription.id, subscription.userWalletAddress, {
    previousValue,
    newValue: subscription.toJSON(),
    reason
  });

  res.status(200).json(new ApiResponse(200, subscription, 'Subscription cancelled successfully'));
};

/**
 * Extend a subscription
 * POST /admin/subscriptions/:subscriptionId/extend
 */
const extendSubscription = async (req, res) => {
  const { subscriptionId } = req.params;
  const { additionalDays, reason } = req.body;
  const adminWallet = getAdminWallet(req);

  const subscription = await Subscription.findByPk(subscriptionId);
  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  const previousEndDate = subscription.endDate;
  const newEndDate = new Date(subscription.endDate);
  newEndDate.setDate(newEndDate.getDate() + (parseInt(additionalDays) || 30));

  await subscription.update({
    endDate: newEndDate,
    isActive: true,
    metadata: {
      ...subscription.metadata,
      extensions: [
        ...(subscription.metadata?.extensions || []),
        { additionalDays, previousEndDate, newEndDate, extendedBy: adminWallet, reason, at: new Date() }
      ]
    }
  });

  await logActivity(adminWallet, 'extend_subscription', 'subscription', subscription.id, subscription.userWalletAddress, {
    previousValue: { endDate: previousEndDate },
    newValue: { endDate: newEndDate },
    reason
  });

  res.status(200).json(new ApiResponse(200, subscription, 'Subscription extended successfully'));
};

/**
 * Get scoring configuration
 * GET /admin/scoring/config
 */
const getScoringConfig = async (req, res) => {
  res.status(200).json(new ApiResponse(200, {
    boostMultipliers: scoringConfig.boostMultipliers,
    traderWeights: scoringConfig.traderWeights,
    creatorWeights: scoringConfig.creatorWeights,
    influencerWeights: scoringConfig.influencerWeights,
    normalization: scoringConfig.normalization,
    algorithmVersion: scoringConfig.algorithmVersion,
    cronSchedules: scoringConfig.cronSchedules
  }, 'Scoring configuration retrieved'));
};

/**
 * Get user stats with detailed breakdown
 * GET /admin/scoring/user/:walletAddress
 */
const getDetailedUserStats = async (req, res) => {
  const { walletAddress } = req.params;

  const scoringEngine = getScoringEngine();
  const stats = await scoringEngine.getUserStats(walletAddress);

  if (!stats) {
    throw new ApiError(404, 'User stats not found');
  }

  // Get recent activity log
  const recentActivities = await ActivityLog.findAll({
    where: { userWalletAddress: walletAddress },
    order: [['createdAt', 'DESC']],
    limit: 20
  });

  // Get subscription history
  const subscriptionHistory = await Subscription.findAll({
    where: { userWalletAddress: walletAddress },
    order: [['createdAt', 'DESC']]
  });

  res.status(200).json(new ApiResponse(200, {
    ...stats,
    recentActivities,
    subscriptionHistory
  }, 'Detailed user stats retrieved'));
};

/**
 * Get subscription statistics
 * GET /admin/subscriptions/stats
 */
const getSubscriptionStats = async (req, res) => {
  const [totalByPlan, activeByPlan, recentSubscriptions] = await Promise.all([
    Subscription.findAll({
      attributes: [
        'planType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      group: ['planType'],
      raw: true
    }),
    Subscription.findAll({
      attributes: [
        'planType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'active']
      ],
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      group: ['planType'],
      raw: true
    }),
    Subscription.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['walletAddress', 'username', 'profileImage']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    })
  ]);

  res.status(200).json(new ApiResponse(200, {
    totalByPlan: totalByPlan.reduce((acc, item) => {
      acc[item.planType] = parseInt(item.total);
      return acc;
    }, {}),
    activeByPlan: activeByPlan.reduce((acc, item) => {
      acc[item.planType] = parseInt(item.active);
      return acc;
    }, {}),
    recentSubscriptions
  }, 'Subscription statistics retrieved'));
};

module.exports = {
  recalculateAllScores,
  recalculateUserScores,
  getScoringJobsStatus,
  getAllSubscriptions,
  createSubscription,
  cancelSubscription,
  extendSubscription,
  getScoringConfig,
  getDetailedUserStats,
  getSubscriptionStats
};
