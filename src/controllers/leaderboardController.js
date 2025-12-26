/**
 * Leaderboard Controller
 *
 * Handles leaderboard and user stats API endpoints
 * Supports monthly-based rankings with month/year filtering
 */

const {
  User,
  UserStats,
  Subscription,
  sequelize
} = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const ScoringEngine = require('../services/scoringEngine');
const scoringConfig = require('../config/scoring');

// Initialize scoring engine with models
const getScoringEngine = () => {
  return new ScoringEngine({
    User,
    UserStats,
    Subscription,
    ...require('../models'),
    sequelize
  });
};

/**
 * Parse and validate month/year from query params
 * Returns current month/year if not specified
 */
const parsePeriod = (query) => {
  const currentPeriod = scoringConfig.getCurrentPeriod();

  let month = query.month ? parseInt(query.month) : currentPeriod.month;
  let year = query.year ? parseInt(query.year) : currentPeriod.year;

  // Validate month
  if (month < 1 || month > 12) {
    month = currentPeriod.month;
  }

  // Validate year (reasonable range)
  if (year < 2020 || year > 2100) {
    year = currentPeriod.year;
  }

  return { month, year };
};

/**
 * Get month name from number
 */
const getMonthName = (month) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
};

/**
 * Get leaderboard for a category
 * GET /leaderboard/:type
 * Query params: page, limit, month, year
 */
