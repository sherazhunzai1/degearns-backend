'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PostBoosts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      postId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Posts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to the boosted post'
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the user who paid for boost'
      },
      boostPercentage: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Boost level: 20%, 40%, 60%, 80%, or 100%'
      },
      paymentAmount: {
        type: Sequelize.DECIMAL(20, 6),
        allowNull: false,
        comment: 'Amount paid in XRP'
      },
      paymentTransactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL transaction hash for payment verification'
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the boost starts'
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When the boost expires'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the boost is currently active'
      },
      impressions: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of times the boosted post was shown'
      },
      clicks: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of clicks/engagements on the boosted post'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata for the boost'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('PostBoosts', ['postId'], { name: 'idx_postboost_post' });
    await queryInterface.addIndex('PostBoosts', ['userWalletAddress'], { name: 'idx_postboost_user' });
    await queryInterface.addIndex('PostBoosts', ['isActive', 'endDate'], { name: 'idx_postboost_active' });
    await queryInterface.addIndex('PostBoosts', ['boostPercentage'], { name: 'idx_postboost_percentage' });
    await queryInterface.addIndex('PostBoosts', ['isActive', 'boostPercentage', 'endDate'], { name: 'idx_postboost_fetch' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PostBoosts');
  }
};
