# API Documentation

## Base URL
```
http://localhost:5000/api/v1
```

## CORS Configuration

The API allows requests from the following origins:
- `https://degearns.com` (Production)
- `http://localhost:3000` (Development)

All other origins will receive CORS errors.

## XRPL Integration

This API connects directly to the **XRP Ledger Mainnet** using xrpl.js:

- **Network**: XRP Ledger Mainnet
- **WebSocket**: wss://xrplcluster.com
- **Library**: xrpl.js (official XRP Ledger JavaScript library)
- **Features**:
  - Real-time NFT data from mainnet
  - Direct ledger queries for accuracy
  - Account information and balances
  - NFT minting, trading, and history

All operations interact with the live XRP Ledger mainnet for production-ready NFT marketplace functionality.

---

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

Update user profile information including displayName, username, bio, email, and social media links.

**Request Body:**
```json
{
  "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "displayName": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "bio": "NFT enthusiast and digital artist",
  "facebook": "https://facebook.com/johndoe",
  "twitter": "https://twitter.com/johndoe",
  "instagram": "https://instagram.com/johndoe"
}
```

**Fields:**
- `walletAddress` (required): User's wallet address for identification
- `displayName` (optional): Display name (stored as username)
- `username` (optional): Unique username
- `email` (optional): User email address
- `bio` (optional): User biography/description
- `facebook` (optional): Facebook profile URL
- `twitter` (optional): Twitter profile URL
- `instagram` (optional): Instagram profile URL

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid",
    "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
    "username": "johndoe",
    "email": "john@example.com",
    "bio": "NFT enthusiast and digital artist",
    "profileImage": "https://example.com/avatar.jpg",
    "coverImage": "https://example.com/cover.jpg",
    "isVerified": false,
    "socialLinks": {
      "facebook": "https://facebook.com/johndoe",
      "twitter": "https://twitter.com/johndoe",
      "instagram": "https://instagram.com/johndoe"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
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

**Error (400) - Email taken:**
```json
{
  "success": false,
  "message": "Email already taken"
}
```

**Notes:**
- All fields are optional except `walletAddress`
- Social links are merged with existing ones (partial updates supported)
- `displayName` and `username` are treated as the same field
- Email and username must be unique across all users

---

### Update Profile Picture

**PUT** `/auth/profile-picture`

Update user's profile picture/avatar.

**Request Body:**
```json
{
  "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "profileImage": "https://example.com/new-avatar.jpg"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile picture updated successfully",
  "data": {
    "profileImage": "https://example.com/new-avatar.jpg"
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "Profile image URL is required"
}
```

---

### Update Cover Picture

**PUT** `/auth/cover-picture`

Update user's cover/banner image.

**Request Body:**
```json
{
  "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "coverImage": "https://example.com/new-cover.jpg"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Cover picture updated successfully",
  "data": {
    "coverImage": "https://example.com/new-cover.jpg"
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "Cover image URL is required"
}
```

---

## NFT Endpoints

**Important:** NFTs are **NOT stored in the database**. All NFT data is fetched in real-time from the **XRPL blockchain**.

### Get NFT Detail

**GET** `/nfts/:nftTokenId?wallet=rOwnerWalletAddress`

Get comprehensive NFT details including ownership, sale information, transaction history, statistics, and metadata (title, description, image).

**Parameters:**
- `nftTokenId` (path parameter): The XRPL NFT Token ID

**Query Parameters:**
- `wallet` (optional): Owner's wallet address. Required if NFT has no active sell offers.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "nftTokenId": "00081388F0E4F3F8E8F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0",
    "title": "Cool NFT #123",
    "description": "A unique digital artwork with special attributes",
    "image": "https://ipfs.io/ipfs/QmExample...",
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

Register a new collection on the marketplace. **This endpoint is idempotent** - calling it multiple times with the same `taxon` will return the existing collection instead of creating duplicates.

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

**Response (201) - New collection created:**
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

**Response (200) - Collection already exists:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Collection already listed",
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
    "totalSupply": 100,
    "floorPrice": "500000",
    "totalVolume": "5000000",
    "isVerified": false,
    "socialLinks": {
      "twitter": "https://twitter.com/collection",
      "discord": "https://discord.gg/collection",
      "website": "https://collection.com"
    },
    "creator": {
      "walletAddress": "rCreatorWalletAddress",
      "username": "creator_name",
      "profileImage": "https://example.com/avatar.jpg",
      "isVerified": true
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Notes:**
- **Idempotent endpoint**: Safe to call multiple times with same `taxon`
- If a collection with the same `taxon` exists, returns the existing collection (200) instead of creating a duplicate
- `taxon` is required and identifies the collection on XRPL
- Slug is auto-generated from the collection name
- All fields except taxon, name, and creatorWalletAddress are optional
- When returning existing collection, it includes creator info and current stats

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

### Get User Collections

**GET** `/collections/wallet/:walletAddress`

Get all collections created by or owned by a specific wallet address. Fetches live data from XRPL testnet and enriches with user information from the database.

**Parameters:**
- `walletAddress` (path parameter): The XRPL wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Collections retrieved successfully",
  "data": [
    {
      "taxon": 1234,
      "title": "My Awesome Collection",
      "image": "https://example.com/collection-image.jpg",
      "floorPrice": "500000",
      "items": 100,
      "listedCount": 25,
      "listedPercentage": "25.00",
      "volume": "50000000",
      "creator": {
        "walletAddress": "rCreatorWalletAddress",
        "username": "creator_name",
        "profileImage": "https://example.com/creator-avatar.jpg",
        "isVerified": true
      },
      "owner": {
        "walletAddress": "rOwnerWalletAddress",
        "username": "owner_name",
        "profileImage": "https://example.com/owner-avatar.jpg",
        "isVerified": false
      },
      "collectionId": "uuid",
      "slug": "my-awesome-collection",
      "description": "A collection of unique digital artworks",
      "category": "art",
      "isVerified": true,
      "isRegistered": true
    },
    {
      "taxon": 5678,
      "title": "Collection #5678",
      "image": "https://ipfs.io/ipfs/QmExample123",
      "floorPrice": "1000000",
      "items": 50,
      "listedCount": 10,
      "listedPercentage": "20.00",
      "volume": "0",
      "creator": {
        "walletAddress": "rIssuerAddress",
        "username": "rIssuerAddress",
        "profileImage": null,
        "isVerified": false
      },
      "owner": {
        "walletAddress": "rOwnerWalletAddress",
        "username": "owner_name",
        "profileImage": "https://example.com/owner-avatar.jpg",
        "isVerified": false
      },
      "collectionId": null,
      "slug": null,
      "description": null,
      "category": null,
      "isVerified": false,
      "isRegistered": false
    }
  ]
}
```

**Response (200) - No collections:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "No collections found for this wallet",
  "data": []
}
```

**Field Descriptions:**
- `taxon`: XRPL NFToken taxon identifier for the collection
- `title`: Collection name from database, or `Collection #[taxon]` if not registered
- `image`: Collection image URL from database, or fetched from first NFT metadata if available
- `floorPrice`: Lowest listed price in drops (from live XRPL data)
- `items`: Total number of NFTs in this collection owned by the wallet
- `listedCount`: Number of NFTs currently listed for sale
- `listedPercentage`: Percentage of NFTs listed (listedCount / items * 100)
- `volume`: Total trading volume from database
- `creator`: Creator information from database (based on NFT issuer)
- `owner`: Owner information from database (the wallet address provided)
- `collectionId`: Database collection ID (null if not registered)
- `slug`: Collection slug (null if not registered)
- `description`: Collection description (null if not registered)
- `category`: Collection category (null if not registered)
- `isVerified`: Whether collection is verified (false if not registered)
- `isRegistered`: Boolean indicating if collection is registered in the database

**Data Sources:**
- **Live from XRPL Testnet**: items, floorPrice, listedCount, listedPercentage
- **From Database**: title, image, volume, creator info, owner info, collection metadata
- Collections are automatically grouped by taxon from owned NFTs

**Filtering & Quality Control:**
- Always includes all registered collections (in database)
- For unregistered collections, applies quality filters:
  - Must have at least 3 NFTs (filters out test/single NFTs)
  - Must have at least one active listing or floor price
  - Must have a collection image (from database or NFT metadata)
- This ensures only meaningful collections with complete data are returned

**Notes:**
- Collections are sorted: registered first, then by number of items (largest first)
- For unregistered collections, attempts to fetch image from first NFT metadata
- Floor price is calculated from all current sell offers
- Listed percentage shows what portion of owned NFTs are currently for sale

**Use Cases:**
- Display user's collection portfolio
- Show collections on user profile page
- Track collection ownership statistics

---

### Get Single Collection

**GET** `/collections/:taxon?wallet=rCreatorWalletAddress`

Get detailed collection information with all NFTs. Fetches data directly from XRPL blockchain without database queries.

**Parameters:**
- `taxon` (path parameter): Collection taxon number

**Query Parameters:**
- `wallet` (required): Creator's wallet address

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
        "URI": "68747470733A2F2F6578616D706C652E636F6D2F6E66742D6D657461646174612E6A736F6E",
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
        },
        "image": "https://example.com/nft-image.jpg",
        "name": "Cool NFT #1",
        "description": "A unique digital artwork",
        "attributes": [
          {
            "trait_type": "Background",
            "value": "Blue"
          },
          {
            "trait_type": "Rarity",
            "value": "Rare"
          }
        ],
        "metadata": {
          "name": "Cool NFT #1",
          "description": "A unique digital artwork",
          "image": "https://example.com/nft-image.jpg",
          "attributes": [
            {
              "trait_type": "Background",
              "value": "Blue"
            },
            {
              "trait_type": "Rarity",
              "value": "Rare"
            }
          ]
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
- **NFT metadata and images are automatically fetched** from the URI field
- The `image` field contains the direct URL to the NFT image (IPFS URLs are converted to HTTP)
- Full metadata is included in the `metadata` field, with commonly used fields extracted to top level (`name`, `description`, `attributes`)
- URI field is hex-encoded; it's automatically decoded and fetched

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

### Get Collection Statistics

**GET** `/collections/stats`

Get comprehensive statistics for all collections including volume, sales, owners, and more.

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Collection statistics retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "taxon": 1234,
      "name": "Popular Collection",
      "slug": "popular-collection",
      "image": "https://example.com/collection.jpg",
      "description": "A very popular collection",
      "creator": {
        "walletAddress": "rCreatorAddress",
        "username": "creator_name",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "isVerified": true,
      "stats": {
        "totalSupply": 1000,
        "volume": "50000000",
        "volumeChange": 25.50,
        "floorPrice": "500000",
        "totalSales": 450,
        "owners": 234,
        "listed": 120
      }
    }
  ]
}
```

**Statistics Explained:**
- `totalSupply`: Total number of NFTs in collection
- `volume`: Total trading volume in drops (all-time)
- `volumeChange`: Percentage change in volume (last 30 days vs previous 30 days)
- `floorPrice`: Lowest listed price in drops
- `totalSales`: Number of completed sales
- `owners`: Number of unique NFT owners
- `listed`: Number of NFTs currently listed for sale

**Notes:**
- Collections sorted by volume (highest first)
- Volume change compares last 30 days to previous 30 days
- Stats calculated from XRPL blockchain in real-time
- May take time to process for large number of collections

---

### Search Collections and NFTs

**GET** `/collections/search?name=dragon&limit=50`

Search for collections and NFTs by name. Searches collection names in database and NFT titles from XRPL metadata.

**Query Parameters:**
- `name` (required): Search term to match
- `limit` (optional): Maximum collections to search (default: 50)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Search completed successfully",
  "data": {
    "collections": [
      {
        "type": "collection",
        "id": "uuid",
        "taxon": 1234,
        "name": "Dragon Collection",
        "slug": "dragon-collection",
        "image": "https://example.com/collection.jpg",
        "description": "Collection of dragon NFTs",
        "creator": {
          "walletAddress": "rCreatorAddress",
          "username": "creator_name",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "isVerified": true,
        "stats": {
          "totalSupply": 100,
          "floorPrice": "500000",
          "totalVolume": "5000000"
        }
      }
    ],
    "nfts": [
      {
        "type": "nft",
        "nftTokenId": "00081388...",
        "name": "Fire Dragon #123",
        "description": "A fierce fire dragon",
        "image": "https://ipfs.io/ipfs/QmExample...",
        "taxon": 1234,
        "issuer": "rIssuerAddress",
        "collection": {
          "id": "uuid",
          "name": "Dragon Collection",
          "slug": "dragon-collection"
        },
        "isOnSale": true,
        "lowestPrice": "1500000",
        "uri": "ipfs://QmExample..."
      }
    ],
    "summary": {
      "totalCollections": 1,
      "totalNFTs": 25,
      "searchTerm": "dragon"
    }
  }
}
```

