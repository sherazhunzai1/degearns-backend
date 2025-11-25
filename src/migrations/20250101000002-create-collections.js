'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Collections', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Collection name'
      },
      slug: {
        type: Sequelize.STRING(120),
        unique: true,
        allowNull: false,
        comment: 'URL-friendly slug for the collection'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Collection description'
      },
      image: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Collection cover image URL'
      },
      bannerImage: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Collection banner image URL'
      },
      creatorWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of collection creator',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      taxon: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        comment: 'XRPL NFToken Taxon - unique identifier to query NFTs from XRPL'
      },
      category: {
        type: Sequelize.ENUM('art', 'music', 'photography', 'sports', 'gaming', 'collectibles', 'other'),
        defaultValue: 'other',
        allowNull: false
      },
      royaltyPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        allowNull: false,
        comment: 'Creator royalty percentage (0-100)'
      },
      totalSupply: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Total number of NFTs in collection'
      },
      floorPrice: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Floor price in drops'
      },
      totalVolume: {
        type: Sequelize.STRING(50),
        defaultValue: '0',
        comment: 'Total trading volume in drops'
      },
      isVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Verified collection status'
      },
      socialLinks: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON object for social media links'
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
    await queryInterface.addIndex('Collections', ['slug'], {
      name: 'idx_collections_slug',
      unique: true
    });

    await queryInterface.addIndex('Collections', ['taxon'], {
      name: 'idx_collections_taxon',
      unique: true
    });

    await queryInterface.addIndex('Collections', ['creatorWalletAddress'], {
      name: 'idx_collections_creator'
    });

    await queryInterface.addIndex('Collections', ['category'], {
      name: 'idx_collections_category'
    });

    await queryInterface.addIndex('Collections', ['createdAt'], {
      name: 'idx_collections_created_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Collections');
  }
};
