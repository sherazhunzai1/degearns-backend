'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ReferralRewards', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      referrerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the referrer who earns the reward'
      },
      referredWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the referred user who made the purchase'
      },
      serviceType: {
        type: Sequelize.ENUM('subscription', 'boost'),
        allowNull: false,
        comment: 'Type of service purchased by the referred user'
      },
      serviceName: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Name/plan of the service purchased (e.g., "pro", "premium", "post_boost")'
      },
      purchaseAmount: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Amount paid by the referred user (in drops/XRP)'
      },
      rewardAmount: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Reward amount earned by the referrer (in drops/XRP)'
      },
      rewardPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        comment: 'Percentage of the purchase given as reward'
      },
      status: {
        type: Sequelize.ENUM('pending', 'claimable', 'claimed', 'paid', 'frozen'),
        defaultValue: 'pending',
        allowNull: false,
        comment: 'Status of the reward'
      },
      purchaseTransactionHash: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Transaction hash of the original purchase'
      },
      payoutTransactionHash: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Transaction hash of the reward payout'
      },
      claimId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to the claim batch this reward was paid in'
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date when the reward was paid out'
      },
      frozenReason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for freezing the reward (anti-abuse)'
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

    await queryInterface.addIndex('ReferralRewards', ['referrerWalletAddress'], {
      name: 'referral_rewards_referrer'
    });
    await queryInterface.addIndex('ReferralRewards', ['referredWalletAddress'], {
      name: 'referral_rewards_referred'
    });
    await queryInterface.addIndex('ReferralRewards', ['status'], {
      name: 'referral_rewards_status'
    });
    await queryInterface.addIndex('ReferralRewards', ['claimId'], {
      name: 'referral_rewards_claim'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ReferralRewards');
  }
};
