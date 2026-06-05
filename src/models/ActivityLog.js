module.exports = (sequelize, DataTypes) => {
  const ActivityLog = sequelize.define('ActivityLog', {
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
    activityType: {
      type: DataTypes.ENUM(
        'nft_buy',          // Bought an NFT
        'nft_sell',         // Sold an NFT
        'nft_mint',         // Minted from a drop
        'nft_list',         // Listed an NFT for sale
        'nft_delist',       // Removed listing
        'collection_create', // Created a collection
        'drop_create',      // Created a drop
        'post_create',      // Created a post
        'comment_create',   // Commented on a post
        'like_give',        // Liked a post
        'like_receive',     // Received a like
        'comment_receive',  // Received a comment
        'follow_give',      // Followed someone
        'follow_receive'    // Received a follower
      ),
      allowNull: false
    },
    relatedId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of the related entity'
    },
    relatedType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Type of related entity'
    },
    xrpAmount: {
      type: DataTypes.DECIMAL(30, 6),
      defaultValue: 0,
      comment: 'XRP amount involved in drops'
    },
    transactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL transaction hash if applicable'
    },
    counterpartyWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Other party in the transaction'
    },
    collectionId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Collection ID for NFT activities'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    },
    scoringPeriodMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Month this activity counts toward (1-12)'
    },
    scoringPeriodYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Year this activity counts toward'
    },
    processedForScoring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this activity has been counted in score calculation'
    }
  }, {
    tableName: 'ActivityLogs',
    timestamps: true,
    indexes: [
      { fields: ['userWalletAddress'] },
      { fields: ['activityType'] },
      { fields: ['createdAt'] },
      { fields: ['scoringPeriodMonth', 'scoringPeriodYear'] },
      { fields: ['processedForScoring'] },
      { fields: ['userWalletAddress', 'activityType', 'createdAt'] },
      { fields: ['collectionId', 'activityType'] }
    ]
  });

  // Activity type categories
  ActivityLog.TRADER_ACTIVITIES = ['nft_buy', 'nft_sell', 'nft_mint'];
  ActivityLog.CREATOR_ACTIVITIES = ['nft_sell', 'collection_create', 'drop_create'];
  ActivityLog.INFLUENCER_ACTIVITIES = ['post_create', 'like_receive', 'comment_receive', 'follow_receive'];
  // Engagement activities - when users actively engage with others' content
  ActivityLog.ENGAGEMENT_ACTIVITIES = ['like_give', 'comment_create', 'follow_give'];

  // Static method to log activity
  ActivityLog.logActivity = async function(data) {
    const now = new Date();
    return await this.create({
      ...data,
      scoringPeriodMonth: data.scoringPeriodMonth || (now.getMonth() + 1),
      scoringPeriodYear: data.scoringPeriodYear || now.getFullYear()
    });
  };

  // Static method to get user activities for a period
  ActivityLog.getUserActivitiesForPeriod = async function(walletAddress, month, year, activityTypes = null) {
    const where = {
      userWalletAddress: walletAddress,
      scoringPeriodMonth: month,
      scoringPeriodYear: year
    };

    if (activityTypes && activityTypes.length > 0) {
      where.activityType = { [sequelize.Sequelize.Op.in]: activityTypes };
    }

    return await this.findAll({ where });
  };

  // Static method to aggregate activities for scoring
  ActivityLog.aggregateForUser = async function(walletAddress, startDate, endDate) {
    const { Op } = sequelize.Sequelize;

    const activities = await this.findAll({
      attributes: [
        'activityType',
        [sequelize.fn('SUM', sequelize.col('xrpAmount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        userWalletAddress: walletAddress,
        createdAt: { [Op.between]: [startDate, endDate] }
      },
      group: ['activityType'],
      raw: true
    });

    // Convert to a more usable format
    const aggregated = {};
    for (const activity of activities) {
      aggregated[activity.activityType] = {
        totalAmount: parseFloat(activity.totalAmount) || 0,
        count: parseInt(activity.count) || 0
      };
    }

    return aggregated;
  };

  /**
   * Aggregate activities per network for USD conversion.
   * Returns { activityType: { xrpl: { totalAmount, count }, solana: { totalAmount, count } } }
   */
  ActivityLog.aggregateForUserByNetwork = async function(walletAddress, startDate, endDate) {
    const { Op } = sequelize.Sequelize;

    const activities = await this.findAll({
      attributes: ['activityType', 'xrpAmount', 'metadata'],
      where: {
        userWalletAddress: walletAddress,
        createdAt: { [Op.between]: [startDate, endDate] }
      },
      raw: true
    });

    const aggregated = {};
    for (const a of activities) {
      const type = a.activityType;
      let meta = a.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
      }
      const network = meta?.network || 'xrpl';

      if (!aggregated[type]) {
        aggregated[type] = { xrpl: { totalAmount: 0, count: 0 }, solana: { totalAmount: 0, count: 0 } };
      }
      aggregated[type][network].totalAmount += parseFloat(a.xrpAmount) || 0;
      aggregated[type][network].count += 1;
    }

    return aggregated;
  };

  // Static method to get unique collections traded
  ActivityLog.getUniqueCollectionsTraded = async function(walletAddress, startDate, endDate) {
    const { Op } = sequelize.Sequelize;

    const result = await this.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('collectionId')), 'collectionId']
      ],
      where: {
        userWalletAddress: walletAddress,
        activityType: { [Op.in]: ['nft_buy', 'nft_sell'] },
        collectionId: { [Op.ne]: null },
        createdAt: { [Op.between]: [startDate, endDate] }
      },
      raw: true
    });

    return result.length;
  };

  // Static method to get unique buyers for a creator
  ActivityLog.getUniqueBuyersForCreator = async function(walletAddress, startDate, endDate) {
    const { Op } = sequelize.Sequelize;

    const result = await this.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('counterpartyWalletAddress')), 'buyer']
      ],
      where: {
        userWalletAddress: walletAddress,
        activityType: 'nft_sell',
        counterpartyWalletAddress: { [Op.ne]: null },
        createdAt: { [Op.between]: [startDate, endDate] }
      },
      raw: true
    });

    return result.length;
  };

  ActivityLog.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    values.xrpAmountXrp = (parseFloat(values.xrpAmount) / 1000000).toFixed(6);
    return values;
  };

  return ActivityLog;
};
