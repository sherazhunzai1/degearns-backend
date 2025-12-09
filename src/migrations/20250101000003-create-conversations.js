'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Conversations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      participant1WalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'First participant wallet address',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      participant2WalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Second participant wallet address',
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      lastMessageAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of the last message'
      },
      lastMessagePreview: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Preview of the last message'
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

    // Add unique constraint on participants (to prevent duplicate conversations)
    await queryInterface.addIndex('Conversations', ['participant1WalletAddress', 'participant2WalletAddress'], {
      name: 'unique_conversation_participants',
      unique: true
    });

    // Add indexes for efficient lookups
    await queryInterface.addIndex('Conversations', ['participant1WalletAddress'], {
      name: 'idx_conversation_participant1'
    });

    await queryInterface.addIndex('Conversations', ['participant2WalletAddress'], {
      name: 'idx_conversation_participant2'
    });

    await queryInterface.addIndex('Conversations', ['lastMessageAt'], {
      name: 'idx_conversation_last_message'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Conversations');
  }
};
