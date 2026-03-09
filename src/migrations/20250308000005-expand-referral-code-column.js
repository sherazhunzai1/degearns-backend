'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Users', 'referralCode', {
      type: Sequelize.STRING(100),
      unique: true,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Users', 'referralCode', {
      type: Sequelize.STRING(20),
      unique: true,
      allowNull: true
    });
  }
};
