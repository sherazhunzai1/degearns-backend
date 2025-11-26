# API Documentation

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication

**Important Changes:**
- All endpoints are now **PUBLIC** (no JWT authentication required)
- Authentication is based on **wallet addresses** instead of JWT tokens
- Users are identified by their XRPL wallet address
- Endpoints accept wallet addresses in request body or query parameters

---

## Authentication Endpoints

### Get or Create User (XAMAN Wallet Connection)

**POST** `/auth/wallet`

Connect with XAMAN wallet. This endpoint automatically creates a new user if the wallet address doesn't exist, or returns the existing user.

**Request Body:**
```json
{
  "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User authenticated successfully",
  "data": {
    "user": {
      "id": "uuid",
      "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
      "username": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
      "email": null,
      "bio": null,
      "profileImage": null,
      "coverImage": null,
      "isVerified": false,
      "role": "user",
      "socialLinks": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here",
    "isNewUser": true
  }
}
```

**Notes:**
- New users get their wallet address as default username
- `isNewUser` flag indicates if this is a first-time connection
- Token is still generated for backwards compatibility

---

### Get User Profile

**GET** `/auth/me?walletAddress=rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X`

Get user profile by wallet address.

**Query Parameters:**
- `walletAddress` (required): User's XRPL wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "uuid",
    "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
    "username": "john_doe",
    "email": "john@example.com",
    "bio": "Digital artist and NFT creator",
    "profileImage": "https://example.com/avatar.jpg",
    "coverImage": "https://example.com/cover.jpg",
    "isVerified": true,
    "role": "user",
    "socialLinks": {
      "twitter": "https://twitter.com/johndoe",
      "discord": "https://discord.gg/johndoe",
      "website": "https://johndoe.com"
    },
    "collections": [
      {
        "id": "uuid",
        "name": "My Collection",
        "slug": "my-collection",
        "image": "https://example.com/collection.jpg",
        "totalSupply": 100,
        "taxon": 1234
      }
    ]
  }
}
```

---

### Update User Profile

**PUT** `/auth/profile`

Update user profile information.

**Request Body:**
```json
{
  "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "username": "new_username",
  "email": "newemail@example.com",
  "bio": "Updated bio text",
  "profileImage": "https://example.com/new-avatar.jpg",
  "coverImage": "https://example.com/new-cover.jpg",
  "socialLinks": {
    "twitter": "https://twitter.com/newhandle",
    "discord": "https://discord.gg/newserver"
  }
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid",
    "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
    "username": "new_username",
    "email": "newemail@example.com",
    "bio": "Updated bio text",
    "profileImage": "https://example.com/new-avatar.jpg",
    "coverImage": "https://example.com/new-cover.jpg",
    "socialLinks": {
      "twitter": "https://twitter.com/newhandle",
      "discord": "https://discord.gg/newserver"
    }
  }
}
```

**Error (400) - Username taken:**
```json
{
  "success": false,
  "message": "Username already taken"
}
```

---

## NFT Endpoints

**Important:** NFTs are **NOT stored in the database**. All NFT data is fetched in real-time from the **XRPL blockchain**.

### Get NFT Detail

**GET** `/nfts/:nftTokenId`

Get comprehensive NFT details including ownership, sale information, transaction history, and statistics.

**Parameters:**
- `nftTokenId` (path parameter): The XRPL NFT Token ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "nftTokenId": "00081388F0E4F3F8E8F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0",
    "uri": "https://example.com/metadata.json",
    "taxon": 1234,
    "flags": 8,
    "transferFee": 5000,
    "issuer": "rIssuerWalletAddress",
    "issuerInfo": {
      "walletAddress": "rIssuerWalletAddress",
      "username": "creator_name",
      "profileImage": "https://example.com/creator-avatar.jpg",
      "isVerified": true
    },
    "owner": "rOwnerWalletAddress",
    "ownerInfo": {
      "walletAddress": "rOwnerWalletAddress",
      "username": "owner_name",
      "profileImage": "https://example.com/owner-avatar.jpg",
      "isVerified": false,
      "bio": "NFT collector"
    },
    "saleInfo": {
      "isOnSale": true,
      "currentPrice": "1000000",
      "sellOffers": [
        {
          "offerId": "offer_id_1",
          "amount": "1000000",
          "owner": "rOwnerWalletAddress",
          "destination": null,
          "expiration": null
        }
      ],
      "buyOffers": [
        {
          "offerId": "offer_id_2",
          "amount": "900000",
          "owner": "rBuyerWalletAddress"
        }
      ]
    },
    "stats": {
      "totalSales": 3,
      "totalVolume": 2500000,
      "lastSalePrice": 1200000,
      "lastSaleDate": "2024-01-15T10:30:00.000Z"
    },
    "history": [
      {
        "hash": "tx_hash_1",
        "type": "NFTokenSale",
        "date": "2024-01-15T10:30:00.000Z",
        "account": "rBuyerAddress",
        "seller": "rSellerAddress",
        "buyer": "rBuyerAddress",
        "amount": "1200000",
        "result": "tesSUCCESS",
        "ledgerIndex": 12345678
      }
    ]
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "message": "NFT not found or owner could not be determined"
}
```

