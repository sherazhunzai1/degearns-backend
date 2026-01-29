'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add isPinned field
    await queryInterface.addColumn('Posts', 'isPinned', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether the post is pinned to the top of user timeline'
    });

    // Add pinnedAt field
    await queryInterface.addColumn('Posts', 'pinnedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when the post was pinned'
    });

    // Add index for pinned posts
    await queryInterface.addIndex('Posts', ['authorWalletAddress', 'isPinned', 'pinnedAt'], {
      name: 'idx_post_author_pinned'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Posts', 'idx_post_author_pinned');
    await queryInterface.removeColumn('Posts', 'pinnedAt');
    await queryInterface.removeColumn('Posts', 'isPinned');
  }
};
