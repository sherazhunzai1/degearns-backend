'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('DropNFTs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      collectionId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to Collection',
        references: {
          model: 'Collections',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      dropId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to Drop (null until assigned to a drop)',
        references: {
          model: 'Drops',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      metadataUri: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'IPFS URI for NFT metadata'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Cached NFT metadata (name, description, image, attributes)'
      },
      nftokenId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL NFToken ID after minting (null if not minted yet)'
      },
      mintedBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address of minter (null if not minted yet)',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      mintedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this NFT was minted'
      },
      transactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL transaction hash (null if not minted yet)'
      },
      isMinted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this NFT has been minted'
      },
      mintNumber: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Sequential mint number (assigned when minted)'
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
    await queryInterface.addIndex('DropNFTs', ['collectionId'], {
      name: 'idx_drop_nfts_collection'
    });

    await queryInterface.addIndex('DropNFTs', ['dropId'], {
      name: 'idx_drop_nfts_drop'
    });

    await queryInterface.addIndex('DropNFTs', ['isMinted'], {
      name: 'idx_drop_nfts_is_minted'
    });

    await queryInterface.addIndex('DropNFTs', ['collectionId', 'dropId'], {
      name: 'idx_drop_nfts_collection_drop'
    });

    await queryInterface.addIndex('DropNFTs', ['dropId', 'isMinted'], {
      name: 'idx_drop_nfts_drop_minted'
    });

    await queryInterface.addIndex('DropNFTs', ['nftokenId'], {
      name: 'idx_drop_nfts_nftoken',
      unique: true,
      where: {
        nftokenId: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('DropNFTs', ['mintedBy'], {
      name: 'idx_drop_nfts_minted_by'
    });

    await queryInterface.addIndex('DropNFTs', ['mintedAt'], {
      name: 'idx_drop_nfts_minted_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('DropNFTs');
  }
};
