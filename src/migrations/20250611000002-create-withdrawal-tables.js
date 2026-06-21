'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create WithdrawalOwners table
    await queryInterface.createTable('WithdrawalOwners', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      walletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex('WithdrawalOwners', ['walletAddress'], { unique: true });
    await queryInterface.addIndex('WithdrawalOwners', ['isActive']);
    await queryInterface.addIndex('WithdrawalOwners', ['position']);

    // Create Withdrawals table
    await queryInterface.createTable('Withdrawals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
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
          model: 'WithdrawalOwners',
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
          model: 'WithdrawalOwners',
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

    await queryInterface.addIndex('Withdrawals', ['status']);
    await queryInterface.addIndex('Withdrawals', ['initiatedBy']);
    await queryInterface.addIndex('Withdrawals', ['createdAt']);

    // Create WithdrawalSignatures table
    await queryInterface.createTable('WithdrawalSignatures', {
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
          model: 'Withdrawals',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'WithdrawalOwners',
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

    await queryInterface.addIndex('WithdrawalSignatures', ['withdrawalId']);
    await queryInterface.addIndex('WithdrawalSignatures', ['ownerId']);
    await queryInterface.addIndex('WithdrawalSignatures', ['withdrawalId', 'ownerId'], {
      unique: true,
      name: 'idx_withdrawal_owner_unique'
    });

    // Seed the 3 withdrawal owners
    await queryInterface.bulkInsert('WithdrawalOwners', [
      {
        id: queryInterface.sequelize.literal('UUID()'),
        name: 'Aristides Yiannoudes',
        walletAddress: 'rMQYjiwVYweGjJT3crUJuym4CUo5M4r1Yk',
        position: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: queryInterface.sequelize.literal('UUID()'),
        name: 'Investors',
        walletAddress: 'rsHAUwc5BsxCvksbFNio5mbAg3omM3hf5k',
        position: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: queryInterface.sequelize.literal('UUID()'),
        name: 'Konstantinos Chrysostomou',
        walletAddress: 'rJA3u8baXpzbVcBAXqEPkfirpbUKAce5TC',
        position: 3,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('WithdrawalSignatures');
    await queryInterface.dropTable('Withdrawals');
    await queryInterface.dropTable('WithdrawalOwners');
  }
};
