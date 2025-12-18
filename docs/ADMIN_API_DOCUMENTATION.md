# Admin Panel API Documentation

## Overview

The Admin Panel APIs provide comprehensive management capabilities for the NFT marketplace. All admin endpoints are protected and require authentication with an admin wallet.

**Base URL:** `/api/v1/admin`

---

## Authentication

### Admin Access Levels

There are two levels of admin access:

1. **Admin** - Can perform most administrative operations
2. **Super Admin** - Can perform sensitive operations (user deletion, role changes, settings management)

### How Admin Access is Determined

A user is granted admin access if ANY of the following conditions are met:

1. User's `role` field is set to `admin` in the database
2. User's wallet address matches the platform admin wallet configured via:
   - `ADMIN_WALLET_SEED` environment variable
   - `ADMIN_WALLET_SECRET_NUMBERS` environment variable
3. User's wallet address matches `ADMIN_WALLET_ADDRESS` environment variable
4. User's wallet is registered as an active admin wallet of type `treasury` or `marketplace`

### Authentication Header

All admin endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Error Responses

| Status Code | Description |
|-------------|-------------|
| 401 | No token provided / Invalid token / Token expired |
| 403 | Admin access required / Super admin access required |

---

## Response Format

All API responses follow this standard format:

```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Success message",
  "success": true
}
```

### Pagination Format

Paginated endpoints return:

```json
{
  "statusCode": 200,
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  },
  "message": "Success",
  "success": true
}
```

---

## Dashboard & Analytics

### Get Dashboard Overview

Returns overall platform statistics.

```
GET /admin/dashboard
```

**Response:**
```json
{
  "data": {
    "users": {
      "total": 1500,
      "verified": 120,
      "banned": 5,
      "admins": 3,
      "newToday": 25,
      "newThisWeek": 150
    },
    "collections": {
      "total": 200,
      "verified": 50
    },
    "drops": {
      "total": 100,
      "active": 15,
      "totalMints": 5000
    },
    "social": {
      "posts": 3000,
      "activePosts": 2950,
      "comments": 8000,
      "follows": 12000
    },
    "revenue": {
      "totalMintRevenue": "50000000000",
      "totalMintRevenueXrp": "50000.000000",
      "totalPlatformFees": "5000000000",
      "totalPlatformFeesXrp": "5000.000000",
      "totalVolume": "100000000000",
      "totalVolumeXrp": "100000.000000"
    }
  }
}
```

---

### Get Growth Analytics

Returns growth data over a specified time period.

```
GET /admin/dashboard/growth
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 30d | Time period: `7d`, `30d`, `90d`, `365d` |

**Response:**
```json
{
  "data": {
    "period": "30d",
    "days": 30,
    "userGrowth": [
      { "date": "2025-01-01", "count": 25 },
      { "date": "2025-01-02", "count": 30 }
    ],
    "dropGrowth": [
      { "date": "2025-01-01", "count": 5 }
    ],
    "mintGrowth": [
      { "date": "2025-01-01", "count": 100, "revenue": "1000000000" }
    ],
    "postGrowth": [
      { "date": "2025-01-01", "count": 50 }
    ]
  }
}
```

---

### Get Top Creators

Returns top creators ranked by various metrics.

```
GET /admin/dashboard/top-creators
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| metric | string | drops | Ranking metric: `drops`, `mints`, `revenue`, `collections` |
| limit | number | 10 | Number of results to return |

**Response:**
```json
{
  "data": {
    "metric": "mints",
    "topCreators": [
      {
        "creatorWalletAddress": "rXXX...",
        "dropCount": 5,
        "totalMints": 500,
        "creator": {
          "username": "TopCreator",
          "profileImage": "https://...",
          "isVerified": true
        }
      }
    ]
  }
}
```

---

### Get Recent Admin Activities

Returns audit log of admin actions.

