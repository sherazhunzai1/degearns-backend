'use strict';

/**
 * Migration to add 'subscriptions' to AdminWallets type ENUM
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // For MySQL, we need to alter the ENUM to add the new value
    await queryInterface.sequelize.query(`
      ALTER TABLE AdminWallets
      MODIFY COLUMN type ENUM('platformFees', 'royalties', 'marketplace', 'treasury', 'subscriptions', 'other') NOT NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert back to original ENUM (without 'subscriptions')
    // Note: This will fail if any rows have 'subscriptions' type
    await queryInterface.sequelize.query(`
      ALTER TABLE AdminWallets
      MODIFY COLUMN type ENUM('platformFees', 'royalties', 'marketplace', 'treasury', 'other') NOT NULL
    `);
  }
};
