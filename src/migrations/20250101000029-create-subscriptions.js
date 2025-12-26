'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Subscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      planType: {
        type: Sequelize.ENUM('free', 'basic', 'pro', 'premium'),
        defaultValue: 'free',
        allowNull: false,
        comment: 'Subscription tier: free (1.0x), basic (1.10x), pro (1.20x), premium (1.30x)'
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: false
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      // Payment info
      paymentTransactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL transaction hash for payment'
      },
      paymentAmount: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Amount paid in drops'
      },
      // Auto-renewal settings
      autoRenew: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      // Cancellation
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // Metadata
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
    await queryInterface.addIndex('Subscriptions', ['userWalletAddress'], {
      name: 'idx_subscription_user'
    });

    await queryInterface.addIndex('Subscriptions', ['planType'], {
      name: 'idx_subscription_plan'
    });

    await queryInterface.addIndex('Subscriptions', ['isActive'], {
      name: 'idx_subscription_active'
    });

    await queryInterface.addIndex('Subscriptions', ['endDate'], {
      name: 'idx_subscription_end_date'
    });

    // Composite index for finding active subscriptions
    await queryInterface.addIndex('Subscriptions', ['userWalletAddress', 'isActive', 'endDate'], {
      name: 'idx_subscription_user_active'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Subscriptions');
  }
};
