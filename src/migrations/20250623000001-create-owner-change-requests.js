'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('OwnerChangeRequests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      network: {
        type: Sequelize.ENUM('xrpl', 'solana'),
        allowNull: false
      },
      targetOwnerId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      targetOwnerName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      targetOwnerWallet: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      newOwnerName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      newOwnerWallet: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      initiatedBy: {
        type: Sequelize.UUID,
        allowNull: false
      },
      initiatorName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false
      },
      requiredSignatures: {
        type: Sequelize.INTEGER,
        defaultValue: 2,
        allowNull: false
      },
      rejectedBy: {
        type: Sequelize.UUID,
        allowNull: true
      },
      rejectorName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      rejectionReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      rejectedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('OwnerChangeRequests', ['network', 'status']);
    await queryInterface.addIndex('OwnerChangeRequests', ['status']);
    await queryInterface.addIndex('OwnerChangeRequests', ['createdAt']);

    await queryInterface.createTable('OwnerChangeSignatures', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      changeRequestId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      ownerName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      signedAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('OwnerChangeSignatures', ['changeRequestId', 'ownerId'], {
      unique: true,
      name: 'idx_change_sig_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('OwnerChangeSignatures');
    await queryInterface.dropTable('OwnerChangeRequests');
  }
};
