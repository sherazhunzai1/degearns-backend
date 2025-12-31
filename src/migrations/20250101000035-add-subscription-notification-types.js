'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update the notification type ENUM to include subscription types
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN type ENUM(
        'like',
        'comment',
        'comment_reply',
        'follow',
        'nft_listing',
        'nft_purchase',
        'drop_launch',
        'drop_mint',
        'drop_allowlist',
        'subscription_created',
        'subscription_upgraded',
        'subscription_cancelled',
        'subscription_expiring',
        'subscription_expired'
      ) NOT NULL
    `);

    // Update the relatedEntityType ENUM to include subscription
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN relatedEntityType ENUM(
        'post',
        'comment',
        'follow',
        'collection',
        'nft',
        'drop',
        'subscription'
      )
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert notification type ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN type ENUM(
        'like',
        'comment',
        'comment_reply',
        'follow',
        'nft_listing',
        'nft_purchase',
        'drop_launch',
        'drop_mint',
        'drop_allowlist'
      ) NOT NULL
    `);

    // Revert relatedEntityType ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN relatedEntityType ENUM(
        'post',
        'comment',
        'follow',
        'collection',
        'nft',
        'drop'
      )
    `);
  }
};