---

### Get NFT Offers

**GET** `/nfts/:nftTokenId/offers`

Get all buy and sell offers for a specific NFT.

**Parameters:**
- `nftTokenId` (path parameter): The XRPL NFT Token ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sellOffers": [
      {
        "offerId": "offer_id_1",
        "amount": "1000000",
        "owner": "rOwnerWalletAddress",
        "destination": null,
        "expiration": null
      }
    ],
    "buyOffers": [
      {
        "offerId": "offer_id_2",
        "amount": "900000",
        "owner": "rBuyerWalletAddress"
      }
    ]
  }
}
```

---

### Get NFT Transaction History

**GET** `/nfts/:nftTokenId/history?ownerAddress=rOwnerAddress&limit=20`

Get transaction history for a specific NFT.

**Parameters:**
- `nftTokenId` (path parameter): The XRPL NFT Token ID

**Query Parameters:**
- `ownerAddress` (required): Current owner's wallet address
- `limit` (optional): Number of transactions to fetch (default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "nftTokenId": "00081388F0E4F3F8E8F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0",
    "ownerAddress": "rOwnerAddress",
    "transactions": [
      {
        "hash": "tx_hash_1",
        "type": "NFTokenSale",
        "date": "2024-01-15T10:30:00.000Z",
        "account": "rBuyerAddress",
        "seller": "rSellerAddress",
        "buyer": "rBuyerAddress",
        "amount": "1200000",
        "result": "tesSUCCESS",
        "ledgerIndex": 12345678
      },
      {
        "hash": "tx_hash_2",
        "type": "NFTokenMint",
        "date": "2024-01-01T08:00:00.000Z",
        "account": "rCreatorAddress",
        "result": "tesSUCCESS",
        "ledgerIndex": 12340000
      }
    ]
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "Owner address is required as query parameter"
}
```

---

## Collection Endpoints

Collections store **metadata only** in the database. NFTs are fetched from the XRPL blockchain using the collection's **taxon** field.

### List/Register Collection

**POST** `/collections/list`

Register a new collection on the marketplace.

