'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('NFTs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      tokenId: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: false,
        comment: 'XRPL NFToken ID'
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'NFT name/title'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'NFT description'
      },
      image: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Main image URL'
      },
      uri: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Metadata URI (IPFS or HTTP)'
      },
      collectionId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Collection this NFT belongs to',
        references: {
          model: 'Collections',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      creatorWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Original creator wallet address',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      ownerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Current owner wallet address',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      taxon: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'XRPL taxon value'
      },
      transferFee: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Transfer fee in basis points (0-50000)'
      },
      attributes: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'NFT attributes/traits as JSON'
      },
      isListed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether NFT is currently listed for sale'
      },
      currentPrice: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Current listing price in drops'
      },
      offerID: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL offer ID if listed'
      },
      views: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of views'
      },
      likes: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of likes'
      },
      transactionHash: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'XRPL transaction hash for minting'
      },
      mintedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the NFT was minted'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata'
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
    await queryInterface.addIndex('NFTs', ['tokenId'], {
      name: 'idx_nfts_token_id',
      unique: true
    });

    await queryInterface.addIndex('NFTs', ['collectionId'], {
      name: 'idx_nfts_collection_id'
    });

    await queryInterface.addIndex('NFTs', ['creatorWalletAddress'], {
      name: 'idx_nfts_creator'
    });

    await queryInterface.addIndex('NFTs', ['ownerWalletAddress'], {
      name: 'idx_nfts_owner'
    });

    await queryInterface.addIndex('NFTs', ['isListed'], {
      name: 'idx_nfts_is_listed'
    });

    await queryInterface.addIndex('NFTs', ['mintedAt'], {
      name: 'idx_nfts_minted_at'
    });

    await queryInterface.addIndex('NFTs', ['createdAt'], {
      name: 'idx_nfts_created_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('NFTs');
  }
};
