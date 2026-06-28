'use strict';

/**
 * Facebook-style comment replies: 2-level flattened threads with @mentions.
 *
 * `parentCommentId` is the thread ROOT (top-level comment) for any reply; these new
 * columns record the specific comment/user a reply targets, so the UI can show
 * "replying to @username" even though all replies live flat under the root.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('PostComments', 'replyToCommentId', {
      type: Sequelize.UUID,
      allowNull: true,
      after: 'parentCommentId',
      comment: 'The specific comment this reply targets (for @mention); null for top-level comments'
    });

    await queryInterface.addColumn('PostComments', 'replyToWalletAddress', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'replyToCommentId',
      comment: 'Wallet of the user being replied to (for "replying to @username")'
    });

    await queryInterface.addIndex('PostComments', ['replyToCommentId'], { name: 'idx_postcomment_replyto' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('PostComments', 'idx_postcomment_replyto');
    await queryInterface.removeColumn('PostComments', 'replyToWalletAddress');
    await queryInterface.removeColumn('PostComments', 'replyToCommentId');
  }
};
