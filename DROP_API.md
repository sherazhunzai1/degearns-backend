# NFT Drop System API Documentation

## Overview

The NFT Drop System allows creators to schedule NFT drops with pre-uploaded metadata, configurable pricing, allowlists, and minting windows. Users can mint NFTs from active drops according to the schedule set by the owner.

**Important**:
- The backend manages drop configurations and records mints, but the actual XRPL blockchain minting operations are handled by the frontend
- This allows users to mint NFTs directly from their wallets
- The drop system is completely independent from the Collections table - no foreign key constraints

## Features

- **Pre-Uploaded NFTs**: Bulk upload NFT metadata before creating drops
- **Scheduled Drops**: Set start and end dates for minting periods
- **Price Control**: Set fixed minting prices in XRP
- **Allowlist Support**: Create public drops or allowlist-only drops
- **Supply Management**: Automatic supply calculation from uploaded NFTs
- **Wallet Limits**: Optional maximum mints per wallet
- **Status Tracking**: Automatic status updates (upcoming, active, ended, soldout)
- **Minting Validation**: Comprehensive checks before allowing mints

## Database Schema

### Drops Table
- `id`: UUID (primary key)
- `collectionId`: STRING(100) - Collection identifier (no FK constraint)
- `collectionName`: STRING(200) - Collection name
- `taxon`: INTEGER - XRPL NFT Taxon
- `name`: STRING - Drop name
- `description`: TEXT - Drop description
- `price`: STRING - Minting price in XRP
- `totalSupply`: INTEGER - Total NFTs in drop (auto-calculated from uploaded NFTs)
- `mintedCount`: INTEGER - Number of NFTs minted
- `startDate`: DATETIME - When minting starts
- `endDate`: DATETIME - When minting ends
- `status`: ENUM - 'upcoming', 'active', 'ended', 'soldout'
- `creatorWalletAddress`: STRING - Wallet address of drop creator
- `isPublic`: BOOLEAN - Whether drop is public or allowlist-only
- `allowlist`: JSON - Array of wallet addresses allowed to mint (null if public)
- `transferFee`: INTEGER - XRPL transfer fee (0-50000 basis points)
- `flags`: INTEGER - XRPL NFT flags (8=Transferable)
- `maxMintsPerWallet`: INTEGER - Max mints per wallet (null=unlimited)

