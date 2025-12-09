'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('PostMedia', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      postId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to the post',
        references: {
          model: 'Posts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mediaType: {
        type: Sequelize.ENUM('image', 'video'),
        allowNull: false,
        comment: 'Type of media: image or video'
      },
      mediaUrl: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'URL of the media file'
      },
      thumbnailUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Thumbnail URL for videos'
      },
      mimeType: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'MIME type of the media (e.g., image/jpeg, video/mp4)'
      },
      fileSize: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'File size in bytes'
      },
      width: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Width in pixels'
      },
      height: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Height in pixels'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Duration in seconds (for videos)'
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Order of media display in the post'
      },
      altText: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Alternative text for accessibility'
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
    await queryInterface.addIndex('PostMedia', ['postId'], {
      name: 'idx_postmedia_post'
    });

    await queryInterface.addIndex('PostMedia', ['mediaType'], {
      name: 'idx_postmedia_type'
    });

    await queryInterface.addIndex('PostMedia', ['postId', 'displayOrder'], {
      name: 'idx_postmedia_order'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('PostMedia');
  }
};
