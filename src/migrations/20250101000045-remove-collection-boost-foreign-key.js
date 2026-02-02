'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove foreign key constraint from CollectionBoosts table
    await queryInterface.removeConstraint('CollectionBoosts', 'CollectionBoosts_ibfk_1');

    // Change collectionId to STRING to allow any collection identifier
    await queryInterface.changeColumn('CollectionBoosts', 'collectionId', {
      type: Sequelize.STRING(100),
      allowNull: false,
      comment: 'Collection identifier (independent, no foreign key)'
    });
  },

  async down(queryInterface, Sequelize) {
    // Change back to UUID
    await queryInterface.changeColumn('CollectionBoosts', 'collectionId', {
      type: Sequelize.UUID,
      allowNull: false,
      comment: 'Reference to the boosted collection'
    });

    // Re-add foreign key constraint
    await queryInterface.addConstraint('CollectionBoosts', {
      fields: ['collectionId'],
      type: 'foreign key',
      name: 'CollectionBoosts_ibfk_1',
      references: {
        table: 'Collections',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};
