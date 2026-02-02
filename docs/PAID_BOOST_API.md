# Paid Boost API Documentation

## Overview

The Paid Boost API allows users to pay XRP to boost the visibility of their posts, NFTs, or collections. Higher boost percentages result in greater visibility through a weighted random selection algorithm.

**Base URL:** `/api/v1/paid-boosts`

---

## Boost Pricing

| Boost Level | Price (XRP/day) | Visibility Weight |
|-------------|-----------------|-------------------|
| 20%         | 5 XRP           | 1x                |
| 40%         | 10 XRP          | 2x                |
| 60%         | 20 XRP          | 3x                |
| 80%         | 35 XRP          | 4x                |
| 100%        | 50 XRP          | 5x                |

---

## Endpoints

### Common Endpoints

#### Get Boost Pricing

```
GET /api/v1/paid-boosts/pricing
```

Returns the current pricing structure for all boost levels.

**Response:**
```json
{
  "success": true,
  "data": {
    "pricing": {
      "20": 5,
      "40": 10,
      "60": 20,
      "80": 35,
      "100": 50
    },
    "currency": "XRP",
    "unit": "per day",
    "availablePercentages": [20, 40, 60, 80, 100]
  }
}
```

---

#### Get User's Paid Boosts

```
GET /api/v1/paid-boosts/user/:walletAddress
```

Returns all active paid boosts for a specific user.

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| walletAddress | string | path | User's wallet address |

**Response:**
```json
{
  "success": true,
  "data": {
    "postBoosts": [...],
    "nftBoosts": [...],
    "collectionBoosts": [...],
    "totalActive": 5
  }
}
```

---

#### Get Boost Statistics

```
GET /api/v1/paid-boosts/stats/:boostId
```