### DropNFTs Table
- `id`: UUID (primary key)
- `collectionId`: STRING(100) - Collection identifier (no FK constraint)
- `dropId`: UUID - Reference to Drop (null until assigned to a drop)
- `metadataUri`: STRING - IPFS URI for NFT metadata
- `metadata`: JSON - Cached NFT metadata (name, description, image, attributes)
- `nftokenId`: STRING (unique) - XRPL NFToken ID after minting
- `mintedBy`: STRING - Wallet address of minter
- `mintedAt`: DATETIME - When this NFT was minted
- `transactionHash`: STRING - XRPL transaction hash
- `isMinted`: BOOLEAN - Whether this NFT has been minted
- `mintNumber`: INTEGER - Sequential mint number (#1, #2, etc.)

## API Endpoints

### 1. Bulk Upload NFTs

**Endpoint**: `POST /api/v1/drops/bulk-upload-nfts`

**Authentication**: Wallet address in request body

**Description**: Bulk upload NFT metadata to be used in drops. NFTs are stored with dropId=null until assigned to a drop.

**Request Body**:
```json
{
  "creatorWalletAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "collectionId": "my-collection-123",
  "nfts": [
    {
      "metadataUri": "ipfs://QmHash1...",
      "metadata": {
        "name": "Cool NFT #1",
        "description": "First NFT",
        "image": "ipfs://QmImageHash1...",
        "attributes": [
          {
            "trait_type": "Rarity",
            "value": "Common"
          }
        ]
      }
    },
    {
      "metadataUri": "ipfs://QmHash2...",
      "metadata": {
        "name": "Cool NFT #2",
        "description": "Second NFT",
        "image": "ipfs://QmImageHash2...",
        "attributes": [
          {
            "trait_type": "Rarity",
            "value": "Rare"
          }
        ]
      }
    }
  ]
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid1",
      "collectionId": "my-collection-123",
      "dropId": null,
      "metadataUri": "ipfs://QmHash1...",
      "metadata": {...},
      "isMinted": false,
      "createdAt": "2025-12-04T..."
    },
    {
      "id": "uuid2",
      "collectionId": "my-collection-123",
      "dropId": null,
      "metadataUri": "ipfs://QmHash2...",
      "metadata": {...},
      "isMinted": false,
      "createdAt": "2025-12-04T..."
    }
  ],
  "message": "Successfully uploaded 2 NFTs"
}
```

---

### 2. Create Drop

**Endpoint**: `POST /api/v1/drops`

**Authentication**: Wallet address in request body

**Description**: Create a new NFT drop. Automatically assigns all available (non-assigned, non-minted) DropNFTs for the collectionId to this drop. TotalSupply is auto-calculated from available NFTs.

**Request Body**:
```json
{
  "creatorWalletAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "collectionId": "my-collection-123",
  "collectionName": "Cool NFT Collection",
  "taxon": 12345,
  "name": "Genesis Drop",
  "description": "Limited edition genesis collection",
  "price": "10",
  "startDate": "2025-12-10T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "transferFee": 1000,
  "flags": 8,
  "maxMintsPerWallet": 5,
  "isPublic": false,
  "allowlist": [
    "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
    "rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY"
  ]
}
```

**Field Details**:
- `collectionId` (optional): Any string identifier for the collection
- `collectionName` (optional): Name of the collection
- `taxon` (optional): XRPL NFT Taxon number
- `isPublic` (optional): true for public drop, false for allowlist-only (default: true)
- `allowlist` (optional): Array of wallet addresses allowed to mint (required if isPublic=false)

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "collectionId": "my-collection-123",
    "collectionName": "Cool NFT Collection",
    "taxon": 12345,
    "name": "Genesis Drop",
    "status": "upcoming",
    "totalSupply": 100,
    "mintedCount": 0,
    "isPublic": false,
    "allowlist": ["rN7n7...", "rPEPPER7..."],
    ...
  }
}
```

**Notes**:
- Requires pre-uploaded NFTs via /bulk-upload-nfts endpoint
- Will fail if no NFTs available for the collectionId
- TotalSupply is automatically set to the count of available NFTs

---

### 3. Get All Drops

**Endpoint**: `GET /api/v1/drops`

**Authentication**: Not required

**Query Parameters**:
- `status` - Filter by status (upcoming, active, ended, soldout)
- `collectionId` - Filter by collection
- `creatorWalletAddress` - Filter by creator
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)
- `sortBy` - Sort field (default: createdAt)
- `sortOrder` - Sort order (ASC/DESC, default: DESC)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "drops": [
      {
        "id": "uuid",
        "name": "Genesis Drop",
        "collectionId": "my-collection-123",
        "collectionName": "Cool NFT Collection",
        "status": "active",
        "totalSupply": 100,
        "mintedCount": 42,
        "isPublic": false,
        "creator": {
          "walletAddress": "rN7n7...",
          "username": "creator",
          "profileImage": "https://..."
        },
        ...
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

### 4. Get Single Drop

**Endpoint**: `GET /api/v1/drops/:id`

**Authentication**: Not required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Genesis Drop",
    "collectionId": "my-collection-123",
    "collectionName": "Cool NFT Collection",
    "taxon": 12345,
    "isPublic": false,
    "allowlist": ["rN7n7...", "rPEPPER7..."],
    "creator": {
      "walletAddress": "rN7n7...",
      "username": "creator",
      "profileImage": "https://..."
    },
    "mints": [...],
    ...
  }
}
```

---

### 5. Update Drop

**Endpoint**: `PUT /api/v1/drops/:id`

**Authentication**: Wallet address in request body (owner only)

**Request Body** (all fields optional):
```json
{
  "walletAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "name": "Updated Drop Name",
  "description": "Updated description",
  "price": "15",
  "startDate": "2025-12-11T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "maxMintsPerWallet": 10
}
```

**Notes**:
- Cannot update ended or sold out drops
- Cannot reduce totalSupply below current mintedCount

**Response**: `200 OK`

---

### 6. Delete Drop

**Endpoint**: `DELETE /api/v1/drops/:id?walletAddress=rN7n7...`

**Authentication**: Wallet address in query parameter (owner only)

**Query Parameters**:
- `walletAddress` (required): Wallet address of the drop creator

