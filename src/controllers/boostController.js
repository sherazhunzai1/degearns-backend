/**
 * Boost Controller
 *
 * Provides API endpoints for boost-related operations:
 * - Get user's boost status
 * - Calculate boost score for content
 * - Preview boost with different subscription tiers
 */

const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { initBoostEngine } = require('../services/boostEngine');
const {
  getActiveSubscriptionsForWallets
} = require('../utils/userHelpers');

/**
 * Get user's current boost status
 * Returns subscription tier and boost multiplier
 */
const getUserBoostStatus = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const db = require('../models');
    const boostEngine = initBoostEngine(db);

    const subscription = await boostEngine.getUserSubscription(walletAddress);

    // Get all available tiers for comparison
    const allTiers = {
      free: { multiplier: 1.0, boost: '0%' },
      basic: { multiplier: 1.10, boost: '+10%' },
      pro: { multiplier: 1.20, boost: '+20%' },
      premium: { multiplier: 1.30, boost: '+30%' }
    };

    res.status(200).json(
      new ApiResponse(200, {
        currentPlan: subscription.planType,
        boostMultiplier: subscription.multiplier,
        boostPercentage: `+${((subscription.multiplier - 1) * 100).toFixed(0)}%`,
        isActive: subscription.isActive,
        expiresAt: subscription.expiresAt,
        availableTiers: allTiers
      }, 'Boost status retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate boost score for a specific content item
 * Useful for previewing how content would be boosted
 */
const calculateBoostScore = async (req, res, next) => {
  try {
    const {
      walletAddress,
      createdAt,
      likesCount = 0,
      commentsCount = 0,
      sharesCount = 0,
      viewsCount = 0
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const db = require('../models');
    const boostEngine = initBoostEngine(db);

    const boostResult = await boostEngine.calculateBoostScore({
      walletAddress,
      createdAt: createdAt || new Date(),
      likesCount: parseInt(likesCount) || 0,
      commentsCount: parseInt(commentsCount) || 0,
      sharesCount: parseInt(sharesCount) || 0,
      viewsCount: parseInt(viewsCount) || 0
    });

    res.status(200).json(
      new ApiResponse(200, boostResult, 'Boost score calculated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Preview boost scores with different subscription tiers
 * Shows what boost score would be with each tier
 */
const previewBoostTiers = async (req, res, next) => {
  try {
    const {
      createdAt,
      likesCount = 0,
      commentsCount = 0,
      sharesCount = 0,
      viewsCount = 0
    } = req.body;

    const db = require('../models');
    const boostEngine = initBoostEngine(db);

    // Calculate base components
    const recencyBoost = boostEngine.calculateRecencyBoost(createdAt || new Date());
    const engagementBoost = boostEngine.calculateEngagementBoost({
      likesCount: parseInt(likesCount) || 0,
      commentsCount: parseInt(commentsCount) || 0,
      sharesCount: parseInt(sharesCount) || 0,
      viewsCount: parseInt(viewsCount) || 0
    });

    // Calculate final score for each tier
    const tiers = ['free', 'basic', 'pro', 'premium'];
    const weights = boostEngine.WEIGHTS;

    const tierScores = tiers.map(tier => {
      const subscriptionBoost = boostEngine.SUBSCRIPTION_BOOSTS[tier];
      const finalScore = (
        (subscriptionBoost * weights.subscription) +
        (recencyBoost * weights.recency) +
        (engagementBoost * weights.engagement)
      );

      return {
        tier,
        multiplier: subscriptionBoost,
        boostPercentage: `+${((subscriptionBoost - 1) * 100).toFixed(0)}%`,
        finalScore: parseFloat(finalScore.toFixed(4)),
        components: {
          subscription: parseFloat((subscriptionBoost * weights.subscription).toFixed(4)),
          recency: parseFloat((recencyBoost * weights.recency).toFixed(4)),
          engagement: parseFloat((engagementBoost * weights.engagement).toFixed(4))
        }
      };
    });

    res.status(200).json(
      new ApiResponse(200, {
        baseMetrics: {
          recencyBoost: parseFloat(recencyBoost.toFixed(4)),
          engagementBoost: parseFloat(engagementBoost.toFixed(4))
        },
        tierComparison: tierScores
      }, 'Boost tier preview generated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get boost leaderboard - top boosted users
 * Shows users with highest subscription tiers
 */
const getBoostLeaderboard = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const db = require('../models');
    const { Subscription, User, UserStats } = db;
    const { Op } = require('sequelize');

    // Get active subscriptions sorted by tier
    const subscriptions = await Subscription.findAll({
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [
        [db.sequelize.literal(`FIELD(planType, 'premium', 'pro', 'basic', 'free')`), 'ASC'],
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit)
    });

    // Get user details for each subscription
    const leaderboardData = await Promise.all(
      subscriptions.map(async (sub, index) => {
        const user = await User.findOne({
          where: { walletAddress: sub.userWalletAddress },
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        });

        const stats = await UserStats.findOne({
          where: { userWalletAddress: sub.userWalletAddress }
        });

        const boostEngine = initBoostEngine(db);
        const multiplier = boostEngine.SUBSCRIPTION_BOOSTS[sub.planType];

        return {
          rank: index + 1,
          user: user ? {
            walletAddress: user.walletAddress,
            username: user.username,
            profileImage: user.profileImage,
            isVerified: user.isVerified
          } : {
            walletAddress: sub.userWalletAddress,
            username: sub.userWalletAddress.substring(0, 8) + '...',
            profileImage: null,
            isVerified: false
          },
          subscription: {
            planType: sub.planType,
            boostMultiplier: multiplier,
            boostPercentage: `+${((multiplier - 1) * 100).toFixed(0)}%`,
            expiresAt: sub.endDate
          },
          scores: stats ? {
            traderScore: parseFloat(stats.boostedTraderScore || 0),
            creatorScore: parseFloat(stats.boostedCreatorScore || 0),
            influencerScore: parseFloat(stats.boostedInfluencerScore || 0)
          } : null
        };
      })
    );

    // Enrich user data with subscription plans
    const walletAddresses = leaderboardData.map(item => item.user.walletAddress);
    const subscriptionPlans = await getActiveSubscriptionsForWallets(walletAddresses);

    const leaderboard = leaderboardData.map(item => ({
      ...item,
      user: {
        ...item.user,
        subscriptionPlan: subscriptionPlans[item.user.walletAddress] || null
      }
    }));

    res.status(200).json(
      new ApiResponse(200, {
        leaderboard,
        total: subscriptions.length
      }, 'Boost leaderboard retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserBoostStatus,
  calculateBoostScore,
  previewBoostTiers,
  getBoostLeaderboard
};
