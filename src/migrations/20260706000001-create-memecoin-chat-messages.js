'use strict';

/**
 * Open chatroom for LISTED meme coins — any user can post and everyone can read.
 * Keyed by MemeCoins.id (listed meme coins always have a DB record). Sender identity
 * comes from Users via walletAddress (no hard FK, so linked wallets resolved to the
 * primary wallet work fine). Deleting a meme coin cascades its chat away.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MemeCoinChatMessages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      memeCoinId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'MemeCoins', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'The listed meme coin this open chatroom belongs to'
      },
      senderWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Sender wallet address (primary wallet)'
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
        allowNull: true,
        comment: 'ID of the message being replied to (no hard FK; validated in app layer)'
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

    await queryInterface.addIndex('MemeCoinChatMessages', ['memeCoinId', 'createdAt'], { name: 'idx_mcchat_coin_time' });
    await queryInterface.addIndex('MemeCoinChatMessages', ['senderWalletAddress'], { name: 'idx_mcchat_sender' });
    await queryInterface.addIndex('MemeCoinChatMessages', ['createdAt'], { name: 'idx_mcchat_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MemeCoinChatMessages');
  }
};
