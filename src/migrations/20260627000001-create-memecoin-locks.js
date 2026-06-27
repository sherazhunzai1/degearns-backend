'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MemeCoinLocks', {
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
      lockType: {
        type: Sequelize.ENUM('liquidity', 'token'),
        allowNull: false,
        defaultValue: 'liquidity',
        comment: 'liquidity = LP tokens locked, token = raw token supply locked'
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'jupiter_lock (Solana), xrpl_custodial (XRPL), burn, streamflow, etc.'
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'released', 'unlocked', 'failed'),
        allowNull: false,
        defaultValue: 'active'
      },
      lockAddress: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'Jupiter Lock escrow account (Solana) or custodial locker wallet (XRPL)'
      },
      assetMint: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'Solana: locked LP/token mint address'
      },
      assetCurrency: {
        type: Sequelize.STRING(40),
        allowNull: true,
        comment: 'XRPL: locked LP token currency code (hex)'
      },
      assetIssuer: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'XRPL: LP token issuer (the AMM account address)'
      },
      amount: {
        type: Sequelize.DECIMAL(40, 15),
        allowNull: false,
        defaultValue: 0,
        comment: 'Amount of LP/token locked'
      },
      ownerWalletAddress: {
        type: Sequelize.STRING(120),
        allowNull: false,
        comment: 'Wallet that owns the locked liquidity (the creator/LP provider)'
      },
      recipientWalletAddress: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'Wallet entitled to claim/receive the liquidity on unlock (defaults to owner)'
      },
      lockTxHash: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'On-chain transaction hash that created/funded the lock'
      },
      unlockTxHash: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'On-chain transaction hash that released the lock'
      },
      lockedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      unlockAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the lock can be released. NULL = permanent (e.g. burned liquidity)'
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

    await queryInterface.addIndex('MemeCoinLocks', ['memeCoinId'], { name: 'idx_lock_memecoin' });
    await queryInterface.addIndex('MemeCoinLocks', ['network'], { name: 'idx_lock_network' });
    await queryInterface.addIndex('MemeCoinLocks', ['status'], { name: 'idx_lock_status' });
    await queryInterface.addIndex('MemeCoinLocks', ['ownerWalletAddress'], { name: 'idx_lock_owner' });
    await queryInterface.addIndex('MemeCoinLocks', ['lockTxHash'], { name: 'idx_lock_tx', unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MemeCoinLocks');
  }
};
