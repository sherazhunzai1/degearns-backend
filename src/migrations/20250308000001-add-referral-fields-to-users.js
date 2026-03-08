'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'referralCode', {
      type: Sequelize.STRING(20),
      unique: true,
      allowNull: true,
      comment: 'Unique referral code for the user'
    });

    await queryInterface.addColumn('Users', 'referredBy', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Wallet address of the user who referred this user'
    });

    // Add index on referralCode for fast lookups
    await queryInterface.addIndex('Users', ['referralCode'], {
      unique: true,
      name: 'users_referral_code_unique'
    });

    // Add index on referredBy for counting referrals
    await queryInterface.addIndex('Users', ['referredBy'], {
      name: 'users_referred_by'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Users', 'users_referred_by');
    await queryInterface.removeIndex('Users', 'users_referral_code_unique');
    await queryInterface.removeColumn('Users', 'referredBy');
    await queryInterface.removeColumn('Users', 'referralCode');
  }
};
