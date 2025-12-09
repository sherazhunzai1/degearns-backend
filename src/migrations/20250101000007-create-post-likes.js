'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PostLikes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      postId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Posts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('PostLikes', ['postId', 'userWalletAddress'], {
      unique: true,
      name: 'unique_post_like'
    });
    await queryInterface.addIndex('PostLikes', ['postId'], {
      name: 'idx_postlike_post'
    });
    await queryInterface.addIndex('PostLikes', ['userWalletAddress'], {
      name: 'idx_postlike_user'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PostLikes');
  }
};
