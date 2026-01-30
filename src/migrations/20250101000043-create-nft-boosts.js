'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('NftBoosts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      nftTokenId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'NFT token ID on XRPL'
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the user who paid for boost'
      },
      boostPercentage: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Boost level: 20%, 40%, 60%, 80%, or 100%'
      },
      paymentAmount: {
        type: Sequelize.DECIMAL(20, 6),
        allowNull: false,
        comment: 'Amount paid in XRP'
      },
      paymentTransactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL transaction hash for payment verification'
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the boost starts'
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When the boost expires'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the boost is currently active'
      },
      impressions: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of times the boosted NFT was shown'
      },
      clicks: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of clicks/engagements on the boosted NFT'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata including NFT details'
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

    // Add indexes
    await queryInterface.addIndex('NftBoosts', ['nftTokenId'], { name: 'idx_nftboost_nft' });
    await queryInterface.addIndex('NftBoosts', ['userWalletAddress'], { name: 'idx_nftboost_user' });
    await queryInterface.addIndex('NftBoosts', ['isActive', 'endDate'], { name: 'idx_nftboost_active' });
    await queryInterface.addIndex('NftBoosts', ['boostPercentage'], { name: 'idx_nftboost_percentage' });
    await queryInterface.addIndex('NftBoosts', ['isActive', 'boostPercentage', 'endDate'], { name: 'idx_nftboost_fetch' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('NftBoosts');
  }
};
