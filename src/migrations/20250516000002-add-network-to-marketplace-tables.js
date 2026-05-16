'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // --- Collections ---

    // Drop the standalone unique index on taxon (keep the composite unique_taxon_creator)
    try {
      await queryInterface.removeIndex('Collections', 'taxon');
    } catch (e) {
      try {
        await queryInterface.removeIndex('Collections', 'Collections_taxon_unique');
      } catch (e2) {
        // Index may have a different name — proceed
      }
    }

    // Make taxon nullable (Solana collections don't have a taxon)
    await queryInterface.changeColumn('Collections', 'taxon', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'XRPL NFToken Taxon (null for Solana collections)'
    });

    await queryInterface.addColumn('Collections', 'network', {
      type: Sequelize.ENUM('xrpl', 'solana'),
      allowNull: false,
      defaultValue: 'xrpl',
      after: 'creatorWalletAddress',
      comment: 'Blockchain network for this collection'
    });

    await queryInterface.addColumn('Collections', 'mintAddress', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'network',
      comment: 'Solana collection mint address (null for XRPL collections)'
    });

    await queryInterface.addIndex('Collections', ['network'], { name: 'idx_collection_network' });
    await queryInterface.addIndex('Collections', ['mintAddress'], { name: 'idx_collection_mint_address' });

    // --- Drops ---

    await queryInterface.addColumn('Drops', 'network', {
      type: Sequelize.ENUM('xrpl', 'solana'),
      allowNull: false,
      defaultValue: 'xrpl',
      after: 'creatorWalletAddress',
      comment: 'Blockchain network for this drop'
    });

    await queryInterface.addColumn('Drops', 'priceCurrency', {
      type: Sequelize.ENUM('XRP', 'SOL'),
      allowNull: false,
      defaultValue: 'XRP',
      after: 'pricePerNft',
      comment: 'Currency for pricing (XRP drops or SOL lamports)'
    });

    await queryInterface.addColumn('Drops', 'collectionMintAddress', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'network',
      comment: 'Solana collection mint address for this drop'
    });

    await queryInterface.addIndex('Drops', ['network'], { name: 'idx_drop_network' });

    // --- DropMints ---

    await queryInterface.addColumn('DropMints', 'network', {
      type: Sequelize.ENUM('xrpl', 'solana'),
      allowNull: false,
      defaultValue: 'xrpl',
      after: 'minterWalletAddress',
      comment: 'Blockchain network for this mint'
    });

    await queryInterface.addIndex('DropMints', ['network'], { name: 'idx_drop_mint_network' });
  },

  async down(queryInterface, Sequelize) {
    // --- DropMints ---
    await queryInterface.removeIndex('DropMints', 'idx_drop_mint_network');
    await queryInterface.removeColumn('DropMints', 'network');

    // --- Drops ---
    await queryInterface.removeIndex('Drops', 'idx_drop_network');
    await queryInterface.removeColumn('Drops', 'collectionMintAddress');
    await queryInterface.removeColumn('Drops', 'priceCurrency');
    await queryInterface.removeColumn('Drops', 'network');

    // --- Collections ---
    await queryInterface.removeIndex('Collections', 'idx_collection_mint_address');
    await queryInterface.removeIndex('Collections', 'idx_collection_network');
    await queryInterface.removeColumn('Collections', 'mintAddress');
    await queryInterface.removeColumn('Collections', 'network');

    // Restore taxon to NOT NULL + unique
    await queryInterface.changeColumn('Collections', 'taxon', {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: true,
      comment: 'XRPL NFToken Taxon - unique identifier to query NFTs from XRPL'
    });
  }
};