const getLeaderboard = async (req, res) => {
  const { type } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // Parse period from query
  const { month, year } = parsePeriod(req.query);

  // Validate category type
  const validTypes = ['traders', 'creators', 'influencers'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, `Invalid leaderboard type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Convert plural to singular for scoring engine
  const category = type.slice(0, -1); // traders -> trader

  const parsedPage = Math.max(1, parseInt(page));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (parsedPage - 1) * parsedLimit;

  const scoringEngine = getScoringEngine();
  const leaderboard = await scoringEngine.getLeaderboard(category, {
    limit: parsedLimit,
    offset,
    month,
    year
  });

  // Get total count for pagination
  const scoreField = `boosted${category.charAt(0).toUpperCase() + category.slice(1)}Score`;
  const total = await UserStats.count({
    where: {
      [scoreField]: { [sequelize.Sequelize.Op.gt]: scoringConfig.normalization.minLeaderboardScore }
    }
  });

  res.status(200).json(new ApiResponse(200, {
    category: type,
    period: {
      month,
      year,
      name: `${getMonthName(month)} ${year}`
    },
    leaderboard,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
      hasMore: offset + leaderboard.length < total
    }
  }, `Top ${type} for ${getMonthName(month)} ${year} retrieved successfully`));
};

/**
 * Get user stats by wallet address
 * GET /leaderboard/user/:walletAddress
 * Query params: month, year
 */
const getUserStats = async (req, res) => {
  const { walletAddress } = req.params;

  // Parse period from query
  const { month, year } = parsePeriod(req.query);

  const scoringEngine = getScoringEngine();
  const stats = await scoringEngine.getUserStats(walletAddress, month, year);

  if (!stats) {
    // If no stats exist, create them
    await scoringEngine.calculateUserScores(walletAddress, month, year);
    const newStats = await scoringEngine.getUserStats(walletAddress, month, year);

    if (!newStats) {
      throw new ApiError(404, 'User not found');
    }

    return res.status(200).json(new ApiResponse(200, newStats, 'User stats retrieved successfully'));
  }

  res.status(200).json(new ApiResponse(200, stats, 'User stats retrieved successfully'));
};

/**
 * Get user's rank in each category
 * GET /leaderboard/user/:walletAddress/ranks
 * Query params: month, year
 */
const getUserRanks = async (req, res) => {
  const { walletAddress } = req.params;

  // Parse period from query
  const { month, year } = parsePeriod(req.query);

  const scoringEngine = getScoringEngine();
  const ranks = await scoringEngine.getUserRanks(walletAddress, month, year);

  res.status(200).json(new ApiResponse(200, {
    walletAddress,
    period: {
      month,
      year,
      name: `${getMonthName(month)} ${year}`
    },
    ranks
  }, 'User ranks retrieved successfully'));
};

/**
 * Recalculate scores for authenticated user
 * POST /leaderboard/recalculate
 * Query params: month, year (optional, defaults to current month)
 */
const recalculateMyScores = async (req, res) => {
  const walletAddress = req.user?.walletAddress;

  if (!walletAddress) {
    throw new ApiError(401, 'Authentication required');
  }

  // Parse period from query
  const { month, year } = parsePeriod(req.query);

  const scoringEngine = getScoringEngine();
  const result = await scoringEngine.calculateUserScores(walletAddress, month, year);

  res.status(200).json(new ApiResponse(200, result, `Scores for ${getMonthName(month)} ${year} recalculated successfully`));
};

/**
 * Get subscription plans info
 * GET /leaderboard/plans
 */
const getSubscriptionPlans = async (req, res) => {
  const plans = Object.entries(scoringConfig.boostMultipliers).map(([planType, multiplier]) => ({
    planType,
    boostMultiplier: multiplier,
    boostPercentage: Math.round((multiplier - 1) * 100),
    features: getPlanFeatures(planType)
  }));

  res.status(200).json(new ApiResponse(200, { plans }, 'Subscription plans retrieved successfully'));
};

/**
 * Get features for a plan type
 */
const getPlanFeatures = (planType) => {
  const features = {
    free: [
      'Basic leaderboard visibility',
      'Standard scoring',
      'No boost multiplier'
    ],
    basic: [
      '10% score boost',
      'Priority leaderboard visibility',
      'Basic analytics'
    ],
    pro: [
      '20% score boost',
      'Enhanced leaderboard visibility',
      'Advanced analytics',
      'Priority support'
    ],
    premium: [
      '30% score boost',
      'Maximum leaderboard visibility',
      'Full analytics suite',
      'Priority support',
      'Early access to features'
    ]
  };

  return features[planType] || [];
};

/**
 * Get user's active subscription
 * GET /leaderboard/subscription
 */
const getMySubscription = async (req, res) => {
  const walletAddress = req.user?.walletAddress;

  if (!walletAddress) {
    throw new ApiError(401, 'Authentication required');
  }

  const subscription = await Subscription.getActiveSubscription(walletAddress);

  if (!subscription) {
    return res.status(200).json(new ApiResponse(200, {
      hasActiveSubscription: false,
      planType: 'free',
      boostMultiplier: scoringConfig.boostMultipliers.free
    }, 'No active subscription'));
  }

  res.status(200).json(new ApiResponse(200, {
    hasActiveSubscription: true,
    subscription: subscription.toJSON()
  }, 'Subscription retrieved successfully'));
};

/**
 * Get leaderboard statistics
 * GET /leaderboard/stats
 * Query params: month, year
 */
const getLeaderboardStats = async (req, res) => {
  // Parse period from query
  const { month, year } = parsePeriod(req.query);

  const [
    totalUsers,
    subscribedUsers,
    avgTraderScore,
    avgCreatorScore,
    avgInfluencerScore
  ] = await Promise.all([
    UserStats.count(),
    Subscription.count({
      where: {
        isActive: true,
        endDate: { [sequelize.Sequelize.Op.gt]: new Date() },
        planType: { [sequelize.Sequelize.Op.ne]: 'free' }
      }
    }),
    UserStats.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('boostedTraderScore')), 'avg']],
      raw: true
    }),
    UserStats.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('boostedCreatorScore')), 'avg']],
      raw: true
    }),
    UserStats.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('boostedInfluencerScore')), 'avg']],
      raw: true
    })
  ]);

  res.status(200).json(new ApiResponse(200, {
    period: {
      month,
      year,
      name: `${getMonthName(month)} ${year}`
    },
    totalUsers,
    subscribedUsers,
    averageScores: {
      trader: parseFloat(avgTraderScore?.avg || 0).toFixed(2),
      creator: parseFloat(avgCreatorScore?.avg || 0).toFixed(2),
      influencer: parseFloat(avgInfluencerScore?.avg || 0).toFixed(2)
    },
    lastUpdated: new Date()
  }, 'Leaderboard statistics retrieved successfully'));
};

/**
 * Compare two users' stats
 * GET /leaderboard/compare/:walletAddress1/:walletAddress2
 * Query params: month, year
 */
const compareUsers = async (req, res) => {
  const { walletAddress1, walletAddress2 } = req.params;

  // Parse period from query
  const { month, year } = parsePeriod(req.query);

  const scoringEngine = getScoringEngine();

  const [user1Stats, user2Stats] = await Promise.all([
    scoringEngine.getUserStats(walletAddress1, month, year),
    scoringEngine.getUserStats(walletAddress2, month, year)
  ]);

  if (!user1Stats) {
    throw new ApiError(404, `User ${walletAddress1} not found`);
  }

  if (!user2Stats) {
    throw new ApiError(404, `User ${walletAddress2} not found`);
  }

  res.status(200).json(new ApiResponse(200, {
    period: {
      month,
      year,
      name: `${getMonthName(month)} ${year}`
    },
    user1: user1Stats,
    user2: user2Stats,
    comparison: {
      trader: {
        user1Score: parseFloat(user1Stats.stats.boostedTraderScore),
        user2Score: parseFloat(user2Stats.stats.boostedTraderScore),
        winner: parseFloat(user1Stats.stats.boostedTraderScore) > parseFloat(user2Stats.stats.boostedTraderScore)
          ? walletAddress1 : walletAddress2
      },
      creator: {
        user1Score: parseFloat(user1Stats.stats.boostedCreatorScore),
        user2Score: parseFloat(user2Stats.stats.boostedCreatorScore),
        winner: parseFloat(user1Stats.stats.boostedCreatorScore) > parseFloat(user2Stats.stats.boostedCreatorScore)
          ? walletAddress1 : walletAddress2
      },
      influencer: {
        user1Score: parseFloat(user1Stats.stats.boostedInfluencerScore),
        user2Score: parseFloat(user2Stats.stats.boostedInfluencerScore),
        winner: parseFloat(user1Stats.stats.boostedInfluencerScore) > parseFloat(user2Stats.stats.boostedInfluencerScore)
          ? walletAddress1 : walletAddress2
      }
    }
  }, 'User comparison retrieved successfully'));
};

/**
 * Get available periods (months) for historical data
 * GET /leaderboard/periods
 */
const getAvailablePeriods = async (req, res) => {
  const currentPeriod = scoringConfig.getCurrentPeriod();

  // Generate last 12 months
  const periods = [];
  for (let i = 0; i < 12; i++) {
    let month = currentPeriod.month - i;
    let year = currentPeriod.year;

    if (month <= 0) {
      month += 12;
      year -= 1;
    }

    periods.push({
      month,
      year,
      name: `${getMonthName(month)} ${year}`,
      isCurrent: i === 0
    });
  }

  res.status(200).json(new ApiResponse(200, {
    currentPeriod: {
      month: currentPeriod.month,
      year: currentPeriod.year,
      name: `${getMonthName(currentPeriod.month)} ${currentPeriod.year}`
    },
    availablePeriods: periods
  }, 'Available periods retrieved successfully'));
};

module.exports = {
  getLeaderboard,
  getUserStats,
  getUserRanks,
  recalculateMyScores,
  getSubscriptionPlans,
  getMySubscription,
  getLeaderboardStats,
  compareUsers,
  getAvailablePeriods
};
