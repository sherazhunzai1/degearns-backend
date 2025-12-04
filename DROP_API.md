# NFT Drop System API Documentation

## Overview

The NFT Drop System allows collection creators to schedule NFT drops with configurable pricing, supply limits, and minting windows. Users can mint NFTs from active drops according to the schedule set by the owner.

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

### 6. Mint from Drop

**Endpoint**: `POST /api/v1/drops/:id/mint`

**Authentication**: Required

**Description**: Mint an NFT from a drop

**Request Body**: None

**Process**:
1. Validates drop is active and mintable
2. Checks supply availability
3. Validates wallet mint limit (if set)
4. Mints NFT on XRPL using admin wallet
5. Creates sell offer to user at drop price
6. Records mint in database
7. Updates drop minted count

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "mint": {
      "id": "uuid",
      "dropId": "uuid",
      "minterWalletAddress": "r...",
      "nftokenId": "000...",
      "transactionHash": "ABC...",
      "mintNumber": 42
    },
    "nftokenID": "000...",
    "transactionHash": "ABC...",
    "offerID": "DEF...",
    "price": "10",
    "metadata": {...}
  },
  "message": "NFT minted successfully. Accept the sell offer to complete the purchase."
}
```

**Notes**:
- User must accept the sell offer on XRPL to receive the NFT
- The sell offer is created at the drop price
- Payment validation should be implemented in production

---

### 7. Get Drop Mints

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

### 8. Get My Mints

**Endpoint**: `GET /api/v1/drops/my-mints`

**Authentication**: Required

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

**Description**: Get all NFTs minted by the current user from all drops

**Response**: `200 OK`

---

### 9. Check Can Mint

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

## Implementation Notes

### TODO for Production

1. **IPFS Integration**: Currently uses placeholder URIs. Implement actual IPFS upload for NFT metadata:
   ```javascript
   // In dropController.mintFromDrop()
   const metadataUri = await uploadToIPFS(metadata);
   ```

2. **Payment Validation**: Add payment verification before minting:
   ```javascript
   // Verify user sent correct amount to creator's wallet
   const paymentValid = await verifyPayment(userWallet, creatorWallet, dropPrice);
   ```

3. **Background Jobs**: Implement scheduled tasks to update drop statuses:
   - Cron job to activate upcoming drops
   - Cron job to end expired drops

4. **Rate Limiting**: Add rate limiting to mint endpoint to prevent abuse

5. **Webhooks**: Consider adding webhooks for drop events:
   - Drop started
   - Drop ended
   - Drop sold out
   - NFT minted

6. **Analytics**: Track drop performance metrics:
   - Mint velocity
   - Revenue tracking
   - Popular drops

---

## Usage Example

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

### Minting from a Drop

```bash
curl -X POST https://api.degearns.com/api/v1/drops/drop-uuid/mint \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
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
1. Create a collection
2. Create a drop for that collection
3. Query drops to see your drop
4. Check can-mint status
5. Mint from the drop
6. View mints for the drop
7. Check your mints

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/sherazhunzai1/degearns-backend/issues
- Documentation: See main README.md
