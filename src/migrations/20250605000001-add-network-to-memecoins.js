'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add network discriminator
    await queryInterface.addColumn('MemeCoins', 'network', {
      type: Sequelize.ENUM('xrpl', 'solana'),
      allowNull: false,
      defaultValue: 'xrpl',
      after: 'creatorWalletAddress',
      comment: 'Blockchain network for this meme coin'
    });

    // Solana SPL token mint address
    await queryInterface.addColumn('MemeCoins', 'mintAddress', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'network',
      comment: 'Solana SPL token mint address (null for XRPL coins)'
    });

    // Make XRPL-only fields nullable for Solana coins
    await queryInterface.changeColumn('MemeCoins', 'currencyHex', {
      type: Sequelize.STRING(40),
      allowNull: true,
      comment: 'Hex-encoded currency code on XRPL (null for Solana coins)'
    });
    await queryInterface.changeColumn('MemeCoins', 'issuerWalletAddress', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'XRPL token issuer address (null for Solana coins)'
    });

    // Expand status ENUM to include solana lifecycle states
    await queryInterface.sequelize.query(`
      ALTER TABLE MemeCoins
      MODIFY COLUMN status ENUM(
        'pending',
        'trust_set',
        'issued',
        'failed',
        'minted'
      ) DEFAULT 'pending'
    `);

    await queryInterface.addIndex('MemeCoins', ['network'], { name: 'idx_memecoin_network' });
    await queryInterface.addIndex('MemeCoins', ['mintAddress'], { name: 'idx_memecoin_mint' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('MemeCoins', 'idx_memecoin_mint');
    await queryInterface.removeIndex('MemeCoins', 'idx_memecoin_network');

    await queryInterface.sequelize.query(`
      ALTER TABLE MemeCoins
      MODIFY COLUMN status ENUM('pending', 'trust_set', 'issued', 'failed') DEFAULT 'pending'
    `);

    await queryInterface.changeColumn('MemeCoins', 'currencyHex', {
      type: Sequelize.STRING(40),
      allowNull: false
    });
    await queryInterface.changeColumn('MemeCoins', 'issuerWalletAddress', {
      type: Sequelize.STRING(100),
      allowNull: false
    });

    await queryInterface.removeColumn('MemeCoins', 'mintAddress');
    await queryInterface.removeColumn('MemeCoins', 'network');
  }
};
