'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('GroupMessages', {
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
      senderWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Sender wallet address'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Message content'
      },
      messageType: {
        type: Sequelize.ENUM('text', 'image', 'nft_share', 'system'),
        defaultValue: 'text',
        comment: 'Type of message (system messages for joins/leaves)'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional data like NFT details, image URL, etc.'
      },
      replyToMessageId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to the message being replied to'
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
    await queryInterface.addIndex('GroupMessages', ['groupId'], {
      name: 'idx_group_message_group'
    });
    await queryInterface.addIndex('GroupMessages', ['senderWalletAddress'], {
      name: 'idx_group_message_sender'
    });
    await queryInterface.addIndex('GroupMessages', ['createdAt'], {
      name: 'idx_group_message_created'
    });
    await queryInterface.addIndex('GroupMessages', ['groupId', 'createdAt'], {
      name: 'idx_group_message_group_created'
    });
    await queryInterface.addIndex('GroupMessages', ['replyToMessageId'], {
      name: 'idx_group_message_reply'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('GroupMessages');
  }
};