**Request Body:**
```json
{
  "name": "My Awesome Collection",
  "description": "A collection of unique digital artworks",
  "image": "https://example.com/collection-image.jpg",
  "bannerImage": "https://example.com/collection-banner.jpg",
  "category": "art",
  "royaltyPercentage": 5,
  "taxon": 1234,
  "creatorWalletAddress": "rCreatorWalletAddress",
  "socialLinks": {
    "twitter": "https://twitter.com/collection",
    "discord": "https://discord.gg/collection",
    "website": "https://collection.com"
  }
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Collection listed successfully",
  "data": {
    "id": "uuid",
    "name": "My Awesome Collection",
    "slug": "my-awesome-collection",
    "description": "A collection of unique digital artworks",
    "image": "https://example.com/collection-image.jpg",
    "bannerImage": "https://example.com/collection-banner.jpg",
    "category": "art",
    "royaltyPercentage": 5,
    "taxon": 1234,
    "creatorWalletAddress": "rCreatorWalletAddress",
    "totalSupply": 0,
    "floorPrice": null,
    "totalVolume": 0,
    "isVerified": false,
    "socialLinks": {
      "twitter": "https://twitter.com/collection",
      "discord": "https://discord.gg/collection",
      "website": "https://collection.com"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error (400) - Taxon already exists:**
```json
{
  "success": false,
  "message": "Collection with this taxon is already listed"
}
```

**Notes:**
- `taxon` is required and must be unique (used to identify NFTs on XRPL)
- Slug is auto-generated from the collection name
- All fields except taxon, name, and creatorWalletAddress are optional

---

### Get All Collections

**GET** `/collections?page=1&limit=20&category=art&sortBy=createdAt&order=DESC`

Get all collections with filtering, pagination, and sorting.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `category` (string): Filter by category
- `creatorWalletAddress` (string): Filter by creator
- `sortBy` (string): Sort field (default: createdAt)
- `order` (string): Sort order - ASC or DESC (default: DESC)
- `search` (string): Search in name and description

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Collections retrieved successfully",
  "data": {
    "collections": [
      {
        "id": "uuid",
        "name": "My Awesome Collection",
        "slug": "my-awesome-collection",
        "description": "A collection of unique digital artworks",
        "image": "https://example.com/collection-image.jpg",
        "bannerImage": "https://example.com/collection-banner.jpg",
        "category": "art",
        "taxon": 1234,
        "isVerified": true,
        "creator": {
          "walletAddress": "rCreatorWalletAddress",
          "username": "creator_name",
          "profileImage": "https://example.com/creator-avatar.jpg",
          "isVerified": true
        },
        "stats": {
          "totalSupply": 100,
          "floorPrice": "500000",
          "totalVolume": "50000000"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

---

### Get Single Collection

**GET** `/collections/:identifier`

Get detailed collection information with NFTs currently on sale. Identifier can be either collection ID (UUID) or slug.

**Parameters:**
- `identifier` (path parameter): Collection ID or slug

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Collection retrieved successfully",
  "data": {
    "collection": {
      "id": "uuid",
      "name": "My Awesome Collection",
      "slug": "my-awesome-collection",
      "description": "A collection of unique digital artworks",
      "image": "https://example.com/collection-image.jpg",
      "bannerImage": "https://example.com/collection-banner.jpg",
      "category": "art",
      "royaltyPercentage": 5,
      "taxon": 1234,
      "creatorWalletAddress": "rCreatorWalletAddress",
      "isVerified": true,
      "socialLinks": {
        "twitter": "https://twitter.com/collection",
        "discord": "https://discord.gg/collection"
      },
      "creator": {
        "walletAddress": "rCreatorWalletAddress",
        "username": "creator_name",
        "profileImage": "https://example.com/creator-avatar.jpg",
        "isVerified": true,
        "bio": "Digital artist"
      },
      "stats": {
        "totalSupply": 100,
        "listedCount": 25,
        "floorPrice": "500000",
        "totalVolume": "50000000"
      }
    },
    "nftsOnSale": [
      {
        "NFTokenID": "00081388F0E4F3F8E8F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0",
        "URI": "https://example.com/nft-metadata.json",
        "NFTokenTaxon": 1234,
        "Flags": 8,
        "TransferFee": 5000,
        "Issuer": "rIssuerAddress",
        "sellOffers": [
          {
            "nft_offer_index": "offer_id",
            "Amount": "1000000",
            "owner": "rOwnerAddress",
            "destination": null,
            "expiration": null
          }
        ],
        "lowestPrice": "1000000",
        "owner": "rOwnerAddress",
        "ownerInfo": {
          "walletAddress": "rOwnerAddress",
          "username": "owner_name",
          "profileImage": "https://example.com/owner-avatar.jpg",
          "isVerified": false
        },
        "issuerInfo": {
          "walletAddress": "rIssuerAddress",
          "username": "issuer_name",
          "profileImage": "https://example.com/issuer-avatar.jpg",
          "isVerified": true
        }
      }
    ]
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "message": "Collection not found"
}
```

**Notes:**
- NFTs are fetched from XRPL in real-time and filtered by taxon
- Only NFTs with active sell offers are included in `nftsOnSale`
- Owner and issuer information is enriched from the database

---

### Update Collection

**PUT** `/collections/:id`

Update collection metadata. Only the creator can update their collection.

**Parameters:**
- `id` (path parameter): Collection UUID

**Request Body:**
```json
{
  "creatorWalletAddress": "rCreatorWalletAddress",
  "name": "Updated Collection Name",
  "description": "Updated description",
  "image": "https://example.com/new-image.jpg",
  "bannerImage": "https://example.com/new-banner.jpg",
  "socialLinks": {
    "twitter": "https://twitter.com/newhandle"
  }
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Collection updated successfully",
  "data": {
    "id": "uuid",
    "name": "Updated Collection Name",
    "slug": "updated-collection-name",
    "description": "Updated description",
    "image": "https://example.com/new-image.jpg",
    "bannerImage": "https://example.com/new-banner.jpg",
    "socialLinks": {
      "twitter": "https://twitter.com/newhandle"
    }
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "You are not the creator of this collection"
}
```

