'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Follows', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      followerWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'The user who is following'
      },
      followingWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'The user being followed'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('Follows', ['followerWalletAddress', 'followingWalletAddress'], {
      unique: true,
      name: 'unique_follow'
    });
    await queryInterface.addIndex('Follows', ['followerWalletAddress'], {
      name: 'idx_follow_follower'
    });
    await queryInterface.addIndex('Follows', ['followingWalletAddress'], {
      name: 'idx_follow_following'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Follows');
  }
};
