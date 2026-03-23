/**
 * Scoring Engine Service
 *
 * Calculates trader, creator, and influencer scores for users.
 * Uses monthly-based scoring periods with subscription boost multipliers.
 */

const { Op } = require('sequelize');
const scoringConfig = require('../config/scoring');
const {
  getActiveSubscriptionsForWallets
} = require('../utils/userHelpers');

class ScoringEngine {
  constructor(models) {
    this.models = models;
    this.config = scoringConfig;

    // Validate configuration on initialization
    this.config.validateWeights();
  }

  /**
   * Calculate scores for a single user for a specific month
   * @param {string} walletAddress - User's wallet address
   * @param {number} month - Month (1-12), defaults to current month
   * @param {number} year - Year, defaults to current year
   * @returns {Object} Calculated scores
   */
  async calculateUserScores(walletAddress, month = null, year = null) {
    const { User, UserStats, Subscription, ActivityLog, Follow, Post, PostLike, PostComment, DropMint, Drop, Collection } = this.models;

    // Default to current month/year if not specified
    const period = this.config.getCurrentPeriod();
    const targetMonth = month || period.month;
    const targetYear = year || period.year;

    // Get or create user stats
    let userStats = await UserStats.findOne({ where: { userWalletAddress: walletAddress } });
    if (!userStats) {
      userStats = await UserStats.create({ userWalletAddress: walletAddress });
    }

    // Get user's boost multiplier from subscription
    const boostMultiplier = await Subscription.getUserBoostMultiplier(walletAddress);

    // Get date range for the specified month
    const { startDate, endDate } = this.config.getMonthDateRange(targetMonth, targetYear);

    // Gather raw metrics for the month
    const rawMetrics = await this.gatherRawMetrics(walletAddress, startDate, endDate);

    // Get max values for normalization (for the same month across all users)
    const maxValues = await this.getMaxValuesForNormalization(targetMonth, targetYear);

    // Normalize metrics
    const normalizedMetrics = this.normalizeMetrics(rawMetrics, maxValues);

    // Calculate base scores
    const traderScore = this.calculateTraderScore(normalizedMetrics);
    const creatorScore = this.calculateCreatorScore(normalizedMetrics);
    const influencerScore = this.calculateInfluencerScore(normalizedMetrics);

    // Apply boost
    const boostedTraderScore = traderScore * boostMultiplier;
    const boostedCreatorScore = creatorScore * boostMultiplier;
    const boostedInfluencerScore = influencerScore * boostMultiplier;

    // Update user stats
    await userStats.update({
      // Raw metrics - Trader
      totalVolumeBought: rawMetrics.volumeBought,
      totalVolumeSold: rawMetrics.volumeSold,
      numberOfTrades: rawMetrics.trades,
      uniqueCollectionsTraded: rawMetrics.uniqueCollections,
      profitMargin: rawMetrics.profitMargin,
      // Raw metrics - Creator
      totalSalesVolume: rawMetrics.salesVolume,
      nftsSold: rawMetrics.nftsSold,
      collectionsCreated: rawMetrics.collections,
      averageNftPrice: rawMetrics.avgPrice,
      uniqueBuyers: rawMetrics.uniqueBuyers,
      // Raw metrics - Influencer (receiving)
      followersCount: rawMetrics.followers,
      totalLikesReceived: rawMetrics.likesReceived,
      totalCommentsReceived: rawMetrics.commentsReceived,
      postsCreated: rawMetrics.posts,
      engagementRate: rawMetrics.engagement,
      // Raw metrics - Engagement (giving)
      totalLikesGiven: rawMetrics.likesGiven,
      totalCommentsGiven: rawMetrics.commentsGiven,
      totalFollowsGiven: rawMetrics.followsGiven,

      // Base scores
      traderScore,
      creatorScore,
      influencerScore,

      // Boosted scores
      boostedTraderScore,
      boostedCreatorScore,
      boostedInfluencerScore,

      // Meta
      currentBoostMultiplier: boostMultiplier,
      lastCalculatedAt: new Date(),
      calculationVersion: this.config.algorithmVersion
    });

    return {
      walletAddress,
      period: { month: targetMonth, year: targetYear },
      rawMetrics,
      normalizedMetrics,
      scores: {
        trader: traderScore,
        creator: creatorScore,
        influencer: influencerScore
      },
      boostedScores: {
        trader: boostedTraderScore,
        creator: boostedCreatorScore,
        influencer: boostedInfluencerScore
      },
      boostMultiplier
    };
  }

