# Activity Logging API Documentation

## Overview

The Activity Logging API allows the frontend to log user activities for the scoring system. When blockchain transactions (NFT buys, sells, mints, etc.) occur on the frontend, these endpoints should be called to record the activity for leaderboard calculations.

### Important Note
**These APIs are independent of database records.** Collections and NFTs are minted on XRPL from the frontend and may not exist in the database until listed for sale. Use `taxon` and `issuerAddress` to identify collections instead of database IDs.

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
9. [Like Give](#like-give)
10. [Like Receive](#like-receive)
11. [Comment Create](#comment-create)
12. [Comment Receive](#comment-receive)
13. [Follow Give](#follow-give)
14. [Follow Receive](#follow-receive)
15. [Get User Activities](#get-user-activities)
16. [Get User Summary](#get-user-summary)

---

## Activity Types

| Activity Type | Category | Description |
|---------------|----------|-------------|
| `collection_create` | Creator | User created a new collection on XRPL |
| `drop_create` | Creator | User created a new drop |
| `nft_mint` | Trader | User minted an NFT from a drop |
| `nft_buy` | Trader | User purchased an NFT |
| `nft_sell` | Trader/Creator | User sold an NFT |
| `nft_list` | - | User listed an NFT for sale |
| `nft_delist` | - | User removed NFT from sale |
| `post_create` | Influencer | User created a post |
| `like_give` | Engagement | User liked someone's post |
| `like_receive` | Influencer | User's post received a like |
| `comment_create` | Engagement | User commented on a post |
| `comment_receive` | Influencer | User's post received a comment |
| `follow_give` | Engagement | User followed another user |
| `follow_receive` | Influencer | User received a new follower |

---

## Endpoints

### Collection Create

Log when a user creates a new collection on XRPL.

```
POST /api/v1/activities/collection-create
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address (creator/issuer) |
| `taxon` | number | Yes | Collection taxon from XRPL (NFTokenTaxon) |
| `collectionName` | string | No | Collection name |
| `transactionHash` | string | No | XRPL transaction hash |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "taxon": 12345,
  "collectionName": "My Art Collection",
  "transactionHash": "A1B2C3D4E5F6...",
  "metadata": {
    "category": "art",
    "description": "A collection of digital art"
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
      "relatedType": "collection",
      "transactionHash": "A1B2C3D4E5F6...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "metadata": {
        "taxon": 12345,
        "collectionName": "My Art Collection",
        "issuerAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "category": "art",
        "description": "A collection of digital art"
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
| 400 | Taxon is required |

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
| `taxon` | number | Yes | Drop/Collection taxon from XRPL |
| `dropName` | string | No | Drop name |
| `transactionHash` | string | No | XRPL transaction hash |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "taxon": 12345,
  "dropName": "Genesis Drop",
  "transactionHash": "B2C3D4E5F6A7...",
  "metadata": {
    "mintPrice": "50000000",
    "maxSupply": 100
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
      "relatedType": "drop",
      "transactionHash": "B2C3D4E5F6A7...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "metadata": {
        "taxon": 12345,
        "dropName": "Genesis Drop",
        "issuerAddress": "rXXXX...",
        "mintPrice": "50000000",
        "maxSupply": 100
      },
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
| `walletAddress` | string | Yes | User's wallet address (minter) |
| `transactionHash` | string | Yes | XRPL transaction hash |
| `nftTokenId` | string | No | The NFT token ID on XRPL |
| `taxon` | number | No | Collection taxon |
| `issuerAddress` | string | No | NFT issuer address |
| `xrpAmount` | number | No | Amount paid in drops (1 XRP = 1,000,000 drops) |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rMinterWalletAddress...",
  "transactionHash": "E8F7A6B5C4D3E2F1...",
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "taxon": 12345,
  "issuerAddress": "rIssuerWalletAddress...",
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
      "userWalletAddress": "rMinterWalletAddress...",
      "activityType": "nft_mint",
      "relatedType": "nft",
      "transactionHash": "E8F7A6B5C4D3E2F1...",
      "xrpAmount": "50000000.000000",
      "xrpAmountXrp": "50.000000",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "metadata": {
        "nftTokenId": "000800006203F49C21D5D6E0...",
        "taxon": 12345,
        "issuerAddress": "rIssuerWalletAddress...",
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
| `walletAddress` | string | Yes | Buyer's wallet address |
| `transactionHash` | string | Yes | XRPL transaction hash |
| `xrpAmount` | number | Yes | Purchase amount in drops |
| `nftTokenId` | string | No | The NFT token ID |
| `taxon` | number | No | Collection taxon |
| `issuerAddress` | string | No | NFT issuer address |
| `sellerWalletAddress` | string | No | Seller's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rBuyerWalletAddress...",
  "transactionHash": "F9E8D7C6B5A4...",
  "xrpAmount": 100000000,
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "taxon": 12345,
  "issuerAddress": "rIssuerWalletAddress...",
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
      "transactionHash": "F9E8D7C6B5A4...",
      "xrpAmount": "100000000.000000",
      "xrpAmountXrp": "100.000000",
      "counterpartyWalletAddress": "rSellerWalletAddress...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "metadata": {
        "nftTokenId": "000800006203F49C21D5D6E0...",
        "taxon": 12345,
        "issuerAddress": "rIssuerWalletAddress...",
        "nftName": "Cool NFT #42",
        "marketplace": "degearns"
      },
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
| `walletAddress` | string | Yes | Seller's wallet address |
| `transactionHash` | string | Yes | XRPL transaction hash |
| `xrpAmount` | number | Yes | Sale amount in drops |
| `nftTokenId` | string | No | The NFT token ID |
| `taxon` | number | No | Collection taxon |
| `issuerAddress` | string | No | NFT issuer address |
| `buyerWalletAddress` | string | No | Buyer's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rSellerWalletAddress...",
  "transactionHash": "A1B2C3D4E5F6...",
  "xrpAmount": 150000000,
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "taxon": 12345,
  "issuerAddress": "rIssuerWalletAddress...",
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
      "transactionHash": "A1B2C3D4E5F6...",
      "xrpAmount": "150000000.000000",
      "xrpAmountXrp": "150.000000",
      "counterpartyWalletAddress": "rBuyerWalletAddress...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "metadata": {
        "nftTokenId": "000800006203F49C21D5D6E0...",
        "taxon": 12345,
        "issuerAddress": "rIssuerWalletAddress...",
        "nftName": "Cool NFT #42"
      },
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
| `taxon` | number | No | Collection taxon |
| `issuerAddress` | string | No | NFT issuer address |
| `xrpAmount` | number | No | Listing price in drops |
| `offerId` | string | No | XRPL offer ID |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "transactionHash": "B2C3D4E5F6A7...",
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "taxon": 12345,
  "issuerAddress": "rIssuerWalletAddress...",
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
      "relatedType": "nft",
      "transactionHash": "B2C3D4E5F6A7...",
      "xrpAmount": "200000000.000000",
      "metadata": {
        "nftTokenId": "000800006203F49C21D5D6E0...",
        "taxon": 12345,
        "issuerAddress": "rIssuerWalletAddress...",
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
| `taxon` | number | No | Collection taxon |
| `issuerAddress` | string | No | NFT issuer address |
| `offerId` | string | No | XRPL offer ID being cancelled |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "transactionHash": "C3D4E5F6A7B8...",
  "nftTokenId": "000800006203F49C21D5D6E0...",
  "taxon": 12345,
  "issuerAddress": "rIssuerWalletAddress...",
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
      "relatedType": "nft",
      "transactionHash": "C3D4E5F6A7B8...",
      "metadata": {
        "nftTokenId": "000800006203F49C21D5D6E0...",
        "taxon": 12345,
        "issuerAddress": "rIssuerWalletAddress...",
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
| `postId` | string (UUID) | Yes | The post ID from database |
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

### Like Give

Log when a user likes someone's post. This contributes to the user's engagement score.

```
POST /api/v1/activities/like-give
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address (the one giving the like) |
| `postId` | string (UUID) | Yes | The post ID being liked |
| `postAuthorWalletAddress` | string | No | Post author's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rLikerWalletAddress...",
  "postId": "770e8400-e29b-41d4-a716-446655440002",
  "postAuthorWalletAddress": "rAuthorWalletAddress..."
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
      "userWalletAddress": "rLikerWalletAddress...",
      "activityType": "like_give",
      "relatedId": "770e8400-e29b-41d4-a716-446655440002",
      "relatedType": "post",
      "counterpartyWalletAddress": "rAuthorWalletAddress...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Like activity logged successfully"
}
```

---

### Like Receive

Log when a user's post receives a like. This contributes to the influencer score.

```
POST /api/v1/activities/like-receive
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | Post author's wallet address (the one receiving the like) |
| `postId` | string (UUID) | Yes | The post ID that was liked |
| `likerWalletAddress` | string | No | Liker's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rAuthorWalletAddress...",
  "postId": "770e8400-e29b-41d4-a716-446655440002",
  "likerWalletAddress": "rLikerWalletAddress..."
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
      "userWalletAddress": "rAuthorWalletAddress...",
      "activityType": "like_receive",
      "relatedId": "770e8400-e29b-41d4-a716-446655440002",
      "relatedType": "post",
      "counterpartyWalletAddress": "rLikerWalletAddress...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Like receive activity logged successfully"
}
```

---

### Comment Create

Log when a user comments on a post. This contributes to the user's engagement score.

```
POST /api/v1/activities/comment-create
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address (the commenter) |
| `postId` | string (UUID) | Yes | The post ID being commented on |
| `commentId` | string (UUID) | No | The comment ID |
| `postAuthorWalletAddress` | string | No | Post author's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rCommenterWalletAddress...",
  "postId": "770e8400-e29b-41d4-a716-446655440002",
  "commentId": "880e8400-e29b-41d4-a716-446655440003",
  "postAuthorWalletAddress": "rAuthorWalletAddress..."
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
      "userWalletAddress": "rCommenterWalletAddress...",
      "activityType": "comment_create",
      "relatedId": "880e8400-e29b-41d4-a716-446655440003",
      "relatedType": "comment",
      "counterpartyWalletAddress": "rAuthorWalletAddress...",
      "metadata": {
        "postId": "770e8400-e29b-41d4-a716-446655440002",
        "commentId": "880e8400-e29b-41d4-a716-446655440003"
      },
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Comment activity logged successfully"
}
```

---

### Comment Receive

Log when a user's post receives a comment. This contributes to the influencer score.

```
POST /api/v1/activities/comment-receive
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | Post author's wallet address (the one receiving the comment) |
| `postId` | string (UUID) | Yes | The post ID that received the comment |
| `commentId` | string (UUID) | No | The comment ID |
| `commenterWalletAddress` | string | No | Commenter's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rAuthorWalletAddress...",
  "postId": "770e8400-e29b-41d4-a716-446655440002",
  "commentId": "880e8400-e29b-41d4-a716-446655440003",
  "commenterWalletAddress": "rCommenterWalletAddress..."
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
      "userWalletAddress": "rAuthorWalletAddress...",
      "activityType": "comment_receive",
      "relatedId": "770e8400-e29b-41d4-a716-446655440002",
      "relatedType": "post",
      "counterpartyWalletAddress": "rCommenterWalletAddress...",
      "metadata": {
        "postId": "770e8400-e29b-41d4-a716-446655440002",
        "commentId": "880e8400-e29b-41d4-a716-446655440003"
      },
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Comment receive activity logged successfully"
}
```

---

### Follow Give

Log when a user follows another user. This contributes to the user's engagement score.

```
POST /api/v1/activities/follow-give
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address (the follower) |
| `followedWalletAddress` | string | Yes | Wallet address of user being followed |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rFollowerWalletAddress...",
  "followedWalletAddress": "rFollowedWalletAddress..."
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
      "userWalletAddress": "rFollowerWalletAddress...",
      "activityType": "follow_give",
      "relatedType": "user",
      "counterpartyWalletAddress": "rFollowedWalletAddress...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Follow activity logged successfully"
}
```

---

### Follow Receive

Log when a user receives a new follower. This contributes to the influencer score.

```
POST /api/v1/activities/follow-receive
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address (the one being followed) |
| `followerWalletAddress` | string | Yes | Follower's wallet address |
| `metadata` | object | No | Additional metadata |

#### Example Request

```json
{
  "walletAddress": "rFollowedWalletAddress...",
  "followerWalletAddress": "rFollowerWalletAddress..."
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
      "userWalletAddress": "rFollowedWalletAddress...",
      "activityType": "follow_receive",
      "relatedType": "user",
      "counterpartyWalletAddress": "rFollowerWalletAddress...",
      "scoringPeriodMonth": 12,
      "scoringPeriodYear": 2025,
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  },
  "message": "Follow receive activity logged successfully"
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
        "metadata": {
          "nftTokenId": "...",
          "taxon": 12345,
          "issuerAddress": "..."
        },
        "createdAt": "2025-12-26T10:00:00.000Z"
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
        "likesReceived": 25,
        "commentsReceived": 12,
        "followersGained": 8
      },
      "engagement": {
        "likesGiven": 45,
        "commentsGiven": 20,
        "followsGiven": 15,
        "totalEngagementActions": 80
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
| User creates a collection | `POST /collection-create` | After XRPL collection creation transaction succeeds |
| User creates a drop | `POST /drop-create` | After drop setup is complete |
| User mints an NFT | `POST /nft-mint` | After `NFTokenMint` transaction succeeds |
| User buys an NFT | `POST /nft-buy` | After `NFTokenAcceptOffer` (buy) transaction succeeds |
| User sells an NFT | `POST /nft-sell` | After `NFTokenAcceptOffer` (sell) transaction succeeds |
| User lists an NFT | `POST /nft-list` | After `NFTokenCreateOffer` (sell) transaction succeeds |
| User delists an NFT | `POST /nft-delist` | After `NFTokenCancelOffer` transaction succeeds |
| User likes a post | ✅ **Automatic** (via POST /posts/:postId/like) | No manual logging needed |
| User comments on a post | ✅ **Automatic** (via POST /posts/:postId/comments) | No manual logging needed |
| User follows someone | ✅ **Automatic** (via POST /follow) | No manual logging needed |
| User creates a post | ✅ **Automatic** (via POST /posts) | No manual logging needed |

> **Note:** Engagement activities (likes, comments, follows, posts) are now **automatically logged** by the backend when using the standard APIs. You do NOT need to call the activity logging endpoints manually for these actions. The backend logs both the "give" and "receive" activities automatically.
>
> The manual activity logging endpoints (`/like-give`, `/like-receive`, `/comment-create`, `/comment-receive`, `/follow-give`, `/follow-receive`, `/post-create`) are still available for edge cases or if you need to log activities outside of the standard API flow.

### Example: Logging Collection Creation

```javascript
// After collection is created on XRPL
async function logCollectionCreation(userWallet, taxon, collectionName, txHash) {
  try {
    const response = await fetch('/api/v1/activities/collection-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress: userWallet,
        taxon: taxon,
        collectionName: collectionName,
        transactionHash: txHash,
        metadata: {
          source: 'web'
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
  }
}
```

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
        taxon: nftDetails.taxon,
        issuerAddress: nftDetails.issuer,
        sellerWalletAddress: nftDetails.previousOwner,
        metadata: {
          nftName: nftDetails.name,
          marketplace: 'degearns'
        }
      })
    });

    const data = await response.json();
    console.log('NFT purchase logged:', data);
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Activity logging failure should not block the user
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
| 500 | Internal Server Error |

---

## Notes

### Duplicate Prevention

All endpoints check for duplicate activities before creating new records:
- For transaction-based activities: Uses `transactionHash` to prevent duplicates
- For collection/drop activities: Uses `walletAddress` + `taxon` combination

If a duplicate is detected, the API returns the existing activity with `alreadyLogged: true`.

### XRPL Integration

These APIs are designed to work with XRPL NFT transactions:
- **taxon**: The `NFTokenTaxon` field from XRPL, used to group NFTs into collections
- **issuerAddress**: The wallet that originally minted the NFT
- **nftTokenId**: The unique `NFTokenID` on XRPL
- **transactionHash**: The XRPL transaction hash for verification

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
4. **Use taxon and issuerAddress** - These identify collections on XRPL instead of database IDs
5. **Always include wallet address** - Since APIs are open, wallet address must be provided in every request
