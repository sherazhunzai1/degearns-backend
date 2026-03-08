'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ReferralClaims', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      referrerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the referrer claiming rewards'
      },
      totalAmount: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Total amount being claimed (in drops/XRP)'
      },
      rewardCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Number of individual rewards included in this claim'
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
        comment: 'Status of the claim'
      },
      transactionHash: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'XRPL transaction hash of the payout'
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date when the claim was processed'
      },
      failureReason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for failure if claim failed'
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

    await queryInterface.addIndex('ReferralClaims', ['referrerWalletAddress'], {
      name: 'referral_claims_referrer'
    });
    await queryInterface.addIndex('ReferralClaims', ['status'], {
      name: 'referral_claims_status'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ReferralClaims');
  }
};
