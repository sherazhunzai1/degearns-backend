'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create LuckyDraws table
    await queryInterface.createTable('LuckyDraws', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      month: {
        type: Sequelize.STRING(7),
        allowNull: false,
        unique: true,
        comment: 'Month of the lucky draw in YYYY-MM format'
      },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'cancelled'),
        defaultValue: 'active',
        comment: 'Status of the lucky draw'
      },
      winnerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address of the winner'
      },
      winningParticipantId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of the winning participant entry'
      },
      prizeDescription: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Description of the prize'
      },
      prizeAmount: {
        type: Sequelize.DECIMAL(20, 6),
        allowNull: true,
        comment: 'Prize amount (if applicable)'
      },
      prizeCurrency: {
        type: Sequelize.STRING(10),
        defaultValue: 'XRP',
        comment: 'Currency of the prize'
      },
      totalParticipants: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total number of participants'
      },
      drawnAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the winner was drawn'
      },
      drawnBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Admin wallet who drew the winner'
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

    // Create LuckyDrawParticipants table
    await queryInterface.createTable('LuckyDrawParticipants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      luckyDrawId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'LuckyDraws',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the participant'
      },
      nftTokenId: {
        type: Sequelize.STRING(64),
        allowNull: false,
        comment: 'NFT token ID that was purchased'
      },
      purchasePrice: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Purchase price in drops'
      },
      purchaseCurrency: {
        type: Sequelize.STRING(10),
        defaultValue: 'XRP',
        comment: 'Currency used for purchase'
      },
      transactionHash: {
        type: Sequelize.STRING(64),
        allowNull: true,
        comment: 'XRPL transaction hash of the purchase'
      },
      purchasedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the NFT was purchased'
      },
      isWinner: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this participant won the draw'
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
    await queryInterface.addIndex('LuckyDraws', ['month'], {
      unique: true,
      name: 'idx_lucky_draw_month'
    });

    await queryInterface.addIndex('LuckyDraws', ['status'], {
      name: 'idx_lucky_draw_status'
    });

    await queryInterface.addIndex('LuckyDrawParticipants', ['luckyDrawId'], {
      name: 'idx_participant_lucky_draw'
    });

    await queryInterface.addIndex('LuckyDrawParticipants', ['userWalletAddress'], {
      name: 'idx_participant_wallet'
    });

    await queryInterface.addIndex('LuckyDrawParticipants', ['luckyDrawId', 'userWalletAddress'], {
      name: 'idx_participant_draw_wallet'
    });

    await queryInterface.addIndex('LuckyDrawParticipants', ['nftTokenId'], {
      name: 'idx_participant_nft'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('LuckyDrawParticipants');
    await queryInterface.dropTable('LuckyDraws');
  }
};
