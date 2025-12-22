'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Banners', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Banner title/headline'
      },
      subtitle: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Optional subtitle or description'
      },
      image: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Banner image URL'
      },
      link: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Optional link URL when banner is clicked'
      },
      linkText: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Text for the CTA button (e.g., "Learn More", "Shop Now")'
      },
      position: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Display order (lower numbers appear first)'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether the banner is currently active/visible'
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Optional start date for scheduled banners'
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Optional end date for scheduled banners'
      },
      createdBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address of admin who created this banner'
      },
      updatedBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Wallet address of admin who last updated this banner'
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
    await queryInterface.addIndex('Banners', ['isActive']);
    await queryInterface.addIndex('Banners', ['position']);
    await queryInterface.addIndex('Banners', ['startDate']);
    await queryInterface.addIndex('Banners', ['endDate']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Banners');
  }
};
