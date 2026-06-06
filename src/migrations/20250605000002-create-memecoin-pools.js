'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MemeCoinPools', {
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
      network: {
        type: Sequelize.ENUM('xrpl', 'solana'),
        allowNull: false
      },
      poolAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Raydium pool ID (Solana) or XRPL AMM account address'
      },
      poolId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Optional pool identifier (Raydium AMM ID, etc.)'
      },
      pairToken: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'The pair token symbol (SOL, USDC, XRP, etc.)'
      },
      pairTokenAddress: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Pair token mint/issuer address'
      },
      initialBaseAmount: {
        type: Sequelize.DECIMAL(30, 9),
        allowNull: true,
        comment: 'Initial meme coin amount provided to pool'
      },
      initialPairAmount: {
        type: Sequelize.DECIMAL(30, 9),
        allowNull: true,
        comment: 'Initial pair token amount provided to pool'
      },
      initialPrice: {
        type: Sequelize.DECIMAL(30, 12),
        allowNull: true,
        comment: 'Initial price (pair token per meme coin)'
      },
      createTxHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Transaction hash that created the pool'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'closed'),
        defaultValue: 'active',
        allowNull: false
      },
      providerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet that provided the initial liquidity'
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

    await queryInterface.addIndex('MemeCoinPools', ['memeCoinId'], { name: 'idx_pool_memecoin' });
    await queryInterface.addIndex('MemeCoinPools', ['poolAddress'], { name: 'idx_pool_address' });
    await queryInterface.addIndex('MemeCoinPools', ['network'], { name: 'idx_pool_network' });
    await queryInterface.addIndex('MemeCoinPools', ['status'], { name: 'idx_pool_status' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MemeCoinPools');
  }
};
