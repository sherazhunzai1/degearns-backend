'use strict';

/**
 * Generic NFTs table — stores newly minted NFTs for BOTH networks (XRPL + Solana)
 * with their metadata, independent of the drop flow. Identified uniquely by
 * (nftTokenId, network).
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Nfts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      network: {
        type: Sequelize.ENUM('xrpl', 'solana'),
        allowNull: false
      },
      nftTokenId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'XRPL NFTokenID or Solana mint address'
      },
      mintAddress: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      image: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      metadataUri: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      attributes: {
        type: Sequelize.JSON,
        allowNull: true
      },
      collectionId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL taxon or Solana collection mint (no FK)'
      },
      taxon: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      issuerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      ownerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      minterWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      mintTransactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      royaltyPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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

    await queryInterface.addIndex('Nfts', ['nftTokenId', 'network'], { unique: true, name: 'unique_nft_token_network' });
    await queryInterface.addIndex('Nfts', ['ownerWalletAddress'], { name: 'idx_nft_owner' });
    await queryInterface.addIndex('Nfts', ['minterWalletAddress'], { name: 'idx_nft_minter' });
    await queryInterface.addIndex('Nfts', ['collectionId'], { name: 'idx_nft_collection' });
    await queryInterface.addIndex('Nfts', ['network'], { name: 'idx_nft_network' });
    await queryInterface.addIndex('Nfts', ['createdAt'], { name: 'idx_nft_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Nfts');
  }
};
