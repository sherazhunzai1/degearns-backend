module.exports = (sequelize, DataTypes) => {
  const ReferralReward = sequelize.define('ReferralReward', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    referrerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the referrer who earns the reward'
    },
    referredWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the referred user who made the purchase'
    },
    serviceType: {
      type: DataTypes.ENUM('subscription', 'boost'),
      allowNull: false,
      comment: 'Type of service purchased by the referred user'
    },
    serviceName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Name/plan of the service purchased'
    },
    purchaseAmount: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Amount paid by the referred user (in drops/XRP)'
    },
    rewardAmount: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Reward amount earned by the referrer (in drops/XRP)'
    },
    rewardPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      comment: 'Percentage of the purchase given as reward'
    },
    status: {
      type: DataTypes.ENUM('pending', 'claimable', 'claimed', 'paid', 'frozen'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Status of the reward'
    },
    purchaseTransactionHash: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Transaction hash of the original purchase'
    },
    payoutTransactionHash: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Transaction hash of the reward payout'
    },
    claimId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to the claim batch this reward was paid in'
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date when the reward was paid out'
    },
    frozenReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for freezing the reward (anti-abuse)'
    }
  }, {
    tableName: 'ReferralRewards',
    timestamps: true,
    indexes: [
      { fields: ['referrerWalletAddress'] },
      { fields: ['referredWalletAddress'] },
      { fields: ['status'] },
      { fields: ['claimId'] }
    ]
  });

  return ReferralReward;
};