**Notes:**
- Searches collection names and descriptions in database
- Searches NFT titles from XRPL metadata
- Case-insensitive search
- IPFS URLs automatically converted to HTTPS
- Returns both matching collections and NFTs

---

### Get New NFTs

**GET** `/collections/new-nfts?limit=20`

Get newest listed NFTs across all collections, sorted by listing date.

**Query Parameters:**
- `limit` (optional): Number of NFTs to return (default: 20)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Newest NFTs retrieved successfully",
  "data": {
    "nfts": [
      {
        "nftTokenId": "00081388...",
        "name": "Cool NFT #123",
        "image": "https://ipfs.io/ipfs/QmExample...",
        "description": "A unique digital artwork",
        "price": "1000000",
        "owner": "rOwnerAddress",
        "listedDate": "2025-01-15T10:30:00Z",
        "collection": {
          "id": "uuid",
          "name": "Popular Collection",
          "slug": "popular-collection",
          "image": "https://example.com/collection.jpg",
          "taxon": 1234
        },
        "uri": "ipfs://QmExample..."
      }
    ],
    "total": 150,
    "limit": 20
  }
}
```

**Notes:**
- Only includes NFTs currently listed for sale
- Sorted by listing date (most recent first)
- Fetches from all collections in database
- NFT metadata fetched from XRPL in real-time

---

### Get Top Sellers

**GET** `/collections/top-sellers?limit=10`

Get users with most collections and highest trading volume.

**Query Parameters:**
- `limit` (optional): Number of sellers to return (default: 10)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Top sellers retrieved successfully",
  "data": {
    "sellers": [
      {
        "walletAddress": "rCreatorAddress",
        "username": "top_creator",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true,
        "collectionsCount": 5,
        "totalVolume": "50000000"
      }
    ],
    "total": 10
  }
}
```

