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
      type: DataTypes.ENUM('free', 'basic', 'pro', 'premium'),
      defaultValue: 'free',
      allowNull: false,
      comment: 'Subscription tier: free (1.0x), basic (1.10x), pro (1.20x), premium (1.30x)'
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

  // Boost multipliers for each plan type
  Subscription.BOOST_MULTIPLIERS = {
    free: 1.0,
    basic: 1.10,    // 10% boost
    pro: 1.20,      // 20% boost
    premium: 1.30   // 30% boost
  };

  // Get boost multiplier for a plan type
  Subscription.getBoostMultiplier = function(planType) {
    return this.BOOST_MULTIPLIERS[planType] || 1.0;
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
      return this.BOOST_MULTIPLIERS.free;
    }
    return this.BOOST_MULTIPLIERS[subscription.planType] || 1.0;
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
    values.boostMultiplier = Subscription.BOOST_MULTIPLIERS[this.planType];
    values.remainingDays = this.getRemainingDays();
    return values;
  };

  return Subscription;
};
