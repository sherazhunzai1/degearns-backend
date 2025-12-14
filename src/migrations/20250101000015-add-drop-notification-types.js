'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Alter the type ENUM to add new drop notification types
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN type ENUM('like', 'comment', 'comment_reply', 'follow', 'nft_listing', 'nft_purchase', 'drop_launch', 'drop_mint', 'drop_allowlist')
    `);

    // Also update relatedEntityType ENUM to include 'drop'
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN relatedEntityType ENUM('post', 'comment', 'follow', 'collection', 'nft', 'drop')
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to original ENUMs
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN type ENUM('like', 'comment', 'comment_reply', 'follow', 'nft_listing', 'nft_purchase')
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN relatedEntityType ENUM('post', 'comment', 'follow', 'collection', 'nft')
    `);
  }
};
