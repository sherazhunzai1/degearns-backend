module.exports = (sequelize, DataTypes) => {
  const MonthlyRanking = sequelize.define('MonthlyRanking', {
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
      validate: {
        min: 1,
        max: 12
      },
      comment: 'Month of the ranking period (1-12)'
    },
    periodYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Year of the ranking period'
    },
    // Category
    category: {
      type: DataTypes.ENUM('trader', 'creator', 'influencer'),
      allowNull: false,
      comment: 'Category of the ranking'
    },
    // Rankings array - 10 wallet addresses ranked 1-10
    rankings: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'Array of 10 ranked wallet addresses [{rank: 1, walletAddress: "...", username: "..."}, ...]',
      validate: {
        isValidRankings(value) {
          if (!Array.isArray(value)) {
            throw new Error('Rankings must be an array');
          }
          if (value.length !== 10) {
            throw new Error('Rankings must have exactly 10 entries');
          }
          const ranks = value.map(r => r.rank);
          for (let i = 1; i <= 10; i++) {
            if (!ranks.includes(i)) {
              throw new Error(`Missing rank ${i} in rankings`);
            }
          }
        }
      }
    },
    // Status
    status: {
      type: DataTypes.ENUM('draft', 'finalized', 'distributed'),
      defaultValue: 'draft',
      comment: 'Status of the ranking: draft (editable), finalized (ready for distribution), distributed (rewards sent)'
    },
    // Distribution reference
    distributionBatchId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to the distribution batch when distributed'
    },
    distributedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when rewards were distributed'
    },
    // Admin who set the rankings
    setBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Admin wallet who set/updated the rankings'
    },
    finalizedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Admin wallet who finalized the rankings'
    },
    finalizedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when rankings were finalized'
    },
    // Notes
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Admin notes about this ranking'
    },
    // Additional metadata
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata about the ranking',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'MonthlyRankings',
    timestamps: true,
    indexes: [
      { fields: ['periodMonth', 'periodYear'] },
      { fields: ['category'] },
      { fields: ['status'] },
      {
        unique: true,
        fields: ['periodMonth', 'periodYear', 'category'],
        name: 'unique_ranking_per_period_category'
      }
    ]
  });

  // Instance methods
  MonthlyRanking.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  // Static method to check if all categories are finalized for a period
  MonthlyRanking.areAllCategoriesFinalized = async function(periodMonth, periodYear) {
    const categories = ['trader', 'creator', 'influencer'];
    const finalizedCount = await this.count({
      where: {
        periodMonth,
        periodYear,
        status: 'finalized'
      }
    });
    return finalizedCount === categories.length;
  };

  // Static method to get all rankings for a period
  MonthlyRanking.getRankingsForPeriod = async function(periodMonth, periodYear) {
    return await this.findAll({
      where: {
        periodMonth,
        periodYear
      },
      order: [['category', 'ASC']]
    });
  };

  return MonthlyRanking;
};
