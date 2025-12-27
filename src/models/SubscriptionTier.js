module.exports = (sequelize, DataTypes) => {
  const SubscriptionTier = sequelize.define('SubscriptionTier', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Tier name: free, basic, pro, premium'
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Display name for UI'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Tier description'
    },
    boostMultiplier: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 1.0,
      comment: 'Score boost multiplier (e.g., 1.30 for 30% boost)',
      get() {
        const value = this.getDataValue('boostMultiplier');
        return value ? parseFloat(value) : 1.0;
      }
    },
    boostPercentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Boost percentage for display (e.g., 30 for 30%)'
    },
    monthlyPriceXrp: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Monthly price in XRP',
      get() {
        const value = this.getDataValue('monthlyPriceXrp');
        return value ? parseFloat(value) : null;
      }
    },
    yearlyPriceXrp: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Yearly price in XRP (discounted)',
      get() {
        const value = this.getDataValue('yearlyPriceXrp');
        return value ? parseFloat(value) : null;
      }
    },
    features: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of feature strings for this tier',
      get() {
        const rawValue = this.getDataValue('features');
        if (!rawValue) return [];
        return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      }
    },
    limits: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Tier-specific limits (e.g., analytics depth, support priority)',
      get() {
        const rawValue = this.getDataValue('limits');
        if (!rawValue) return null;
        return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether this tier is currently available for purchase'
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Display order (0=free, 1=basic, 2=pro, 3=premium)'
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Theme color for UI display (e.g., #FFD700 for premium)'
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Icon name for UI display'
    },
    badge: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Badge text for UI (e.g., "Most Popular", "Best Value")'
    }
  }, {
    tableName: 'SubscriptionTiers',
    timestamps: true,
    indexes: [
      { fields: ['name'], unique: true },
      { fields: ['isActive'] },
      { fields: ['sortOrder'] }
    ]
  });

  // Static method to get all active tiers
  SubscriptionTier.getActiveTiers = async function() {
    return await this.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']]
    });
  };

  // Static method to get tier by name
  SubscriptionTier.getTierByName = async function(name) {
    return await this.findOne({
      where: { name: name.toLowerCase() }
    });
  };

  // Static method to get boost multiplier for a tier name
  SubscriptionTier.getBoostMultiplier = async function(tierName) {
    const tier = await this.getTierByName(tierName);
    return tier ? tier.boostMultiplier : 1.0;
  };

  // Instance method to calculate yearly savings
  SubscriptionTier.prototype.getYearlySavings = function() {
    if (!this.monthlyPriceXrp || !this.yearlyPriceXrp) return null;
    const yearlyIfMonthly = this.monthlyPriceXrp * 12;
    const savings = yearlyIfMonthly - this.yearlyPriceXrp;
    return {
      amount: parseFloat(savings.toFixed(2)),
      percentage: Math.round((savings / yearlyIfMonthly) * 100)
    };
  };

  // Custom toJSON to include computed fields
  SubscriptionTier.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());

    // Add computed savings
    if (this.monthlyPriceXrp && this.yearlyPriceXrp) {
      values.yearlySavings = this.getYearlySavings();
    }

    // Format boost display
    values.boostDisplay = this.boostPercentage > 0
      ? `+${this.boostPercentage}%`
      : 'No boost';

    return values;
  };

  return SubscriptionTier;
};
