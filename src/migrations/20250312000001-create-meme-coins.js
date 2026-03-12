'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('MemeCoins', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      tokenName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      tokenSymbol: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      currencyHex: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      totalSupply: {
        type: Sequelize.DECIMAL(30, 6),
        allowNull: false
      },
      decimals: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 6
      },
      logo: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      website: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      socialLinks: {
        type: Sequelize.JSON,
        allowNull: true
      },
      issuerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      creatorWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'trust_set', 'issued', 'failed'),
        defaultValue: 'pending'
      },
      trustSetTxHash: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      issuanceTxHash: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('MemeCoins', ['creatorWalletAddress'], { name: 'idx_memecoin_creator' });
    await queryInterface.addIndex('MemeCoins', ['issuerWalletAddress'], { name: 'idx_memecoin_issuer' });
    await queryInterface.addIndex('MemeCoins', ['tokenSymbol'], { name: 'idx_memecoin_symbol' });
    await queryInterface.addIndex('MemeCoins', ['status'], { name: 'idx_memecoin_status' });
    await queryInterface.addIndex('MemeCoins', ['currencyHex', 'issuerWalletAddress'], {
      unique: true,
      name: 'idx_memecoin_unique_currency'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('MemeCoins');
  }
};
