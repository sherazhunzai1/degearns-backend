'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('GroupMembers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      groupId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Groups',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to the group'
      },
      walletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Member wallet address'
      },
      role: {
        type: Sequelize.ENUM('admin', 'member'),
        defaultValue: 'member',
        comment: 'Member role in the group (admin or member)'
      },
      joinedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the member joined the group'
      },
      addedByWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address of the user who added this member'
      },
      lastReadAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of when the member last read messages'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the member is currently active in the group'
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
    await queryInterface.addIndex('GroupMembers', ['groupId', 'walletAddress'], {
      unique: true,
      name: 'unique_group_member'
    });
    await queryInterface.addIndex('GroupMembers', ['groupId'], {
      name: 'idx_group_member_group'
    });
    await queryInterface.addIndex('GroupMembers', ['walletAddress'], {
      name: 'idx_group_member_wallet'
    });
    await queryInterface.addIndex('GroupMembers', ['role'], {
      name: 'idx_group_member_role'
    });
    await queryInterface.addIndex('GroupMembers', ['isActive'], {
      name: 'idx_group_member_active'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('GroupMembers');
  }
};