  /**
   * Gather raw metrics for a user within a date range
   */
  async gatherRawMetrics(walletAddress, startDate, endDate) {
    const { ActivityLog, Follow, Post, PostLike, PostComment, DropMint, Drop, Collection } = this.models;

    // Get aggregated activities
    const activities = await ActivityLog.aggregateForUser(walletAddress, startDate, endDate);

    // Trader metrics
    const volumeBought = (activities.nft_buy?.totalAmount || 0) + (activities.nft_mint?.totalAmount || 0);
    const volumeSold = activities.nft_sell?.totalAmount || 0;
    const trades = (activities.nft_buy?.count || 0) + (activities.nft_sell?.count || 0);
    const uniqueCollections = await ActivityLog.getUniqueCollectionsTraded(walletAddress, startDate, endDate);

    // Calculate profit margin
    let profitMargin = 0;
    if (volumeBought > 0) {
      profitMargin = ((volumeSold - volumeBought) / volumeBought) * 100;
    }

    // Creator metrics
    const salesVolume = volumeSold;
    const nftsSold = activities.nft_sell?.count || 0;

    // For collections, count those created in the month
    const collections = await Collection.count({
      where: {
        creatorWalletAddress: walletAddress,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });

    const avgPrice = nftsSold > 0 ? salesVolume / nftsSold : 0;
    const uniqueBuyers = await ActivityLog.getUniqueBuyersForCreator(walletAddress, startDate, endDate);

    // Influencer metrics - new followers gained in the month
    const newFollowers = await Follow.count({
      where: {
        followingWalletAddress: walletAddress,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });

    // Total followers (for engagement calculation)
    const totalFollowers = await Follow.count({
      where: { followingWalletAddress: walletAddress }
    });

    // Get likes and comments received on user's posts during the month
    const userPosts = await Post.findAll({
      where: { authorWalletAddress: walletAddress },
      attributes: ['id']
    });
    const postIds = userPosts.map(p => p.id);

    let likesReceived = 0;
    let commentsReceived = 0;
    if (postIds.length > 0) {
      likesReceived = await PostLike.count({
        where: {
          postId: { [Op.in]: postIds },
          createdAt: { [Op.between]: [startDate, endDate] }
        }
      });
      commentsReceived = await PostComment.count({
        where: {
          postId: { [Op.in]: postIds },
          createdAt: { [Op.between]: [startDate, endDate] }
        }
      });
    }

    // Posts created in the month
    const posts = await Post.count({
      where: {
        authorWalletAddress: walletAddress,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });

    // Calculate engagement rate for the month
    let engagement = 0;
    if (totalFollowers > 0 && posts > 0) {
      const totalEngagements = likesReceived + commentsReceived;
      engagement = (totalEngagements / (totalFollowers * posts)) * 100;
    }

    // Engagement metrics (giving) - from ActivityLog
    const likesGiven = activities.like_give?.count || 0;
    const commentsGiven = activities.comment_create?.count || 0;
    const followsGiven = activities.follow_give?.count || 0;

    return {
      // Trader
      volumeBought,
      volumeSold,
      trades,
      uniqueCollections,
      profitMargin,
      // Creator
      salesVolume,
      nftsSold,
      collections,
      avgPrice,
      uniqueBuyers,
      // Influencer (receiving)
      followers: newFollowers, // New followers this month
      totalFollowers,
      likesReceived,
      commentsReceived,
      posts,
      engagement,
      // Engagement (giving)
      likesGiven,
      commentsGiven,
      followsGiven
    };
  }

  /**
   * Get maximum values across all users for normalization
   * Uses current month's data for fair comparison
   */
  async getMaxValuesForNormalization(month, year) {
    const { UserStats } = this.models;
    const { sequelize } = this.models;

    const result = await UserStats.findOne({
      attributes: [
        [sequelize.fn('MAX', sequelize.col('totalVolumeBought')), 'maxVolumeBought'],
        [sequelize.fn('MAX', sequelize.col('totalVolumeSold')), 'maxVolumeSold'],
        [sequelize.fn('MAX', sequelize.col('numberOfTrades')), 'maxTrades'],
        [sequelize.fn('MAX', sequelize.col('uniqueCollectionsTraded')), 'maxUniqueCollections'],
        [sequelize.fn('MAX', sequelize.col('profitMargin')), 'maxProfitMargin'],
        [sequelize.fn('MAX', sequelize.col('totalSalesVolume')), 'maxSalesVolume'],
        [sequelize.fn('MAX', sequelize.col('nftsSold')), 'maxNftsSold'],
        [sequelize.fn('MAX', sequelize.col('collectionsCreated')), 'maxCollections'],
        [sequelize.fn('MAX', sequelize.col('averageNftPrice')), 'maxAvgPrice'],
        [sequelize.fn('MAX', sequelize.col('uniqueBuyers')), 'maxUniqueBuyers'],
        [sequelize.fn('MAX', sequelize.col('followersCount')), 'maxFollowers'],
        [sequelize.fn('MAX', sequelize.col('totalLikesReceived')), 'maxLikesReceived'],
        [sequelize.fn('MAX', sequelize.col('totalCommentsReceived')), 'maxCommentsReceived'],
        [sequelize.fn('MAX', sequelize.col('postsCreated')), 'maxPosts'],
        [sequelize.fn('MAX', sequelize.col('engagementRate')), 'maxEngagement'],
        [sequelize.fn('MAX', sequelize.col('totalLikesGiven')), 'maxLikesGiven'],
        [sequelize.fn('MAX', sequelize.col('totalCommentsGiven')), 'maxCommentsGiven'],
        [sequelize.fn('MAX', sequelize.col('totalFollowsGiven')), 'maxFollowsGiven']
      ],
      raw: true
    });

    // Ensure we have minimum values to avoid division by zero
    return {
      maxVolumeBought: Math.max(parseFloat(result?.maxVolumeBought) || 1, 1),
      maxVolumeSold: Math.max(parseFloat(result?.maxVolumeSold) || 1, 1),
      maxTrades: Math.max(parseInt(result?.maxTrades) || 1, 1),
      maxUniqueCollections: Math.max(parseInt(result?.maxUniqueCollections) || 1, 1),
      maxProfitMargin: Math.max(parseFloat(result?.maxProfitMargin) || 1, 100),
      maxSalesVolume: Math.max(parseFloat(result?.maxSalesVolume) || 1, 1),
      maxNftsSold: Math.max(parseInt(result?.maxNftsSold) || 1, 1),
      maxCollections: Math.max(parseInt(result?.maxCollections) || 1, 1),
      maxAvgPrice: Math.max(parseFloat(result?.maxAvgPrice) || 1, 1),
      maxUniqueBuyers: Math.max(parseInt(result?.maxUniqueBuyers) || 1, 1),
      maxFollowers: Math.max(parseInt(result?.maxFollowers) || 1, 1),
      maxLikesReceived: Math.max(parseInt(result?.maxLikesReceived) || 1, 1),
      maxCommentsReceived: Math.max(parseInt(result?.maxCommentsReceived) || 1, 1),
      maxPosts: Math.max(parseInt(result?.maxPosts) || 1, 1),
      maxEngagement: Math.max(parseFloat(result?.maxEngagement) || 1, 100),
      maxLikesGiven: Math.max(parseInt(result?.maxLikesGiven) || 1, 1),
      maxCommentsGiven: Math.max(parseInt(result?.maxCommentsGiven) || 1, 1),
      maxFollowsGiven: Math.max(parseInt(result?.maxFollowsGiven) || 1, 1)
    };
  }

  /**
   * Normalize metrics to 0-100 scale
   */
  normalizeMetrics(rawMetrics, maxValues) {
    const normalize = (value, max) => {
      if (!max || max === 0) return 0;
      return Math.min((value / max) * this.config.normalization.maxScore, this.config.normalization.maxScore);
    };

    return {
      volumeBought: normalize(rawMetrics.volumeBought, maxValues.maxVolumeBought),
      volumeSold: normalize(rawMetrics.volumeSold, maxValues.maxVolumeSold),
      trades: normalize(rawMetrics.trades, maxValues.maxTrades),
      uniqueCollections: normalize(rawMetrics.uniqueCollections, maxValues.maxUniqueCollections),
      profitMargin: normalize(Math.max(0, rawMetrics.profitMargin), maxValues.maxProfitMargin),
      salesVolume: normalize(rawMetrics.salesVolume, maxValues.maxSalesVolume),
      nftsSold: normalize(rawMetrics.nftsSold, maxValues.maxNftsSold),
      collections: normalize(rawMetrics.collections, maxValues.maxCollections),
      avgPrice: normalize(rawMetrics.avgPrice, maxValues.maxAvgPrice),
      uniqueBuyers: normalize(rawMetrics.uniqueBuyers, maxValues.maxUniqueBuyers),
      followers: normalize(rawMetrics.followers, maxValues.maxFollowers),
      likesReceived: normalize(rawMetrics.likesReceived, maxValues.maxLikesReceived),
      commentsReceived: normalize(rawMetrics.commentsReceived, maxValues.maxCommentsReceived),
      posts: normalize(rawMetrics.posts, maxValues.maxPosts),
      engagement: normalize(rawMetrics.engagement, maxValues.maxEngagement),
      likesGiven: normalize(rawMetrics.likesGiven, maxValues.maxLikesGiven),
      commentsGiven: normalize(rawMetrics.commentsGiven, maxValues.maxCommentsGiven),
      followsGiven: normalize(rawMetrics.followsGiven, maxValues.maxFollowsGiven)
    };
  }

  /**
   * Calculate trader score from normalized metrics
   */
  calculateTraderScore(normalized) {
    const w = this.config.traderWeights;
    return (
      (normalized.volumeBought * w.volumeBought) +
      (normalized.volumeSold * w.volumeSold) +
      (normalized.trades * w.trades) +
      (normalized.uniqueCollections * w.uniqueCollections) +
      (normalized.profitMargin * w.profitMargin)
    );
  }

  /**
   * Calculate creator score from normalized metrics
   */
  calculateCreatorScore(normalized) {
    const w = this.config.creatorWeights;
    return (
      (normalized.salesVolume * w.salesVolume) +
      (normalized.nftsSold * w.nftsSold) +
      (normalized.collections * w.collections) +
      (normalized.avgPrice * w.avgPrice) +
      (normalized.uniqueBuyers * w.uniqueBuyers)
    );
  }

  /**
   * Calculate influencer score from normalized metrics
   * Includes both "receiving" (content popularity) and "giving" (community participation)
   */
  calculateInfluencerScore(normalized) {
    const w = this.config.influencerWeights;
    return (
      // Receiving metrics (content popularity)
      (normalized.followers * w.followers) +
      (normalized.likesReceived * w.likesReceived) +
      (normalized.commentsReceived * w.commentsReceived) +
      (normalized.posts * w.posts) +
      (normalized.engagement * w.engagement) +
      // Giving metrics (community participation)
      (normalized.likesGiven * w.likesGiven) +
      (normalized.commentsGiven * w.commentsGiven) +
      (normalized.followsGiven * w.followsGiven)
    );
  }

  /**
   * Recalculate scores for all users for a specific month
   * @param {Object} options - Options for batch processing
   * @returns {Object} Summary of recalculation
   */
  async recalculateAllScores(options = {}) {
    const { User } = this.models;
    const {
      batchSize = this.config.periods.batchSize,
      onProgress = null,
      month = null,
      year = null
    } = options;

    // Default to current month/year
    const period = this.config.getCurrentPeriod();
    const targetMonth = month || period.month;
    const targetYear = year || period.year;

    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    // Get all active users
    const totalUsers = await User.count({ where: { isBanned: false } });
    let offset = 0;

    console.log(`Starting score recalculation for ${totalUsers} users (${targetMonth}/${targetYear})...`);

    while (offset < totalUsers) {
      const users = await User.findAll({
        where: { isBanned: false },
        attributes: ['walletAddress'],
        limit: batchSize,
        offset
      });

      // Process batch in parallel
      const results = await Promise.allSettled(
        users.map(user => this.calculateUserScores(user.walletAddress, targetMonth, targetYear))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          errors++;
          console.error('Error calculating scores:', result.reason);
        }
      }

      offset += batchSize;

      if (onProgress) {
        onProgress({ processed, total: totalUsers, errors });
      }
    }

    const duration = Date.now() - startTime;

    console.log(`Score recalculation complete: ${processed} processed, ${errors} errors, ${duration}ms`);

    return {
      processed,
      errors,
      total: totalUsers,
      durationMs: duration,
      period: { month: targetMonth, year: targetYear }
    };
  }

  /**
   * Get leaderboard for a category for a specific month
   * @param {string} category - 'trader', 'creator', or 'influencer'
   * @param {Object} options - Pagination and period options
   */
  async getLeaderboard(category, options = {}) {
    const { UserStats, User, Subscription } = this.models;
    const { limit = 100, offset = 0, month = null, year = null } = options;

    // Default to current month/year
    const period = this.config.getCurrentPeriod();
    const targetMonth = month || period.month;
    const targetYear = year || period.year;

    const scoreField = `boosted${category.charAt(0).toUpperCase() + category.slice(1)}Score`;

    const stats = await UserStats.findAll({
      where: {
        [scoreField]: { [Op.gt]: this.config.normalization.minLeaderboardScore }
      },
      order: [[scoreField, 'DESC']],
      limit,
      offset,
      raw: true
    });

    // Enrich with user details
    const users = await User.findAll({
      where: {
        walletAddress: { [Op.in]: stats.map(s => s.userWalletAddress) }
      },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'],
      raw: true
    });

    // Create user lookup map
    const userMap = new Map(users.map(u => [u.walletAddress, u]));

    // Batch fetch subscriptions for all wallets
    const walletAddresses = stats.map(s => s.userWalletAddress);
    const subscriptionsMap = await getActiveSubscriptionsForWallets(walletAddresses);

    // Build leaderboard with enriched user data
    const leaderboard = stats.map((stat, index) => {
      const user = userMap.get(stat.userWalletAddress);
      // subscriptionsMap is a plain object with string values (planType)
      const planType = subscriptionsMap[stat.userWalletAddress] || 'free';

      // Enrich user with subscription plan
      const enrichedUser = user ? { ...user, subscriptionPlan: planType } : null;

      return {
        rank: offset + index + 1,
        walletAddress: stat.userWalletAddress,
        score: parseFloat(stat[scoreField]),
        baseScore: parseFloat(stat[`${category}Score`]),
        boostMultiplier: parseFloat(stat.currentBoostMultiplier),
        planType,
        user: enrichedUser,
        metrics: this.getCategoryMetrics(stat, category)
      };
    });

    return leaderboard;
  }

  /**
   * Get category-specific metrics from stats
   */
  getCategoryMetrics(stats, category) {
    switch (category) {
      case 'trader':
        return {
          volumeBought: parseFloat(stats.totalVolumeBought),
          volumeBoughtXrp: (parseFloat(stats.totalVolumeBought) / 1000000).toFixed(6),
          volumeSold: parseFloat(stats.totalVolumeSold),
          volumeSoldXrp: (parseFloat(stats.totalVolumeSold) / 1000000).toFixed(6),
          trades: parseInt(stats.numberOfTrades),
          uniqueCollections: parseInt(stats.uniqueCollectionsTraded),
          profitMargin: parseFloat(stats.profitMargin)
        };
      case 'creator':
        return {
          salesVolume: parseFloat(stats.totalSalesVolume),
          salesVolumeXrp: (parseFloat(stats.totalSalesVolume) / 1000000).toFixed(6),
          nftsSold: parseInt(stats.nftsSold),
          collections: parseInt(stats.collectionsCreated),
          avgPrice: parseFloat(stats.averageNftPrice),
          avgPriceXrp: (parseFloat(stats.averageNftPrice) / 1000000).toFixed(6),
          uniqueBuyers: parseInt(stats.uniqueBuyers)
        };
      case 'influencer':
        return {
          // Receiving metrics
          followers: parseInt(stats.followersCount),
          likesReceived: parseInt(stats.totalLikesReceived),
          commentsReceived: parseInt(stats.totalCommentsReceived),
          posts: parseInt(stats.postsCreated),
          engagementRate: parseFloat(stats.engagementRate),
          // Giving metrics
          likesGiven: parseInt(stats.totalLikesGiven) || 0,
          commentsGiven: parseInt(stats.totalCommentsGiven) || 0,
          followsGiven: parseInt(stats.totalFollowsGiven) || 0
        };
      default:
        return {};
    }
  }

  /**
   * Get user's rank in each category for a specific month
   */
  async getUserRanks(walletAddress, month = null, year = null) {
    const { UserStats } = this.models;

    const userStats = await UserStats.findOne({
      where: { userWalletAddress: walletAddress }
    });

    if (!userStats) {
      return { trader: null, creator: null, influencer: null };
    }

    const [traderRank, creatorRank, influencerRank] = await Promise.all([
      UserStats.count({
        where: {
          boostedTraderScore: { [Op.gt]: userStats.boostedTraderScore }
        }
      }),
      UserStats.count({
        where: {
          boostedCreatorScore: { [Op.gt]: userStats.boostedCreatorScore }
        }
      }),
      UserStats.count({
        where: {
          boostedInfluencerScore: { [Op.gt]: userStats.boostedInfluencerScore }
        }
      })
    ]);

    return {
      trader: traderRank + 1,
      creator: creatorRank + 1,
      influencer: influencerRank + 1
    };
  }

  /**
   * Get complete user stats with rankings for a specific month
   */
  async getUserStats(walletAddress, month = null, year = null) {
    const { UserStats, Subscription, User } = this.models;

    // Default to current month/year
    const period = this.config.getCurrentPeriod();
    const targetMonth = month || period.month;
    const targetYear = year || period.year;

    const [userStats, user, ranks] = await Promise.all([
      UserStats.findOne({ where: { userWalletAddress: walletAddress } }),
      User.findOne({
        where: { walletAddress },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }),
      this.getUserRanks(walletAddress, targetMonth, targetYear)
    ]);

    if (!userStats) {
      return null;
    }

    // Fetch subscription and enrich user data
    // subscriptionsMap is a plain object with string values (planType)
    const subscriptionsMap = await getActiveSubscriptionsForWallets([walletAddress]);
    const planType = subscriptionsMap[walletAddress] || 'free';

    // Enrich user with subscription plan
    const enrichedUser = user ? { ...user.toJSON(), subscriptionPlan: planType } : null;

    return {
      user: enrichedUser,
      subscription: { planType, boostMultiplier: this.config.boostMultipliers[planType] || 1.0 },
      stats: userStats.toJSON(),
      ranks,
      period: { month: targetMonth, year: targetYear },
      lastCalculatedAt: userStats.lastCalculatedAt
    };
  }

  /**
   * Get user badges with ranking info for profile display
   * Uses current date/time for real-time ranking
   */
  async getUserBadges(walletAddress) {
    const { UserStats } = this.models;

    const userStats = await UserStats.findOne({
      where: { userWalletAddress: walletAddress },
      raw: true
    });

    if (!userStats) {
      return null;
    }

    const categories = ['trader', 'creator', 'influencer'];
    const badges = {};

    await Promise.all(categories.map(async (category) => {
      const scoreField = `boosted${category.charAt(0).toUpperCase() + category.slice(1)}Score`;
      const userScore = parseFloat(userStats[scoreField]) || 0;

      // Count users with higher score (rank) and total participants
      const [higherCount, totalParticipants] = await Promise.all([
        UserStats.count({
          where: { [scoreField]: { [Op.gt]: userScore } }
        }),
        UserStats.count({
          where: { [scoreField]: { [Op.gt]: this.config.normalization.minLeaderboardScore } }
        })
      ]);

      const rank = userScore > this.config.normalization.minLeaderboardScore ? higherCount + 1 : null;

      // Determine badge tier based on position
      let badge = 'none';
      if (rank && totalParticipants > 0) {
        const topPercent = (rank / totalParticipants) * 100;
        if (topPercent <= 1) badge = 'diamond';
        else if (topPercent <= 5) badge = 'platinum';
        else if (topPercent <= 10) badge = 'gold';
        else if (topPercent <= 25) badge = 'silver';
        else if (topPercent <= 50) badge = 'bronze';
        else badge = 'member';
      }

      badges[category] = {
        rank,
        totalParticipants,
        badge
      };
    }));

    return badges;
  }

  /**
   * Get month name from month number
   */
  getMonthName(month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
  }

  /**
   * Format period for display
   */
  formatPeriod(month, year) {
    return `${this.getMonthName(month)} ${year}`;
  }
}

module.exports = ScoringEngine;