**Notes**:
- Can only delete drops with no minted NFTs
- Unassigns all DropNFTs (sets dropId back to null) for potential reuse

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Drop deleted successfully"
}
```

---

### 7. Get Mint Metadata

**Endpoint**: `GET /api/v1/drops/:id/mint-metadata?walletAddress=rN7n7...`

**Authentication**: Wallet address optional in query parameter

**Description**: Get metadata and XRPL parameters for the next available unminted NFT in the drop

**Query Parameters**:
- `walletAddress` (optional, required for allowlist drops): User's wallet address

**Process**:
1. Validates drop is active and mintable
2. Checks allowlist if drop is not public
3. Checks supply availability
4. Validates wallet mint limit (if set and user provided)
5. Returns ONE unminted DropNFT metadata with mint number and XRPL parameters

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "dropId": "uuid",
    "dropName": "Genesis Drop",
    "mintNumber": 42,
    "metadata": {
      "name": "Cool NFT #5",
      "description": "Fifth NFT",
      "image": "ipfs://QmImageHash5...",
      "attributes": [
        {
          "trait_type": "Rarity",
          "value": "Common"
        },
        {
          "trait_type": "Mint Number",
          "value": 42
        },
        {
          "trait_type": "Drop",
          "value": "Genesis Drop"
        }
      ]
    },
    "metadataUri": "ipfs://QmHash5...",
    "taxon": 12345,
    "transferFee": 1000,
    "flags": 8,
    "price": "10",
    "collectionName": "Cool NFT Collection",
    "collectionId": "my-collection-123"
  }
}
```

**Frontend Usage**:
Frontend should:
1. Call this endpoint to get metadata and parameters
2. Use the returned metadataUri directly (already on IPFS)
3. Use returned parameters to mint NFT on XRPL
4. Call the record mint endpoint with the result

---

### 8. Record NFT Mint

**Endpoint**: `POST /api/v1/drops/:id/mint`

**Authentication**: Wallet address in request body

**Description**: Record an NFT mint after the frontend has minted on XRPL. Updates the DropNFT record with mint details.

**Request Body**:
```json
{
  "minterWalletAddress": "rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY",
  "nftokenId": "00080000...",
  "transactionHash": "ABC123...",
  "metadataUri": "ipfs://QmHash5..."
}
```

**Process**:
1. Validates drop is active and mintable
2. Checks allowlist if drop is not public
3. Checks supply availability
4. Validates wallet mint limit (if set)
5. Checks NFT not already recorded
6. Finds the DropNFT by metadataUri
7. Updates DropNFT with mint details
8. Updates drop minted count
9. Updates status if sold out

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "mint": {
      "id": "uuid",
      "dropId": "uuid",
      "minterWalletAddress": "rPEPPER7...",
      "nftokenId": "00080000...",
      "transactionHash": "ABC123...",
      "mintNumber": 42,
      "metadataUri": "ipfs://QmHash5..."
    },
    "mintNumber": 42,
    "drop": {
      "id": "uuid",
      "name": "Genesis Drop",
      "mintedCount": 42,
      "totalSupply": 100,
      "status": "active"
    }
  },
  "message": "NFT mint recorded successfully"
}
```

**Notes**:
- Frontend must mint the NFT on XRPL first
- This endpoint only records the mint that already happened
- Prevents double-recording with nftokenId uniqueness check

---

### 9. Get Drop Mints

**Endpoint**: `GET /api/v1/drops/:id/mints`

**Authentication**: Not required

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "mints": [
      {
        "id": "uuid",
        "nftokenId": "000...",
        "transactionHash": "ABC...",
        "mintNumber": 1,
        "metadataUri": "ipfs://...",
        "minter": {
          "walletAddress": "rPEPPER7...",
          "username": "user1",
          "profileImage": "https://..."
        },
        "mintedAt": "2025-12-10T12:00:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

---

### 10. Get My Mints

**Endpoint**: `GET /api/v1/drops/my-mints?walletAddress=rN7n7...`

**Authentication**: Wallet address in query parameter (required)

**Query Parameters**:
- `walletAddress` (required): User's wallet address
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

**Description**: Get all NFTs minted by a specific wallet from all drops

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "mints": [
      {
        "id": "uuid",
        "nftokenId": "000...",
        "metadataUri": "ipfs://...",
        "metadata": {...},
        "mintNumber": 5,
        "mintedAt": "2025-12-10T12:00:00Z",
        "drop": {
          "id": "uuid",
          "name": "Genesis Drop",
          "collectionId": "my-collection-123",
          "collectionName": "Cool NFT Collection",
          "status": "active"
        }
      }
    ],
    "pagination": {...}
  }
}
```

---

### 11. Check Can Mint

**Endpoint**: `GET /api/v1/drops/:id/can-mint?walletAddress=rN7n7...`

**Authentication**: Wallet address optional in query parameter

**Query Parameters**:
- `walletAddress` (optional, required for accurate allowlist/limit checks): User's wallet address

