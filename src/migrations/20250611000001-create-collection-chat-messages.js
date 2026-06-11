'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CollectionChatMessages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      collectionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Collections', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      senderWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      messageType: {
        type: Sequelize.ENUM('text', 'image', 'nft_share', 'system'),
        defaultValue: 'text'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      replyToMessageId: {
        type: Sequelize.UUID,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('CollectionChatMessages', ['collectionId', 'createdAt'], { name: 'idx_colchat_collection_time' });
    await queryInterface.addIndex('CollectionChatMessages', ['senderWalletAddress'], { name: 'idx_colchat_sender' });
    await queryInterface.addIndex('CollectionChatMessages', ['createdAt'], { name: 'idx_colchat_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CollectionChatMessages');
  }
};
