'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('DropMints', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      dropId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to the drop',
        references: {
          model: 'Drops',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      minterWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the minter'
      },
      nftTokenId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'XRPL NFToken ID of the minted NFT'
      },
      nftUri: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URI of the NFT metadata'
      },
      transactionHash: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'XRPL transaction hash of the mint'
      },
      mintPrice: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: '0',
        comment: 'Price paid for this mint in drops'
      },
      paymentTransactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Transaction hash for the payment to creator (if not free)'
      },
      mintIndex: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'The index/order of this mint in the drop (1, 2, 3, etc.)'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata about the mint'
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
    await queryInterface.addIndex('DropMints', ['dropId'], {
      name: 'idx_drop_mints_drop'
    });

    await queryInterface.addIndex('DropMints', ['minterWalletAddress'], {
      name: 'idx_drop_mints_minter'
    });

    await queryInterface.addIndex('DropMints', ['nftTokenId'], {
      name: 'idx_drop_mints_nft_token',
      unique: true
    });

    await queryInterface.addIndex('DropMints', ['transactionHash'], {
      name: 'idx_drop_mints_transaction'
    });

    await queryInterface.addIndex('DropMints', ['createdAt'], {
      name: 'idx_drop_mints_created_at'
    });

    await queryInterface.addIndex('DropMints', ['dropId', 'mintIndex'], {
      name: 'idx_drop_mint_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('DropMints');
  }
};
