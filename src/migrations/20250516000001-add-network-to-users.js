'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add network discriminator. Existing rows default to 'xrpl' so the
    // change is fully backward compatible.
    await queryInterface.addColumn('Users', 'network', {
      type: Sequelize.ENUM('xrpl', 'solana'),
      allowNull: false,
      defaultValue: 'xrpl',
      comment: 'Blockchain network the wallet belongs to'
    });

    await queryInterface.addIndex('Users', ['network'], {
      name: 'idx_user_network'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Users', 'idx_user_network');
    await queryInterface.removeColumn('Users', 'network');
  }
};
