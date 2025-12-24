'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Groups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Group name'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Group description'
      },
      groupImage: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Group profile image URL'
      },
      creatorWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Wallet address of the group creator'
      },
      lastMessageAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of the last message in the group'
      },
      lastMessagePreview: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Preview of the last message'
      },
      lastMessageSenderWallet: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address of the last message sender'
      },
      memberCount: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: 'Total number of members in the group'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the group is active'
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
    await queryInterface.addIndex('Groups', ['creatorWalletAddress'], {
      name: 'idx_group_creator'
    });
    await queryInterface.addIndex('Groups', ['lastMessageAt'], {
      name: 'idx_group_last_message'
    });
    await queryInterface.addIndex('Groups', ['isActive'], {
      name: 'idx_group_active'
    });
    await queryInterface.addIndex('Groups', ['createdAt'], {
      name: 'idx_group_created'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Groups');
  }
};
