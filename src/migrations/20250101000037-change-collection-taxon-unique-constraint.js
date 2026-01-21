'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the old unique constraint on taxon alone
    // Try all possible index name patterns
    const possibleIndexNames = [
      'idx_collections_taxon',
      'collections_taxon',
      'taxon',
      'Collections_taxon_unique',
      'Collections_taxon_key'
    ];

    for (const indexName of possibleIndexNames) {
      try {
        await queryInterface.removeIndex('Collections', indexName);
        console.log(`Successfully removed index: ${indexName}`);
      } catch (error) {
        console.log(`Index ${indexName} does not exist, skipping removal`);
      }
    }

    // Add new composite unique constraint on taxon + creatorWalletAddress
    await queryInterface.addIndex('Collections', ['taxon', 'creatorWalletAddress'], {
      unique: true,
      name: 'unique_taxon_creator'
    });

    console.log('Successfully changed taxon unique constraint to composite (taxon + creatorWalletAddress)');
  },

  async down(queryInterface, Sequelize) {
    // Remove the composite unique constraint
    await queryInterface.removeIndex('Collections', 'unique_taxon_creator');

    // Restore the original unique constraint on taxon alone
    await queryInterface.addIndex('Collections', ['taxon'], {
      unique: true,
      name: 'idx_collections_taxon'
    });

    console.log('Reverted to original taxon-only unique constraint');
  }
};
