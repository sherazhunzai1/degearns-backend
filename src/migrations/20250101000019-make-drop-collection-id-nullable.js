'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make collectionId nullable (Drop can be standalone)
    await queryInterface.changeColumn('Drops', 'collectionId', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Optional reference to existing collection (Drop can be standalone)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to required collectionId
    await queryInterface.changeColumn('Drops', 'collectionId', {
      type: Sequelize.UUID,
      allowNull: false,
      comment: 'Reference to the collection this drop belongs to'
    });
  }
};
