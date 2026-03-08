'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ReferralAuditLogs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      action: {
        type: Sequelize.ENUM(
          'reward_created',
          'reward_claimable',
          'reward_claimed',
          'reward_paid',
          'reward_frozen',
          'claim_initiated',
          'claim_completed',
          'claim_failed',
          'abuse_detected',
          'rewards_unfrozen'
        ),
        allowNull: false,
        comment: 'Type of action logged'
      },
      referrerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the referrer'
      },
      referredWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address of the referred user (if applicable)'
      },
      rewardId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to the specific reward'
      },
      claimId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to the claim batch'
      },
      serviceType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Type of service (subscription/boost)'
      },
      amount: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Amount involved (in drops/XRP)'
      },
      transactionHash: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'XRPL transaction hash'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata for the log entry'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // No updatedAt - audit logs are immutable
    await queryInterface.addIndex('ReferralAuditLogs', ['referrerWalletAddress'], {
      name: 'referral_audit_referrer'
    });
    await queryInterface.addIndex('ReferralAuditLogs', ['referredWalletAddress'], {
      name: 'referral_audit_referred'
    });
    await queryInterface.addIndex('ReferralAuditLogs', ['action'], {
      name: 'referral_audit_action'
    });
    await queryInterface.addIndex('ReferralAuditLogs', ['rewardId'], {
      name: 'referral_audit_reward'
    });
    await queryInterface.addIndex('ReferralAuditLogs', ['createdAt'], {
      name: 'referral_audit_created'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ReferralAuditLogs');
  }
};
