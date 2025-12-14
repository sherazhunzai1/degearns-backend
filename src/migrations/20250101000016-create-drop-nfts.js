'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('DropNfts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      dropId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to the drop this NFT belongs to',
        references: {
          model: 'Drops',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      index: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Index/order of this NFT in the drop (1, 2, 3, etc.)'
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
        comment: 'NFT image URL (IPFS or HTTP)'
      },
      animationUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Animation/video URL for animated NFTs'
      },
      externalUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'External URL for more info about the NFT'
      },
      attributes: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'NFT attributes/traits array [{trait_type, value}]'
      },
      metadataUri: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'IPFS URI for the complete metadata JSON'
      },
      status: {
        type: Sequelize.ENUM('available', 'reserved', 'minted'),
        defaultValue: 'available',
        comment: 'Current status of this NFT item'
      },
      mintedTo: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address that minted this NFT'
      },
      mintedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this NFT was minted'
      },
      nftTokenId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL NFToken ID after minting'
      },
      transactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL transaction hash of the mint'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata for the NFT'
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

    // Add indexes (MySQL auto-creates index for dropId foreign key)
    await queryInterface.addIndex('DropNfts', ['status'], {
      name: 'idx_drop_nfts_status'
    });

    await queryInterface.addIndex('DropNfts', ['mintedTo'], {
      name: 'idx_drop_nfts_minted_to'
    });

    await queryInterface.addIndex('DropNfts', ['nftTokenId'], {
      name: 'idx_drop_nfts_token_id',
      unique: true
    });

    await queryInterface.addIndex('DropNfts', ['dropId', 'index'], {
      name: 'idx_drop_nft_unique_index',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('DropNfts');
  }
};
