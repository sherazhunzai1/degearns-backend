'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create SolanaWithdrawals table
    await queryInterface.createTable('SolanaWithdrawals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      chain: {
        type: Sequelize.ENUM('solana'),
        allowNull: false,
        defaultValue: 'solana'
      },
      totalAmount: {
        type: Sequelize.STRING,
        allowNull: false
      },
      perOwnerAmount: {
        type: Sequelize.STRING,
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      initiatedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'SolanaWithdrawalOwners',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      status: {
        type: Sequelize.ENUM('pending_signatures', 'completed', 'rejected'),
        allowNull: false,
        defaultValue: 'pending_signatures'
      },
      requiredSignatures: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3
      },
      rejectedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'SolanaWithdrawalOwners',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      rejectionReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      splits: {
        type: Sequelize.JSON,
        allowNull: true
      },
      sourceBreakdown: {
        type: Sequelize.JSON,
        allowNull: true
      },
      transactionHashes: {
        type: Sequelize.JSON,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rejectedAt: {
        type: Sequelize.DATE,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('SolanaWithdrawals', ['status']);
    await queryInterface.addIndex('SolanaWithdrawals', ['initiatedBy']);
    await queryInterface.addIndex('SolanaWithdrawals', ['createdAt']);

    // Create SolanaWithdrawalSignatures table
    await queryInterface.createTable('SolanaWithdrawalSignatures', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      withdrawalId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'SolanaWithdrawals',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'SolanaWithdrawalOwners',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      signedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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

    await queryInterface.addIndex('SolanaWithdrawalSignatures', ['withdrawalId']);
    await queryInterface.addIndex('SolanaWithdrawalSignatures', ['ownerId']);
    await queryInterface.addIndex('SolanaWithdrawalSignatures', ['withdrawalId', 'ownerId'], {
      unique: true,
      name: 'idx_solana_withdrawal_owner_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('SolanaWithdrawalSignatures');
    await queryInterface.dropTable('SolanaWithdrawals');
  }
};
