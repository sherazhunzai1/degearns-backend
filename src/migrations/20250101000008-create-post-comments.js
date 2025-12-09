'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PostComments', {
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
      authorWalletAddress: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      parentCommentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'PostComments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      likesCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      repliesCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isEdited: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('PostComments', ['postId'], {
      name: 'idx_postcomment_post'
    });
    await queryInterface.addIndex('PostComments', ['authorWalletAddress'], {
      name: 'idx_postcomment_author'
    });
    await queryInterface.addIndex('PostComments', ['parentCommentId'], {
      name: 'idx_postcomment_parent'
    });
    await queryInterface.addIndex('PostComments', ['postId', 'createdAt'], {
      name: 'idx_postcomment_post_created'
    });
    await queryInterface.addIndex('PostComments', ['isActive'], {
      name: 'idx_postcomment_active'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PostComments');
  }
};
