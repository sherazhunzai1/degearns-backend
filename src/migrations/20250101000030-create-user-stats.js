'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserStats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      // ===== TRADER METRICS =====
      totalVolumeBought: {
        type: Sequelize.DECIMAL(30, 6),
        defaultValue: 0,
        comment: 'Total XRP spent buying NFTs (in drops)'
      },
      totalVolumeSold: {
        type: Sequelize.DECIMAL(30, 6),
        defaultValue: 0,
        comment: 'Total XRP earned from selling NFTs (in drops)'
      },
      numberOfTrades: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total number of trades (buys + sells)'
      },
      uniqueCollectionsTraded: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of unique collections traded'
      },
      profitMargin: {
        type: Sequelize.DECIMAL(10, 4),
        defaultValue: 0,
        comment: 'Profit margin percentage ((sold - bought) / bought * 100)'
      },
      traderScore: {
        type: Sequelize.DECIMAL(20, 6),
        defaultValue: 0,
        comment: 'Calculated trader score (before boost)'
      },

      // ===== CREATOR METRICS =====
      totalSalesVolume: {
        type: Sequelize.DECIMAL(30, 6),
        defaultValue: 0,
        comment: 'Total revenue from NFT sales (in drops)'
      },
      nftsSold: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total NFTs sold'
      },
      collectionsCreated: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total collections created'
      },
      averageNftPrice: {
        type: Sequelize.DECIMAL(30, 6),
        defaultValue: 0,
        comment: 'Average sale price of NFTs (in drops)'
      },
      uniqueBuyers: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of unique buyers'
      },
      creatorScore: {
        type: Sequelize.DECIMAL(20, 6),
        defaultValue: 0,
        comment: 'Calculated creator score (before boost)'
      },

      // ===== INFLUENCER METRICS =====
      followersCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total followers'
      },
      totalLikesReceived: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total likes received on posts'
      },
      totalCommentsReceived: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total comments received on posts'
      },
      postsCreated: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total posts created'
      },
      engagementRate: {
        type: Sequelize.DECIMAL(10, 4),
        defaultValue: 0,
        comment: 'Engagement rate percentage'
      },
      influencerScore: {
        type: Sequelize.DECIMAL(20, 6),
        defaultValue: 0,
        comment: 'Calculated influencer score (before boost)'
      },

      // ===== BOOSTED SCORES =====
      boostedTraderScore: {
        type: Sequelize.DECIMAL(20, 6),
        defaultValue: 0,
        comment: 'Trader score after subscription boost multiplier'
      },
      boostedCreatorScore: {
        type: Sequelize.DECIMAL(20, 6),
        defaultValue: 0,
        comment: 'Creator score after subscription boost multiplier'
      },
      boostedInfluencerScore: {
        type: Sequelize.DECIMAL(20, 6),
        defaultValue: 0,
        comment: 'Influencer score after subscription boost multiplier'
      },

      // ===== META =====
      currentBoostMultiplier: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 1.0,
        comment: 'Current boost multiplier based on subscription'
      },
      lastCalculatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When scores were last recalculated'
      },
      calculationVersion: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: 'Version of the scoring algorithm used'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for leaderboard queries
    await queryInterface.addIndex('UserStats', ['boostedTraderScore'], {
      name: 'idx_stats_trader_score'
    });

    await queryInterface.addIndex('UserStats', ['boostedCreatorScore'], {
      name: 'idx_stats_creator_score'
    });

    await queryInterface.addIndex('UserStats', ['boostedInfluencerScore'], {
      name: 'idx_stats_influencer_score'
    });

    await queryInterface.addIndex('UserStats', ['lastCalculatedAt'], {
      name: 'idx_stats_last_calculated'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('UserStats');
  }
};
