/**
 * Boost Engine Service
 *
 * Calculates visibility boost scores for content based on:
 * - User's subscription tier (free: 1.0x, basic: 1.10x, pro: 1.20x, premium: 1.30x)
 * - Content recency (newer content gets a recency boost)
 * - Engagement metrics (likes, comments, etc.)
 *
 * The boost score determines the order in which content appears in feeds and listings.
 */

const logger = require('../utils/logger');

class BoostEngine {
  constructor(models) {
    this.models = models;

    // Boost multipliers for subscription tiers
    this.SUBSCRIPTION_BOOSTS = {
      free: 1.0,
      basic: 1.10,    // 10% boost
      pro: 1.20,      // 20% boost
      premium: 1.30   // 30% boost
    };

    // Weights for boost calculation
    this.WEIGHTS = {
      subscription: 0.50,     // 50% weight for subscription tier
      recency: 0.30,          // 30% weight for recency
      engagement: 0.20        // 20% weight for engagement
    };

    // Recency decay settings
    this.RECENCY = {
      maxAgeHours: 168,       // 7 days - content older than this gets no recency boost
      minBoost: 0.5,          // Minimum recency multiplier
      maxBoost: 1.5           // Maximum recency multiplier (for very new content)
    };

    // Cache for user subscription data (to avoid repeated DB queries)
    this.subscriptionCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get user's active subscription and boost multiplier
   */
  async getUserSubscription(walletAddress) {
    const { Subscription } = this.models;

    // Check cache first
    const cached = this.subscriptionCache.get(walletAddress);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const subscription = await Subscription.getActiveSubscription(walletAddress);
      const data = {
        planType: subscription ? subscription.planType : 'free',
        multiplier: subscription
          ? this.SUBSCRIPTION_BOOSTS[subscription.planType] || 1.0
          : 1.0,
        isActive: !!subscription,
        expiresAt: subscription ? subscription.endDate : null
      };

      // Cache the result
      this.subscriptionCache.set(walletAddress, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      logger.error(`Error getting subscription for ${walletAddress}:`, error);
      return {
        planType: 'free',
        multiplier: 1.0,
        isActive: false,
        expiresAt: null
      };
    }
  }

  /**
   * Calculate recency boost based on content age
   * Newer content gets higher boost, decaying over time
   */
  calculateRecencyBoost(createdAt) {
    const now = Date.now();
    const contentTime = new Date(createdAt).getTime();
    const ageHours = (now - contentTime) / (1000 * 60 * 60);

    if (ageHours <= 0) {
      return this.RECENCY.maxBoost;
    }

    if (ageHours >= this.RECENCY.maxAgeHours) {
      return this.RECENCY.minBoost;
    }

    // Exponential decay
    const decayRate = Math.log(this.RECENCY.maxBoost / this.RECENCY.minBoost) / this.RECENCY.maxAgeHours;
    const boost = this.RECENCY.maxBoost * Math.exp(-decayRate * ageHours);

    return Math.max(boost, this.RECENCY.minBoost);
  }

  /**
   * Calculate engagement boost based on likes, comments, etc.
   * Normalized to 0-2 range
   */
  calculateEngagementBoost(metrics) {
    const {
      likesCount = 0,
      commentsCount = 0,
      sharesCount = 0,
      viewsCount = 0
    } = metrics;

    // Weighted engagement score
    const engagementScore = (
      likesCount * 1.0 +
      commentsCount * 2.0 +
      sharesCount * 3.0 +
      viewsCount * 0.1
    );

    // Logarithmic scaling to prevent high-engagement content from dominating
    // Returns value between 1.0 and 2.0
    if (engagementScore <= 0) return 1.0;

    const boost = 1.0 + Math.min(Math.log10(engagementScore + 1) / 3, 1.0);
    return boost;
  }

  /**
   * Calculate the final boost score for content
   */
  async calculateBoostScore(params) {
    const {
      walletAddress,
      createdAt,
      likesCount = 0,
      commentsCount = 0,
      sharesCount = 0,
      viewsCount = 0
    } = params;

    // Get subscription boost
    const subscription = await this.getUserSubscription(walletAddress);
    const subscriptionBoost = subscription.multiplier;

    // Calculate recency boost
    const recencyBoost = this.calculateRecencyBoost(createdAt);

    // Calculate engagement boost
    const engagementBoost = this.calculateEngagementBoost({
      likesCount,
      commentsCount,
      sharesCount,
      viewsCount
    });

    // Combine all factors with weights
    const finalScore = (
      (subscriptionBoost * this.WEIGHTS.subscription) +
      (recencyBoost * this.WEIGHTS.recency) +
      (engagementBoost * this.WEIGHTS.engagement)
    );

    return {
      score: parseFloat(finalScore.toFixed(4)),
      components: {
        subscription: {
          planType: subscription.planType,
          multiplier: subscriptionBoost,
          weighted: parseFloat((subscriptionBoost * this.WEIGHTS.subscription).toFixed(4))
        },
        recency: {
          multiplier: parseFloat(recencyBoost.toFixed(4)),
          weighted: parseFloat((recencyBoost * this.WEIGHTS.recency).toFixed(4))
        },
        engagement: {
          multiplier: parseFloat(engagementBoost.toFixed(4)),
          weighted: parseFloat((engagementBoost * this.WEIGHTS.engagement).toFixed(4))
        }
      }
    };
  }

  /**
   * Batch calculate boost scores for multiple items
   * More efficient than calculating one by one
   */
  async calculateBatchBoostScores(items) {
    // Pre-fetch all unique wallet addresses' subscriptions
    const walletAddresses = [...new Set(items.map(item => item.walletAddress))];

    await Promise.all(
      walletAddresses.map(wallet => this.getUserSubscription(wallet))
    );

    // Now calculate scores (subscriptions are cached)
    const results = await Promise.all(
      items.map(async (item) => {
        const boost = await this.calculateBoostScore({
          walletAddress: item.walletAddress,
          createdAt: item.createdAt,
          likesCount: item.likesCount || 0,
          commentsCount: item.commentsCount || 0,
          sharesCount: item.sharesCount || 0,
          viewsCount: item.viewsCount || 0
        });

        return {
          ...item,
          boostScore: boost.score,
          boostDetails: boost.components
        };
      })
    );

    return results;
  }

  /**
   * Sort items by boost score (descending)
   */
  sortByBoost(items) {
    return items.sort((a, b) => (b.boostScore || 0) - (a.boostScore || 0));
  }

  /**
   * Apply boost scoring and sorting to posts
   */
  async boostPosts(posts) {
    const items = posts.map(post => ({
      walletAddress: post.authorWalletAddress,
      createdAt: post.createdAt,
      likesCount: post.likesCount || 0,
      commentsCount: post.commentsCount || 0,
      sharesCount: post.sharesCount || 0,
      id: post.id,
      originalData: post
    }));

    const boostedItems = await this.calculateBatchBoostScores(items);

    return boostedItems.map(item => ({
      ...item.originalData.toJSON ? item.originalData.toJSON() : item.originalData,
      boostScore: item.boostScore,
      boostDetails: item.boostDetails
    }));
  }

  /**
   * Apply boost scoring and sorting to collections
   */
  async boostCollections(collections) {
    const items = collections.map(collection => ({
      walletAddress: collection.creatorWalletAddress,
      createdAt: collection.createdAt,
      likesCount: 0, // Collections don't have likes
      commentsCount: 0,
      sharesCount: 0,
      viewsCount: parseInt(collection.totalVolume || 0) / 1000000, // Use volume as proxy for views
      id: collection.id,
      originalData: collection
    }));

    const boostedItems = await this.calculateBatchBoostScores(items);

    return boostedItems.map(item => ({
      ...item.originalData.toJSON ? item.originalData.toJSON() : item.originalData,
      boostScore: item.boostScore,
      boostDetails: item.boostDetails
    }));
  }

  /**
   * Get boosted feed query parameters for Sequelize
   * This adds a virtual boostScore column based on subscription tier
   */
  async getBoostedQueryParams(walletAddresses) {
    const { Subscription } = this.models;
    const { Op, literal, fn, col, cast } = require('sequelize').Sequelize;

    // Get all active subscriptions for the wallet addresses
    const subscriptions = await Subscription.findAll({
      where: {
        userWalletAddress: { [Op.in]: walletAddresses },
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      attributes: ['userWalletAddress', 'planType']
    });

    // Create a map of wallet -> multiplier
    const boostMap = {};
    subscriptions.forEach(sub => {
      boostMap[sub.userWalletAddress] = this.SUBSCRIPTION_BOOSTS[sub.planType] || 1.0;
    });

    return boostMap;
  }

  /**
   * Clear subscription cache
   */
  clearCache() {
    this.subscriptionCache.clear();
  }

  /**
   * Clear cache for specific user
   */
  clearUserCache(walletAddress) {
    this.subscriptionCache.delete(walletAddress);
  }
}

// Singleton instance
let boostEngineInstance = null;

/**
 * Initialize boost engine with models
 */
const initBoostEngine = (models) => {
  if (!boostEngineInstance) {
    boostEngineInstance = new BoostEngine(models);
  }
  return boostEngineInstance;
};

/**
 * Get the boost engine instance
 */
const getBoostEngine = () => {
  return boostEngineInstance;
};

module.exports = {
  BoostEngine,
  initBoostEngine,
  getBoostEngine
};
