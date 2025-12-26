'use strict';

/**
 * Migration: Add engagement metrics columns to UserStats
 *
 * These columns track "giving" activities:
 * - totalLikesGiven: Number of likes user has given to others' posts
 * - totalCommentsGiven: Number of comments user has made on others' posts
 * - totalFollowsGiven: Number of users the user has followed
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add totalLikesGiven column
    await queryInterface.addColumn('UserStats', 'totalLikesGiven', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Total likes given to others posts'
    });

    // Add totalCommentsGiven column
    await queryInterface.addColumn('UserStats', 'totalCommentsGiven', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Total comments made on others posts'
    });

    // Add totalFollowsGiven column
    await queryInterface.addColumn('UserStats', 'totalFollowsGiven', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Total users followed'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserStats', 'totalLikesGiven');
    await queryInterface.removeColumn('UserStats', 'totalCommentsGiven');
    await queryInterface.removeColumn('UserStats', 'totalFollowsGiven');
  }
};