**Description**: Check if a drop is mintable and if a specific user can mint

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "canMint": true,
    "status": "active",
    "remaining": 58,
    "userMintCount": 2,
    "maxMintsPerWallet": 5,
    "isPublic": false,
    "reason": null
  }
}
```

If cannot mint:
```json
{
  "success": true,
  "data": {
    "canMint": false,
    "status": "active",
    "remaining": 100,
    "userMintCount": 0,
    "maxMintsPerWallet": 5,
    "isPublic": false,
    "reason": ["You are not on the allowlist for this drop"]
  }
}
```

**Possible Reasons**:
- "Drop has not started yet"
- "Drop has ended"
- "Drop is sold out"
- "You are not on the allowlist for this drop"
- "Wallet address is required for allowlist drops"
- "Maximum X mints per wallet reached"

---

## Status Flow

```
upcoming → active → ended
              ↓
           soldout
```

- **upcoming**: Current time < startDate
- **active**: startDate ≤ current time ≤ endDate AND mintedCount < totalSupply
- **ended**: Current time > endDate
- **soldout**: mintedCount ≥ totalSupply

Status is automatically updated when drops are accessed.

---

## Complete Workflow

### Step 1: Upload NFTs to IPFS (External)

Upload all NFT images and metadata to IPFS externally. Get IPFS URIs for each.

### Step 2: Bulk Upload NFT Metadata

```bash
POST /api/v1/drops/bulk-upload-nfts
{
  "creatorWalletAddress": "rN7n7...",
  "collectionId": "my-collection-123",
  "nfts": [
    {
      "metadataUri": "ipfs://QmHash1...",
      "metadata": {...}
    },
    ...
  ]
}
```

### Step 3: Create Drop

```bash
POST /api/v1/drops
{
  "creatorWalletAddress": "rN7n7...",
  "collectionId": "my-collection-123",
  "collectionName": "Cool NFT Collection",
  "taxon": 12345,
  "name": "Genesis Drop",
  "price": "10",
  "startDate": "2025-12-10T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "isPublic": false,
  "allowlist": ["rN7n7...", "rPEPPER7..."]
}
```

### Step 4: Users Mint

#### 4a. Check Eligibility
```bash
GET /api/v1/drops/:id/can-mint?walletAddress=rPEPPER7...
```

#### 4b. Get Mint Metadata
```bash
GET /api/v1/drops/:id/mint-metadata?walletAddress=rPEPPER7...
```

#### 4c. Frontend Mints on XRPL
```javascript
// Frontend code (using XRPL.js)
import { Client, Wallet, convertStringToHex } from 'xrpl';

const client = new Client('wss://xrplcluster.com');
await client.connect();

const wallet = Wallet.fromSeed(userWalletSeed);
const mintTx = {
  TransactionType: 'NFTokenMint',
  Account: wallet.address,
  URI: convertStringToHex(metadataUri), // from mint-metadata response
  Flags: 8, // from mint-metadata response
  TransferFee: 1000, // from mint-metadata response
  NFTokenTaxon: 12345 // from mint-metadata response
};

const prepared = await client.autofill(mintTx);
const signed = wallet.sign(prepared);
const result = await client.submitAndWait(signed.tx_blob);

const nftokenId = extractNFTokenID(result.result.meta);
const transactionHash = result.result.hash;
```

#### 4d. Record Mint
```bash
POST /api/v1/drops/:id/mint
{
  "minterWalletAddress": "rPEPPER7...",
  "nftokenId": "00080000...",
  "transactionHash": "ABC123...",
  "metadataUri": "ipfs://QmHash5..."
}
```

---

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "status": 400,
    "message": "Error message here"
  }
}
```

Common error codes:
- `400` - Bad Request (validation errors, drop not mintable)
- `403` - Forbidden (not the owner, not on allowlist)
- `404` - Not Found (drop/resource not found)
- `500` - Internal Server Error

---

## Database Migration

To create the required database tables, run:

```bash
npm run db:migrate
```

This will execute:
- `20250101000003-create-drops.js`
- `20250101000005-create-drop-nfts.js`
- `20250101000006-update-drops-for-allowlist.js`

---

## Testing

Example test flow:
1. Upload NFTs to IPFS externally
2. Bulk upload NFT metadata via API
3. Create a drop for those NFTs
4. Query drops to see your drop
5. Check can-mint status
6. Get mint metadata
7. Mint NFT on XRPL (via frontend)
8. Record the mint via API
9. View mints for the drop
10. Check your mints

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/sherazhunzai1/degearns-backend/issues
- Documentation: See main README.md
