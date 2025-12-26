module.exports = (sequelize, DataTypes) => {
  const UserStats = sequelize.define('UserStats', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    userWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'User wallet address'
    },

    // ===== TRADER METRICS =====
    totalVolumeBought: {
      type: DataTypes.DECIMAL(30, 6),
      defaultValue: 0,
      comment: 'Total XRP spent buying NFTs (in drops)'
    },
    totalVolumeSold: {
      type: DataTypes.DECIMAL(30, 6),
      defaultValue: 0,
      comment: 'Total XRP earned from selling NFTs (in drops)'
    },
    numberOfTrades: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total number of trades (buys + sells)'
    },
    uniqueCollectionsTraded: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of unique collections traded'
    },
    profitMargin: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Profit margin percentage'
    },
    traderScore: {
      type: DataTypes.DECIMAL(20, 6),
      defaultValue: 0,
      comment: 'Calculated trader score (before boost)'
    },

    // ===== CREATOR METRICS =====
    totalSalesVolume: {
      type: DataTypes.DECIMAL(30, 6),
      defaultValue: 0,
      comment: 'Total revenue from NFT sales (in drops)'
    },
    nftsSold: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total NFTs sold'
    },
    collectionsCreated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total collections created'
    },
    averageNftPrice: {
      type: DataTypes.DECIMAL(30, 6),
      defaultValue: 0,
      comment: 'Average sale price of NFTs (in drops)'
    },
    uniqueBuyers: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of unique buyers'
    },
    creatorScore: {
      type: DataTypes.DECIMAL(20, 6),
      defaultValue: 0,
      comment: 'Calculated creator score (before boost)'
    },

    // ===== INFLUENCER METRICS =====
    followersCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total followers'
    },
    totalLikesReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total likes received on posts'
    },
    totalCommentsReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total comments received on posts'
    },
    postsCreated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total posts created'
    },
    engagementRate: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Engagement rate percentage'
    },
    influencerScore: {
      type: DataTypes.DECIMAL(20, 6),
      defaultValue: 0,
      comment: 'Calculated influencer score (before boost)'
    },

    // ===== BOOSTED SCORES =====
    boostedTraderScore: {
      type: DataTypes.DECIMAL(20, 6),
      defaultValue: 0,
      comment: 'Trader score after subscription boost multiplier'
    },
    boostedCreatorScore: {
      type: DataTypes.DECIMAL(20, 6),
      defaultValue: 0,
      comment: 'Creator score after subscription boost multiplier'
    },
    boostedInfluencerScore: {
      type: DataTypes.DECIMAL(20, 6),
      defaultValue: 0,
      comment: 'Influencer score after subscription boost multiplier'
    },

    // ===== META =====
    currentBoostMultiplier: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 1.0,
      comment: 'Current boost multiplier based on subscription'
    },
    lastCalculatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When scores were last recalculated'
    },
    calculationVersion: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'Version of the scoring algorithm used'
    }
  }, {
    tableName: 'UserStats',
    timestamps: true,
    indexes: [
      { fields: ['boostedTraderScore'] },
      { fields: ['boostedCreatorScore'] },
      { fields: ['boostedInfluencerScore'] },
      { fields: ['lastCalculatedAt'] }
    ]
  });

  // Static method to find or create stats for a user
  UserStats.findOrCreateForUser = async function(walletAddress) {
    const [stats, created] = await this.findOrCreate({
      where: { userWalletAddress: walletAddress },
      defaults: { userWalletAddress: walletAddress }
    });
    return stats;
  };

  // Static method to get leaderboard
  UserStats.getLeaderboard = async function(category, limit = 100, offset = 0) {
    const scoreField = `boosted${category.charAt(0).toUpperCase() + category.slice(1)}Score`;

    return await this.findAll({
      order: [[scoreField, 'DESC']],
      limit,
      offset
    });
  };

  // Instance method to get user rank in a category
  UserStats.prototype.getRankInCategory = async function(category) {
    const scoreField = `boosted${category.charAt(0).toUpperCase() + category.slice(1)}Score`;
    const myScore = this[scoreField];

    const count = await UserStats.count({
      where: {
        [scoreField]: {
          [sequelize.Sequelize.Op.gt]: myScore
        }
      }
    });

    return count + 1;
  };

  UserStats.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    // Convert drops to XRP for display
    values.totalVolumeBoughtXrp = (parseFloat(values.totalVolumeBought) / 1000000).toFixed(6);
    values.totalVolumeSoldXrp = (parseFloat(values.totalVolumeSold) / 1000000).toFixed(6);
    values.totalSalesVolumeXrp = (parseFloat(values.totalSalesVolume) / 1000000).toFixed(6);
    values.averageNftPriceXrp = (parseFloat(values.averageNftPrice) / 1000000).toFixed(6);
    return values;
  };

  return UserStats;
};