**Notes:**
- Sorted by number of collections first, then by volume
- Volume is sum of all collection volumes
- Only includes users with listed collections
- Profile data from database

---

### Get Popular Collections

**GET** `/collections/popular`

Get most popular collection in each category based on number of NFTs minted.

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Popular collections retrieved successfully",
  "data": {
    "popularCollections": [
      {
        "category": "art",
        "collection": {
          "id": "uuid",
          "name": "Popular Art Collection",
          "slug": "popular-art-collection",
          "image": "https://example.com/collection.jpg",
          "description": "Most popular art collection",
          "taxon": 1234,
          "creator": {
            "walletAddress": "rCreatorAddress",
            "username": "artist_name",
            "profileImage": "https://example.com/avatar.jpg",
            "isVerified": true
          },
          "isVerified": true,
          "totalSupply": 1000,
          "floorPrice": "500000",
          "totalVolume": "50000000"
        },
        "mintedCount": 1000,
        "recentNFTs": [
          {
            "nftTokenId": "00081388...",
            "name": "Art NFT #1",
            "image": "https://ipfs.io/ipfs/QmExample...",
            "description": "Beautiful artwork"
          }
        ]
      }
    ],
    "total": 5
  }
}
```

**Notes:**
- Groups collections by category
- Returns collection with most NFTs minted in each category
- Includes 4 most recent NFTs from each popular collection
- Sorted by minted count (highest first)
- Only includes collections with categories

---

## Chat Endpoints

The Chat API enables real-time messaging between users. All chat operations are based on wallet addresses for user identification.

### Get Chat Users

**GET** `/chat/users/:walletAddress`

Get all users with whom the logged-in user has had conversations, sorted by most recent message.

**Parameters:**
- `walletAddress` (path parameter): The logged-in user's XRPL wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Chat users retrieved successfully",
  "data": {
    "chatUsers": [
      {
        "conversationId": "uuid",
        "user": {
          "id": "uuid",
          "walletAddress": "rOtherUserWalletAddress",
          "username": "other_user",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "lastMessageAt": "2025-01-15T10:30:00.000Z",
        "lastMessagePreview": "Hey, are you interested in...",
        "unreadCount": 3
      }
    ],
    "total": 5
  }
}
```

**Notes:**
- Returns conversations sorted by last message timestamp (most recent first)
- Includes unread message count for each conversation
- `lastMessagePreview` shows first 100 characters of the last message

---

### Get All Users (For New Chat)

**GET** `/chat/all-users/:walletAddress?search=john&page=1&limit=20`

Get all available users for starting a new chat conversation. Excludes the current user.

**Parameters:**
- `walletAddress` (path parameter): The logged-in user's XRPL wallet address

**Query Parameters:**
- `search` (optional): Search term to filter by username or wallet address
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "uuid",
        "walletAddress": "rUserWalletAddress",
        "username": "john_doe",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

**Notes:**
- Use this endpoint to display a list of users when starting a new conversation
- Search is case-insensitive and matches partial strings
- Users are sorted alphabetically by username

---

### Get Messages

**GET** `/chat/messages/:walletAddress/:otherWalletAddress?page=1&limit=50`

Get messages between two users with pagination support.

