'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Get current columns in Drops table
      const dropsTableInfo = await queryInterface.describeTable('Drops');

      // Add collectionId if it doesn't exist
      if (!dropsTableInfo.collectionId) {
        await queryInterface.addColumn('Drops', 'collectionId', {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Collection identifier (no FK constraint)'
        }, { transaction });
      }

      // Add collectionName if it doesn't exist
      if (!dropsTableInfo.collectionName) {
        await queryInterface.addColumn('Drops', 'collectionName', {
          type: Sequelize.STRING(200),
          allowNull: true,
          comment: 'Collection name'
        }, { transaction });
      }

      // Add taxon if it doesn't exist
      if (!dropsTableInfo.taxon) {
        await queryInterface.addColumn('Drops', 'taxon', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'XRPL NFT Taxon'
        }, { transaction });
      }

      // Add isPublic if it doesn't exist
      if (!dropsTableInfo.isPublic) {
        await queryInterface.addColumn('Drops', 'isPublic', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false,
          comment: 'Whether drop is public or allowlist-only'
        }, { transaction });
      }

      // Add allowlist if it doesn't exist
      if (!dropsTableInfo.allowlist) {
        await queryInterface.addColumn('Drops', 'allowlist', {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Array of wallet addresses allowed to mint (null if public)'
        }, { transaction });
      }

      // Remove nftMetadata if it exists (no longer needed)
      if (dropsTableInfo.nftMetadata) {
        await queryInterface.removeColumn('Drops', 'nftMetadata', { transaction });
      }

      await transaction.commit();
      console.log('✅ Successfully updated Drops table');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeColumn('Drops', 'collectionId', { transaction });
      await queryInterface.removeColumn('Drops', 'collectionName', { transaction });
      await queryInterface.removeColumn('Drops', 'taxon', { transaction });
      await queryInterface.removeColumn('Drops', 'isPublic', { transaction });
      await queryInterface.removeColumn('Drops', 'allowlist', { transaction });

      // Re-add nftMetadata
      await queryInterface.addColumn('Drops', 'nftMetadata', {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Base metadata for NFTs in this drop'
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
