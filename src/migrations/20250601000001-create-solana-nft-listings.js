'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SolanaNftListings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      mintAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      sellerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      price: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      collectionMintAddress: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      nftName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      nftImage: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      nftDescription: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      nftAttributes: {
        type: Sequelize.JSON,
        allowNull: true
      },
      delegateTxHash: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'sold', 'cancelled'),
        defaultValue: 'active',
        allowNull: false
      },
      buyerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      saleTxHash: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      soldAt: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('SolanaNftListings', ['mintAddress', 'status'], { name: 'idx_listing_mint_status' });
    await queryInterface.addIndex('SolanaNftListings', ['sellerWalletAddress'], { name: 'idx_listing_seller' });
    await queryInterface.addIndex('SolanaNftListings', ['collectionMintAddress'], { name: 'idx_listing_collection' });
    await queryInterface.addIndex('SolanaNftListings', ['status'], { name: 'idx_listing_status' });
    await queryInterface.addIndex('SolanaNftListings', ['buyerWalletAddress'], { name: 'idx_listing_buyer' });
    await queryInterface.addIndex('SolanaNftListings', ['createdAt'], { name: 'idx_listing_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SolanaNftListings');
  }
};
