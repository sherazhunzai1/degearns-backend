'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('DropAllowedWallets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      dropId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to the drop',
        references: {
          model: 'Drops',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      walletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Allowed wallet address'
      },
      mintLimit: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Maximum NFTs this wallet can mint (null = uses drop default limit)'
      },
      mintedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of NFTs already minted by this wallet'
      },
      notes: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Optional notes about this allowed wallet'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('DropAllowedWallets', ['dropId'], {
      name: 'idx_drop_allowed_wallets_drop'
    });

    await queryInterface.addIndex('DropAllowedWallets', ['walletAddress'], {
      name: 'idx_drop_allowed_wallets_wallet'
    });

    await queryInterface.addIndex('DropAllowedWallets', ['dropId', 'walletAddress'], {
      name: 'idx_drop_allowed_wallet_unique',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('DropAllowedWallets');
  }
};