Returns detailed statistics for a specific boost.

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| boostId | UUID | path | The boost ID |
| type | string | query | Type of boost: `post`, `nft`, or `collection` |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "boostPercentage": 60,
    "impressions": 1500,
    "clicks": 45,
    "ctr": "3.00",
    "startDate": "2025-01-15T00:00:00.000Z",
    "endDate": "2025-01-22T00:00:00.000Z",
    "remainingDays": 5,
    "isCurrentlyActive": true,
    "paymentAmount": "140.000000"
  }
}
```

---

#### Cancel a Boost

```
DELETE /api/v1/paid-boosts/:boostId
```

Cancels an active boost (no refunds).

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| boostId | UUID | path | The boost ID |
| type | string | query | Type of boost: `post`, `nft`, or `collection` |
| walletAddress | string | body | User's wallet address (for verification) |

**Response:**
```json
{
  "success": true,
  "message": "Boost cancelled successfully"
}
```

---

### Post Boost Endpoints

#### Create Post Boost

```
POST /api/v1/paid-boosts/posts
```

Creates a paid boost for a post.

**Request Body:**
```json
{
  "postId": "uuid",
  "walletAddress": "rXXXXXXXXXX",
  "boostPercentage": 60,
  "durationDays": 7,
  "paymentTransactionHash": "XXXXXXXX..."
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| postId | UUID | Yes | The post to boost |
| walletAddress | string | Yes | Payer's wallet address |
| boostPercentage | integer | Yes | 20, 40, 60, 80, or 100 |
| durationDays | integer | Yes | Number of days (1-30) |
| paymentTransactionHash | string | No | XRPL transaction hash |

**Response:**
```json
{
  "success": true,
  "message": "Post boost created successfully",
  "data": {
    "boost": {
      "id": "uuid",
      "postId": "uuid",
      "boostPercentage": 60,
      "paymentAmount": "140.000000",
      "startDate": "2025-01-15T00:00:00.000Z",
      "endDate": "2025-01-22T00:00:00.000Z",
      "isActive": true
    },
    "totalCost": 140
  }
}
```

---

#### Get Boosted Posts

```
GET /api/v1/paid-boosts/posts
```

Returns boosted posts sorted by weighted random selection.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| limit | integer | 10 | Number of posts to return |

**Response:**
```json
{
  "success": true,
  "data": {
    "boostedPosts": [
      {
        "id": "uuid",
        "postId": "uuid",
        "boostPercentage": 80,
        "post": {
          "id": "uuid",
          "content": "...",
          "author": {...}
        }
      }
    ],
    "total": 5
  }
}
```

---

#### Record Post Boost Click

```
POST /api/v1/paid-boosts/posts/:boostId/click
```

Records a click/engagement on a boosted post.

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| boostId | UUID | path | The boost ID |

**Response:**
```json
{
  "success": true,
  "message": "Click recorded"
}
```

---

### NFT Boost Endpoints

#### Create NFT Boost

```
POST /api/v1/paid-boosts/nfts
```

Creates a paid boost for an NFT. **NFT metadata is automatically fetched from XRPL** and stored in the boost record.

**Request Body:**
```json
{
  "nftTokenId": "000800003B...",
  "walletAddress": "rXXXXXXXXXX",
  "boostPercentage": 40,
  "durationDays": 14,
  "paymentTransactionHash": "XXXXXXXX...",
  "metadata": {
    "name": "NFT Name (optional)",
    "image": "https://... (optional)",
    "description": "Description (optional)"
  }
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| nftTokenId | string | Yes | The NFT token ID on XRPL |
| walletAddress | string | Yes | Payer's wallet address |
| boostPercentage | integer | Yes | 20, 40, 60, 80, or 100 |
| durationDays | integer | Yes | Number of days (1-30) |
| paymentTransactionHash | string | No | XRPL transaction hash |
| metadata | object | No | Optional NFT details (auto-fetched from XRPL if not provided) |

**Auto-fetched Metadata:**
When creating an NFT boost, the system automatically:
1. Fetches NFT info from XRPL (`nft_info` command)
2. Retrieves metadata from the NFT's URI (IPFS/HTTP)
3. Looks up collection info based on taxon and issuer
4. Stores all data in the `metadata` field for fast retrieval

**Response:**
```json
{
  "success": true,
  "message": "NFT boost created successfully",
  "data": {
    "boost": {
      "id": "uuid",
      "nftTokenId": "000800003B...",
      "userWalletAddress": "rXXXXXXXXXX",
      "boostPercentage": 40,
      "paymentAmount": "140.000000",
      "startDate": "2025-01-15T00:00:00.000Z",
      "endDate": "2025-01-29T00:00:00.000Z",
      "isActive": true,
      "metadata": {
        "name": "Cool NFT #123",
        "image": "ipfs://Qm...",
        "description": "A unique NFT",
        "uri": "ipfs://Qm.../metadata.json",
        "owner": "rXXXXXXXXXX",
        "issuer": "rYYYYYYYYYY",
        "taxon": 12345,
        "collection": {
          "id": "uuid",
          "name": "Cool Collection",
          "slug": "cool-collection",
          "image": "https://...",
          "taxon": 12345,
          "creator": {
            "walletAddress": "rYYYYYYYYYY",
            "username": "creator",
            "profileImage": "https://...",
            "isVerified": true
          }
        },
        "durationDays": 14,
        "dailyRate": 10
      }
    },
    "pricing": {
      "dailyRate": 10,
      "totalDays": 14,
      "totalCost": 140
    }
  }
}
```

---

#### Get Boosted NFTs

```
GET /api/v1/paid-boosts/nfts
```

Returns boosted NFTs sorted by weighted random selection.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| limit | integer | 10 | Number of NFTs to return |

**Response:**
```json
{
  "success": true,
  "data": {
    "boostedNfts": [
      {
        "boostId": "uuid",
        "boostPercentage": 60,
        "nftTokenId": "000800003B...",
        "userWalletAddress": "rXXXXXXXXXX",
        "metadata": {...}
      }
    ],
    "total": 3
  }
}
```

---

#### Record NFT Boost Click

```
POST /api/v1/paid-boosts/nfts/:boostId/click
```

Records a click/engagement on a boosted NFT.

---

### Boosted NFTs Display Endpoint

#### Get Boosted NFTs for Display

```
GET /api/v1/collections/new-nfts
```

**Note:** This endpoint fetches NFTs from the `NftBoosts` table with full metadata.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| limit | integer | 20 | Number of NFTs to return |
| sortBy | string | boost | Sort: `boost`, `price_low`, `price_high`, `recent` |

**Response:**
```json
{
  "success": true,
  "data": {
    "nfts": [
      {
        "nftTokenId": "000800003B...",
        "name": "Cool NFT #123",
        "image": "https://gateway.pinata.cloud/ipfs/Qm...",
        "description": "A unique NFT",
        "price": "10000000",
        "owner": "rXXXXXXXXXX",
        "listedDate": "2025-01-15T00:00:00.000Z",
        "collection": {
          "id": "uuid",
          "name": "Cool Collection",
          "slug": "cool-collection",
          "image": "https://...",
          "taxon": 12345,
          "creator": {
            "walletAddress": "rYYYYYYYYYY",
            "username": "creator",
            "profileImage": "https://...",
            "isVerified": true
          }
        },
        "uri": "ipfs://Qm.../metadata.json",
        "boostId": "uuid",
        "boostPercentage": 60,
        "boostEndDate": "2025-01-22T00:00:00.000Z",
        "boostScore": 3,
        "boostDetails": {
          "percentage": 60,
          "remainingDays": 5,
          "impressions": 1500,
          "clicks": 45
        }
      }
    ],
    "total": 10,
    "limit": 20,
    "sorting": {
      "primary": "boost",
      "secondary": "boost"
    }
  },
  "message": "Boosted NFTs retrieved successfully"
}
```

**Data Fetching Process:**
1. Fetches active boosts from `NftBoosts` table
2. Applies weighted shuffle based on boost percentage
3. For each NFT, attempts to fetch details from XRPL:
   - First tries `nft_info` command
   - Falls back to `getAccountNFTs` if `nft_info` unavailable
   - Fetches metadata from NFT URI
   - Looks up collection based on taxon and issuer
4. Uses stored metadata as fallback
5. Increments impressions counter automatically

---

### Collection Boost Endpoints

#### Create Collection Boost

```
POST /api/v1/paid-boosts/collections
```

Creates a paid boost for a collection. **Collection metadata is automatically fetched** from the database if the collection exists (by ID or slug).

**Request Body:**
```json
{
  "collectionId": "uuid-or-slug",
  "walletAddress": "rXXXXXXXXXX",
  "boostPercentage": 100,
  "durationDays": 7,
  "paymentTransactionHash": "XXXXXXXX...",
  "metadata": {
    "name": "Collection Name (optional override)",
    "image": "https://... (optional override)",
    "description": "Description (optional override)"
  }
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collectionId | string | Yes | Collection UUID or slug |
| walletAddress | string | Yes | Payer's wallet address |
| boostPercentage | integer | Yes | 20, 40, 60, 80, or 100 |
| durationDays | integer | Yes | Number of days (1-30) |
| paymentTransactionHash | string | No | XRPL transaction hash |
| metadata | object | No | Optional overrides (auto-fetched from database if collection exists) |

**Auto-fetched Metadata:**
When creating a collection boost, the system automatically:
1. Tries to find collection by UUID (primary key)
2. Falls back to finding by slug if UUID not found
3. If found, fetches: name, description, image, bannerImage, taxon, category, floorPrice, totalVolume, totalSupply, isVerified, creator info
4. Stores all data in the `metadata` field for fast retrieval

**Response:**
```json
{
  "success": true,
  "message": "Collection boost created successfully",
  "data": {
    "boost": {
      "id": "uuid",
      "collectionId": "uuid-or-slug",
      "userWalletAddress": "rXXXXXXXXXX",
      "boostPercentage": 100,
      "paymentAmount": "350.000000",
      "startDate": "2025-01-15T00:00:00.000Z",
      "endDate": "2025-01-22T00:00:00.000Z",
      "isActive": true,
      "metadata": {
        "id": "uuid",
        "name": "Cool Collection",
        "slug": "cool-collection",
        "description": "An amazing collection",
        "image": "https://...",
        "bannerImage": "https://...",
        "taxon": 12345,
        "category": "art",
        "floorPrice": "1000000",
        "totalVolume": "50000000",
        "totalSupply": 100,
        "isVerified": true,
        "creatorWalletAddress": "rYYYYYYYYYY",
        "creator": {
          "walletAddress": "rYYYYYYYYYY",
          "username": "creator",
          "profileImage": "https://...",
          "isVerified": true
        },
        "durationDays": 7,
        "dailyRate": 50
      }
    },
    "pricing": {
      "dailyRate": 50,
      "totalDays": 7,
      "totalCost": 350
    }
  }
}
```

---

#### Get Boosted Collections

```
GET /api/v1/paid-boosts/collections
```

Returns boosted collections sorted by weighted random selection.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 10 | Number of collections to return |

**Response:**
```json
{
  "success": true,
  "data": {
    "boostedCollections": [
      {
        "boostId": "uuid",
        "boostPercentage": 100,
        "boostEndDate": "2025-01-22T00:00:00.000Z",
        "boostScore": 5,
        "boostDetails": {
          "percentage": 100,
          "remainingDays": 5,
          "impressions": 1500,
          "clicks": 45
        },
        "collectionId": "uuid-or-slug",
        "collection": {
          "id": "uuid",
          "name": "Cool Collection",
          "slug": "cool-collection",
          "description": "An amazing collection",
          "image": "https://...",
          "bannerImage": "https://...",
          "taxon": 12345,
          "category": "art",
          "floorPrice": "1000000",
          "totalVolume": "50000000",
          "totalSupply": 100,
          "isVerified": true,
          "creatorWalletAddress": "rYYYYYYYYYY",
          "creator": {
            "walletAddress": "rYYYYYYYYYY",
            "username": "creator",
            "profileImage": "https://...",
            "isVerified": true
          }
        },
        "userWalletAddress": "rXXXXXXXXXX",
        "user": {
          "walletAddress": "rXXXXXXXXXX",
          "username": "booster123",
          "profileImage": "https://...",
          "isVerified": false,
          "subscriptionPlan": "DEGEN"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  },
  "message": "Boosted collections retrieved successfully"
}
```

---

#### Record Collection Boost Click

```
POST /api/v1/paid-boosts/collections/:boostId/click
```

Records a click/engagement on a boosted collection.

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

### Common Error Codes

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Active boost already exists |
| 500 | Internal Server Error |

---

## Weighted Selection Algorithm

The boost system uses a weighted random selection algorithm:

1. Each boost level corresponds to a weight multiplier:
   - 20% = 1x weight
   - 40% = 2x weight
   - 60% = 3x weight
   - 80% = 4x weight
   - 100% = 5x weight

2. Items are duplicated based on their weight factor
3. The list is shuffled randomly (Fisher-Yates algorithm)
4. Duplicates are removed (keeping first occurrence)
5. Results are returned in the shuffled order

This ensures higher-paying boosts appear more frequently while still giving exposure to all boosted content.

---

## Database Tables

### PostBoosts
- Stores post boost records with payment and analytics data
- Has foreign key to Posts table

### NftBoosts
- Stores NFT boost records with payment and analytics data
- **No foreign key** - uses `nftTokenId` (string) to identify NFTs on XRPL
- Stores NFT metadata in JSON `metadata` field

### CollectionBoosts
- Stores collection boost records with payment and analytics data
- **No foreign key** - uses `collectionId` (string) as independent identifier
- Stores collection metadata in JSON `metadata` field

**Each table tracks:**
- Boost percentage and duration
- Payment amount and transaction hash
- Impressions and clicks
- Active status and timestamps
- Metadata (JSON field for storing related data)

---

## Metadata Field Structure

### NFT Boost Metadata
```json
{
  "name": "NFT Name",
  "image": "https://...",
  "description": "NFT description",
  "uri": "ipfs://...",
  "owner": "rXXXXXXXXXX",
  "issuer": "rYYYYYYYYYY",
  "taxon": 12345,
  "collection": {
    "id": "uuid",
    "name": "Collection Name",
    "slug": "collection-slug",
    "image": "https://...",
    "taxon": 12345,
    "creator": {...}
  },
  "durationDays": 7,
  "dailyRate": 20
}
```

### Collection Boost Metadata
```json
{
  "id": "uuid",
  "name": "Collection Name",
  "slug": "collection-slug",
  "description": "Collection description",
  "image": "https://...",
  "bannerImage": "https://...",
  "taxon": 12345,
  "category": "art",
  "floorPrice": "1000000",
  "totalVolume": "50000000",
  "totalSupply": 100,
  "isVerified": true,
  "creatorWalletAddress": "rYYYYYYYYYY",
  "creator": {
    "walletAddress": "rYYYYYYYYYY",
    "username": "creator",
    "profileImage": "https://...",
    "isVerified": true
  },
  "durationDays": 7,
  "dailyRate": 50
}
```

---

## Integration Notes

1. **Payment Verification**: The `paymentTransactionHash` field allows for XRPL transaction verification
2. **Impression Tracking**: GET endpoints automatically increment impressions counter
3. **Click Tracking**: Call the click endpoints when users interact with boosted content
4. **CTR Calculation**: Click-through rate is calculated as `(clicks / impressions) * 100`
5. **NFT Auto-fetch**: NFT metadata is automatically fetched from XRPL when creating a boost
6. **Collection Auto-fetch**: Collection metadata is automatically fetched from database when creating a boost (by ID or slug)
7. **Metadata Fallback**: If database/XRPL fetch fails, stored metadata or provided metadata is used for display
8. **Collection Independence**: Collection boosts work even if collection doesn't exist in database (uses provided metadata)
