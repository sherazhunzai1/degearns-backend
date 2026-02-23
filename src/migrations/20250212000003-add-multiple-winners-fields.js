'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add totalWinners to LuckyDraws
    await queryInterface.addColumn('LuckyDraws', 'totalWinners', {
      type: Sequelize.INTEGER,
      defaultValue: 10,
      comment: 'Number of winners to draw'
    });

    // Add winnerPosition to LuckyDrawParticipants
    await queryInterface.addColumn('LuckyDrawParticipants', 'winnerPosition', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Winner position (1-10), null if not a winner'
    });

    // Add index for winner position
    await queryInterface.addIndex('LuckyDrawParticipants', ['luckyDrawId', 'winnerPosition'], {
      name: 'idx_participant_winner_position'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('LuckyDrawParticipants', 'idx_participant_winner_position');
    await queryInterface.removeColumn('LuckyDrawParticipants', 'winnerPosition');
    await queryInterface.removeColumn('LuckyDraws', 'totalWinners');
  }
};
