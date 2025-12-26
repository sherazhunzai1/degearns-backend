'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ActivityLogs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        references: {
          model: 'Users',
          key: 'walletAddress'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      activityType: {
        type: Sequelize.ENUM(
          'nft_buy',          // Bought an NFT
          'nft_sell',         // Sold an NFT
          'nft_mint',         // Minted from a drop
          'nft_list',         // Listed an NFT for sale
          'nft_delist',       // Removed listing
          'collection_create', // Created a collection
          'drop_create',      // Created a drop
          'post_create',      // Created a post
          'comment_create',   // Commented on a post
          'like_give',        // Liked a post
          'like_receive',     // Received a like
          'comment_receive',  // Received a comment
          'follow_give',      // Followed someone
          'follow_receive'    // Received a follower
        ),
        allowNull: false
      },
      // Related entity
      relatedId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of the related entity (NFT, post, user, etc.)'
      },
      relatedType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Type of related entity'
      },
      // Monetary value if applicable
      xrpAmount: {
        type: Sequelize.DECIMAL(30, 6),
        defaultValue: 0,
        comment: 'XRP amount involved in drops (if applicable)'
      },
      // Transaction reference
      transactionHash: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'XRPL transaction hash if applicable'
      },
      // Counterparty for trades
      counterpartyWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Other party in the transaction'
      },
      // Collection reference for trades
      collectionId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Collection ID for NFT activities'
      },
      // Additional data
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional activity-specific data'
      },
      // Scoring window
      scoringPeriodMonth: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Month this activity counts toward (1-12)'
      },
      scoringPeriodYear: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Year this activity counts toward'
      },
      // Whether this has been processed for scoring
      processedForScoring: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this activity has been counted in score calculation'
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
    await queryInterface.addIndex('ActivityLogs', ['userWalletAddress'], {
      name: 'idx_activity_user'
    });

    await queryInterface.addIndex('ActivityLogs', ['activityType'], {
      name: 'idx_activity_type'
    });

    await queryInterface.addIndex('ActivityLogs', ['createdAt'], {
      name: 'idx_activity_created'
    });

    await queryInterface.addIndex('ActivityLogs', ['scoringPeriodMonth', 'scoringPeriodYear'], {
      name: 'idx_activity_scoring_period'
    });

    await queryInterface.addIndex('ActivityLogs', ['processedForScoring'], {
      name: 'idx_activity_processed'
    });

    // Composite index for user activity queries
    await queryInterface.addIndex('ActivityLogs', ['userWalletAddress', 'activityType', 'createdAt'], {
      name: 'idx_activity_user_type_date'
    });

    // Index for trade tracking
    await queryInterface.addIndex('ActivityLogs', ['collectionId', 'activityType'], {
      name: 'idx_activity_collection'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ActivityLogs');
  }
};
