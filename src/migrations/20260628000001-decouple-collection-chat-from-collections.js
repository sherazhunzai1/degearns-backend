'use strict';

/**
 * Decouple collection chat from the Collections table so chatrooms work for ANY
 * collection on-chain (Solana or XRPL), not just ones stored in our DB.
 *
 * - Drop the foreign key on CollectionChatMessages.collectionId -> Collections.id
 * - Change collectionId from UUID to STRING (holds a mint address or taxon)
 * - Add a nullable `network` discriminator
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the foreign key constraint (name is auto-generated, so look it up)
    const [fks] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'CollectionChatMessages'
        AND COLUMN_NAME = 'collectionId'
        AND REFERENCED_TABLE_NAME = 'Collections'
        AND TABLE_SCHEMA = DATABASE()
    `);
    for (const row of fks) {
      try {
        await queryInterface.removeConstraint('CollectionChatMessages', row.CONSTRAINT_NAME);
      } catch (e) {
        // ignore — constraint may already be gone
      }
    }

    // collectionId becomes a free-form on-chain identifier (mint address / taxon)
    await queryInterface.changeColumn('CollectionChatMessages', 'collectionId', {
      type: Sequelize.STRING(100),
      allowNull: false,
      comment: 'On-chain collection identifier — Solana mint address or XRPL taxon (no FK)'
    });

    await queryInterface.addColumn('CollectionChatMessages', 'network', {
      type: Sequelize.ENUM('xrpl', 'solana'),
      allowNull: true,
      after: 'collectionId',
      comment: 'Blockchain network of the collection this chatroom belongs to'
    });

    await queryInterface.addIndex('CollectionChatMessages', ['network'], { name: 'idx_colchat_network' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('CollectionChatMessages', 'idx_colchat_network');
    await queryInterface.removeColumn('CollectionChatMessages', 'network');

    await queryInterface.changeColumn('CollectionChatMessages', 'collectionId', {
      type: Sequelize.UUID,
      allowNull: false,
      comment: 'Reference to the collection this chatroom belongs to'
    });

    // Restore the foreign key
    await queryInterface.addConstraint('CollectionChatMessages', {
      fields: ['collectionId'],
      type: 'foreign key',
      name: 'CollectionChatMessages_ibfk_1',
      references: { table: 'Collections', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};
