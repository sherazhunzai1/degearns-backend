'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Posts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      authorWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Author wallet address',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Post text content (optional if media is provided)'
      },
      postType: {
        type: Sequelize.ENUM('text', 'image', 'video', 'mixed'),
        defaultValue: 'text',
        comment: 'Type of post: text only, image(s), video(s), or mixed media'
      },
      visibility: {
        type: Sequelize.ENUM('public', 'private'),
        defaultValue: 'public',
        comment: 'Post visibility setting'
      },
      likesCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of likes on the post'
      },
      commentsCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of comments on the post'
      },
      sharesCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of shares of the post'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata like location, tags, etc.'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Soft delete flag'
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
    await queryInterface.addIndex('Posts', ['authorWalletAddress'], {
      name: 'idx_post_author'
    });

    await queryInterface.addIndex('Posts', ['postType'], {
      name: 'idx_post_type'
    });

    await queryInterface.addIndex('Posts', ['visibility'], {
      name: 'idx_post_visibility'
    });

    await queryInterface.addIndex('Posts', ['createdAt'], {
      name: 'idx_post_created'
    });

    await queryInterface.addIndex('Posts', ['isActive'], {
      name: 'idx_post_active'
    });

    await queryInterface.addIndex('Posts', ['authorWalletAddress', 'createdAt'], {
      name: 'idx_post_author_created'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Posts');
  }
};
