'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      walletAddress: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: false,
        comment: 'XRPL wallet address - primary identifier'
      },
      username: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: true,
        comment: 'User display name'
      },
      email: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: true,
        comment: 'User email (optional)'
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User biography'
      },
      profileImage: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Profile image URL'
      },
      coverImage: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Cover/banner image URL'
      },
      isVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Verified badge status'
      },
      role: {
        type: Sequelize.ENUM('user', 'admin'),
        defaultValue: 'user',
        allowNull: false
      },
      socialLinks: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON object for social media links'
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
    await queryInterface.addIndex('Users', ['walletAddress'], {
      name: 'idx_users_wallet_address',
      unique: true
    });

    await queryInterface.addIndex('Users', ['username'], {
      name: 'idx_users_username'
    });

    await queryInterface.addIndex('Users', ['email'], {
      name: 'idx_users_email'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Users');
  }
};
