/**
 * Scoring Configuration
 *
 * This file contains all the configuration for the weighted scoring algorithm.
 * Weights should sum to 1.0 for each category.
 */

module.exports = {
  // Subscription boost multipliers
  boostMultipliers: {
    free: 1.0,
    basic: 1.10,    // 10% boost
    pro: 1.20,      // 20% boost
    premium: 1.30   // 30% boost
  },

  // Trader scoring weights (must sum to 1.0)
  traderWeights: {
    volumeBought: 0.25,      // 25% - Total XRP spent buying NFTs
    volumeSold: 0.25,        // 25% - Total XRP earned from selling NFTs
    trades: 0.20,            // 20% - Number of trades
    uniqueCollections: 0.15, // 15% - Unique collections traded
    profitMargin: 0.15       // 15% - Profit margin percentage
  },

  // Creator scoring weights (must sum to 1.0)
  creatorWeights: {
    salesVolume: 0.30,       // 30% - Total revenue from NFT sales
    nftsSold: 0.20,          // 20% - Number of NFTs sold
    collections: 0.15,       // 15% - Number of collections created
    avgPrice: 0.15,          // 15% - Average NFT price
    uniqueBuyers: 0.20       // 20% - Number of unique buyers
  },

  // Influencer scoring weights (must sum to 1.0)
  influencerWeights: {
    followers: 0.25,         // 25% - Follower count
    likes: 0.20,             // 20% - Total likes received
    comments: 0.20,          // 20% - Total comments received
    posts: 0.15,             // 15% - Posts created
    engagement: 0.20         // 20% - Engagement rate
  },

  // Scoring periods
  periods: {
    // Monthly-based scoring (activities within calendar month)
    useMonthlyPeriod: true,

    // How often to recalculate scores (in milliseconds)
    recalculationIntervalMs: 60 * 60 * 1000, // 1 hour

    // Batch size for processing users
    batchSize: 100
  },

  // Normalization settings
  normalization: {
    // Maximum normalized score (before boost)
    maxScore: 100,

    // Minimum score threshold to appear on leaderboard
    minLeaderboardScore: 0.01,

    // Whether to use percentile-based normalization
    usePercentileNormalization: true,

    // Percentile for capping outliers (0-100)
    outlierPercentile: 99
  },

  // Cron schedule expressions
  cronSchedules: {
    // Main score recalculation - every hour at minute 0
    recalculateScores: '0 * * * *',

    // Full stats rebuild - once daily at 3 AM
    fullRebuild: '0 3 * * *',

    // Subscription expiry check - every 15 minutes
    checkSubscriptions: '*/15 * * * *'
  },

  // Algorithm versioning
  algorithmVersion: 1,

  // Get date range for a specific month
  getMonthDateRange: function(month, year) {
    // month is 1-12, year is full year (e.g., 2025)
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  },

  // Get current month and year
  getCurrentPeriod: function() {
    const now = new Date();
    return {
      month: now.getMonth() + 1, // 1-12
      year: now.getFullYear()
    };
  },

  // Validate that weights sum to 1.0
  validateWeights: function() {
    const validateCategory = (weights, category) => {
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new Error(`${category} weights must sum to 1.0, got ${sum}`);
      }
    };

    validateCategory(this.traderWeights, 'Trader');
    validateCategory(this.creatorWeights, 'Creator');
    validateCategory(this.influencerWeights, 'Influencer');

    return true;
  }
};
