'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add drawScheduledAt column
    await queryInterface.addColumn('LuckyDraws', 'drawScheduledAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Scheduled date/time for the live draw'
    });

    // Add isLiveDrawActive column
    await queryInterface.addColumn('LuckyDraws', 'isLiveDrawActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'Whether the live draw is currently in progress'
    });

    // Add index for scheduled draws
    await queryInterface.addIndex('LuckyDraws', ['drawScheduledAt'], {
      name: 'idx_lucky_draw_scheduled'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('LuckyDraws', 'idx_lucky_draw_scheduled');
    await queryInterface.removeColumn('LuckyDraws', 'isLiveDrawActive');
    await queryInterface.removeColumn('LuckyDraws', 'drawScheduledAt');
  }
};
