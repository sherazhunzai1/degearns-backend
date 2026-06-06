'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MemeCoinTrades', {
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
        onDelete: 'CASCADE'
      },
      poolId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'MemeCoinPools', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      network: {
        type: Sequelize.ENUM('xrpl', 'solana'),
        allowNull: false
      },
      txHash: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'On-chain transaction hash of the trade'
      },
      traderWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('buy', 'sell'),
        allowNull: false,
        comment: 'Whether the trader bought or sold the meme coin'
      },
      tokenAmount: {
        type: Sequelize.DECIMAL(30, 9),
        allowNull: false,
        comment: 'Amount of meme coins traded'
      },
      pairAmount: {
        type: Sequelize.DECIMAL(30, 9),
        allowNull: false,
        comment: 'Amount of pair token (SOL/XRP/USDC) exchanged'
      },
      pairToken: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      pricePerToken: {
        type: Sequelize.DECIMAL(30, 12),
        allowNull: false,
        comment: 'Price per meme coin in pair token'
      },
      priceUsd: {
        type: Sequelize.DECIMAL(30, 12),
        allowNull: true,
        comment: 'Price per meme coin in USD'
      },
      volumeUsd: {
        type: Sequelize.DECIMAL(30, 6),
        allowNull: true,
        comment: 'Total trade volume in USD'
      },
      tradedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When the trade occurred on-chain'
      },
      metadata: {
        type: Sequelize.JSON,
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

    await queryInterface.addIndex('MemeCoinTrades', ['memeCoinId', 'tradedAt'], { name: 'idx_trade_coin_time' });
    await queryInterface.addIndex('MemeCoinTrades', ['poolId'], { name: 'idx_trade_pool' });
    await queryInterface.addIndex('MemeCoinTrades', ['traderWalletAddress'], { name: 'idx_trade_trader' });
    await queryInterface.addIndex('MemeCoinTrades', ['txHash'], { name: 'idx_trade_tx', unique: true });
    await queryInterface.addIndex('MemeCoinTrades', ['tradedAt'], { name: 'idx_trade_time' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MemeCoinTrades');
  }
};