**Notes:**
- `creatorWalletAddress` is required for authorization
- Taxon cannot be changed after creation
- Name change will regenerate the slug

---

### Update Collection Stats

**PUT** `/collections/:id/stats`

Sync collection statistics from XRPL blockchain. Updates total supply, floor price, and listed count.

**Parameters:**
- `id` (path parameter): Collection UUID

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Collection statistics updated successfully",
  "data": {
    "totalSupply": 100,
    "listedCount": 25,
    "floorPrice": "500000",
    "totalVolume": "50000000"
  }
}
```

**Notes:**
- This endpoint fetches real-time data from XRPL
- Updates the database with latest stats
- Can be called periodically to keep stats in sync

---

## Health Check

### Server Health

**GET** `/health`

Check server health and status.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message description"
}
```

### Common Error Codes

- `400 Bad Request`: Invalid request data or missing required fields
- `401 Unauthorized`: Missing or invalid wallet address
- `403 Forbidden`: Insufficient permissions (e.g., not the collection creator)
- `404 Not Found`: Resource not found (user, collection, NFT)
- `500 Internal Server Error`: Server error or XRPL connection issue

---

## Data Types and Enums

### Collection Categories
- `art`
- `music`
- `photography`
- `sports`
- `gaming`
- `collectibles`
- `other`

### User Roles
- `user`: Regular user
- `admin`: Administrator

### NFT Transaction Types (from XRPL)
- `NFTokenMint`: NFT creation
- `NFTokenSale`: NFT sale/purchase
- `NFTokenAcceptOffer`: Offer acceptance
- `NFTokenCancelOffer`: Offer cancellation
- `NFTokenBurn`: NFT destruction

### XRPL Amount Format
All amounts are in **drops** (1 XRP = 1,000,000 drops)
- Example: `"1000000"` = 1 XRP
- Amounts are returned as strings to preserve precision

---

## Key Architecture Changes

### What Changed from Previous Version

1. **Authentication**
   - ❌ No more JWT authentication middleware
   - ✅ All endpoints are public
   - ✅ Wallet addresses used for identity verification
   - ✅ Wallet address passed in request body or query params

2. **NFT Storage**
   - ❌ NFTs are NO LONGER stored in database
   - ✅ All NFT data fetched from XRPL blockchain in real-time
   - ✅ NFT endpoints query XRPL directly

3. **Collections**
   - ✅ Collections store metadata only
   - ✅ `taxon` field identifies NFTs on XRPL
   - ✅ NFTs fetched from blockchain and filtered by taxon

4. **User Enrichment**
   - ✅ NFT and collection responses include user profile data
   - ✅ Owner and issuer information enriched from database
   - ✅ Batch fetching for performance

5. **Real-time Data**
   - ✅ NFT details, offers, and history from XRPL
   - ✅ Collection stats can be synced from blockchain
   - ✅ No stale data in marketplace

---

## Notes for Frontend Integration

1. **Wallet Address Required**: Most endpoints now require `walletAddress` in the request. Store this after XAMAN connection.

2. **No JWT Headers**: Remove `Authorization: Bearer` headers from API calls.

3. **No Rate Limiting**: The API does not have any rate limiting. You can make unlimited requests without worrying about 429 errors.

4. **Real-time NFT Data**: NFT data is fetched from XRPL, so responses may be slightly slower but always up-to-date.

5. **Collection Taxon**: When creating collections, ensure you use a unique taxon number that matches your NFTs on XRPL.

6. **Amounts in Drops**: All XRP amounts are in drops (divide by 1,000,000 to get XRP).

7. **User Enrichment**: NFT and collection responses now include user profile data (username, avatar, verified status).

8. **Error Handling**: Always check the `success` field in responses. XRPL connection errors may occur.

---

## Example XAMAN Integration Flow

```javascript
// 1. User connects XAMAN wallet
const { walletAddress } = await xamanSDK.authorize();

// 2. Get or create user
const response = await fetch('/api/v1/auth/wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress })
});

const { data } = await response.json();
const { user, token, isNewUser } = data;

// 3. Store wallet address for future requests
localStorage.setItem('walletAddress', walletAddress);

// 4. Make authenticated requests using wallet address
const profile = await fetch(
  `/api/v1/auth/me?walletAddress=${walletAddress}`
);
```
