'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Drops', 'minterAuthorizationTxHash', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Transaction hash for minter authorization on XRPL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Drops', 'minterAuthorizationTxHash');
  }
};
