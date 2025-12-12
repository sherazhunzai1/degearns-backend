'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Alter the ENUM column to add 'nft_purchase' type
    // MySQL requires recreating the ENUM with all values
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN type ENUM('like', 'comment', 'comment_reply', 'follow', 'nft_listing', 'nft_purchase')
      NOT NULL
      COMMENT 'Type of notification'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert by removing 'nft_purchase' from the ENUM
    // Note: This will fail if there are any records with type='nft_purchase'
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN type ENUM('like', 'comment', 'comment_reply', 'follow', 'nft_listing')
      NOT NULL
      COMMENT 'Type of notification'
    `);
  }
};
