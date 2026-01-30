module.exports = (sequelize, DataTypes) => {
  const PostBoost = sequelize.define('PostBoost', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the boosted post'
    },
    userWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the user who paid for boost'
    },
    boostPercentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isIn: [[20, 40, 60, 80, 100]]
      },
      comment: 'Boost level: 20%, 40%, 60%, 80%, or 100%'
    },
    paymentAmount: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: false,
      comment: 'Amount paid in XRP'
    },
    paymentTransactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL transaction hash for payment verification'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the boost starts'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When the boost expires'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether the boost is currently active'
    },
    impressions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of times the boosted post was shown'
    },
    clicks: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of clicks/engagements on the boosted post'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the boost',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'PostBoosts',
    timestamps: true,
    indexes: [
      {
        fields: ['postId'],
        name: 'idx_postboost_post'
      },
      {
        fields: ['userWalletAddress'],
        name: 'idx_postboost_user'
      },
      {
        fields: ['isActive', 'endDate'],
        name: 'idx_postboost_active'
      },
      {
        fields: ['boostPercentage'],
        name: 'idx_postboost_percentage'
      },
      {
        fields: ['isActive', 'boostPercentage', 'endDate'],
        name: 'idx_postboost_fetch'
      }
    ]
  });

  // Check if boost is currently valid
  PostBoost.prototype.isCurrentlyActive = function() {
    return this.isActive && new Date() < new Date(this.endDate);
  };

  // Get remaining days
  PostBoost.prototype.getRemainingDays = function() {
    if (!this.isCurrentlyActive()) return 0;
    const now = new Date();
    const end = new Date(this.endDate);
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  };

  PostBoost.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    values.remainingDays = this.getRemainingDays();
    values.isCurrentlyActive = this.isCurrentlyActive();
    return values;
  };

  return PostBoost;
};
