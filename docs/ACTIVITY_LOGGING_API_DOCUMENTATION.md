# Activity Logging API Documentation

## Overview

The Activity Logging API allows the frontend to log user activities for the scoring system. When blockchain transactions (NFT buys, sells, mints, etc.) occur on the frontend, these endpoints should be called to record the activity for leaderboard calculations.

### Base URL
```
/api/v1/activities
```

### Authentication
**All endpoints are open and do not require authentication.** The wallet address is passed in the request body for POST endpoints or as a URL parameter for GET endpoints.

---

## Table of Contents

1. [Collection Create](#collection-create)
2. [Drop Create](#drop-create)
3. [NFT Mint](#nft-mint)
4. [NFT Buy](#nft-buy)
5. [NFT Sell](#nft-sell)
6. [NFT List](#nft-list)
7. [NFT Delist](#nft-delist)
8. [Post Create](#post-create)
9. [Get User Activities](#get-user-activities)
10. [Get User Summary](#get-user-summary)

---

## Activity Types

| Activity Type | Category | Description |
|---------------|----------|-------------|
| `collection_create` | Creator | User created a new collection |
| `drop_create` | Creator | User created a new drop |
| `nft_mint` | Trader | User minted an NFT from a drop |
| `nft_buy` | Trader | User purchased an NFT |
| `nft_sell` | Trader/Creator | User sold an NFT |
| `nft_list` | - | User listed an NFT for sale |
| `nft_delist` | - | User removed NFT from sale |
| `post_create` | Influencer | User created a post |

---

## Endpoints

### Collection Create

Log when a user creates a new collection.

```
POST /api/v1/activities/collection-create
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `collectionId` | string (UUID) | Yes | The collection ID from database |
| `transactionHash` | string | No | XRPL transaction hash if applicable |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionHash": "A1B2C3D4E5F6...",
  "metadata": {
    "source": "web",
    "category": "art"
  }
}
```

#### Example Response (Success - 201)

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "activity": {
      "id": "activity-uuid",
      "userWalletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "activityType": "collection_create",
      "relatedId": "550e8400-e29b-41d4-a716-446655440000",
      "relatedType": "collection",
      "transactionHash": "A1B2C3D4E5F6...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "metadata": {
        "collectionName": "My Art Collection",
        "collectionSlug": "my-art-collection",
        "taxon": 12345,
        "source": "web",
        "category": "art"
      },
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Collection creation activity logged successfully"
}
```

#### Example Response (Already Logged - 200)

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "activity": { ... },
    "alreadyLogged": true
  },
  "message": "Activity already logged for this collection"
}
```

#### Errors

| Status | Message |
|--------|---------|
| 400 | Wallet address is required |
| 400 | Collection ID is required |
| 404 | Collection not found or does not belong to this wallet |

---

### Drop Create

Log when a user creates a new drop.

```
POST /api/v1/activities/drop-create
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `dropId` | string (UUID) | Yes | The drop ID |
| `collectionId` | string (UUID) | No | Related collection ID |
| `transactionHash` | string | No | XRPL transaction hash |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "dropId": "660e8400-e29b-41d4-a716-446655440001",
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "dropName": "Genesis Drop",
    "mintPrice": "50000000"
  }
}
```

#### Example Response (Success - 201)

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "activity": {
      "id": "activity-uuid",
      "userWalletAddress": "rXXXX...",
      "activityType": "drop_create",
      "relatedId": "660e8400-e29b-41d4-a716-446655440001",
      "relatedType": "drop",
      "collectionId": "550e8400-e29b-41d4-a716-446655440000",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Drop creation activity logged successfully"
}
```

---

### NFT Mint

Log when a user mints an NFT (from a drop or directly).

```
POST /api/v1/activities/nft-mint
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `transactionHash` | string | Yes | XRPL transaction hash |
| `nftTokenId` | string | No | The NFT token ID on XRPL |
| `collectionId` | string (UUID) | No | Collection ID |
| `dropId` | string (UUID) | No | Drop ID if minted from drop |
| `xrpAmount` | number | No | Amount paid in drops (1 XRP = 1,000,000 drops) |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "transactionHash": "E8F7A6B5C4D3E2F1...",
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "dropId": "660e8400-e29b-41d4-a716-446655440001",
  "xrpAmount": 50000000,
  "metadata": {
    "nftName": "Cool NFT #42"
  }
}
```

#### Example Response (Success - 201)

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "activity": {
      "id": "activity-uuid",
      "userWalletAddress": "rXXXX...",
      "activityType": "nft_mint",
      "relatedId": "660e8400-e29b-41d4-a716-446655440001",
      "relatedType": "drop",
      "collectionId": "550e8400-e29b-41d4-a716-446655440000",
      "transactionHash": "E8F7A6B5C4D3E2F1...",
      "xrpAmount": "50000000.000000",
      "xrpAmountXrp": "50.000000",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "metadata": {
        "nftTokenId": "000800006203F49C21D5D6E0...",
        "nftName": "Cool NFT #42"
      },
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "NFT mint activity logged successfully"
}
```

---

### NFT Buy

Log when a user purchases an NFT.

```
POST /api/v1/activities/nft-buy
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `transactionHash` | string | Yes | XRPL transaction hash |
| `xrpAmount` | number | Yes | Purchase amount in drops |
| `nftTokenId` | string | No | The NFT token ID |
| `collectionId` | string (UUID) | No | Collection ID |
| `sellerWalletAddress` | string | No | Seller's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rBuyerWalletAddress...",
  "transactionHash": "F9E8D7C6B5A4...",
  "xrpAmount": 100000000,
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "sellerWalletAddress": "rSellerWalletAddress...",
  "metadata": {
    "nftName": "Cool NFT #42",
    "marketplace": "degearns"
  }
}
```

#### Example Response (Success - 201)

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "activity": {
      "id": "activity-uuid",
      "userWalletAddress": "rBuyerWallet...",
      "activityType": "nft_buy",
      "relatedType": "nft",
      "collectionId": "550e8400-e29b-41d4-a716-446655440000",
      "transactionHash": "F9E8D7C6B5A4...",
      "xrpAmount": "100000000.000000",
      "xrpAmountXrp": "100.000000",
      "counterpartyWalletAddress": "rSellerWalletAddress...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "NFT buy activity logged successfully"
}
```

#### Errors

| Status | Message |
|--------|---------|
| 400 | Wallet address is required |
| 400 | Transaction hash is required |
| 400 | XRP amount is required |

---

### NFT Sell

Log when a user sells an NFT.

```
POST /api/v1/activities/nft-sell
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `transactionHash` | string | Yes | XRPL transaction hash |
| `xrpAmount` | number | Yes | Sale amount in drops |
| `nftTokenId` | string | No | The NFT token ID |
| `collectionId` | string (UUID) | No | Collection ID |
| `buyerWalletAddress` | string | No | Buyer's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rSellerWalletAddress...",
  "transactionHash": "A1B2C3D4E5F6...",
  "xrpAmount": 150000000,
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "buyerWalletAddress": "rBuyerWalletAddress...",
  "metadata": {
    "nftName": "Cool NFT #42"
  }
}
```

#### Example Response (Success - 201)

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "activity": {
      "id": "activity-uuid",
      "userWalletAddress": "rSellerWallet...",
      "activityType": "nft_sell",
      "relatedType": "nft",
      "collectionId": "550e8400-e29b-41d4-a716-446655440000",
      "transactionHash": "A1B2C3D4E5F6...",
      "xrpAmount": "150000000.000000",
      "xrpAmountXrp": "150.000000",
      "counterpartyWalletAddress": "rBuyerWalletAddress...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "NFT sell activity logged successfully"
}
```

---

### NFT List

Log when a user lists an NFT for sale.

```
POST /api/v1/activities/nft-list
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `transactionHash` | string | Yes | XRPL transaction hash |
| `nftTokenId` | string | No | The NFT token ID |
| `collectionId` | string (UUID) | No | Collection ID |
| `xrpAmount` | number | No | Listing price in drops |
| `offerId` | string | No | XRPL offer ID |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "transactionHash": "B2C3D4E5F6A7...",
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "xrpAmount": 200000000,
  "offerId": "OFFER123456...",
  "metadata": {
    "nftName": "Cool NFT #42"
  }
}
```

#### Example Response (Success - 201)

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "activity": {
      "id": "activity-uuid",
      "userWalletAddress": "rXXXX...",
      "activityType": "nft_list",
      "transactionHash": "B2C3D4E5F6A7...",
      "xrpAmount": "200000000.000000",
      "metadata": {
        "nftTokenId": "000800006203F49C21D5D6E0...",
        "offerId": "OFFER123456...",
        "listPrice": 200000000
      },
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "NFT listing activity logged successfully"
}
```

---

### NFT Delist

Log when a user removes an NFT from sale.

```
POST /api/v1/activities/nft-delist
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `transactionHash` | string | Yes | XRPL transaction hash |
| `nftTokenId` | string | No | The NFT token ID |
| `collectionId` | string (UUID) | No | Collection ID |
| `offerId` | string | No | XRPL offer ID being cancelled |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "transactionHash": "C3D4E5F6A7B8...",
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "offerId": "OFFER123456..."
}
```

#### Example Response (Success - 201)

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "activity": {
      "id": "activity-uuid",
      "userWalletAddress": "rXXXX...",
      "activityType": "nft_delist",
      "transactionHash": "C3D4E5F6A7B8...",
      "metadata": {
        "nftTokenId": "000800006203F49C21D5D6E0...",
        "offerId": "OFFER123456..."
      },
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "NFT delisting activity logged successfully"
}
```

---

### Post Create

Log when a user creates a post.

```
POST /api/v1/activities/post-create
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `postId` | string (UUID) | Yes | The post ID |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "postId": "770e8400-e29b-41d4-a716-446655440002",
  "metadata": {
    "hasMedia": true,
    "mediaType": "image"
  }
}
```

#### Example Response (Success - 201)

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "activity": {
      "id": "activity-uuid",
      "userWalletAddress": "rXXXX...",
      "activityType": "post_create",
      "relatedId": "770e8400-e29b-41d4-a716-446655440002",
      "relatedType": "post",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Post creation activity logged successfully"
}
```

---

### Get User Activities

Get a user's activity history.

```
GET /api/v1/activities/user/:walletAddress
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | User's wallet address |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `activityType` | string | - | Filter by activity type |
| `month` | number | - | Filter by month (1-12) |
| `year` | number | - | Filter by year |

#### Example Request

```
GET /api/v1/activities/user/rXXXXXXXXXXXXXXXXXXXX?page=1&limit=10&activityType=nft_buy&month=12&year=2025
```

#### Example Response (Success - 200)

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "walletAddress": "rXXXX...",
    "activities": [
      {
        "id": "activity-uuid-1",
        "userWalletAddress": "rXXXX...",
        "activityType": "nft_buy",
        "transactionHash": "ABC123...",
        "xrpAmount": "100000000.000000",
        "xrpAmountXrp": "100.000000",
        "counterpartyWalletAddress": "rSeller...",
        "scoringPeriodMonth": 12,
        "scoringPeriodYear": 2025,
        "createdAt": "2025-12-26T10:00:00.000Z"
      },
      {
        "id": "activity-uuid-2",
        "userWalletAddress": "rXXXX...",
        "activityType": "nft_buy",
        "transactionHash": "DEF456...",
        "xrpAmount": "50000000.000000",
        "xrpAmountXrp": "50.000000",
        "scoringPeriodMonth": 12,
        "scoringPeriodYear": 2025,
        "createdAt": "2025-12-25T15:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasMore": true
    }
  },
  "message": "Activities retrieved successfully"
}
```

---

### Get User Summary

Get a user's activity summary for the scoring system.

```
GET /api/v1/activities/user/:walletAddress/summary
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | User's wallet address |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `month` | number | Current month | Month (1-12) |
| `year` | number | Current year | Year |

#### Example Request

```
GET /api/v1/activities/user/rXXXXXXXXXXXXXXXXXXXX/summary?month=12&year=2025
```

#### Example Response (Success - 200)

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "walletAddress": "rXXXX...",
    "period": {
      "month": 12,
      "year": 2025
    },
    "summary": {
      "nft_buy": {
        "totalAmount": 500000000,
        "count": 5
      },
      "nft_sell": {
        "totalAmount": 750000000,
        "count": 3
      },
      "nft_mint": {
        "totalAmount": 150000000,
        "count": 3
      },
      "collection_create": {
        "totalAmount": 0,
        "count": 2
      },
      "post_create": {
        "totalAmount": 0,
        "count": 10
      }
    },
    "totalActivities": 23,
    "activityBreakdown": {
      "trader": {
        "buys": 5,
        "sells": 3,
        "mints": 3,
        "totalVolume": 1250000000
      },
      "creator": {
        "collections": 2,
        "drops": 0,
        "sales": 3
      },
      "influencer": {
        "posts": 10,
        "likesReceived": 0,
        "commentsReceived": 0,
        "followersGained": 0
      }
    }
  },
  "message": "Activity summary retrieved successfully"
}
```

---

## Frontend Integration Guide

### When to Call Each Endpoint

| Frontend Action | API Endpoint | When to Call |
|-----------------|--------------|--------------|
| User creates a collection | `POST /collection-create` | After collection is saved to database |
| User creates a drop | `POST /drop-create` | After drop is saved to database |
| User mints an NFT | `POST /nft-mint` | After `NFTokenMint` transaction succeeds |
| User buys an NFT | `POST /nft-buy` | After `NFTokenAcceptOffer` (buy) transaction succeeds |
| User sells an NFT | `POST /nft-sell` | After `NFTokenAcceptOffer` (sell) transaction succeeds |
| User lists an NFT | `POST /nft-list` | After `NFTokenCreateOffer` (sell) transaction succeeds |
| User delists an NFT | `POST /nft-delist` | After `NFTokenCancelOffer` transaction succeeds |
| User creates a post | `POST /post-create` | After post is saved to database |

### Example: Logging NFT Purchase

```javascript
// After NFTokenAcceptOffer transaction succeeds
async function logNftPurchase(txResult, nftDetails, userWallet) {
  try {
    const response = await fetch('/api/v1/activities/nft-buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress: userWallet,
        transactionHash: txResult.hash,
        xrpAmount: parseInt(txResult.Amount), // in drops
        nftTokenId: nftDetails.nftTokenId,
        collectionId: nftDetails.collectionId,
        sellerWalletAddress: nftDetails.previousOwner,
        metadata: {
          nftName: nftDetails.name,
          marketplace: 'degearns'
        }
      })
    });

    const data = await response.json();

    if (data.data?.alreadyLogged) {
      console.log('Activity was already logged');
    } else {
      console.log('Activity logged successfully');
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Activity logging failure should not block the user
  }
}
```

### Example: Logging Collection Creation

```javascript
// After collection is created in database
async function logCollectionCreation(collectionId, userWallet) {
  try {
    const response = await fetch('/api/v1/activities/collection-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress: userWallet,
        collectionId: collectionId
      })
    });

    const data = await response.json();
    console.log('Collection activity logged:', data);
  } catch (error) {
    console.error('Failed to log collection activity:', error);
  }
}
```

---

## Error Responses

### Common Error Format

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message here"
}
```

### Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Missing or invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Notes

### Duplicate Prevention

All endpoints check for duplicate activities before creating new records:
- For transaction-based activities: Uses `transactionHash` to prevent duplicates
- For entity-based activities: Uses `relatedId` (e.g., `collectionId`, `postId`)

If a duplicate is detected, the API returns the existing activity with `alreadyLogged: true`.

### Scoring Period

Activities are automatically assigned to a scoring period based on when they are logged:
- `scoringPeriodMonth`: Month the activity was logged (1-12)
- `scoringPeriodYear`: Year the activity was logged

This determines which monthly leaderboard the activity counts toward.

### XRP Amount Format

- All XRP amounts should be provided in **drops** (1 XRP = 1,000,000 drops)
- The API response includes both `xrpAmount` (in drops) and `xrpAmountXrp` (in XRP)

### Best Practices

1. **Always log after confirmed transactions** - Only call these APIs after blockchain transactions are confirmed
2. **Handle failures gracefully** - Activity logging failures should not block user flows
3. **Include metadata** - Provide as much context as possible in the metadata field
4. **Use collection IDs** - Always include `collectionId` when available for better analytics
5. **Always include wallet address** - Since APIs are open, wallet address must be provided in every request