**Parameters:**
- `walletAddress` (path parameter): The logged-in user's XRPL wallet address
- `otherWalletAddress` (path parameter): The other user's XRPL wallet address

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Messages retrieved successfully",
  "data": {
    "messages": [
      {
        "id": "uuid",
        "conversationId": "uuid",
        "senderWalletAddress": "rSenderWalletAddress",
        "receiverWalletAddress": "rReceiverWalletAddress",
        "sender": {
          "walletAddress": "rSenderWalletAddress",
          "username": "sender_name",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "content": "Hello! Are you interested in this NFT?",
        "messageType": "text",
        "metadata": null,
        "isRead": true,
        "readAt": "2025-01-15T10:35:00.000Z",
        "createdAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": "uuid",
        "conversationId": "uuid",
        "senderWalletAddress": "rReceiverWalletAddress",
        "receiverWalletAddress": "rSenderWalletAddress",
        "sender": {
          "walletAddress": "rReceiverWalletAddress",
          "username": "receiver_name",
          "profileImage": "https://example.com/avatar2.jpg",
          "isVerified": false
        },
        "content": "Yes! Check out this NFT",
        "messageType": "nft_share",
        "metadata": {
          "nftTokenId": "00081388...",
          "collectionName": "Cool Collection",
          "nftName": "Cool NFT #123",
          "image": "https://example.com/nft.jpg"
        },
        "isRead": false,
        "readAt": null,
        "createdAt": "2025-01-15T10:32:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1
    }
  }
}
```

**Response (200) - No messages:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "No messages found",
  "data": {
    "messages": [],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

**Notes:**
- Messages are returned in chronological order (oldest first for display)
- Pagination fetches from newest messages (page 1 = most recent)
- Includes sender profile information with each message

---

### Send Message

**POST** `/chat/send`

Send a message to another user. Automatically creates a conversation if one doesn't exist.

**Request Body:**
```json
{
  "senderWalletAddress": "rSenderWalletAddress",
  "receiverWalletAddress": "rReceiverWalletAddress",
  "content": "Hello! I'm interested in your NFT.",
  "messageType": "text",
  "metadata": null
}
```

**Request Body (NFT Share):**
```json
{
  "senderWalletAddress": "rSenderWalletAddress",
  "receiverWalletAddress": "rReceiverWalletAddress",
  "content": "Check out this NFT!",
  "messageType": "nft_share",
  "metadata": {
    "nftTokenId": "00081388...",
    "collectionName": "Cool Collection",
    "nftName": "Cool NFT #123",
    "image": "https://example.com/nft.jpg",
    "price": "1000000"
  }
}
```

**Fields:**
- `senderWalletAddress` (required): Sender's XRPL wallet address
- `receiverWalletAddress` (required): Receiver's XRPL wallet address
- `content` (required): Message content (cannot be empty)
- `messageType` (optional): Type of message - `text`, `image`, or `nft_share` (default: `text`)
- `metadata` (optional): Additional data for image or NFT share messages

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "id": "uuid",
      "conversationId": "uuid",
      "senderWalletAddress": "rSenderWalletAddress",
      "receiverWalletAddress": "rReceiverWalletAddress",
      "sender": {
        "walletAddress": "rSenderWalletAddress",
        "username": "sender_name",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "content": "Hello! I'm interested in your NFT.",
      "messageType": "text",
      "metadata": null,
      "isRead": false,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "Message content is required"
}
```

**Error (404):**
```json
{
  "success": false,
  "message": "Sender not found"
}
```

**Notes:**
- Automatically creates conversation if first message between users
- Automatically creates receiver user if they don't exist (new wallet)
- Updates conversation's `lastMessageAt` and `lastMessagePreview`
- Message types: `text` (default), `image`, `nft_share`

---

### Mark Messages as Read

**PUT** `/chat/read`

Mark all unread messages from a specific sender as read.

**Request Body:**
```json
{
  "walletAddress": "rReceiverWalletAddress",
  "senderWalletAddress": "rSenderWalletAddress"
}
```

**Fields:**
- `walletAddress` (required): The logged-in user's wallet address (who is reading)
- `senderWalletAddress` (required): The sender's wallet address (whose messages to mark as read)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Messages marked as read successfully",
  "data": {
    "markedAsRead": 5
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "message": "Conversation not found"
}
```

**Notes:**
- Only marks messages where the logged-in user is the receiver
- Sets `isRead` to `true` and `readAt` to current timestamp
- Returns count of messages that were marked as read

---

### Get Unread Messages Count

**GET** `/chat/unread/:walletAddress`

Get the total count of unread messages and breakdown by sender.

**Parameters:**
- `walletAddress` (path parameter): The logged-in user's XRPL wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Unread count retrieved successfully",
  "data": {
    "totalUnread": 12,
    "unreadBySender": [
      {
        "conversationId": "uuid",
        "senderWalletAddress": "rSender1WalletAddress",
        "sender": {
          "walletAddress": "rSender1WalletAddress",
          "username": "user_one",
          "profileImage": "https://example.com/avatar1.jpg"
        },
        "unreadCount": 5
      },
      {
        "conversationId": "uuid",
        "senderWalletAddress": "rSender2WalletAddress",
        "sender": {
          "walletAddress": "rSender2WalletAddress",
          "username": "user_two",
          "profileImage": "https://example.com/avatar2.jpg"
        },
        "unreadCount": 7
      }
    ]
  }
}
```

**Notes:**
- `totalUnread` is the total count of all unread messages
- `unreadBySender` provides breakdown by each sender
- Use `totalUnread` for notification badges
- Use `unreadBySender` to show per-conversation unread counts

---

### Get Total Unread Count (Badge)

**GET** `/chat/unread-count/:walletAddress`

Get only the total count of unread messages. Lightweight endpoint optimized for notification badge display.

**Parameters:**
- `walletAddress` (path parameter): The logged-in user's XRPL wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Unread count retrieved successfully",
  "data": {
    "count": 12
  }
}
```

**Notes:**
- Returns only the count value for lightweight badge display
- Use this endpoint when you only need the number for a notification badge
- For detailed breakdown by sender, use `/chat/unread/:walletAddress` instead

---

### Message Types

| Type | Description | Metadata |
|------|-------------|----------|
| `text` | Plain text message | None required |
| `image` | Image message | `{ "imageUrl": "https://..." }` |
| `nft_share` | NFT share | `{ "nftTokenId": "...", "collectionName": "...", "nftName": "...", "image": "...", "price": "..." }` |

---

### Chat Data Models

**Conversation:**
```json
{
  "id": "uuid",
  "participant1WalletAddress": "rWallet1...",
  "participant2WalletAddress": "rWallet2...",
  "lastMessageAt": "2025-01-15T10:30:00.000Z",
  "lastMessagePreview": "Last message content...",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Message:**
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "senderWalletAddress": "rSender...",
  "receiverWalletAddress": "rReceiver...",
  "content": "Message text...",
  "messageType": "text|image|nft_share",
  "metadata": {},
  "isRead": false,
  "readAt": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

---

### Example Chat Integration Flow

```javascript
// 1. Get wallet address (from XAMAN connection)
const walletAddress = localStorage.getItem('walletAddress');

// 2. Get chat users (conversations list)
const chatUsers = await fetch(`/api/v1/chat/users/${walletAddress}`);

// 3. Get messages with a specific user
const messages = await fetch(
  `/api/v1/chat/messages/${walletAddress}/${otherWalletAddress}`
);

// 4. Send a message
const sendMessage = await fetch('/api/v1/chat/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    senderWalletAddress: walletAddress,
    receiverWalletAddress: otherWalletAddress,
    content: 'Hello!',
    messageType: 'text'
  })
});

// 5. Mark messages as read when viewing a conversation
await fetch('/api/v1/chat/read', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: walletAddress,
    senderWalletAddress: otherWalletAddress
  })
});

// 6. Get unread count for notification badge
const unreadCount = await fetch(`/api/v1/chat/unread/${walletAddress}`);
```

---

## Follow Endpoints

The Follow API enables users to follow/unfollow other users and get personalized feeds based on who they follow.

### Follow a User

**POST** `/follow`

Follow another user.

**Request Body:**
```json
{
  "followerWalletAddress": "rYourWalletAddress",
  "followingWalletAddress": "rUserToFollowWalletAddress"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "User followed successfully",
  "data": {
    "follow": {
      "id": "uuid",
      "followerWalletAddress": "rYourWalletAddress",
      "followingWalletAddress": "rUserToFollowWalletAddress",
      "createdAt": "2025-01-15T10:30:00.000Z"
    },
    "followersCount": 150
  }
}
```

**Error (400) - Already following:**
```json
{
  "success": false,
  "message": "You are already following this user"
}
```

**Error (400) - Self follow:**
```json
{
  "success": false,
  "message": "You cannot follow yourself"
}
```

---

### Unfollow a User

**DELETE** `/follow`

Unfollow a user.

**Request Body:**
```json
{
  "followerWalletAddress": "rYourWalletAddress",
  "followingWalletAddress": "rUserToUnfollowWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User unfollowed successfully",
  "data": {
    "followersCount": 149
  }
}
```

**Error (400) - Not following:**
```json
{
  "success": false,
  "message": "You are not following this user"
}
```

---

### Check Follow Status

**GET** `/follow/status?followerWalletAddress=rYourWallet&followingWalletAddress=rOtherWallet`

Check if user A follows user B.

**Query Parameters:**
- `followerWalletAddress` (required): The user who might be following
- `followingWalletAddress` (required): The user who might be followed

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Follow status retrieved successfully",
  "data": {
    "isFollowing": true,
    "followedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### Get Followers

**GET** `/follow/followers/:walletAddress?page=1&limit=20&viewerWalletAddress=rViewerWallet`

Get all users who follow a specific user.

**Parameters:**
- `walletAddress` (path parameter): The user whose followers to retrieve

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `viewerWalletAddress` (optional): Wallet of viewer to check if they follow each follower

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Followers retrieved successfully",
  "data": {
    "followers": [
      {
        "walletAddress": "rFollowerWalletAddress",
        "username": "follower_user",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true,
        "bio": "NFT collector",
        "followedAt": "2025-01-15T10:30:00.000Z",
        "isFollowing": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Notes:**
- `isFollowing` indicates if the viewer (viewerWalletAddress) follows this user
- Sorted by follow date (most recent first)

---

### Get Following

**GET** `/follow/following/:walletAddress?page=1&limit=20&viewerWalletAddress=rViewerWallet`

Get all users that a specific user is following.

**Parameters:**
- `walletAddress` (path parameter): The user whose following list to retrieve

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `viewerWalletAddress` (optional): Wallet of viewer to check mutual follows

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Following retrieved successfully",
  "data": {
    "following": [
      {
        "walletAddress": "rFollowingWalletAddress",
        "username": "followed_user",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true,
        "bio": "Digital artist",
        "followedAt": "2025-01-15T10:30:00.000Z",
        "isFollowing": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 75,
      "totalPages": 4
    }
  }
}
```

---

### Get Follow Counts

**GET** `/follow/counts/:walletAddress`

Get follower and following counts for a user.

**Parameters:**
- `walletAddress` (path parameter): The user's wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Follow counts retrieved successfully",
  "data": {
    "followersCount": 150,
    "followingCount": 75
  }
}
```

---

### Get Following Feed (Posts from Followed Users)

**GET** `/posts/following/:walletAddress?page=1&limit=20`

Get posts from users that the logged-in user follows. This creates a personalized feed.

**Parameters:**
- `walletAddress` (path parameter): The logged-in user's wallet address

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Posts per page (default: 20)
- `viewerWalletAddress` (optional): Wallet address of viewer to check if they liked posts

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Following feed retrieved successfully",
  "data": {
    "posts": [
      {
        "id": "uuid",
        "authorWalletAddress": "rAuthorWalletAddress",
        "author": {
          "walletAddress": "rAuthorWalletAddress",
          "username": "followed_user",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "content": "Check out my latest NFT!",
        "postType": "image",
        "visibility": "public",
        "media": [...],
        "likesCount": 42,
        "commentsCount": 5,
        "sharesCount": 3,
        "isLiked": true,
        "recentComments": [...],
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

**Response (200) - No follows:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "No posts found. Follow some users to see their posts.",
  "data": {
    "posts": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

**Notes:**
- Only returns posts from users the logged-in user follows
- Sorted by creation date (newest first)
- Includes engagement data (likes, comments, isLiked status)

---

### Follow Data Model

**Follow:**
```json
{
  "id": "uuid",
  "followerWalletAddress": "rWalletWhoFollows...",
  "followingWalletAddress": "rWalletBeingFollowed...",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

---

### Example Follow Integration Flow

```javascript
// 1. Get wallet address (from XAMAN connection)
const walletAddress = localStorage.getItem('walletAddress');

// 2. Follow a user
const followUser = await fetch('/api/v1/follow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    followerWalletAddress: walletAddress,
    followingWalletAddress: userToFollow
  })
});

// 3. Unfollow a user
const unfollowUser = await fetch('/api/v1/follow', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    followerWalletAddress: walletAddress,
    followingWalletAddress: userToUnfollow
  })
});

// 4. Check if you follow a user
const followStatus = await fetch(
  `/api/v1/follow/status?followerWalletAddress=${walletAddress}&followingWalletAddress=${otherUser}`
);

// 5. Get your followers
const followers = await fetch(`/api/v1/follow/followers/${walletAddress}?page=1&limit=20`);

// 6. Get users you follow
const following = await fetch(`/api/v1/follow/following/${walletAddress}?page=1&limit=20`);

// 7. Get follow counts for profile display
const counts = await fetch(`/api/v1/follow/counts/${walletAddress}`);

// 8. Get personalized feed (posts from followed users)
const followingFeed = await fetch(`/api/v1/posts/following/${walletAddress}?page=1&limit=20`);
```

---

## Notification Endpoints

The Notifications API enables users to receive and manage notifications for various activities like post likes, comments, new followers, and NFT listings from followed users.

### Get Notifications

**GET** `/notifications/:walletAddress`

Get notifications for a user with pagination and filtering options.

**Parameters:**
- `walletAddress` (path parameter): The user's wallet address

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Notifications per page (default: 20)
- `unreadOnly` (optional): Only return unread notifications (default: false)
- `type` (optional): Filter by notification type (like, comment, comment_reply, follow, nft_listing)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "like",
        "title": "New Like",
        "message": "john_doe liked your post",
        "sender": {
          "walletAddress": "rSenderWalletAddress",
          "username": "john_doe",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "relatedEntityId": "post-uuid",
        "relatedEntityType": "post",
        "metadata": {
          "postPreview": "Check out my latest NFT!",
          "likerUsername": "john_doe"
        },
        "isRead": false,
        "readAt": null,
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

---

### Get Unread Notification Count

**GET** `/notifications/:walletAddress/unread-count`

Get the count of unread notifications for badge display.

**Parameters:**
- `walletAddress` (path parameter): The user's wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Unread count retrieved successfully",
  "data": {
    "unreadCount": 5
  }
}
```

---

### Mark Notification as Read

**PUT** `/notifications/:notificationId/read`

Mark a single notification as read.

**Parameters:**
- `notificationId` (path parameter): The notification ID

**Request Body:**
```json
{
  "walletAddress": "rYourWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "uuid",
    "isRead": true,
    "readAt": "2025-01-15T10:35:00.000Z"
  }
}
```

---

### Mark All Notifications as Read

**PUT** `/notifications/read-all`

Mark all notifications as read for a user.

**Request Body:**
```json
{
  "walletAddress": "rYourWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updatedCount": 5
  }
}
```

---

### Delete Notification

**DELETE** `/notifications/:notificationId`

Delete a single notification.

**Parameters:**
- `notificationId` (path parameter): The notification ID

**Request Body:**
```json
{
  "walletAddress": "rYourWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Notification deleted successfully",
  "data": {
    "notificationId": "uuid"
  }
}
```

---

### Delete All Notifications

**DELETE** `/notifications/delete-all`

Delete all notifications for a user.

**Request Body:**
```json
{
  "walletAddress": "rYourWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "All notifications deleted successfully",
  "data": {
    "deletedCount": 25
  }
}
```

---

### Notify NFT Listing

**POST** `/nfts/notify-listing`

Notify all followers about an NFT listing. This endpoint should be called by the frontend after successfully creating a sell offer on XRPL.

**Request Body:**
```json
{
  "sellerWalletAddress": "rSellerWalletAddress",
  "nftTokenId": "000800006203F49C21D5D6E022CB16DE3538F248662FC73C0000099B00000000",
  "nftName": "Amazing NFT #1",
  "nftImage": "https://example.com/nft-image.jpg",
  "price": "10000000",
  "collectionId": "collection-uuid",
  "collectionName": "My Collection"
}
```

**Fields:**
- `sellerWalletAddress` (required): Wallet address of the seller
- `nftTokenId` (required): NFT token ID on XRPL
- `nftName` (optional): Name of the NFT
- `nftImage` (optional): Image URL of the NFT
- `price` (optional): Listing price in drops
- `collectionId` (optional): Collection ID in database
- `collectionName` (optional): Name of the collection

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "NFT listing notifications sent successfully",
  "data": {
    "notificationsSent": 150,
    "nftTokenId": "000800006203F49C21D5D6E022CB16DE3538F248662FC73C0000099B00000000"
  }
}
```

---

### Notification Types

| Type | Description | Trigger |
|------|-------------|---------|
| `like` | Post like notification | When someone likes your post |
| `comment` | Post comment notification | When someone comments on your post |
| `comment_reply` | Comment reply notification | When someone replies to your comment |
| `follow` | New follower notification | When someone follows you |
| `nft_listing` | NFT listing notification | When someone you follow lists an NFT for sale |

---

### Notification Data Model

**Notification:**
```json
{
  "id": "uuid",
  "recipientWalletAddress": "rRecipientWallet...",
  "senderWalletAddress": "rSenderWallet...",
  "type": "like|comment|comment_reply|follow|nft_listing",
  "title": "New Like",
  "message": "john_doe liked your post",
  "relatedEntityId": "uuid",
  "relatedEntityType": "post|comment|follow|collection|nft",
  "metadata": {
    "postPreview": "...",
    "likerUsername": "john_doe"
  },
  "isRead": false,
  "readAt": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

---

### Example Notification Integration Flow

```javascript
// 1. Get wallet address (from XAMAN connection)
const walletAddress = localStorage.getItem('walletAddress');

// 2. Get unread notification count (for badge)
const unreadCount = await fetch(`/api/v1/notifications/${walletAddress}/unread-count`);
const { data } = await unreadCount.json();
updateBadge(data.unreadCount);

// 3. Get notifications list
const notifications = await fetch(`/api/v1/notifications/${walletAddress}?page=1&limit=20`);

// 4. Get only unread notifications
const unreadNotifications = await fetch(
  `/api/v1/notifications/${walletAddress}?unreadOnly=true`
);

// 5. Mark a notification as read
await fetch(`/api/v1/notifications/${notificationId}/read`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress })
});

// 6. Mark all notifications as read
await fetch('/api/v1/notifications/read-all', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress })
});

// 7. Delete a notification
await fetch(`/api/v1/notifications/${notificationId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress })
});

// 8. Notify followers after listing an NFT on XRPL
// (Call this after successfully creating a sell offer)
await fetch('/api/v1/nfts/notify-listing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sellerWalletAddress: walletAddress,
    nftTokenId: nftTokenId,
    nftName: 'My NFT',
    nftImage: nftImage,
    price: listingPrice,
    collectionName: collectionName
  })
});
```

---

## Post Endpoints

The Posts API enables users to create and share content similar to social media platforms. Users can create posts with text, images, videos, or any combination.

### Create Post

**POST** `/posts`

Create a new post with text, images, videos, or any combination.

**Request Body (Text Only):**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "This is my first post!",
  "visibility": "public"
}
```

