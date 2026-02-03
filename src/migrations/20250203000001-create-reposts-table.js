'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create Reposts table
    await queryInterface.createTable('Reposts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      postId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Posts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      quote: {
        type: Sequelize.TEXT,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('Reposts', ['postId'], { name: 'idx_repost_post' });
    await queryInterface.addIndex('Reposts', ['userWalletAddress'], { name: 'idx_repost_user' });
    await queryInterface.addIndex('Reposts', ['postId', 'userWalletAddress'], { unique: true, name: 'idx_repost_unique' });
    await queryInterface.addIndex('Reposts', ['createdAt'], { name: 'idx_repost_created' });

    // Add repostsCount column to Posts table
    await queryInterface.addColumn('Posts', 'repostsCount', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove repostsCount from Posts
    await queryInterface.removeColumn('Posts', 'repostsCount');

    // Drop Reposts table
    await queryInterface.dropTable('Reposts');
  }
};
