'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the old unique constraint on taxon alone
    // First, try to find and remove any existing unique index on taxon
    try {
      await queryInterface.removeIndex('Collections', 'collections_taxon');
    } catch (error) {
      console.log('Index collections_taxon does not exist, skipping removal');
    }

    try {
      await queryInterface.removeIndex('Collections', 'taxon');
    } catch (error) {
      console.log('Index taxon does not exist, skipping removal');
    }

    // Try removing by unique constraint name patterns
    try {
      await queryInterface.removeIndex('Collections', 'Collections_taxon_unique');
    } catch (error) {
      console.log('Index Collections_taxon_unique does not exist, skipping removal');
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
      name: 'collections_taxon'
    });

    console.log('Reverted to original taxon-only unique constraint');
  }
};
