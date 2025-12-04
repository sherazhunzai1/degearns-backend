'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns for allowlist functionality
    await queryInterface.addColumn('Drops', 'isPublic', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether drop is public or allowlist-only'
    });

    await queryInterface.addColumn('Drops', 'allowlist', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Array of wallet addresses allowed to mint (null if public)'
    });

    // Remove nftMetadata column as NFTs are pre-uploaded
    await queryInterface.removeColumn('Drops', 'nftMetadata');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Drops', 'isPublic');
    await queryInterface.removeColumn('Drops', 'allowlist');

    // Add back nftMetadata
    await queryInterface.addColumn('Drops', 'nftMetadata', {
      type: Sequelize.JSON,
      allowNull: false,
      comment: 'Base metadata for NFTs in this drop'
    });
  }
};