```
GET /admin/dashboard/activities
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| action | string | - | Filter by action type |
| targetType | string | - | Filter by target type |
| adminWallet | string | - | Filter by admin wallet |

**Response:**
```json
{
  "data": {
    "activities": [
      {
        "id": "uuid",
        "adminWalletAddress": "rXXX...",
        "action": "user_ban",
        "targetType": "user",
        "targetId": "user-uuid",
        "targetIdentifier": "rYYY...",
        "reason": "Spam activity",
        "createdAt": "2025-01-15T10:00:00Z",
        "admin": {
          "username": "AdminUser",
          "profileImage": "https://..."
        }
      }
    ],
    "pagination": { ... }
  }
}
```

**Action Types:**
- `user_ban`, `user_unban`, `user_verify`, `user_unverify`, `user_role_change`, `user_delete`
- `collection_verify`, `collection_unverify`, `collection_delete`, `collection_update`
- `drop_approve`, `drop_reject`, `drop_pause`, `drop_resume`, `drop_delete`, `drop_update`, `drop_refund`
- `post_delete`, `post_hide`, `comment_delete`
- `setting_update`, `fee_update`
- `admin_wallet_create`, `admin_wallet_update`, `admin_wallet_delete`

---

### Get Platform Health

Returns real-time platform health metrics.

```
GET /admin/dashboard/health
```

**Response:**
```json
{
  "data": {
    "activity": {
      "usersLast24h": 150,
      "usersLastHour": 10,
      "dropsLast24h": 5,
      "mintsLast24h": 200,
      "mintsLastHour": 15,
      "postsLast24h": 100,
      "adminActivitiesLast24h": 25
    },
    "pendingItems": {
      "pendingFeesDrops": 10,
      "unverifiedCollections": 25,
      "hiddenPosts": 5,
      "bannedUsers": 3
    },
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

---

### Get Revenue Breakdown

Returns detailed revenue breakdown by period.

```
GET /admin/dashboard/revenue
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 30d | Time period: `7d`, `30d`, `90d` |

**Response:**
```json
{
  "data": {
    "period": "30d",
    "days": 30,
    "summary": {
      "totalPlatformFees": "5000000000",
      "totalPlatformFeesXrp": "5000.000000",
      "totalMintRevenue": "50000000000",
      "totalMintRevenueXrp": "50000.000000",
      "totalMints": 2000
    },
    "daily": {
      "platformFees": [
        { "date": "2025-01-01", "fees": "100000000", "feesXrp": "100.000000" }
      ],
      "mintRevenue": [
        { "date": "2025-01-01", "revenue": "1000000000", "revenueXrp": "1000.000000", "mintCount": 50 }
      ]
    }
  }
}
```

---

## User Management

### Get All Users

Returns paginated list of users with filtering options.

```
GET /admin/users
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| search | string | - | Search by wallet, username, or email |
| role | string | - | Filter by role: `user`, `admin` |
| isVerified | boolean | - | Filter by verification status |
| isBanned | boolean | - | Filter by ban status |
| sortBy | string | createdAt | Sort field |
| sortOrder | string | DESC | Sort order: `ASC`, `DESC` |

**Response:**
```json
{
  "data": {
    "users": [
      {
        "id": "uuid",
        "walletAddress": "rXXX...",
        "username": "User1",
        "email": "user@example.com",
        "profileImage": "https://...",
        "isVerified": true,
        "isBanned": false,
        "role": "user",
        "createdAt": "2025-01-01T00:00:00Z",
        "stats": {
          "followersCount": 100,
          "followingCount": 50,
          "postsCount": 25,
          "collectionsCount": 3,
          "dropsCount": 2,
          "mintsCount": 15
        }
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Get User Statistics

Returns overall user statistics.

```
GET /admin/users/statistics
```

**Response:**
```json
{
  "data": {
    "totalUsers": 1500,
    "totalAdmins": 3,
    "verifiedUsers": 120,
    "bannedUsers": 5,
    "newUsers": {
      "today": 25,
      "thisWeek": 150,
      "thisMonth": 500
    }
  }
}
```

---

### Get User by Wallet

Returns detailed information about a specific user.

```
GET /admin/users/:walletAddress
```

**Response:**
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "walletAddress": "rXXX...",
      "username": "User1",
      "email": "user@example.com",
      "bio": "Creator bio",
      "profileImage": "https://...",
      "coverImage": "https://...",
      "isVerified": true,
      "isBanned": false,
      "banReason": null,
      "role": "user",
      "socialLinks": { "twitter": "https://..." },
      "createdAt": "2025-01-01T00:00:00Z"
    },
    "stats": {
      "followersCount": 100,
      "followingCount": 50,
      "postsCount": 25,
      "collectionsCount": 3,
      "dropsCount": 2,
      "mintsCount": 15,
      "totalMintRevenue": "10000000000"
    },
    "recentCollections": [...],
    "recentDrops": [...]
  }
}
```

---

### Update User Role

Changes a user's role. **Requires Super Admin.**

```
PUT /admin/users/:walletAddress/role
```

**Request Body:**
```json
{
  "role": "admin",
  "reason": "Promoted to admin for moderation duties"
}
```

**Response:**
```json
{
  "data": {
    "user": { ... }
  },
  "message": "User role updated to admin"
}
```

---

### Verify/Unverify User

Updates a user's verification badge status.

```
PUT /admin/users/:walletAddress/verify
```

**Request Body:**
```json
{
  "isVerified": true,
  "reason": "Identity verified"
}
```

---

### Ban User

Bans a user from the platform.

```
PUT /admin/users/:walletAddress/ban
```

**Request Body:**
```json
{
  "reason": "Violation of terms of service"
}
```

**Notes:**
- Cannot ban yourself
- Only super admin can ban other admins

---

### Unban User

Removes ban from a user.

```
PUT /admin/users/:walletAddress/unban
```

**Request Body:**
```json
{
  "reason": "Ban reviewed and lifted"
}
```

---

### Delete User

Permanently deletes a user. **Requires Super Admin.**

```
DELETE /admin/users/:walletAddress
```

**Request Body:**
```json
{
  "reason": "Account deletion requested"
}
```

---

### Bulk Update Verification

Update verification status for multiple users at once.

```
POST /admin/users/bulk-verify
```

**Request Body:**
```json
{
  "walletAddresses": ["rXXX...", "rYYY..."],
  "isVerified": true,
  "reason": "Batch verification"
}
```

---

## Drop Management

### Get All Drops

Returns paginated list of drops with filtering options.

```
GET /admin/drops
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| search | string | - | Search by name, description, or creator wallet |
| status | string | - | Filter by status |
| platformFeesStatus | string | - | Filter by fees status |
| creatorWallet | string | - | Filter by creator wallet |
| sortBy | string | createdAt | Sort field |
| sortOrder | string | DESC | Sort order |

**Status Values:** `draft`, `scheduled`, `active`, `paused`, `ended`, `sold_out`

**Fees Status Values:** `pending`, `paid`, `failed`, `refunded`

**Response:**
```json
{
  "data": {
    "drops": [
      {
        "id": "uuid",
        "name": "Cool NFT Drop",
        "description": "...",
        "image": "https://...",
        "status": "active",
        "totalSupply": 1000,
        "mintedCount": 250,
        "pricePerNft": "10000000",
        "platformFeesStatus": "paid",
        "remainingSupply": 750,
        "feesBreakdown": {
          "platformFeePerNft": "30000",
          "platformFeePerNftXrp": "0.030000",
          "setupFee": "3000000",
          "setupFeeXrp": "3.000000",
          "totalPlatformFees": "33000000",
          "totalPlatformFeesXrp": "33.000000"
        },
        "creator": {
          "walletAddress": "rXXX...",
          "username": "Creator1",
          "isVerified": true
        },
        "collection": {
          "id": "uuid",
          "name": "My Collection",
          "isVerified": true
        }
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Get Drop Statistics

Returns overall drop statistics.

```
GET /admin/drops/statistics
```

**Response:**
```json
{
  "data": {
    "totalDrops": 100,
    "statusBreakdown": {
      "active": 15,
      "paused": 5,
      "draft": 20,
      "ended": 50,
      "soldOut": 10
    },
    "feesStatus": {
      "paid": 80,
      "pending": 20
    },
    "totalMints": 5000,
    "totalPlatformFeesCollected": "5000000000",
    "totalPlatformFeesCollectedXrp": "5000.000000",
    "totalMintRevenue": "50000000000",
    "totalMintRevenueXrp": "50000.000000",
    "newDrops": {
      "today": 3,
      "thisWeek": 15,
      "thisMonth": 40
    }
  }
}
```

---

### Get Drops with Pending Fees

Returns drops that have pending platform fee payments.

```
GET /admin/drops/pending-fees
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

---

### Get Drop by ID

Returns detailed information about a specific drop.

```
GET /admin/drops/:dropId
```

**Response:**
```json
{
  "data": {
    "drop": {
      "id": "uuid",
      "name": "Cool NFT Drop",
      "description": "...",
      "image": "https://...",
      "bannerImage": "https://...",
      "taxonId": 12345,
      "status": "active",
      "totalSupply": 1000,
      "mintedCount": 250,
      "pricePerNft": "10000000",
      "limitPerWallet": 5,
      "royaltyPercentage": 5,
      "isBurnable": true,
      "isTransferable": true,
      "isOnlyXrp": false,
      "isMintingEnabled": true,
      "isAllowlistEnabled": false,
      "isFreeMint": false,
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-02-01T00:00:00Z",
      "platformFeesStatus": "paid",
      "platformFeesTransactionHash": "ABC123...",
      "authorizedMinterWallet": "rZZZ...",
      "websiteUrl": "https://...",
      "twitterUrl": "https://...",
      "discordUrl": "https://...",
      "remainingSupply": 750,
      "feesBreakdown": { ... },
      "creator": { ... },
      "collection": { ... }
    },
    "stats": {
      "nftCount": 1000,
      "mintCount": 250,
      "allowlistCount": 500,
      "totalRevenue": "2500000000",
      "nftStatusBreakdown": {
        "available": 750,
        "reserved": 0,
        "minted": 250
      }
    }
  }
}
```

---

### Update Drop

Updates drop details.

```
PUT /admin/drops/:dropId
```

**Request Body:**
```json
{
  "name": "Updated Drop Name",
  "description": "Updated description",
  "image": "https://...",
  "bannerImage": "https://...",
  "pricePerNft": "15000000",
  "limitPerWallet": 10,
  "startDate": "2025-01-15T00:00:00Z",
  "endDate": "2025-02-15T00:00:00Z",
  "isMintingEnabled": true,
  "isAllowlistEnabled": false,
  "isFreeMint": false,
  "websiteUrl": "https://...",
  "twitterUrl": "https://...",
  "discordUrl": "https://...",
  "telegramUrl": "https://...",
  "reason": "Updated pricing and dates"
}
```

---

### Update Drop Status

Changes the status of a drop.

```
PUT /admin/drops/:dropId/status
```

**Request Body:**
```json
{
  "status": "active",
  "reason": "Approved for launch"
}
```

---

### Pause Drop

Pauses an active drop, disabling minting.

```
PUT /admin/drops/:dropId/pause
```

**Request Body:**
```json
{
  "reason": "Paused for investigation"
}
```

---

### Resume Drop

Resumes a paused drop.

```
PUT /admin/drops/:dropId/resume
```

**Request Body:**
```json
{
  "status": "active",
  "enableMinting": true,
  "reason": "Investigation complete, resuming drop"
}
```

---

### Update Platform Fees Status

Updates the platform fees payment status for a drop.

```
PUT /admin/drops/:dropId/fees-status
```

**Request Body:**
```json
{
  "platformFeesStatus": "paid",
  "transactionHash": "ABC123...",
  "reason": "Manual payment verification"
}
```

---

### Delete Drop

Permanently deletes a drop and all associated data. **Requires Super Admin.**

```
DELETE /admin/drops/:dropId
```

**Request Body:**
```json
{
  "reason": "Fraudulent drop removed"
}
```

**Notes:**
- Deletes all associated NFTs, mints, and allowlist entries
- Returns count of deleted mints

---

### Get Drop Mints

Returns minting history for a drop.

```
GET /admin/drops/:dropId/mints
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

---

### Get Drop Allowlist

Returns allowlist entries for a drop.

```
GET /admin/drops/:dropId/allowlist
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |

---

## Collection Management

### Get All Collections

Returns paginated list of collections with filtering options.

```
GET /admin/collections
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| search | string | - | Search by name, slug, description, or creator |
| category | string | - | Filter by category |
| isVerified | boolean | - | Filter by verification status |
| creatorWallet | string | - | Filter by creator wallet |
| sortBy | string | createdAt | Sort field |
| sortOrder | string | DESC | Sort order |

**Category Values:** `art`, `music`, `photography`, `sports`, `gaming`, `collectibles`, `other`

---

### Get Collection Statistics

Returns overall collection statistics.

```
GET /admin/collections/statistics
```

**Response:**
```json
{
  "data": {
    "totalCollections": 200,
    "verifiedCollections": 50,
    "unverifiedCollections": 150,
    "totalVolume": "100000000000",
    "totalVolumeXrp": "100000.000000",
    "categoryBreakdown": {
      "art": 80,
      "music": 30,
      "photography": 25,
      "gaming": 40,
      "collectibles": 15,
      "other": 10
    },
    "newCollections": {
      "today": 5,
      "thisWeek": 25,
      "thisMonth": 80
    }
  }
}
```

---

### Get Pending Verification Collections

Returns collections awaiting verification.

```
GET /admin/collections/pending-verification
```

---

### Get Collection by ID

Returns detailed information about a specific collection.

```
GET /admin/collections/:collectionId
```

---

### Update Collection

Updates collection details.

```
PUT /admin/collections/:collectionId
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "image": "https://...",
  "bannerImage": "https://...",
  "category": "art",
  "royaltyPercentage": 10,
  "socialLinks": {
    "twitter": "https://...",
    "discord": "https://..."
  },
  "reason": "Updated collection details"
}
```

---

### Verify/Unverify Collection

Updates a collection's verification status.

```
PUT /admin/collections/:collectionId/verify
```

**Request Body:**
```json
{
  "isVerified": true,
  "reason": "Collection verified after review"
}
```

---

### Delete Collection

Permanently deletes a collection. **Requires Super Admin.**

```
DELETE /admin/collections/:collectionId
```

**Request Body:**
```json
{
  "reason": "Collection removed at creator's request"
}
```

**Notes:**
- Cannot delete collections that have associated drops
- Must remove/reassign drops first

---

### Bulk Verify Collections

Update verification status for multiple collections at once.

```
POST /admin/collections/bulk-verify
```

**Request Body:**
```json
{
  "collectionIds": ["uuid1", "uuid2"],
  "isVerified": true,
  "reason": "Batch verification"
}
```

---

## Post Moderation

### Get All Posts

Returns paginated list of posts with filtering options.

```
GET /admin/posts
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| search | string | - | Search in post content |
| postType | string | - | Filter by type: `text`, `image`, `video`, `mixed` |
| visibility | string | - | Filter by visibility: `public`, `private` |
| isActive | boolean | - | Filter by active status |
| authorWallet | string | - | Filter by author wallet |
| sortBy | string | createdAt | Sort field |
| sortOrder | string | DESC | Sort order |

---

### Get Post Statistics

Returns overall post statistics.

```
GET /admin/posts/statistics
```

**Response:**
```json
{
  "data": {
    "totalPosts": 3000,
    "activePosts": 2950,
    "hiddenPosts": 50,
    "postTypeBreakdown": {
      "text": 1500,
      "image": 1000,
      "video": 300,
      "mixed": 200
    },
    "totalComments": 8000,
    "activeComments": 7900,
    "totalLikes": 25000,
    "newPosts": {
      "today": 100,
      "thisWeek": 500,
      "thisMonth": 1500
    }
  }
}
```

---

### Get Flagged Content

Returns hidden/flagged posts for review.

```
GET /admin/posts/flagged
```

---

### Get Post by ID

Returns detailed information about a specific post.

```
GET /admin/posts/:postId
```

---

### Toggle Post Visibility

Hides or unhides a post.

```
PUT /admin/posts/:postId/visibility
```

**Request Body:**
```json
{
  "isActive": false,
  "reason": "Inappropriate content"
}
```

---

### Delete Post

Permanently deletes a post and all associated data.

```
DELETE /admin/posts/:postId
```

**Request Body:**
```json
{
  "reason": "Violated community guidelines"
}
```

---

### Get All Comments

Returns paginated list of comments with filtering options.

```
GET /admin/comments
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| search | string | - | Search in comment content |
| postId | string | - | Filter by post ID |
| authorWallet | string | - | Filter by author wallet |
| isActive | boolean | - | Filter by active status |
| sortBy | string | createdAt | Sort field |
| sortOrder | string | DESC | Sort order |

---

### Delete Comment

Deletes a comment and its replies.

```
DELETE /admin/comments/:commentId
```

**Request Body:**
```json
{
  "reason": "Spam comment"
}
```

---

### Bulk Delete Posts

Delete multiple posts at once.

```
POST /admin/posts/bulk-delete
```

**Request Body:**
```json
{
  "postIds": ["uuid1", "uuid2"],
  "reason": "Spam cleanup"
}
```

---

### Bulk Hide Posts

Hide or unhide multiple posts at once.

```
POST /admin/posts/bulk-hide
```

**Request Body:**
```json
{
  "postIds": ["uuid1", "uuid2"],
  "isActive": false,
  "reason": "Flagged for review"
}
```

---

## Platform Settings

### Initialize Default Settings

Creates default platform settings. **Requires Super Admin.**

```
POST /admin/settings/initialize
```

**Response:**
```json
{
  "data": {
    "created": ["platform_fee_per_nft", "setup_fee", ...],
    "existing": [],
    "total": 14
  }
}
```

---

### Get All Settings

Returns all platform settings grouped by category.

```
GET /admin/settings
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| category | string | - | Filter by category |
| isPublic | boolean | - | Filter by public visibility |

**Categories:** `fees`, `marketplace`, `drops`, `social`, `notifications`, `general`

**Response:**
```json
{
  "data": {
    "settings": {
      "fees": [
        {
          "id": "uuid",
          "key": "platform_fee_per_nft",
          "value": "30000",
          "type": "number",
          "category": "fees",
          "label": "Platform Fee Per NFT (drops)",
          "description": "Platform fee charged per NFT mint",
          "isPublic": true,
          "isEditable": true,
          "parsedValue": 30000
        }
      ],
      "marketplace": [...],
      "general": [...]
    },
    "total": 14
  }
}
```

---

### Get Public Settings

Returns public settings as key-value pairs. **No authentication required.**

```
GET /admin/settings/public
```

**Response:**
```json
{
  "data": {
    "platform_fee_per_nft": 30000,
    "setup_fee": 3000000,
    "marketplace_fee_percentage": 2.5,
    "min_listing_price": 1000000,
    "max_royalty_percentage": 50,
    "maintenance_mode": false,
    "registration_enabled": true,
    "minting_enabled": true
  }
}
```

---

### Get Setting by Key

Returns a specific setting by its key.

```
GET /admin/settings/:key
```

---

### Update Setting

Updates a setting value. **Requires Super Admin.**

```
PUT /admin/settings/:key
```

**Request Body:**
```json
{
  "value": "50000",
  "label": "Updated Label",
  "description": "Updated description",
  "isPublic": true,
  "reason": "Increased platform fee"
}
```

---

### Reset Setting to Default

Resets a setting to its default value. **Requires Super Admin.**

```
PUT /admin/settings/:key/reset
```

**Request Body:**
```json
{
  "reason": "Reverted to default value"
}
```

---

### Create Setting

Creates a new custom setting. **Requires Super Admin.**

```
POST /admin/settings
```

**Request Body:**
```json
{
  "key": "custom_setting",
  "value": "custom_value",
  "type": "string",
  "category": "general",
  "label": "Custom Setting",
  "description": "A custom platform setting",
  "isPublic": false
}
```

**Type Values:** `string`, `number`, `boolean`, `json`

---

### Delete Setting

Deletes a custom setting. **Requires Super Admin.**

```
DELETE /admin/settings/:key
```

**Request Body:**
```json
{
  "reason": "Setting no longer needed"
}
```

**Notes:**
- Cannot delete default platform settings

---

### Bulk Update Settings

Update multiple settings at once. **Requires Super Admin.**

```
PUT /admin/settings/bulk
```

**Request Body:**
```json
{
  "settings": [
    { "key": "platform_fee_per_nft", "value": "40000" },
    { "key": "setup_fee", "value": "4000000" }
  ],
  "reason": "Fee adjustment"
}
```

---

## Fee Management

### Get Fees Overview

Returns overall platform fees statistics.

```
GET /admin/fees
```

**Response:**
```json
{
  "data": {
    "platformFees": {
      "collected": "5000000000",
      "collectedXrp": "5000.000000",
      "pending": "1000000000",
      "pendingXrp": "1000.000000",
      "failed": "100000000",
      "failedXrp": "100.000000",
      "refunded": "50000000",
      "refundedXrp": "50.000000"
    },
    "mintRevenue": {
      "total": "50000000000",
      "totalXrp": "50000.000000"
    },
    "drops": {
      "paidFees": 80,
      "pendingFees": 20
    },
    "platformFeesWallet": {
      "address": "rPLATFORM...",
      "label": "Platform Fees Wallet"
    }
  }
}
```

---

### Get Fee Transactions

Returns fee transaction history.

```
GET /admin/fees/transactions
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| status | string | - | Filter by fees status |
| sortBy | string | updatedAt | Sort field |
| sortOrder | string | DESC | Sort order |

---

### Get Fee Statistics

Returns fee statistics over a time period.

```
GET /admin/fees/statistics
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 30d | Time period: `7d`, `30d`, `90d`, `365d` |

---

### Get Pending Fees

Returns drops with pending fee payments.

```
GET /admin/fees/pending
```

---

### Get Failed Fees

Returns drops with failed fee payments.

```
GET /admin/fees/failed
```

---

### Export Fee Report

Generates a fee report for export.

```
GET /admin/fees/export
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| startDate | string | - | Filter from date (ISO 8601) |
| endDate | string | - | Filter to date (ISO 8601) |
| status | string | - | Filter by fees status |

**Response:**
```json
{
  "data": {
    "report": [
      {
        "dropId": "uuid",
        "dropName": "Cool NFT Drop",
        "creatorWallet": "rXXX...",
        "totalPlatformFeesDrops": "33000000",
        "totalPlatformFeesXrp": "33.000000",
        "setupFeeDrops": "3000000",
        "setupFeeXrp": "3.000000",
        "feePerNftDrops": "30000",
        "feePerNftXrp": "0.030000",
        "totalSupply": 1000,
        "mintedCount": 250,
        "totalRevenueDrops": "2500000000",
        "totalRevenueXrp": "2500.000000",
        "feesStatus": "paid",
        "transactionHash": "ABC123...",
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-15T00:00:00Z"
      }
    ],
    "summary": {
      "totalRecords": 100,
      "totalFeesCollected": 5000000000,
      "totalFeesCollectedXrp": "5000.000000",
      "totalFeesPending": 1000000000,
      "totalFeesPendingXrp": "1000.000000",
      "totalMintRevenue": 50000000000,
      "totalMintRevenueXrp": "50000.000000"
    },
    "filters": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-31",
      "status": null
    }
  }
}
```

---

### Mark Fees as Paid

Manually marks drop fees as paid.

```
PUT /admin/fees/:dropId/mark-paid
```

**Request Body:**
```json
{
  "transactionHash": "ABC123...",
  "reason": "Manual payment verification"
}
```

---

### Mark Fees as Refunded

Marks drop fees as refunded. **Requires Super Admin.**

```
PUT /admin/fees/:dropId/mark-refunded
```

**Request Body:**
```json
{
  "transactionHash": "DEF456...",
  "reason": "Drop cancelled, fees refunded"
}
```

---

## Default Platform Settings

When initialized, the following default settings are created:

| Key | Default Value | Type | Category | Description |
|-----|---------------|------|----------|-------------|
| `platform_fee_per_nft` | 30000 | number | fees | Platform fee per NFT (0.03 XRP) |
| `setup_fee` | 3000000 | number | fees | Setup fee for drops (3 XRP) |
| `marketplace_fee_percentage` | 2.5 | number | fees | Secondary sales fee % |
| `min_listing_price` | 1000000 | number | marketplace | Minimum listing price (1 XRP) |
| `max_royalty_percentage` | 50 | number | marketplace | Maximum royalty % |
| `max_nfts_per_drop` | 10000 | number | drops | Maximum NFTs per drop |
| `max_mint_per_wallet` | 100 | number | drops | Default max mints per wallet |
| `max_post_length` | 5000 | number | social | Maximum post characters |
| `max_comment_length` | 1000 | number | social | Maximum comment characters |
| `max_media_per_post` | 10 | number | social | Maximum media per post |
| `maintenance_mode` | false | boolean | general | Enable maintenance mode |
| `registration_enabled` | true | boolean | general | Allow new registrations |
| `minting_enabled` | true | boolean | general | Enable platform-wide minting |
| `email_notifications_enabled` | false | boolean | notifications | Enable email notifications |

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently disabled. Can be re-enabled in configuration if needed.

---

## Notes

### XRP Drops Conversion

All monetary values are stored in XRP drops (1 XRP = 1,000,000 drops). API responses include both drop values and XRP-formatted values for convenience.

### Audit Logging

All admin actions are automatically logged to the `AdminActivities` table for audit purposes. Each log entry includes:
- Admin wallet address
- Action type
- Target entity
- Previous and new values (where applicable)
- Reason (if provided)
- Timestamp

### Database Migration

Before using admin features, run the migration:

```bash
npx sequelize-cli db:migrate
```

Then initialize default settings:

```bash
# POST /api/v1/admin/settings/initialize with super admin authentication
```
