'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserWallets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      walletAddress: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: false
      },
      network: {
        type: Sequelize.ENUM('xrpl', 'solana'),
        allowNull: false
      },
      isPrimary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      label: {
        type: Sequelize.STRING(50),
        allowNull: true
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

    await queryInterface.addIndex('UserWallets', ['userId'], { name: 'idx_user_wallet_user_id' });
    await queryInterface.addIndex('UserWallets', ['network'], { name: 'idx_user_wallet_network' });

    // Seed: insert the primary wallet for every existing user
    await queryInterface.sequelize.query(`
      INSERT INTO UserWallets (id, userId, walletAddress, network, isPrimary, createdAt, updatedAt)
      SELECT UUID(), id, walletAddress, network, true, NOW(), NOW()
      FROM Users
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('UserWallets');
  }
};
