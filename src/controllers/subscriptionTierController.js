/**
 * Subscription Tier Controller
 *
 * Provides API endpoints for subscription tier operations:
 * - Get all subscription tiers
 * - Get tier by name
 * - Compare tiers
 */

const { SubscriptionTier, Subscription, User, UserStats, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const ScoringEngine = require('../services/scoringEngine');

// Get scoring engine instance
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
 * Get all active subscription tiers
 * Returns tiers sorted by sortOrder (free -> basic -> pro -> premium)
 */
const getAllTiers = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;

    const whereClause = includeInactive === 'true' ? {} : { isActive: true };

    const tiers = await SubscriptionTier.findAll({
      where: whereClause,
      order: [['sortOrder', 'ASC']]
    });

    res.status(200).json(
      new ApiResponse(200, {
        tiers: tiers.map(tier => tier.toJSON()),
        total: tiers.length
      }, 'Subscription tiers retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific tier by name
 */
const getTierByName = async (req, res, next) => {
  try {
    const { name } = req.params;

    if (!name) {
      throw new ApiError(400, 'Tier name is required');
    }

    const tier = await SubscriptionTier.getTierByName(name);

    if (!tier) {
      throw new ApiError(404, `Tier '${name}' not found`);
    }

    res.status(200).json(
      new ApiResponse(200, tier.toJSON(), 'Subscription tier retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Compare multiple tiers side by side
 * Useful for pricing page comparisons
 */
const compareTiers = async (req, res, next) => {
  try {
    const tiers = await SubscriptionTier.getActiveTiers();

    // Build comparison matrix
    const allFeatures = new Set();
    tiers.forEach(tier => {
      tier.features.forEach(feature => allFeatures.add(feature));
    });

    const comparisonMatrix = Array.from(allFeatures).map(feature => {
      const row = { feature };
      tiers.forEach(tier => {
        row[tier.name] = tier.features.includes(feature);
      });
      return row;
    });

    // Build tier summary for quick comparison
    const tierSummary = tiers.map(tier => ({
      name: tier.name,
      displayName: tier.displayName,
      description: tier.description,
      boostMultiplier: tier.boostMultiplier,
      boostPercentage: tier.boostPercentage,
      boostDisplay: tier.boostPercentage > 0 ? `+${tier.boostPercentage}%` : 'No boost',
      monthlyPriceXrp: tier.monthlyPriceXrp,
      yearlyPriceXrp: tier.yearlyPriceXrp,
      yearlySavings: tier.getYearlySavings(),
      featuresCount: tier.features.length,
      color: tier.color,
      icon: tier.icon,
      badge: tier.badge
    }));

    res.status(200).json(
      new ApiResponse(200, {
        tiers: tierSummary,
        featureComparison: comparisonMatrix,
        allFeatures: Array.from(allFeatures)
      }, 'Tier comparison retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get tier pricing info
 * Focused endpoint for pricing display
 */
const getTierPricing = async (req, res, next) => {
  try {
    const tiers = await SubscriptionTier.getActiveTiers();

    const pricing = tiers.map(tier => ({
      name: tier.name,
      displayName: tier.displayName,
      monthlyPriceXrp: tier.monthlyPriceXrp,
      yearlyPriceXrp: tier.yearlyPriceXrp,
      yearlySavings: tier.getYearlySavings(),
      boostPercentage: tier.boostPercentage,
      badge: tier.badge,
      color: tier.color,
      isFree: tier.name === 'free'
    }));

    res.status(200).json(
      new ApiResponse(200, {
        pricing,
        currency: 'XRP'
      }, 'Tier pricing retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get tier features only
 * Lightweight endpoint for feature lists
 */
const getTierFeatures = async (req, res, next) => {
  try {
    const { name } = req.params;

    if (name) {
      // Get features for specific tier
      const tier = await SubscriptionTier.getTierByName(name);
      if (!tier) {
        throw new ApiError(404, `Tier '${name}' not found`);
      }

      return res.status(200).json(
        new ApiResponse(200, {
          tier: tier.name,
          displayName: tier.displayName,
          features: tier.features,
          limits: tier.limits
        }, 'Tier features retrieved successfully')
      );
    }

    // Get features for all tiers
    const tiers = await SubscriptionTier.getActiveTiers();

    const allFeatures = tiers.map(tier => ({
      tier: tier.name,
      displayName: tier.displayName,
      features: tier.features,
      limits: tier.limits
    }));

    res.status(200).json(
      new ApiResponse(200, {
        tiers: allFeatures
      }, 'All tier features retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get authenticated user's current subscription
 */
const getMySubscription = async (req, res, next) => {
  try {
    const walletAddress = req.user?.walletAddress;

    if (!walletAddress) {
      throw new ApiError(401, 'Authentication required');
    }

    const subscription = await Subscription.getActiveSubscription(walletAddress);

    if (!subscription) {
      // Get free tier info
      const freeTier = await SubscriptionTier.getTierByName('free');

      return res.status(200).json(
        new ApiResponse(200, {
          hasActiveSubscription: false,
          currentTier: freeTier ? freeTier.toJSON() : {
            name: 'free',
            displayName: 'Free',
            boostMultiplier: 1.0,
            boostPercentage: 0
          }
        }, 'No active subscription')
      );
    }

    // Get tier details
    const tier = await SubscriptionTier.getTierByName(subscription.planType);

    res.status(200).json(
      new ApiResponse(200, {
        hasActiveSubscription: true,
        subscription: subscription.toJSON(),
        currentTier: tier ? tier.toJSON() : null
      }, 'Subscription retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Subscribe to a plan / Upgrade subscription
 * Requires payment transaction hash for verification
 */
const subscribeToPlan = async (req, res, next) => {
  try {
    const walletAddress = req.user?.walletAddress;

    if (!walletAddress) {
      throw new ApiError(401, 'Authentication required');
    }

    const {
      planType,
      billingCycle = 'monthly',
      paymentTransactionHash,
      paymentAmount
    } = req.body;

    // Validate plan type
    if (!planType || !['basic', 'pro', 'premium'].includes(planType)) {
      throw new ApiError(400, 'Invalid plan type. Must be basic, pro, or premium');
    }

    // Get tier details to validate pricing
    const tier = await SubscriptionTier.getTierByName(planType);
    if (!tier || !tier.isActive) {
      throw new ApiError(400, 'Selected plan is not available');
    }

    // Determine duration based on billing cycle
    let durationDays = 30;
    let expectedPrice = tier.monthlyPriceXrp;

    if (billingCycle === 'yearly') {
      durationDays = 365;
      expectedPrice = tier.yearlyPriceXrp;
    }

    // Payment transaction hash is required for paid plans
    if (!paymentTransactionHash) {
      throw new ApiError(400, 'Payment transaction hash is required');
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.getActiveSubscription(walletAddress);

    // Calculate dates
    const startDate = new Date();
    let endDate = new Date();

    if (existingSubscription) {
      // If upgrading, extend from current end date or now (whichever is later)
      const currentEndDate = new Date(existingSubscription.endDate);
      if (currentEndDate > startDate) {
        endDate = new Date(currentEndDate);
      }
    }

    endDate.setDate(endDate.getDate() + durationDays);

    // Deactivate existing subscriptions
    if (existingSubscription) {
      await Subscription.update(
        { isActive: false },
        {
          where: {
            userWalletAddress: walletAddress,
            isActive: true
          }
        }
      );
    }

    // Create new subscription
    const subscription = await Subscription.create({
      userWalletAddress: walletAddress,
      planType,
      startDate,
      endDate,
      isActive: true,
      paymentTransactionHash,
      paymentAmount: paymentAmount || null,
      metadata: {
        billingCycle,
        expectedPrice,
        upgradedFrom: existingSubscription?.planType || 'free',
        subscribedAt: new Date().toISOString()
      }
    });

    // Recalculate user scores with new boost
    try {
      const scoringEngine = getScoringEngine();
      await scoringEngine.calculateUserScores(walletAddress);
    } catch (scoringError) {
      console.error('Failed to recalculate scores:', scoringError);
      // Don't fail the subscription creation if scoring fails
    }

    res.status(201).json(
      new ApiResponse(201, {
        subscription: subscription.toJSON(),
        tier: tier.toJSON(),
        message: existingSubscription
          ? `Successfully upgraded to ${tier.displayName}`
          : `Successfully subscribed to ${tier.displayName}`
      }, 'Subscription created successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel current subscription
 */
const cancelMySubscription = async (req, res, next) => {
  try {
    const walletAddress = req.user?.walletAddress;

    if (!walletAddress) {
      throw new ApiError(401, 'Authentication required');
    }

    const { reason } = req.body;

    const subscription = await Subscription.getActiveSubscription(walletAddress);

    if (!subscription) {
      throw new ApiError(404, 'No active subscription found');
    }

    await subscription.update({
      isActive: false,
      cancelledAt: new Date(),
      cancelReason: reason || 'Cancelled by user',
      metadata: {
        ...subscription.metadata,
        cancelledByUser: true
      }
    });

    // Recalculate user scores (will use free multiplier now)
    try {
      const scoringEngine = getScoringEngine();
      await scoringEngine.calculateUserScores(walletAddress);
    } catch (scoringError) {
      console.error('Failed to recalculate scores:', scoringError);
    }

    res.status(200).json(
      new ApiResponse(200, {
        subscription: subscription.toJSON(),
        message: 'Subscription cancelled successfully. You will retain access until the end of your billing period.'
      }, 'Subscription cancelled successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get upgrade options for current user
 * Shows available upgrades based on current subscription
 */
const getUpgradeOptions = async (req, res, next) => {
  try {
    const walletAddress = req.user?.walletAddress;

    if (!walletAddress) {
      throw new ApiError(401, 'Authentication required');
    }

    const currentSubscription = await Subscription.getActiveSubscription(walletAddress);
    const currentPlan = currentSubscription?.planType || 'free';

    // Get all active tiers
    const allTiers = await SubscriptionTier.getActiveTiers();

    // Determine which tiers are upgrades
    const tierOrder = { free: 0, basic: 1, pro: 2, premium: 3 };
    const currentTierOrder = tierOrder[currentPlan];

    const upgradeOptions = allTiers
      .filter(tier => tierOrder[tier.name] > currentTierOrder)
      .map(tier => ({
        ...tier.toJSON(),
        isUpgrade: true,
        upgradeFrom: currentPlan,
        boostIncrease: `+${tier.boostPercentage - (currentSubscription ? Subscription.BOOST_MULTIPLIERS[currentPlan] * 100 - 100 : 0)}%`
      }));

    const currentTier = allTiers.find(t => t.name === currentPlan);

    res.status(200).json(
      new ApiResponse(200, {
        currentPlan: {
          name: currentPlan,
          displayName: currentTier?.displayName || 'Free',
          boostMultiplier: Subscription.BOOST_MULTIPLIERS[currentPlan] || 1.0,
          expiresAt: currentSubscription?.endDate || null,
          remainingDays: currentSubscription?.getRemainingDays() || null
        },
        upgradeOptions,
        canUpgrade: upgradeOptions.length > 0
      }, 'Upgrade options retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTiers,
  getTierByName,
  compareTiers,
  getTierPricing,
  getTierFeatures,
  getMySubscription,
  subscribeToPlan,
  cancelMySubscription,
  getUpgradeOptions
};
