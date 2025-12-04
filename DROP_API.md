# NFT Drop System API Documentation

## Overview

The NFT Drop System allows collection creators to schedule NFT drops with configurable pricing, supply limits, and minting windows. Users can mint NFTs from active drops according to the schedule set by the owner.

**Important**: The backend manages drop configurations and records mints, but the actual XRPL blockchain minting operations are handled by the frontend. This allows users to mint NFTs directly from their wallets.

## Features

- **Scheduled Drops**: Set start and end dates for minting periods
- **Price Control**: Set fixed minting prices in XRP
- **Supply Management**: Define total supply and track minted count
- **Wallet Limits**: Optional maximum mints per wallet
- **Status Tracking**: Automatic status updates (upcoming, active, ended, soldout)
- **Minting Validation**: Comprehensive checks before allowing mints

## Database Schema

### Drops Table
- `id`: UUID (primary key)
- `collectionId`: UUID (foreign key to Collections)
- `name`: String - Drop name
- `description`: Text - Drop description
- `price`: String - Minting price in XRP
- `totalSupply`: Integer - Total NFTs in drop
- `mintedCount`: Integer - Number of NFTs minted
- `startDate`: DateTime - When minting starts
- `endDate`: DateTime - When minting ends
- `status`: Enum - 'upcoming', 'active', 'ended', 'soldout'
- `creatorWalletAddress`: String (foreign key to Users)
- `nftMetadata`: JSON - Base metadata for NFTs
- `transferFee`: Integer - XRPL transfer fee (0-50000 basis points)
- `flags`: Integer - XRPL NFT flags (8=Transferable)
- `maxMintsPerWallet`: Integer - Max mints per wallet (null=unlimited)

### DropMints Table
- `id`: UUID (primary key)
- `dropId`: UUID (foreign key to Drops)
- `minterWalletAddress`: String (foreign key to Users)
- `nftokenId`: String (unique) - XRPL NFToken ID
- `transactionHash`: String - XRPL transaction hash
- `mintNumber`: Integer - Sequential mint number (#1, #2, etc.)

## API Endpoints

### 1. Create Drop

**Endpoint**: `POST /api/v1/drops`

**Authentication**: Required

**Description**: Create a new NFT drop for a collection

**Request Body**:
```json
{
  "collectionId": "uuid",
  "name": "Genesis Drop",
  "description": "Limited edition genesis collection",
  "price": "10",
  "totalSupply": 1000,
  "startDate": "2025-12-10T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "nftMetadata": {
    "name": "Genesis NFT",
    "description": "Genesis collection NFT",
    "image": "https://example.com/image.png",
    "attributes": [
      {
        "trait_type": "Rarity",
        "value": "Common"
      }
    ]
  },
  "transferFee": 1000,
  "flags": 8,
  "maxMintsPerWallet": 5
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "collectionId": "uuid",
    "name": "Genesis Drop",
    "status": "upcoming",
    ...
  }
}
```

---

### 2. Get All Drops

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
    "drops": [...],
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

### 3. Get Single Drop

**Endpoint**: `GET /api/v1/drops/:id`

**Authentication**: Not required

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Genesis Drop",
    "collection": {
      "id": "uuid",
      "name": "Collection Name",
      "slug": "collection-slug",
      "image": "https://...",
      "taxon": 12345
    },
    "creator": {
      "walletAddress": "r...",
      "username": "creator",
      "profileImage": "https://..."
    },
    "mints": [...],
    ...
  }
}
```

---

### 4. Update Drop

**Endpoint**: `PUT /api/v1/drops/:id`

**Authentication**: Required (owner only)

**Request Body** (all fields optional):
```json
{
  "name": "Updated Drop Name",
  "description": "Updated description",
  "price": "15",
  "startDate": "2025-12-11T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "maxMintsPerWallet": 10,
  "totalSupply": 1500
}
```

**Notes**:
- Cannot update ended or sold out drops
- Cannot reduce totalSupply below current mintedCount

**Response**: `200 OK`

---

### 5. Delete Drop

**Endpoint**: `DELETE /api/v1/drops/:id`

**Authentication**: Required (owner only)

**Notes**:
- Can only delete drops with no minted NFTs

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Drop deleted successfully"
}
```

---

### 6. Get Mint Metadata

**Endpoint**: `GET /api/v1/drops/:id/mint-metadata`

**Authentication**: Optional (for per-user validation)

**Description**: Get metadata and XRPL parameters needed for minting on the frontend

