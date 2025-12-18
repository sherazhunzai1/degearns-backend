module.exports = (sequelize, DataTypes) => {
  const RewardDistribution = sequelize.define('RewardDistribution', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    // Reward period
    periodMonth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Month of the reward period (1-12)'
    },
    periodYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Year of the reward period'
    },
    // Category
    category: {
      type: DataTypes.ENUM('trader', 'creator', 'influencer'),
      allowNull: false,
      comment: 'Category of the reward'
    },
    // Rank
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Rank position (1-10)'
    },
    // Recipient
    recipientWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the reward recipient'
    },
    // Reward amount
    rewardAmount: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Reward amount in drops (1 XRP = 1,000,000 drops)'
    },
    // Metrics that earned the reward
    metricValue: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'The metric value that earned this rank (volume, revenue, followers, etc.)'
    },
    metricType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Type of metric (trading_volume, mint_revenue, followers_count, etc.)'
    },
    // Transaction details
    transactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL transaction hash for the reward payment'
    },
    transactionStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending',
      comment: 'Status of the reward transaction'
    },
    transactionError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if transaction failed'
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when the reward was paid'
    },
    // Admin who initiated
    initiatedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Admin wallet who initiated the reward'
    },
    // Additional data
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata about the reward',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'RewardDistributions',
    timestamps: true,
    indexes: [
      { fields: ['periodMonth', 'periodYear'] },
      { fields: ['category'] },
      { fields: ['recipientWalletAddress'] },
      { fields: ['transactionStatus'] },
      { fields: ['rank'] },
      {
        unique: true,
        fields: ['periodMonth', 'periodYear', 'category', 'rank'],
        name: 'unique_reward_per_period_category_rank'
      }
    ]
  });

  // Instance methods
  RewardDistribution.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return RewardDistribution;
};
