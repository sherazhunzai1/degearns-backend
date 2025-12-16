'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add taxonId column
    await queryInterface.addColumn('Drops', 'taxonId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Taxon ID for NFT minting on XRPL'
    });

    // Add social links columns
    await queryInterface.addColumn('Drops', 'websiteUrl', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Project website URL'
    });

    await queryInterface.addColumn('Drops', 'twitterUrl', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Twitter/X profile URL'
    });

    await queryInterface.addColumn('Drops', 'discordUrl', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Discord server URL'
    });

    await queryInterface.addColumn('Drops', 'telegramUrl', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Telegram group URL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Drops', 'telegramUrl');
    await queryInterface.removeColumn('Drops', 'discordUrl');
    await queryInterface.removeColumn('Drops', 'twitterUrl');
    await queryInterface.removeColumn('Drops', 'websiteUrl');
    await queryInterface.removeColumn('Drops', 'taxonId');
  }
};
