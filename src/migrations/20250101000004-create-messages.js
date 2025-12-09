'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      conversationId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to the conversation',
        references: {
          model: 'Conversations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      senderWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Sender wallet address',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      receiverWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Receiver wallet address',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Message content'
      },
      messageType: {
        type: Sequelize.ENUM('text', 'image', 'nft_share'),
        defaultValue: 'text',
        comment: 'Type of message'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional data like NFT details, image URL, etc.'
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether message has been read'
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when message was read'
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

    // Add indexes for efficient queries
    await queryInterface.addIndex('Messages', ['conversationId'], {
      name: 'idx_message_conversation'
    });

    await queryInterface.addIndex('Messages', ['senderWalletAddress'], {
      name: 'idx_message_sender'
    });

    await queryInterface.addIndex('Messages', ['receiverWalletAddress'], {
      name: 'idx_message_receiver'
    });

    await queryInterface.addIndex('Messages', ['isRead'], {
      name: 'idx_message_read_status'
    });

    await queryInterface.addIndex('Messages', ['createdAt'], {
      name: 'idx_message_created'
    });

    // Composite index for unread messages query
    await queryInterface.addIndex('Messages', ['receiverWalletAddress', 'isRead'], {
      name: 'idx_message_unread_by_receiver'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Messages');
  }
};
