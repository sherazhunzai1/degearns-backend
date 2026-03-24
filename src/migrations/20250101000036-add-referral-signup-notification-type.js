'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update the notification type ENUM to include referral_signup
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
        'subscription_expired',
        'referral_signup'
      ) NOT NULL
    `);

    // Update the relatedEntityType ENUM to include referral
    await queryInterface.sequelize.query(`
      ALTER TABLE Notifications
      MODIFY COLUMN relatedEntityType ENUM(
        'post',
        'comment',
        'follow',
        'collection',
        'nft',
        'drop',
        'subscription',
        'referral'
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
        'drop_allowlist',
        'subscription_created',
        'subscription_upgraded',
        'subscription_cancelled',
        'subscription_expiring',
        'subscription_expired'
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
        'drop',
        'subscription'
      )
    `);
  }
};