**Request Body (Single Image):**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "Check out this amazing photo!",
  "media": [
    {
      "mediaType": "image",
      "mediaUrl": "https://example.com/image.jpg",
      "mimeType": "image/jpeg",
      "width": 1920,
      "height": 1080,
      "altText": "Beautiful sunset"
    }
  ],
  "visibility": "public"
}
```

**Request Body (Multiple Images):**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "My vacation photos!",
  "media": [
    {
      "mediaType": "image",
      "mediaUrl": "https://example.com/photo1.jpg",
      "displayOrder": 0
    },
    {
      "mediaType": "image",
      "mediaUrl": "https://example.com/photo2.jpg",
      "displayOrder": 1
    },
    {
      "mediaType": "image",
      "mediaUrl": "https://example.com/photo3.jpg",
      "displayOrder": 2
    }
  ],
  "visibility": "public"
}
```

**Request Body (Video):**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "Watch this!",
  "media": [
    {
      "mediaType": "video",
      "mediaUrl": "https://example.com/video.mp4",
      "thumbnailUrl": "https://example.com/thumbnail.jpg",
      "mimeType": "video/mp4",
      "duration": 120,
      "width": 1920,
      "height": 1080
    }
  ],
  "visibility": "public"
}
```

**Request Body (Mixed Media - Images and Videos):**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "Photos and videos from the event!",
  "media": [
    {
      "mediaType": "image",
      "mediaUrl": "https://example.com/photo.jpg",
      "displayOrder": 0
    },
    {
      "mediaType": "video",
      "mediaUrl": "https://example.com/video.mp4",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "displayOrder": 1
    }
  ],
  "visibility": "public",
  "metadata": {
    "location": "New York",
    "tags": ["event", "fun"]
  }
}
```

