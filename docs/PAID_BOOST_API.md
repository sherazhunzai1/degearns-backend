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

Creates a paid boost for an NFT.

**Request Body:**
```json
{
  "nftTokenId": "000800003B...",
  "walletAddress": "rXXXXXXXXXX",
  "boostPercentage": 40,
  "durationDays": 14,
  "paymentTransactionHash": "XXXXXXXX..."
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| nftTokenId | string | Yes | The NFT token ID |
| walletAddress | string | Yes | Payer's wallet address |
| boostPercentage | integer | Yes | 20, 40, 60, 80, or 100 |
| durationDays | integer | Yes | Number of days (1-30) |
| paymentTransactionHash | string | No | XRPL transaction hash |

**Response:**
```json
{
  "success": true,
  "message": "NFT boost created successfully",
  "data": {
    "boost": {...},
    "totalCost": 140
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
    "boostedNfts": [...],
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

### Collection Boost Endpoints

#### Create Collection Boost

```
POST /api/v1/paid-boosts/collections
```

Creates a paid boost for a collection.

**Request Body:**
```json
{
  "collectionId": "uuid",
  "walletAddress": "rXXXXXXXXXX",
  "boostPercentage": 100,
  "durationDays": 7,
  "paymentTransactionHash": "XXXXXXXX..."
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collectionId | UUID | Yes | The collection to boost |
| walletAddress | string | Yes | Payer's wallet address |
| boostPercentage | integer | Yes | 20, 40, 60, 80, or 100 |
| durationDays | integer | Yes | Number of days (1-30) |
| paymentTransactionHash | string | No | XRPL transaction hash |

**Response:**
```json
{
  "success": true,
  "message": "Collection boost created successfully",
  "data": {
    "boost": {...},
    "totalCost": 350
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
| limit | integer | 10 | Number of collections to return |

**Response:**
```json
{
  "success": true,
  "data": {
    "boostedCollections": [...],
    "total": 2
  }
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
3. The list is shuffled randomly
4. Duplicates are removed (keeping first occurrence)
5. Results are returned in the shuffled order

This ensures higher-paying boosts appear more frequently while still giving exposure to all boosted content.

---

## Database Tables

### PostBoosts
- Stores post boost records with payment and analytics data

### NftBoosts
- Stores NFT boost records with payment and analytics data

### CollectionBoosts
- Stores collection boost records with payment and analytics data

Each table tracks:
- Boost percentage and duration
- Payment amount and transaction hash
- Impressions and clicks
- Active status and timestamps

---

## Integration Notes

1. **Payment Verification**: The `paymentTransactionHash` field allows for XRPL transaction verification
2. **Impression Tracking**: Call the GET endpoints to automatically increment impressions
3. **Click Tracking**: Call the click endpoints when users interact with boosted content
4. **CTR Calculation**: Click-through rate is calculated as `(clicks / impressions) * 100`
