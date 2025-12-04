'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('DropMints', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      dropId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to Drop',
        references: {
          model: 'Drops',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      minterWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the minter',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      nftokenId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'XRPL NFToken ID of minted NFT'
      },
      transactionHash: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'XRPL transaction hash'
      },
      mintNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Sequential mint number for this drop (e.g., #1, #2, #3)'
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
    await queryInterface.addIndex('DropMints', ['dropId'], {
      name: 'idx_drop_mints_drop'
    });

    await queryInterface.addIndex('DropMints', ['minterWalletAddress'], {
      name: 'idx_drop_mints_minter'
    });

    await queryInterface.addIndex('DropMints', ['nftokenId'], {
      name: 'idx_drop_mints_nftoken',
      unique: true
    });

    await queryInterface.addIndex('DropMints', ['dropId', 'minterWalletAddress'], {
      name: 'idx_drop_mints_drop_minter'
    });

    await queryInterface.addIndex('DropMints', ['createdAt'], {
      name: 'idx_drop_mints_created_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('DropMints');
  }
};