**Fields:**
- `authorWalletAddress` (required): Author's XRPL wallet address
- `content` (optional if media provided): Post text content
- `media` (optional if content provided): Array of media items
  - `mediaType` (required): `image` or `video`
  - `mediaUrl` (required): URL of the media file (supports IPFS URLs)
  - `thumbnailUrl` (optional): Thumbnail URL for videos (supports IPFS URLs)
  - `mimeType` (optional): MIME type (e.g., `image/jpeg`, `video/mp4`)
  - `fileSize` (optional): File size in bytes
  - `width` (optional): Width in pixels
  - `height` (optional): Height in pixels
  - `duration` (optional): Duration in seconds (for videos)
  - `displayOrder` (optional): Display order (0-based, defaults to array index)
  - `altText` (optional): Alternative text for accessibility
- `visibility` (optional): `public` or `private` (default: `public`)
- `metadata` (optional): Additional metadata (location, tags, etc.)

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Post created successfully",
  "data": {
    "post": {
      "id": "uuid",
      "authorWalletAddress": "rAuthorWalletAddress",
      "author": {
        "walletAddress": "rAuthorWalletAddress",
        "username": "john_doe",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "content": "Check out this amazing photo!",
      "postType": "image",
      "visibility": "public",
      "media": [
        {
          "id": "uuid",
          "mediaType": "image",
          "mediaUrl": "https://example.com/image.jpg",
          "thumbnailUrl": null,
          "mimeType": "image/jpeg",
          "fileSize": null,
          "width": 1920,
          "height": 1080,
          "duration": null,
          "displayOrder": 0,
          "altText": "Beautiful sunset"
        }
      ],
      "likesCount": 0,
      "commentsCount": 0,
      "sharesCount": 0,
      "metadata": null,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "Post must have either text content or media"
}
```

**Notes:**
- Maximum 10 media items per post
- `postType` is automatically determined: `text`, `image`, `video`, or `mixed`
- At least `content` or `media` must be provided
- **IPFS Support**: URLs starting with `ipfs://` are automatically converted to HTTP gateway URLs (`https://ipfs.io/ipfs/...`) for consistent browser access

---

### Get All Posts (Feed)

**GET** `/posts/feed?page=1&limit=20&postType=image&viewerWalletAddress=rViewerAddress`

Get all public posts sorted by most recent (feed).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Posts per page (default: 20)
- `postType` (optional): Filter by type - `text`, `image`, `video`, or `mixed`
- `viewerWalletAddress` (optional): Wallet address of the viewer to check if they liked each post

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Posts retrieved successfully",
  "data": {
    "posts": [
      {
        "id": "uuid",
        "authorWalletAddress": "rAuthorWalletAddress",
        "author": {
          "walletAddress": "rAuthorWalletAddress",
          "username": "john_doe",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "content": "Check out this amazing photo!",
        "postType": "image",
        "visibility": "public",
        "media": [
          {
            "id": "uuid",
            "mediaType": "image",
            "mediaUrl": "https://example.com/image.jpg",
            "thumbnailUrl": null,
            "mimeType": "image/jpeg",
            "width": 1920,
            "height": 1080,
            "displayOrder": 0
          }
        ],
        "likesCount": 42,
        "commentsCount": 5,
        "sharesCount": 3,
        "metadata": null,
        "isLiked": true,
        "recentComments": [
          {
            "id": "uuid",
            "content": "Great post!",
            "authorWalletAddress": "rCommenterAddress",
            "author": {
              "walletAddress": "rCommenterAddress",
              "username": "commenter",
              "profileImage": "https://example.com/avatar.jpg",
              "isVerified": false
            },
            "createdAt": "2025-01-15T11:00:00.000Z"
          }
        ],
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Notes:**
- Only returns public posts
- Sorted by creation date (newest first)
- Filter by post type to get only specific content
- `isLiked` is `true` if the viewer (identified by `viewerWalletAddress`) has liked the post, `false` otherwise, or omitted if no viewer wallet provided
- `recentComments` includes up to 3 most recent comments for quick preview

---

### Get User Posts

**GET** `/posts/user/:walletAddress?page=1&limit=20`

Get all posts by a specific user.

**Parameters:**
- `walletAddress` (path parameter): User's XRPL wallet address

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Posts per page (default: 20)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Posts retrieved successfully",
  "data": {
    "posts": [
      {
        "id": "uuid",
        "authorWalletAddress": "rAuthorWalletAddress",
        "author": {
          "walletAddress": "rAuthorWalletAddress",
          "username": "john_doe",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "content": "My latest NFT collection!",
        "postType": "mixed",
        "visibility": "public",
        "media": [
          {
            "id": "uuid",
            "mediaType": "image",
            "mediaUrl": "https://example.com/nft1.jpg",
            "displayOrder": 0
          },
          {
            "id": "uuid",
            "mediaType": "video",
            "mediaUrl": "https://example.com/promo.mp4",
            "thumbnailUrl": "https://example.com/thumb.jpg",
            "displayOrder": 1
          }
        ],
        "likesCount": 100,
        "commentsCount": 25,
        "sharesCount": 10,
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

**Notes:**
- Returns all active posts by the user
- Sorted by creation date (newest first)

---

### Get Post by ID

**GET** `/posts/:postId`

Get a single post by its ID.

**Parameters:**
- `postId` (path parameter): Post UUID

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Post retrieved successfully",
  "data": {
    "post": {
      "id": "uuid",
      "authorWalletAddress": "rAuthorWalletAddress",
      "author": {
        "walletAddress": "rAuthorWalletAddress",
        "username": "john_doe",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true,
        "bio": "NFT creator and collector"
      },
      "content": "Check out this amazing photo!",
      "postType": "image",
      "visibility": "public",
      "media": [
        {
          "id": "uuid",
          "mediaType": "image",
          "mediaUrl": "https://example.com/image.jpg",
          "width": 1920,
          "height": 1080,
          "displayOrder": 0
        }
      ],
      "likesCount": 42,
      "commentsCount": 5,
      "sharesCount": 3,
      "metadata": null,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "message": "Post not found"
}
```

---

### Update Post

**PUT** `/posts/:postId`

Update an existing post. Only the author can update their post.

**Parameters:**
- `postId` (path parameter): Post UUID

**Request Body:**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "Updated post content!",
  "media": [
    {
      "mediaType": "image",
      "mediaUrl": "https://example.com/new-image.jpg"
    }
  ],
  "visibility": "public"
}
```

**Fields:**
- `authorWalletAddress` (required): For authorization verification
- `content` (optional): Updated text content
- `media` (optional): Updated media array (replaces existing media)
- `visibility` (optional): Updated visibility setting
- `metadata` (optional): Updated metadata

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Post updated successfully",
  "data": {
    "post": {
      "id": "uuid",
      "authorWalletAddress": "rAuthorWalletAddress",
      "author": {
        "walletAddress": "rAuthorWalletAddress",
        "username": "john_doe",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "content": "Updated post content!",
      "postType": "image",
      "visibility": "public",
      "media": [...],
      "likesCount": 42,
      "commentsCount": 5,
      "sharesCount": 3,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T11:00:00.000Z"
    }
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "You are not authorized to update this post"
}
```

**Notes:**
- Only the post author can update their post
- When updating media, all existing media is replaced
- Post must still have content or media after update

---

### Delete Post

**DELETE** `/posts/:postId`

Delete a post (soft delete). Only the author can delete their post.

**Parameters:**
- `postId` (path parameter): Post UUID

**Request Body:**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Post deleted successfully",
  "data": {
    "postId": "uuid"
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "You are not authorized to delete this post"
}
```

**Notes:**
- Performs soft delete (sets `isActive` to `false`)
- Only the post author can delete their post
- Deleted posts will not appear in feed or user posts

---

## Post Like Endpoints

### Like a Post

**POST** `/posts/:postId/like`

Like a post. A user can only like a post once.

**Parameters:**
- `postId` (path parameter): Post UUID

**Request Body:**
```json
{
  "userWalletAddress": "rUserWalletAddress"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Post liked successfully",
  "data": {
    "like": {
      "id": "uuid",
      "postId": "uuid",
      "userWalletAddress": "rUserWalletAddress",
      "createdAt": "2025-01-15T10:30:00.000Z"
    },
    "likesCount": 43
  }
}
```

**Error (400) - Already liked:**
```json
{
  "success": false,
  "message": "You have already liked this post"
}
```

**Error (404):**
```json
{
  "success": false,
  "message": "Post not found"
}
```

---

### Unlike a Post

**DELETE** `/posts/:postId/like`

Remove a like from a post.

**Parameters:**
- `postId` (path parameter): Post UUID

**Request Body:**
```json
{
  "userWalletAddress": "rUserWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Post unliked successfully",
  "data": {
    "likesCount": 42
  }
}
```

**Error (400) - Not liked:**
```json
{
  "success": false,
  "message": "You have not liked this post"
}
```

---

### Get Post Likes

**GET** `/posts/:postId/likes?page=1&limit=20`

Get all users who liked a post.

**Parameters:**
- `postId` (path parameter): Post UUID

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Post likes retrieved successfully",
  "data": {
    "likes": [
      {
        "id": "uuid",
        "userWalletAddress": "rUserWalletAddress",
        "user": {
          "walletAddress": "rUserWalletAddress",
          "username": "john_doe",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3
    }
  }
}
```

---

## Post Comment Endpoints

### Add Comment

**POST** `/posts/:postId/comments`

Add a comment to a post. Supports nested replies.

**Parameters:**
- `postId` (path parameter): Post UUID

**Request Body (Top-level comment):**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "Great post! Love the artwork."
}
```

**Request Body (Reply to comment):**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "I agree with you!",
  "parentCommentId": "uuid-of-parent-comment"
}
```

**Fields:**
- `authorWalletAddress` (required): Commenter's wallet address
- `content` (required): Comment text
- `parentCommentId` (optional): UUID of parent comment for replies

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "comment": {
      "id": "uuid",
      "postId": "uuid",
      "authorWalletAddress": "rAuthorWalletAddress",
      "author": {
        "walletAddress": "rAuthorWalletAddress",
        "username": "john_doe",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "content": "Great post! Love the artwork.",
      "parentCommentId": null,
      "likesCount": 0,
      "repliesCount": 0,
      "isEdited": false,
      "createdAt": "2025-01-15T10:30:00.000Z"
    },
    "commentsCount": 6
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "Comment content is required"
}
```

**Error (404):**
```json
{
  "success": false,
  "message": "Parent comment not found"
}
```

---

### Get Post Comments

**GET** `/posts/:postId/comments?page=1&limit=20&parentCommentId=null`

Get comments for a post with pagination. Supports fetching top-level comments or replies to a specific comment.

**Parameters:**
- `postId` (path parameter): Post UUID

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Comments per page (default: 20)
- `parentCommentId` (optional): Filter by parent comment ID. Use `null` for top-level comments, or a UUID for replies

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Comments retrieved successfully",
  "data": {
    "comments": [
      {
        "id": "uuid",
        "postId": "uuid",
        "authorWalletAddress": "rAuthorWalletAddress",
        "author": {
          "walletAddress": "rAuthorWalletAddress",
          "username": "john_doe",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "content": "Great post! Love the artwork.",
        "parentCommentId": null,
        "likesCount": 5,
        "repliesCount": 2,
        "isEdited": false,
        "createdAt": "2025-01-15T10:30:00.000Z",
        "replies": [
          {
            "id": "uuid",
            "authorWalletAddress": "rReplyAuthorAddress",
            "author": {
              "walletAddress": "rReplyAuthorAddress",
              "username": "jane_doe",
              "profileImage": "https://example.com/avatar2.jpg",
              "isVerified": false
            },
            "content": "I agree!",
            "parentCommentId": "parent-uuid",
            "likesCount": 1,
            "repliesCount": 0,
            "isEdited": false,
            "createdAt": "2025-01-15T11:00:00.000Z"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

**Notes:**
- Top-level comments include up to 3 nested replies for preview
- Use `parentCommentId` query param to fetch more replies
- Comments are sorted by creation date (oldest first)

---

### Update Comment

**PUT** `/posts/comments/:commentId`

Update a comment. Only the author can update their comment.

**Parameters:**
- `commentId` (path parameter): Comment UUID

**Request Body:**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress",
  "content": "Updated comment text"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Comment updated successfully",
  "data": {
    "comment": {
      "id": "uuid",
      "postId": "uuid",
      "authorWalletAddress": "rAuthorWalletAddress",
      "author": {
        "walletAddress": "rAuthorWalletAddress",
        "username": "john_doe",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "content": "Updated comment text",
      "parentCommentId": null,
      "likesCount": 5,
      "repliesCount": 2,
      "isEdited": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T12:00:00.000Z"
    }
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "You are not authorized to update this comment"
}
```

---

### Delete Comment

**DELETE** `/posts/comments/:commentId`

Delete a comment (soft delete). Only the author can delete their comment.

**Parameters:**
- `commentId` (path parameter): Comment UUID

**Request Body:**
```json
{
  "authorWalletAddress": "rAuthorWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Comment deleted successfully",
  "data": {
    "commentId": "uuid",
    "commentsCount": 4
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "You are not authorized to delete this comment"
}
```

**Notes:**
- Performs soft delete (sets `isActive` to `false`)
- Deleting a parent comment does not delete its replies
- Updates the post's `commentsCount`

---

### Post Like Data Model

**PostLike:**
```json
{
  "id": "uuid",
  "postId": "uuid",
  "userWalletAddress": "rWallet...",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

---

### Post Comment Data Model

**PostComment:**
```json
{
  "id": "uuid",
  "postId": "uuid",
  "authorWalletAddress": "rWallet...",
  "content": "Comment text...",
  "parentCommentId": null,
  "likesCount": 0,
  "repliesCount": 0,
  "isEdited": false,
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

---

### Example Like & Comment Integration Flow

```javascript
// 1. Get wallet address (from XAMAN connection)
const walletAddress = localStorage.getItem('walletAddress');

// 2. Like a post
const likePost = await fetch(`/api/v1/posts/${postId}/like`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userWalletAddress: walletAddress
  })
});

// 3. Unlike a post
const unlikePost = await fetch(`/api/v1/posts/${postId}/like`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userWalletAddress: walletAddress
  })
});

// 4. Get users who liked a post
const likes = await fetch(`/api/v1/posts/${postId}/likes?page=1&limit=20`);

// 5. Add a comment
const addComment = await fetch(`/api/v1/posts/${postId}/comments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorWalletAddress: walletAddress,
    content: 'Great post!'
  })
});

// 6. Reply to a comment
const replyToComment = await fetch(`/api/v1/posts/${postId}/comments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorWalletAddress: walletAddress,
    content: 'I agree!',
    parentCommentId: parentCommentId
  })
});

// 7. Get post comments
const comments = await fetch(`/api/v1/posts/${postId}/comments?page=1&limit=20`);

// 8. Update a comment
const updateComment = await fetch(`/api/v1/posts/comments/${commentId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorWalletAddress: walletAddress,
    content: 'Updated comment'
  })
});

// 9. Delete a comment
const deleteComment = await fetch(`/api/v1/posts/comments/${commentId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorWalletAddress: walletAddress
  })
});

// 10. Get feed with like status (pass viewerWalletAddress)
const feed = await fetch(
  `/api/v1/posts/feed?page=1&limit=20&viewerWalletAddress=${walletAddress}`
);
```

---

### Post Types

| Type | Description |
|------|-------------|
| `text` | Text-only post (no media) |
| `image` | Post with one or more images |
| `video` | Post with one or more videos |
| `mixed` | Post with both images and videos |

---

### Post Data Models

**Post:**
```json
{
  "id": "uuid",
  "authorWalletAddress": "rWallet...",
  "content": "Post text...",
  "postType": "text|image|video|mixed",
  "visibility": "public|private",
  "likesCount": 0,
  "commentsCount": 0,
  "sharesCount": 0,
  "metadata": {},
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**PostMedia:**
```json
{
  "id": "uuid",
  "postId": "uuid",
  "mediaType": "image|video",
  "mediaUrl": "https://...",
  "thumbnailUrl": "https://...",
  "mimeType": "image/jpeg",
  "fileSize": 1024000,
  "width": 1920,
  "height": 1080,
  "duration": 120,
  "displayOrder": 0,
  "altText": "Description...",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

---

### Example Post Integration Flow

```javascript
// 1. Get wallet address (from XAMAN connection)
const walletAddress = localStorage.getItem('walletAddress');

// 2. Create a text post
const textPost = await fetch('/api/v1/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorWalletAddress: walletAddress,
    content: 'Hello world!'
  })
});

// 3. Create a post with images
const imagePost = await fetch('/api/v1/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorWalletAddress: walletAddress,
    content: 'Check out my photos!',
    media: [
      { mediaType: 'image', mediaUrl: 'https://example.com/photo1.jpg' },
      { mediaType: 'image', mediaUrl: 'https://example.com/photo2.jpg' }
    ]
  })
});

// 4. Get feed
const feed = await fetch('/api/v1/posts/feed?page=1&limit=20');

// 5. Get user's posts
const userPosts = await fetch(`/api/v1/posts/user/${walletAddress}`);

// 6. Delete a post
await fetch(`/api/v1/posts/${postId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorWalletAddress: walletAddress
  })
});
```

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
