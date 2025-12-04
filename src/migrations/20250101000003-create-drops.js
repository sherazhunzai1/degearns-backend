'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Drops', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      collectionId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Collection identifier (no FK constraint)'
      },
      collectionName: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Collection name'
      },
      taxon: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'XRPL NFT Taxon'
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Drop name/title'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Drop description'
      },
      price: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Minting price in XRP'
      },
      totalSupply: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Total number of NFTs in this drop'
      },
      mintedCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Number of NFTs already minted'
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When minting starts'
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When minting ends'
      },
      status: {
        type: Sequelize.ENUM('upcoming', 'active', 'ended', 'soldout'),
        defaultValue: 'upcoming',
        allowNull: false,
        comment: 'Drop status'
      },
      creatorWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of drop creator'
      },
      transferFee: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Transfer fee in basis points (0-50000, where 50000 = 50%)'
      },
      flags: {
        type: Sequelize.INTEGER,
        defaultValue: 8,
        allowNull: false,
        comment: 'XRPL NFT flags (8 = Transferable, 9 = Burnable & Transferable)'
      },
      maxMintsPerWallet: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Maximum number of NFTs one wallet can mint from this drop (null = unlimited)'
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
    await queryInterface.addIndex('Drops', ['collectionId'], {
      name: 'idx_drops_collection'
    });

    await queryInterface.addIndex('Drops', ['creatorWalletAddress'], {
      name: 'idx_drops_creator'
    });

    await queryInterface.addIndex('Drops', ['status'], {
      name: 'idx_drops_status'
    });

    await queryInterface.addIndex('Drops', ['startDate', 'endDate'], {
      name: 'idx_drops_dates'
    });

    await queryInterface.addIndex('Drops', ['createdAt'], {
      name: 'idx_drops_created_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Drops');
  }
};
