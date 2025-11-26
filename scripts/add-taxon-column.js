/**
 * Script to add the taxon column to the Collections table
 * This is needed for XRPL integration
 *
 * Run this script with: node scripts/add-taxon-column.js
 */

const { sequelize } = require('../src/models');

async function addTaxonColumn() {
  try {
    console.log('Connecting to database...');

    // Check if the column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Collections'
        AND COLUMN_NAME = 'taxon'
    `);

    if (results.length > 0) {
      console.log('✓ Column "taxon" already exists in Collections table');
      process.exit(0);
    }

    console.log('Adding taxon column to Collections table...');

    // Add the taxon column
    await sequelize.query(`
      ALTER TABLE Collections
      ADD COLUMN taxon INT NOT NULL UNIQUE COMMENT 'XRPL NFToken Taxon - unique identifier to query NFTs from XRPL'
    `);

    console.log('✓ Column "taxon" added successfully');

    // Add index (it might already exist from UNIQUE constraint, but let's make sure)
    try {
      await sequelize.query(`
        CREATE UNIQUE INDEX idx_collections_taxon ON Collections(taxon)
      `);
      console.log('✓ Index "idx_collections_taxon" added successfully');
    } catch (indexError) {
      if (indexError.message.includes('Duplicate key name')) {
        console.log('✓ Index "idx_collections_taxon" already exists');
      } else {
        console.warn('⚠ Warning: Could not create index:', indexError.message);
      }
    }

    // Verify the column was added
    const [columns] = await sequelize.query(`
      DESCRIBE Collections
    `);

    console.log('\n✓ Migration completed successfully!');
    console.log('\nCollections table structure:');
    console.table(columns);

    process.exit(0);
  } catch (error) {
    console.error('✗ Error adding taxon column:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the migration
addTaxonColumn();