**Process**:
1. Validates drop is active and mintable
2. Checks supply availability
3. Validates wallet mint limit (if set and user authenticated)
4. Returns metadata with mint number and XRPL parameters

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "dropId": "uuid",
    "dropName": "Genesis Drop",
    "mintNumber": 42,
    "metadata": {
      "name": "Genesis NFT #42",
      "description": "Genesis collection NFT",
      "image": "https://example.com/image.png",
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
    "taxon": 12345,
    "transferFee": 1000,
    "flags": 8,
    "price": "10",
    "collectionName": "Collection Name"
  }
}
```

**Frontend Usage**:
Frontend should:
1. Call this endpoint to get metadata and parameters
2. Upload metadata to IPFS (or use data URI)
3. Use returned parameters to mint NFT on XRPL
4. Call the record mint endpoint with the result

---

### 7. Record NFT Mint

**Endpoint**: `POST /api/v1/drops/:id/mint`

**Authentication**: Required

**Description**: Record an NFT mint after the frontend has minted on XRPL

**Request Body**:
```json
{
  "nftokenId": "00080000...",
  "transactionHash": "ABC123..."
}
```

**Process**:
1. Validates drop is active and mintable
2. Checks supply availability
3. Validates wallet mint limit (if set)
4. Checks NFT not already recorded
5. Records mint in database
6. Updates drop minted count
7. Updates status if sold out

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "mint": {
      "id": "uuid",
      "dropId": "uuid",
      "minterWalletAddress": "r...",
      "nftokenId": "00080000...",
      "transactionHash": "ABC123...",
      "mintNumber": 42
    },
    "mintNumber": 42,
    "drop": {
      "id": "uuid",
      "name": "Genesis Drop",
      "mintedCount": 42,
      "totalSupply": 1000,
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

### 8. Get Drop Mints

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
        "minter": {
          "walletAddress": "r...",
          "username": "user1",
          "profileImage": "https://..."
        },
        "createdAt": "2025-12-10T12:00:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

---

### 9. Get My Mints

**Endpoint**: `GET /api/v1/drops/my-mints`

**Authentication**: Required

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

**Description**: Get all NFTs minted by the current user from all drops

**Response**: `200 OK`

---

### 10. Check Can Mint

**Endpoint**: `GET /api/v1/drops/:id/can-mint`

**Authentication**: Optional (for per-user checks)

**Description**: Check if a drop is mintable and if the user can mint

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "canMint": true,
    "status": "active",
    "remaining": 958,
    "userMintCount": 2,
    "maxMintsPerWallet": 5,
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
    "status": "upcoming",
    "remaining": 1000,
    "userMintCount": 0,
    "maxMintsPerWallet": 5,
    "reason": ["Drop has not started yet"]
  }
}
```

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
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (not the owner)
- `404` - Not Found (drop/resource not found)
- `500` - Internal Server Error

---

## Minting Flow (Frontend to Backend)

The complete minting flow works as follows:

1. **Check Eligibility**:
   ```
   GET /api/v1/drops/:id/can-mint
   ```
   Verify drop is active and user can mint

2. **Get Mint Metadata**:
   ```
   GET /api/v1/drops/:id/mint-metadata
   ```
   Retrieve metadata and XRPL parameters

3. **Frontend Mints on XRPL**:
   - Upload metadata to IPFS
   - Use XRPL.js to mint NFT with provided parameters
   - User signs transaction with their wallet (XAMAN)

4. **Record Mint**:
   ```
   POST /api/v1/drops/:id/mint
   {
     "nftokenId": "...",
     "transactionHash": "..."
   }
   ```
   Backend records the mint in database

## Implementation Notes

### Frontend Responsibilities

1. **IPFS Upload**: Frontend must upload metadata to IPFS before minting
2. **XRPL Minting**: Use XRPL.js to mint NFTs with user's wallet
3. **Transaction Handling**: Handle transaction signing and errors
4. **Payment**: User pays gas fees for minting transaction

### Backend Responsibilities

1. **Drop Management**: CRUD operations for drops
2. **Validation**: Ensure drop rules (timing, supply, limits)
3. **Mint Recording**: Track which NFTs were minted and by whom
4. **Status Updates**: Automatically update drop status

### TODO for Production

1. **Background Jobs**: Implement scheduled tasks to update drop statuses:
   - Cron job to activate upcoming drops
   - Cron job to end expired drops

2. **Rate Limiting**: Add rate limiting to mint endpoint to prevent spam

3. **Transaction Verification**: Optionally verify transaction on XRPL before recording

4. **Webhooks**: Consider adding webhooks for drop events:
   - Drop started
   - Drop ended
   - Drop sold out
   - NFT minted

5. **Analytics**: Track drop performance metrics:
   - Mint velocity
   - Revenue tracking
   - Popular drops

---

## Usage Examples

### Creating a Drop

```bash
curl -X POST https://api.degearns.com/api/v1/drops \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collectionId": "collection-uuid",
    "name": "Holiday Special Drop",
    "description": "Limited holiday collection",
    "price": "5",
    "totalSupply": 500,
    "startDate": "2025-12-20T00:00:00Z",
    "endDate": "2025-12-31T23:59:59Z",
    "nftMetadata": {
      "name": "Holiday NFT",
      "description": "Special holiday edition",
      "image": "https://example.com/holiday.png"
    },
    "maxMintsPerWallet": 3
  }'
```

### Minting Flow

#### Step 1: Get Mint Metadata
```bash
curl -X GET https://api.degearns.com/api/v1/drops/drop-uuid/mint-metadata \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Step 2: Frontend Mints on XRPL
```javascript
// Frontend code (using XRPL.js)
import { Client, Wallet, convertStringToHex } from 'xrpl';

// Upload metadata to IPFS first
const metadataUri = await uploadToIPFS(metadata);

// Mint NFT
const client = new Client('wss://xrplcluster.com');
await client.connect();

const wallet = Wallet.fromSeed(userWalletSeed);
const mintTx = {
  TransactionType: 'NFTokenMint',
  Account: wallet.address,
  URI: convertStringToHex(metadataUri),
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

#### Step 3: Record Mint
```bash
curl -X POST https://api.degearns.com/api/v1/drops/drop-uuid/mint \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nftokenId": "00080000...",
    "transactionHash": "ABC123..."
  }'
```

---

## Database Migration

To create the required database tables, run:

```bash
npm run db:migrate
```

This will execute:
- `20250101000003-create-drops.js`
- `20250101000004-create-drop-mints.js`

---

## Testing

Test the endpoints using the provided Postman collection or curl commands.

Example test flow:
1. Create a collection (via frontend)
2. Create a drop for that collection
3. Query drops to see your drop
4. Check can-mint status
5. Get mint metadata
6. Mint NFT on XRPL (via frontend)
7. Record the mint via API
8. View mints for the drop
9. Check your mints

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/sherazhunzai1/degearns-backend/issues
- Documentation: See main README.md
