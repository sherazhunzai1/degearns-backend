'use strict';

/**
 * Migration to add 'subscriptions' and 'rewards' to AdminWallets type ENUM
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // For MySQL, we need to alter the ENUM to add the new values
    await queryInterface.sequelize.query(`
      ALTER TABLE AdminWallets
      MODIFY COLUMN type ENUM('platformFees', 'royalties', 'marketplace', 'treasury', 'subscriptions', 'rewards', 'other') NOT NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert back to original ENUM (without 'subscriptions' and 'rewards')
    // Note: This will fail if any rows have 'subscriptions' or 'rewards' type
    await queryInterface.sequelize.query(`
      ALTER TABLE AdminWallets
      MODIFY COLUMN type ENUM('platformFees', 'royalties', 'marketplace', 'treasury', 'other') NOT NULL
    `);
  }
};
