'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'lastCoverImageUpdate', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp of the last cover image update for subscription-based rate limiting'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'lastCoverImageUpdate');
  }
};
