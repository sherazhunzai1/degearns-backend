'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('AdminWallets', 'network', {
      type: Sequelize.ENUM('xrpl', 'solana'),
      allowNull: true,
      after: 'type',
      comment: 'Blockchain network for this wallet (null = both/legacy)'
    });

    // Drop old unique index and create new one with network
    try {
      await queryInterface.removeIndex('AdminWallets', 'idx_admin_wallet_active_type');
    } catch (e) {}

    await queryInterface.addIndex('AdminWallets', {
      fields: ['type', 'network', 'isActive'],
      name: 'idx_admin_wallet_type_network_active'
    });

    await queryInterface.addIndex('AdminWallets', ['network'], { name: 'idx_admin_wallet_network' });

    // Set existing wallets to 'xrpl' network
    await queryInterface.sequelize.query(`UPDATE AdminWallets SET network = 'xrpl' WHERE network IS NULL`);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('AdminWallets', 'idx_admin_wallet_network');
    await queryInterface.removeIndex('AdminWallets', 'idx_admin_wallet_type_network_active');
    await queryInterface.removeColumn('AdminWallets', 'network');

    // Restore old index
    await queryInterface.addIndex('AdminWallets', {
      unique: true,
      fields: ['type', 'isActive'],
      where: { isActive: true },
      name: 'idx_admin_wallet_active_type'
    });
  }
};
