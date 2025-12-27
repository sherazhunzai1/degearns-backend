/**
 * Subscription Tier Controller
 *
 * Provides API endpoints for subscription tier operations:
 * - Get all subscription tiers
 * - Get tier by name
 * - Compare tiers
 */

const { SubscriptionTier } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

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

module.exports = {
  getAllTiers,
  getTierByName,
  compareTiers,
  getTierPricing,
  getTierFeatures
};
