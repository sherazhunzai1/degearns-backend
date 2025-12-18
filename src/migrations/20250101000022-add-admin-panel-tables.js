'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add ban-related columns to Users table
    await queryInterface.addColumn('Users', 'isBanned', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether the user is banned'
    });

    await queryInterface.addColumn('Users', 'banReason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Reason for ban (if banned)'
    });

    await queryInterface.addColumn('Users', 'bannedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Date when user was banned'
    });

    await queryInterface.addColumn('Users', 'bannedBy', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Wallet address of admin who banned the user'
    });

    // Create PlatformSettings table
    await queryInterface.createTable('PlatformSettings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      key: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: false,
        comment: 'Setting key/identifier'
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Setting value (stored as string, parsed based on type)'
      },
      type: {
        type: Sequelize.ENUM('string', 'number', 'boolean', 'json'),
        defaultValue: 'string',
        allowNull: false,
        comment: 'Data type for parsing the value'
      },
      category: {
        type: Sequelize.ENUM('fees', 'marketplace', 'drops', 'social', 'notifications', 'general'),
        defaultValue: 'general',
        allowNull: false,
        comment: 'Category for grouping settings'
      },
      label: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Human-readable label for the setting'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Description of what this setting does'
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this setting is visible to non-admin users'
      },
      isEditable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this setting can be edited via admin panel'
      },
      lastUpdatedBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address of admin who last updated this setting'
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

    // Add indexes for PlatformSettings
    await queryInterface.addIndex('PlatformSettings', ['key'], { unique: true });
    await queryInterface.addIndex('PlatformSettings', ['category']);
    await queryInterface.addIndex('PlatformSettings', ['isPublic']);

    // Create AdminActivities table
    await queryInterface.createTable('AdminActivities', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      adminWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of admin who performed the action'
      },
      action: {
        type: Sequelize.ENUM(
          'user_ban',
          'user_unban',
          'user_verify',
          'user_unverify',
          'user_role_change',
          'user_delete',
          'collection_verify',
          'collection_unverify',
          'collection_delete',
          'collection_update',
          'drop_approve',
          'drop_reject',
          'drop_pause',
          'drop_resume',
          'drop_delete',
          'drop_update',
          'drop_refund',
          'post_delete',
          'post_hide',
          'comment_delete',
          'setting_update',
          'fee_update',
          'admin_wallet_create',
          'admin_wallet_update',
          'admin_wallet_delete',
          'other'
        ),
        allowNull: false,
        comment: 'Type of admin action performed'
      },
      targetType: {
        type: Sequelize.ENUM('user', 'collection', 'drop', 'post', 'comment', 'setting', 'wallet', 'fee', 'other'),
        allowNull: false,
        comment: 'Type of entity the action was performed on'
      },
      targetId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'ID of the target entity'
      },
      targetIdentifier: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Human-readable identifier (wallet address, name, etc.)'
      },
      previousValue: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Previous value before the change (JSON string)'
      },
      newValue: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'New value after the change (JSON string)'
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for the action (if provided)'
      },
      ipAddress: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'IP address of the admin (optional)'
      },
      userAgent: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'User agent of the admin browser/client'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata for the action'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for AdminActivities
    await queryInterface.addIndex('AdminActivities', ['adminWalletAddress']);
    await queryInterface.addIndex('AdminActivities', ['action']);
    await queryInterface.addIndex('AdminActivities', ['targetType']);
    await queryInterface.addIndex('AdminActivities', ['targetId']);
    await queryInterface.addIndex('AdminActivities', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    // Remove ban columns from Users
    await queryInterface.removeColumn('Users', 'isBanned');
    await queryInterface.removeColumn('Users', 'banReason');
    await queryInterface.removeColumn('Users', 'bannedAt');
    await queryInterface.removeColumn('Users', 'bannedBy');

    // Drop PlatformSettings table
    await queryInterface.dropTable('PlatformSettings');

    // Drop AdminActivities table
    await queryInterface.dropTable('AdminActivities');
  }
};
