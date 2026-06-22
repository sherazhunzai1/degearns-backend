'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SolanaWithdrawalOwners', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      walletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('SolanaWithdrawalOwners', ['isActive']);
    await queryInterface.addIndex('SolanaWithdrawalOwners', ['position']);

    // Seed Solana withdrawal owners
    // Note: Constantinos and Investor share the same wallet, so seeded as one entry
    await queryInterface.bulkInsert('SolanaWithdrawalOwners', [
      {
        id: queryInterface.sequelize.literal('UUID()'),
        name: 'Constantinos / Investor',
        walletAddress: '6p6z9ABYaAUcz2AckuMgy3B7ETL4p6TPdjvy9QogEhM6',
        position: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: queryInterface.sequelize.literal('UUID()'),
        name: 'Aristides',
        walletAddress: 'FTr48D1hxQ5dihnmwUaLbxwHvAUrhtZrHRWvFZZ6ZcSq',
        position: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SolanaWithdrawalOwners');
  }
};
