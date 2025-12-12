'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      recipientWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the user receiving the notification'
      },
      senderWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the user who triggered the notification'
      },
      type: {
        type: Sequelize.ENUM('like', 'comment', 'comment_reply', 'follow', 'nft_listing'),
        allowNull: false,
        comment: 'Type of notification'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Short notification title'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Detailed notification message'
      },
      relatedEntityId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of the related entity (postId, commentId, followId, collectionId)'
      },
      relatedEntityType: {
        type: Sequelize.ENUM('post', 'comment', 'follow', 'collection', 'nft'),
        allowNull: true,
        comment: 'Type of the related entity'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata for the notification'
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether the notification has been read'
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when the notification was read'
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

    // Add indexes for performance
    await queryInterface.addIndex('Notifications', ['recipientWalletAddress', 'isRead'], {
      name: 'idx_notification_recipient_read'
    });
    await queryInterface.addIndex('Notifications', ['recipientWalletAddress', 'createdAt'], {
      name: 'idx_notification_recipient_created'
    });
    await queryInterface.addIndex('Notifications', ['type'], {
      name: 'idx_notification_type'
    });
    await queryInterface.addIndex('Notifications', ['senderWalletAddress'], {
      name: 'idx_notification_sender'
    });
    await queryInterface.addIndex('Notifications', ['relatedEntityId', 'relatedEntityType'], {
      name: 'idx_notification_related_entity'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Notifications');
  }
};
