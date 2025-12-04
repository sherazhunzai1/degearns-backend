# Drop System Implementation Guide

## Status: IN PROGRESS - Database Schema Complete

The database schema and models have been updated to support the correct drop workflow. Controller methods need to be updated.

## Correct Workflow

### Step 1: Upload NFT Metadata to IPFS (Owner)
Owner uploads all NFTs (images + metadata JSON) to IPFS externally, gets URIs for each NFT.

### Step 2: Bulk Upload Metadata to Backend (Owner)
```bash
POST /api/v1/drops/bulk-upload-nfts
Content-Type: application/json

{
  "creatorWalletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "collectionId": "uuid",
  "nfts": [
    {
      "metadataUri": "ipfs://QmHash1...",
      "metadata": {
        "name": "Cool NFT #1",
        "description": "First NFT in collection",
        "image": "ipfs://QmImage1...",
        "attributes": [...]
      }
    },
    {
      "metadataUri": "ipfs://QmHash2...",
      "metadata": {
        "name": "Cool NFT #2",
        "description": "Second NFT in collection",
        "image": "ipfs://QmImage2...",
        "attributes": [...]
      }
    }
    // ... more NFTs
  ]
}
```

Response: Returns array of created DropNFT records (not yet assigned to a drop, not yet minted).

### Step 3: Create Drop with Schedule (Owner)
```bash
POST /api/v1/drops
Content-Type: application/json

{
  "creatorWalletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "collectionId": "uuid",
  "name": "Genesis Drop",
  "description": "Limited genesis collection",
  "price": "10",
  "startDate": "2025-12-10T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "transferFee": 1000,
  "flags": 8,
  "maxMintsPerWallet": 5,
  "isPublic": true,
  "allowlist": null  // or ["rAddress1...", "rAddress2..."] for private drops
}
```

Note: `totalSupply` is automatically calculated from available DropNFTs for the collection.

### Step 4: User Mints (Frontend)
1. Call `GET /api/v1/drops/:id/can-mint` to check eligibility
2. Call `GET /api/v1/drops/:id/mint-metadata` to get an unminted NFT
3. Frontend mints on XRPL using returned metadata
4. Call `POST /api/v1/drops/:id/mint` with nftokenId and transactionHash

## Database Schema Changes

### New Table: DropNFTs
Stores pre-uploaded NFT metadata before drop creation and tracks minting status.

```sql
CREATE TABLE DropNFTs (
  id UUID PRIMARY KEY,
  dropId UUID NULL,  -- NULL until assigned to a drop
  metadataUri VARCHAR(500) NOT NULL,  -- IPFS URI
  metadata JSON NOT NULL,  -- Cached metadata
  nftokenId VARCHAR(100) NULL UNIQUE,  -- Set after minting
  mintedBy VARCHAR(100) NULL,  -- Minter wallet address
  mintedAt DATETIME NULL,  -- When minted
  transactionHash VARCHAR(100) NULL,  -- XRPL tx hash
  isMinted BOOLEAN DEFAULT FALSE,
  mintNumber INT NULL,  -- Sequential mint number
  createdAt DATETIME,
  updatedAt DATETIME
);
```

### Updated Table: Drops
- **Removed**: `nftMetadata` (JSON) - No longer needed
- **Added**: `isPublic` (BOOLEAN) - Public or allowlist-only
- **Added**: `allowlist` (JSON) - Array of allowed wallet addresses

## Controller Methods to Update

### 1. Add: bulkUploadNFTs()
```javascript
async bulkUploadNFTs(req, res, next) {
  // POST /api/drops/bulk-upload-nfts
  // Validates user owns collection
  // Creates DropNFT records with dropId=NULL
  // Returns created records
}
```

### 2. Update: createDrop()
```javascript
async createDrop(req, res, next) {
  // Remove nftMetadata requirement
  // Count available DropNFTs for collection (where dropId IS NULL)
  // Set totalSupply = count of available NFTs
  // Assign these DropNFTs to this drop (update dropId)
  // Validate dates, allowlist format
}
```

### 3. Update: getMintMetadata()
```javascript
async getMintMetadata(req, res, next) {
  // Check drop is mintable
  // Check user is allowed (allowlist validation)
  // Find ONE unminted DropNFT (isMinted=false, dropId=thisDropId)
  // Return its metadata and XRPL parameters
  // Optionally: temporarily "reserve" this NFT to prevent race conditions
}
```

### 4. Update: mintFromDrop()
```javascript
async mintFromDrop(req, res, next) {
  // Receives: nftokenId, transactionHash, metadataUri (to identify which DropNFT)
  // Find DropNFT by metadataUri
  // Validate it belongs to this drop and not yet minted
  // Update DropNFT: set nftokenId, mintedBy, mintedAt, transactionHash, isMinted=true, mintNumber
  // Increment drop.mintedCount
  // Update drop status if needed
}
```

### 5. Add: canMint() - Update allowlist check
```javascript
async canMint(req, res, next) {
  // Existing checks
  // Add: Check drop.isAllowed(walletAddress) for allowlist validation
}
```

## Routes to Add/Update

```javascript
// Add new route
router.post('/bulk-upload-nfts', authenticate, bulkUploadNFTs);

// Update existing routes - no changes needed to route definitions
// but controller logic changes as described above
```

## API Flow Example

### Owner Flow:
```bash
# 1. Upload NFTs to IPFS externally (using Pinata, NFT.Storage, etc.)

# 2. Store metadata in backend
POST /api/v1/drops/bulk-upload-nfts
{
  "creatorWalletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "collectionId": "uuid",
  "nfts": [ { "metadataUri": "ipfs://...", "metadata": {...} }, ... ]
}

# 3. Create drop
POST /api/v1/drops
{
  "creatorWalletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "collectionId": "uuid",
  "name": "Genesis Drop",
  "price": "10",
  "startDate": "2025-12-10T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "isPublic": false,
  "allowlist": ["rAddress1...", "rAddress2..."]
}
```

### User Flow:
```bash
# 1. Check if can mint
GET /api/v1/drops/:id/can-mint

# 2. Get NFT metadata for minting
GET /api/v1/drops/:id/mint-metadata
# Returns: { metadata: {...}, taxon, transferFee, flags, metadataUri }

# 3. Frontend mints on XRPL using metadata

# 4. Record mint
POST /api/v1/drops/:id/mint
{
  "minterWalletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "nftokenId": "00080000...",
  "transactionHash": "ABC123...",
  "metadataUri": "ipfs://QmHash..."  // to identify which DropNFT was minted
}
```

## Testing Checklist

- [ ] Run migrations: `npm run db:migrate`
- [ ] Test bulk upload endpoint
- [ ] Test create drop with uploaded NFTs
- [ ] Test public minting
- [ ] Test allowlist minting (should reject non-allowlisted users)
- [ ] Test getMintMetadata returns different NFT each time
- [ ] Test mintFromDrop records correctly
- [ ] Test drop status updates (soldout when all minted)
- [ ] Test maxMintsPerWallet enforcement

## Migration Order

1. `20250101000003-create-drops.js` (existing)
2. `20250101000004-create-drop-mints.js` (existing)
3. `20250101000005-create-drop-nfts.js` (NEW)
4. `20250101000006-update-drops-for-allowlist.js` (NEW)

## Notes

- DropMints table still exists for backward compatibility / historical tracking
- DropNFTs is the new source of truth for what's available to mint
- transferFee is the royalty percentage (already exists in Drop model)
- Allowlist is case-insensitive wallet address matching
- Each DropNFT can only be minted once (enforced by unique nftokenId)
