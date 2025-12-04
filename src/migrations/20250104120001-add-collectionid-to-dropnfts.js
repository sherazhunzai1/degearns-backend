'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Get current columns in DropNFTs table
      const dropNFTsTableInfo = await queryInterface.describeTable('DropNFTs');

      // Add collectionId if it doesn't exist
      if (!dropNFTsTableInfo.collectionId) {
        await queryInterface.addColumn('DropNFTs', 'collectionId', {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Collection identifier (no FK constraint)'
        }, { transaction });

        // Add index for collectionId
        await queryInterface.addIndex('DropNFTs', ['collectionId'], {
          name: 'idx_drop_nfts_collection',
          transaction
        });

        // Add composite index for collectionId and dropId
        await queryInterface.addIndex('DropNFTs', ['collectionId', 'dropId'], {
          name: 'idx_drop_nfts_collection_drop',
          transaction
        });

        console.log('✅ Successfully added collectionId to DropNFTs table');
      } else {
        console.log('ℹ️  collectionId already exists in DropNFTs table');
      }

      // Make dropId nullable if it isn't already
      if (dropNFTsTableInfo.dropId && dropNFTsTableInfo.dropId.allowNull === false) {
        await queryInterface.changeColumn('DropNFTs', 'dropId', {
          type: Sequelize.UUID,
          allowNull: true,
          comment: 'Reference to Drop (null until assigned to a drop)'
        }, { transaction });
        console.log('✅ Made dropId nullable in DropNFTs table');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes
      await queryInterface.removeIndex('DropNFTs', 'idx_drop_nfts_collection_drop', { transaction });
      await queryInterface.removeIndex('DropNFTs', 'idx_drop_nfts_collection', { transaction });

      // Remove column
      await queryInterface.removeColumn('DropNFTs', 'collectionId', { transaction });

      // Make dropId non-nullable again
      await queryInterface.changeColumn('DropNFTs', 'dropId', {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to Drop'
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
