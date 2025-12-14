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
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to the collection this drop belongs to',
        references: {
          model: 'Collections',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      creatorWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of drop creator',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
      image: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Drop cover image URL'
      },
      bannerImage: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Drop banner image URL'
      },
      royaltyPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        allowNull: false,
        comment: 'Creator royalty percentage (0-100)'
      },
      pricePerNft: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: '0',
        comment: 'Price per NFT in drops (XRP drops)'
      },
      limitPerWallet: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Maximum NFTs per wallet (null = unlimited)'
      },
      totalSupply: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total NFTs available in this drop'
      },
      mintedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of NFTs minted from this drop'
      },
      isBurnable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether NFTs can be burned'
      },
      isTransferable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether NFTs can be transferred'
      },
      isOnlyXrp: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether NFTs can only be traded for XRP'
      },
      isMutable: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether NFT metadata can be changed'
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Drop start date and time'
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Drop end date and time'
      },
      launchFee: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Fee paid to launch the drop'
      },
      launchFeeTransactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Transaction hash for launch fee payment'
      },
      paymentStatus: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
        defaultValue: 'pending',
        comment: 'Status of launch fee payment'
      },
      isMintingEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether minting is currently enabled'
      },
      isAllowlistEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether allowlist restriction is enabled'
      },
      isFreeMint: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether minting is free (ignores pricePerNft)'
      },
      status: {
        type: Sequelize.ENUM('draft', 'scheduled', 'active', 'paused', 'ended', 'sold_out'),
        defaultValue: 'draft',
        comment: 'Current status of the drop'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata for the drop'
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

    await queryInterface.addIndex('Drops', ['startDate'], {
      name: 'idx_drops_start_date'
    });

    await queryInterface.addIndex('Drops', ['endDate'], {
      name: 'idx_drops_end_date'
    });

    await queryInterface.addIndex('Drops', ['paymentStatus'], {
      name: 'idx_drops_payment_status'
    });

    await queryInterface.addIndex('Drops', ['createdAt'], {
      name: 'idx_drops_created_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Drops');
  }
};
