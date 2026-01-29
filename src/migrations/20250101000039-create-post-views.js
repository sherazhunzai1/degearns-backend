'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PostViews', {
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
        onDelete: 'CASCADE',
        comment: 'Reference to the post'
      },
      userWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Wallet address of the user who viewed'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('PostViews', ['postId', 'userWalletAddress'], {
      unique: true,
      name: 'unique_post_view'
    });

    await queryInterface.addIndex('PostViews', ['postId'], {
      name: 'idx_postview_post'
    });

    await queryInterface.addIndex('PostViews', ['userWalletAddress'], {
      name: 'idx_postview_user'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PostViews');
  }
};
