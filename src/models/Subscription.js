module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define('Subscription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    userWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'User wallet address'
    },
    planType: {
      type: DataTypes.STRING(50),
      defaultValue: 'free',
      allowNull: false,
      comment: 'Subscription tier name from SubscriptionTiers table'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    paymentTransactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL transaction hash for payment'
    },
    paymentAmount: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Amount paid in drops'
    },
    autoRenew: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'Subscriptions',
    timestamps: true,
    indexes: [
      { fields: ['userWalletAddress'] },
      { fields: ['planType'] },
      { fields: ['isActive'] },
      { fields: ['endDate'] },
      { fields: ['userWalletAddress', 'isActive', 'endDate'] }
    ]
  });

  // Default boost multipliers (fallback if SubscriptionTiers not available)
  Subscription.DEFAULT_BOOST_MULTIPLIERS = {
    free: 1.0,
    basic: 1.10,    // 10% boost
    pro: 1.20,      // 20% boost
    premium: 1.30   // 30% boost
  };

  // Get boost multiplier for a plan type (async - fetches from SubscriptionTiers)
  Subscription.getBoostMultiplier = async function(planType) {
    try {
      // Lazy load to avoid circular dependency
      const { SubscriptionTier } = require('./index');
      if (SubscriptionTier) {
        const tier = await SubscriptionTier.findOne({ where: { name: planType } });
        if (tier) {
          return parseFloat(tier.boostMultiplier) || 1.0;
        }
      }
    } catch (error) {
      // Silently fall back to defaults during initialization
    }
    return this.DEFAULT_BOOST_MULTIPLIERS[planType] || 1.0;
  };

  // Sync version for backward compatibility (uses defaults)
  Subscription.getBoostMultiplierSync = function(planType) {
    return this.DEFAULT_BOOST_MULTIPLIERS[planType] || 1.0;
  };

  // Static method to get active subscription for a user
  Subscription.getActiveSubscription = async function(walletAddress) {
    return await this.findOne({
      where: {
        userWalletAddress: walletAddress,
        isActive: true,
        endDate: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      order: [['endDate', 'DESC']]
    });
  };

  // Static method to get user's boost multiplier
  Subscription.getUserBoostMultiplier = async function(walletAddress) {
    const subscription = await this.getActiveSubscription(walletAddress);
    if (!subscription) {
      return 1.0; // Free tier default
    }
    return await this.getBoostMultiplier(subscription.planType);
  };

  // Instance method to check if subscription is currently active
  Subscription.prototype.isCurrentlyActive = function() {
    return this.isActive && new Date() < new Date(this.endDate);
  };

  // Instance method to get remaining days
  Subscription.prototype.getRemainingDays = function() {
    if (!this.isCurrentlyActive()) return 0;
    const now = new Date();
    const end = new Date(this.endDate);
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  };

  Subscription.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    // Use default multipliers for sync JSON serialization
    values.boostMultiplier = Subscription.DEFAULT_BOOST_MULTIPLIERS[this.planType] || 1.0;
    values.remainingDays = this.getRemainingDays();
    return values;
  };

  return Subscription;
};
