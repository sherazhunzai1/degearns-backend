-- Add taxon column to Collections table
-- This script adds the missing taxon column that is required for XRPL integration

ALTER TABLE Collections
ADD COLUMN taxon INT NOT NULL UNIQUE COMMENT 'XRPL NFToken Taxon - unique identifier to query NFTs from XRPL';

-- Add index for taxon column for better query performance
CREATE UNIQUE INDEX idx_collections_taxon ON Collections(taxon);

-- Verify the column was added
DESCRIBE Collections;
