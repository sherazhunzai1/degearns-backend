'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RewardDistributions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      periodMonth: {
        type: Sequelize.INTEGER,
        allowNull: false,
        field: 'periodMonth'
      },
      periodYear: {
        type: Sequelize.INTEGER,
        allowNull: false,
        field: 'periodYear'
      },
      category: {
        type: Sequelize.ENUM('trader', 'creator', 'influencer'),
        allowNull: false
      },
      rank: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      recipientWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      rewardAmount: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Amount in drops (1 XRP = 1,000,000 drops)'
      },
      metricValue: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'The metric value that earned this reward'
      },
      metricType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Type of metric (totalSpent, totalRevenue, engagementScore)'
      },
      transactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL transaction hash'
      },
      transactionStatus: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending'
      },
      transactionError: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if transaction failed'
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      initiatedBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Admin wallet address who initiated the reward'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
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

    // Add indexes
    await queryInterface.addIndex('RewardDistributions', ['periodMonth', 'periodYear'], {
      name: 'idx_reward_period'
    });

    await queryInterface.addIndex('RewardDistributions', ['category'], {
      name: 'idx_reward_category'
    });

    await queryInterface.addIndex('RewardDistributions', ['recipientWalletAddress'], {
      name: 'idx_reward_recipient'
    });

    await queryInterface.addIndex('RewardDistributions', ['transactionStatus'], {
      name: 'idx_reward_status'
    });

    // Unique constraint to prevent duplicate rewards for same period/category/rank
    await queryInterface.addIndex('RewardDistributions', ['periodMonth', 'periodYear', 'category', 'rank'], {
      name: 'idx_reward_unique_period_rank',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('RewardDistributions');
  }
};
