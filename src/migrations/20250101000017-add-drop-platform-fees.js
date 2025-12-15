'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add authorizedMinterWallet column
    await queryInterface.addColumn('Drops', 'authorizedMinterWallet', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Wallet address authorized to perform minting operations'
    });

    // Add platform fee columns
    await queryInterface.addColumn('Drops', 'platformFeePerNft', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: '30000', // 0.03 XRP in drops
      comment: 'Platform fee per NFT in drops (0.03 XRP = 30000 drops)'
    });

    await queryInterface.addColumn('Drops', 'setupFee', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: '3000000', // 3 XRP in drops
      comment: 'Setup fee for launching the drop (3 XRP = 3000000 drops)'
    });

    await queryInterface.addColumn('Drops', 'totalPlatformFees', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Total calculated platform fees (platformFeePerNft * totalSupply + setupFee)'
    });

    await queryInterface.addColumn('Drops', 'platformFeesTransactionHash', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Transaction hash for platform fees payment'
    });

    await queryInterface.addColumn('Drops', 'platformFeesStatus', {
      type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
      comment: 'Status of platform fees payment'
    });

    // Add revenue tracking
    await queryInterface.addColumn('Drops', 'totalRevenue', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: '0',
      comment: 'Total revenue from mints in drops'
    });

    // Add index for platformFeesStatus
    await queryInterface.addIndex('Drops', ['platformFeesStatus'], {
      name: 'idx_drops_platform_fees_status'
    });

    // Add index for authorizedMinterWallet
    await queryInterface.addIndex('Drops', ['authorizedMinterWallet'], {
      name: 'idx_drops_authorized_minter'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('Drops', 'idx_drops_platform_fees_status');
    await queryInterface.removeIndex('Drops', 'idx_drops_authorized_minter');

    // Remove columns
    await queryInterface.removeColumn('Drops', 'totalRevenue');
    await queryInterface.removeColumn('Drops', 'platformFeesStatus');
    await queryInterface.removeColumn('Drops', 'platformFeesTransactionHash');
    await queryInterface.removeColumn('Drops', 'totalPlatformFees');
    await queryInterface.removeColumn('Drops', 'setupFee');
    await queryInterface.removeColumn('Drops', 'platformFeePerNft');
    await queryInterface.removeColumn('Drops', 'authorizedMinterWallet');
  }
};
