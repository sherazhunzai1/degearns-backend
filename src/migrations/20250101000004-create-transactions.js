'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      txHash: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: false,
        comment: 'XRPL transaction hash'
      },
      type: {
        type: Sequelize.ENUM('mint', 'sale', 'transfer', 'list', 'delist', 'offer', 'burn'),
        allowNull: false,
        comment: 'Transaction type'
      },
      nftId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'NFT involved in transaction',
        references: {
          model: 'NFTs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      nftTokenId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'XRPL NFToken ID'
      },
      fromWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Sender wallet address'
      },
      toWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Receiver wallet address'
      },
      amount: {
        type: Sequelize.STRING(50),
        defaultValue: '0',
        comment: 'Transaction amount in drops'
      },
      marketplaceFee: {
        type: Sequelize.STRING(50),
        defaultValue: '0',
        comment: 'Marketplace fee in drops'
      },
      royaltyFee: {
        type: Sequelize.STRING(50),
        defaultValue: '0',
        comment: 'Creator royalty in drops'
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
        comment: 'Transaction status'
      },
      offerID: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL offer ID if applicable'
      },
      blockNumber: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'XRPL ledger index'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional transaction metadata'
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
    await queryInterface.addIndex('Transactions', ['txHash'], {
      name: 'idx_transactions_tx_hash',
      unique: true
    });

    await queryInterface.addIndex('Transactions', ['nftId'], {
      name: 'idx_transactions_nft_id'
    });

    await queryInterface.addIndex('Transactions', ['fromWalletAddress'], {
      name: 'idx_transactions_from'
    });

    await queryInterface.addIndex('Transactions', ['toWalletAddress'], {
      name: 'idx_transactions_to'
    });

    await queryInterface.addIndex('Transactions', ['type'], {
      name: 'idx_transactions_type'
    });

    await queryInterface.addIndex('Transactions', ['status'], {
      name: 'idx_transactions_status'
    });

    await queryInterface.addIndex('Transactions', ['createdAt'], {
      name: 'idx_transactions_created_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Transactions');
  }
};
