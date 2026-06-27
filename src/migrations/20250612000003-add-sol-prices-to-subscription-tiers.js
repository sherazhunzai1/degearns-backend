'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('SubscriptionTiers', 'monthlyPriceSol', {
      type: Sequelize.DECIMAL(10, 4),
      allowNull: true,
      after: 'yearlyPriceXrp',
      comment: 'Monthly price in SOL'
    });

    await queryInterface.addColumn('SubscriptionTiers', 'yearlyPriceSol', {
      type: Sequelize.DECIMAL(10, 4),
      allowNull: true,
      after: 'monthlyPriceSol',
      comment: 'Yearly price in SOL (discounted)'
    });

    // Set default SOL prices (approximate equivalent to XRP prices)
    // basic: 5 XRP/mo → ~0.015 SOL, pro: 15 XRP/mo → ~0.045 SOL, premium: 30 XRP/mo → ~0.09 SOL
    await queryInterface.sequelize.query(`
      UPDATE SubscriptionTiers SET monthlyPriceSol = 0.015, yearlyPriceSol = 0.15 WHERE name = 'basic';
    `);
    await queryInterface.sequelize.query(`
      UPDATE SubscriptionTiers SET monthlyPriceSol = 0.045, yearlyPriceSol = 0.45 WHERE name = 'pro';
    `);
    await queryInterface.sequelize.query(`
      UPDATE SubscriptionTiers SET monthlyPriceSol = 0.09, yearlyPriceSol = 0.90 WHERE name = 'premium';
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('SubscriptionTiers', 'yearlyPriceSol');
    await queryInterface.removeColumn('SubscriptionTiers', 'monthlyPriceSol');
  }
};
