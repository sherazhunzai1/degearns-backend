# Subscription API Documentation

## Overview

The Subscription APIs provide comprehensive functionality for managing user subscriptions, subscription tiers, and boost-related features. Subscriptions determine a user's boost multiplier which affects their visibility and ranking in leaderboards.

---

## Table of Contents

1. [Subscription Tiers](#subscription-tiers)
2. [Boost Status](#boost-status)
3. [User Subscription](#user-subscription)
4. [Admin Subscription Management](#admin-subscription-management)
5. [Data Models](#data-models)

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

---

## Subscription Tiers

Public endpoints for retrieving subscription tier information.

**Base URL:** `/api/v1/subscription-tiers`

### Get All Subscription Tiers

Retrieves all active subscription tiers with their features and pricing.

```
GET /api/v1/subscription-tiers
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeInactive` | string | `"false"` | Set to `"true"` to include inactive tiers |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "tiers": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "free",
        "displayName": "Free",
        "description": "Get started with basic features",
        "boostMultiplier": 1.0,
        "boostPercentage": 0,
        "boostDisplay": "No boost",
        "monthlyPriceXrp": null,
        "yearlyPriceXrp": null,
        "features": [
          "Basic leaderboard visibility",
          "Standard scoring algorithm",
          "Community access",
          "Basic profile customization"
        ],
        "limits": {
          "analyticsDepth": "basic",
          "supportPriority": "standard",
          "apiRateLimit": 100
        },
        "isActive": true,
        "sortOrder": 0,
        "color": "#6B7280",
        "icon": "user",
        "badge": null
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "name": "basic",
        "displayName": "Basic",
        "description": "Enhanced visibility and analytics",
        "boostMultiplier": 1.1,
        "boostPercentage": 10,
        "boostDisplay": "+10%",
        "monthlyPriceXrp": 10.00,
        "yearlyPriceXrp": 100.00,
        "yearlySavings": {
          "amount": 20.00,
          "percentage": 17
        },
        "features": [
          "10% score boost",
          "Priority leaderboard visibility",
          "Basic analytics dashboard",
          "Enhanced profile customization",
          "Email support"
        ],
        "limits": {
          "analyticsDepth": "basic",
          "supportPriority": "email",
          "apiRateLimit": 500
        },
        "isActive": true,
        "sortOrder": 1,
        "color": "#3B82F6",
        "icon": "star",
        "badge": null
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "name": "pro",
        "displayName": "Pro",
        "description": "Professional tools for serious creators",
        "boostMultiplier": 1.2,
        "boostPercentage": 20,
        "boostDisplay": "+20%",
        "monthlyPriceXrp": 25.00,
        "yearlyPriceXrp": 250.00,
        "yearlySavings": {
          "amount": 50.00,
          "percentage": 17
        },
        "features": [
          "20% score boost",
          "Enhanced leaderboard visibility",
          "Advanced analytics dashboard",
          "Performance insights",
          "Priority email support",
          "Custom profile badge",
          "Early access to new features"
        ],
        "limits": {
          "analyticsDepth": "advanced",
          "supportPriority": "priority",
          "apiRateLimit": 1000
        },
        "isActive": true,
        "sortOrder": 2,
        "color": "#8B5CF6",
        "icon": "zap",
        "badge": "Most Popular"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440004",
        "name": "premium",
        "displayName": "Premium",
        "description": "Maximum visibility and exclusive benefits",
        "boostMultiplier": 1.3,
        "boostPercentage": 30,
        "boostDisplay": "+30%",
        "monthlyPriceXrp": 50.00,
        "yearlyPriceXrp": 500.00,
        "yearlySavings": {
          "amount": 100.00,
          "percentage": 17
        },
        "features": [
          "30% score boost",
          "Maximum leaderboard visibility",
          "Full analytics suite",
          "Real-time performance tracking",
          "Dedicated priority support",
          "Exclusive premium badge",
          "Early access to all features",
          "Featured creator spotlight",
          "API access for integrations"
        ],
        "limits": {
          "analyticsDepth": "full",
          "supportPriority": "dedicated",
          "apiRateLimit": 5000
        },
        "isActive": true,
        "sortOrder": 3,
        "color": "#F59E0B",
        "icon": "crown",
        "badge": "Best Value"
      }
    ],
    "total": 4
  },
  "message": "Subscription tiers retrieved successfully",
  "success": true
}
```

---

### Get Specific Tier

Retrieves details for a specific subscription tier by name.

```
GET /api/v1/subscription-tiers/:name
```

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Tier name: `free`, `basic`, `pro`, or `premium` |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "name": "pro",
    "displayName": "Pro",
    "description": "Professional tools for serious creators",
    "boostMultiplier": 1.2,
    "boostPercentage": 20,
    "boostDisplay": "+20%",
    "monthlyPriceXrp": 25.00,
    "yearlyPriceXrp": 250.00,
    "yearlySavings": {
      "amount": 50.00,
      "percentage": 17
    },
    "features": [...],
    "limits": {...},
    "isActive": true,
    "sortOrder": 2,
    "color": "#8B5CF6",
    "icon": "zap",
    "badge": "Most Popular"
  },
  "message": "Subscription tier retrieved successfully",
  "success": true
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "message": "Tier 'invalid' not found",
  "success": false
}
```

---

### Compare Tiers

Retrieves a side-by-side comparison of all tiers with a feature matrix.

```
GET /api/v1/subscription-tiers/compare
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "tiers": [
      {
        "name": "free",
        "displayName": "Free",
        "description": "Get started with basic features",
        "boostMultiplier": 1.0,
        "boostPercentage": 0,
        "boostDisplay": "No boost",
        "monthlyPriceXrp": null,
        "yearlyPriceXrp": null,
        "yearlySavings": null,
        "featuresCount": 4,
        "color": "#6B7280",
        "icon": "user",
        "badge": null
      },
      {
        "name": "basic",
        "displayName": "Basic",
        "description": "Enhanced visibility and analytics",
        "boostMultiplier": 1.1,
        "boostPercentage": 10,
        "boostDisplay": "+10%",
        "monthlyPriceXrp": 10.00,
        "yearlyPriceXrp": 100.00,
        "yearlySavings": { "amount": 20.00, "percentage": 17 },
        "featuresCount": 5,
        "color": "#3B82F6",
        "icon": "star",
        "badge": null
      },
      ...
    ],
    "featureComparison": [
      {
        "feature": "Basic leaderboard visibility",
        "free": true,
        "basic": false,
        "pro": false,
        "premium": false
      },
      {
        "feature": "10% score boost",
        "free": false,
        "basic": true,
        "pro": false,
        "premium": false
      },
      {
        "feature": "20% score boost",
        "free": false,
        "basic": false,
        "pro": true,
        "premium": false
      },
      {
        "feature": "30% score boost",
        "free": false,
        "basic": false,
        "pro": false,
        "premium": true
      },
      ...
    ],
    "allFeatures": [
      "Basic leaderboard visibility",
      "10% score boost",
      "20% score boost",
      "30% score boost",
      ...
    ]
  },
  "message": "Tier comparison retrieved successfully",
  "success": true
}
```

---

### Get Tier Pricing

Retrieves pricing information for all tiers. Useful for pricing pages.

```
GET /api/v1/subscription-tiers/pricing
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "pricing": [
      {
        "name": "free",
        "displayName": "Free",
        "monthlyPriceXrp": null,
        "yearlyPriceXrp": null,
        "yearlySavings": null,
        "boostPercentage": 0,
        "badge": null,
        "color": "#6B7280",
        "isFree": true
      },
      {
        "name": "basic",
        "displayName": "Basic",
        "monthlyPriceXrp": 10.00,
        "yearlyPriceXrp": 100.00,
        "yearlySavings": { "amount": 20.00, "percentage": 17 },
        "boostPercentage": 10,
        "badge": null,
        "color": "#3B82F6",
        "isFree": false
      },
      {
        "name": "pro",
        "displayName": "Pro",
        "monthlyPriceXrp": 25.00,
        "yearlyPriceXrp": 250.00,
        "yearlySavings": { "amount": 50.00, "percentage": 17 },
        "boostPercentage": 20,
        "badge": "Most Popular",
        "color": "#8B5CF6",
        "isFree": false
      },
      {
        "name": "premium",
        "displayName": "Premium",
        "monthlyPriceXrp": 50.00,
        "yearlyPriceXrp": 500.00,
        "yearlySavings": { "amount": 100.00, "percentage": 17 },
        "boostPercentage": 30,
        "badge": "Best Value",
        "color": "#F59E0B",
        "isFree": false
      }
    ],
    "currency": "XRP"
  },
  "message": "Tier pricing retrieved successfully",
  "success": true
}
```

---

### Get Tier Features

Retrieves feature lists for all tiers or a specific tier.

```
GET /api/v1/subscription-tiers/features
GET /api/v1/subscription-tiers/features/:name
```

**Response (All Tiers):**
```json
{
  "statusCode": 200,
  "data": {
    "tiers": [
      {
        "tier": "free",
        "displayName": "Free",
        "features": [
          "Basic leaderboard visibility",
          "Standard scoring algorithm",
          "Community access",
          "Basic profile customization"
        ],
        "limits": {
          "analyticsDepth": "basic",
          "supportPriority": "standard",
          "apiRateLimit": 100
        }
      },
      {
        "tier": "basic",
        "displayName": "Basic",
        "features": [...],
        "limits": {...}
      },
      ...
    ]
  },
  "message": "All tier features retrieved successfully",
  "success": true
}
```

**Response (Specific Tier):**
```json
{
  "statusCode": 200,
  "data": {
    "tier": "pro",
    "displayName": "Pro",
    "features": [
      "20% score boost",
      "Enhanced leaderboard visibility",
      "Advanced analytics dashboard",
      "Performance insights",
      "Priority email support",
      "Custom profile badge",
      "Early access to new features"
    ],
    "limits": {
      "analyticsDepth": "advanced",
      "supportPriority": "priority",
      "apiRateLimit": 1000
    }
  },
  "message": "Tier features retrieved successfully",
  "success": true
}
```

---

## Boost Status

Public endpoints for checking a user's boost status based on their subscription.

**Base URL:** `/api/v1/boost`

### Get User Boost Status

Retrieves the current boost status for a specific wallet address.

```
GET /api/v1/boost/status/:walletAddress
```

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | User's XRPL wallet address |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "currentPlan": "pro",
    "boostMultiplier": 1.2,
    "boostPercentage": "+20%",
    "isActive": true,
    "expiresAt": "2025-02-15T00:00:00.000Z",
    "availableTiers": {
      "free": { "multiplier": 1.0, "boost": "0%" },
      "basic": { "multiplier": 1.1, "boost": "+10%" },
      "pro": { "multiplier": 1.2, "boost": "+20%" },
      "premium": { "multiplier": 1.3, "boost": "+30%" }
    }
  },
  "message": "Boost status retrieved successfully",
  "success": true
}
```

---

### Calculate Boost Score

Calculates the boost score for content with a user's current subscription.

```
POST /api/v1/boost/calculate
```

**Request Body:**
```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "createdAt": "2025-01-20T12:00:00.000Z",
  "likesCount": 150,
  "commentsCount": 25,
  "sharesCount": 10,
  "viewsCount": 5000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | Content owner's wallet address |
| `createdAt` | string | No | Content creation date (ISO 8601). Defaults to now |
| `likesCount` | number | No | Number of likes |
| `commentsCount` | number | No | Number of comments |
| `sharesCount` | number | No | Number of shares |
| `viewsCount` | number | No | Number of views |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "score": 1.0847,
    "components": {
      "subscription": {
        "planType": "pro",
        "multiplier": 1.2,
        "weighted": 0.6
      },
      "recency": {
        "multiplier": 1.2345,
        "weighted": 0.3704
      },
      "engagement": {
        "multiplier": 1.4567,
        "weighted": 0.2913
      }
    }
  },
  "message": "Boost score calculated successfully",
  "success": true
}
```

---

### Preview Boost Tiers

Preview how content would score across all subscription tiers.

```
POST /api/v1/boost/preview
```

**Request Body:**
```json
{
  "createdAt": "2025-01-20T12:00:00.000Z",
  "likesCount": 150,
  "commentsCount": 25,
  "sharesCount": 10,
  "viewsCount": 5000
}
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "baseMetrics": {
      "recencyBoost": 1.2345,
      "engagementBoost": 1.4567
    },
    "tierComparison": [
      {
        "tier": "free",
        "multiplier": 1.0,
        "boostPercentage": "+0%",
        "finalScore": 0.9847,
        "components": {
          "subscription": 0.5,
          "recency": 0.3704,
          "engagement": 0.2913
        }
      },
      {
        "tier": "basic",
        "multiplier": 1.1,
        "boostPercentage": "+10%",
        "finalScore": 1.0347,
        "components": {
          "subscription": 0.55,
          "recency": 0.3704,
          "engagement": 0.2913
        }
      },
      {
        "tier": "pro",
        "multiplier": 1.2,
        "boostPercentage": "+20%",
        "finalScore": 1.0847,
        "components": {
          "subscription": 0.6,
          "recency": 0.3704,
          "engagement": 0.2913
        }
      },
      {
        "tier": "premium",
        "multiplier": 1.3,
        "boostPercentage": "+30%",
        "finalScore": 1.1347,
        "components": {
          "subscription": 0.65,
          "recency": 0.3704,
          "engagement": 0.2913
        }
      }
    ]
  },
  "message": "Boost tier preview generated successfully",
  "success": true
}
```

---

### Get Boost Leaderboard

Retrieves users ranked by their subscription tier.

```
GET /api/v1/boost/leaderboard
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Number of users to return |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "user": {
          "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          "username": "TopCreator",
          "profileImage": "https://...",
          "isVerified": true
        },
        "subscription": {
          "planType": "premium",
          "boostMultiplier": 1.3,
          "boostPercentage": "+30%",
          "expiresAt": "2025-03-01T00:00:00.000Z"
        },
        "scores": {
          "traderScore": 850.25,
          "creatorScore": 920.50,
          "influencerScore": 780.00
        }
      },
      ...
    ],
    "total": 10
  },
  "message": "Boost leaderboard retrieved successfully",
  "success": true
}
```

---

## User Subscription

Endpoints for authenticated users to manage their subscriptions.

**Base URL:** `/api/v1/leaderboard`

### Get My Subscription

Retrieves the authenticated user's active subscription.

```
GET /api/v1/leaderboard/subscription
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (With Subscription):**
```json
{
  "statusCode": 200,
  "data": {
    "hasActiveSubscription": true,
    "subscription": {
      "id": "uuid-here",
      "userWalletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "planType": "pro",
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-02-01T00:00:00.000Z",
      "isActive": true,
      "boostMultiplier": 1.2,
      "remainingDays": 25,
      "autoRenew": false
    }
  },
  "message": "Subscription retrieved successfully",
  "success": true
}
```

**Response (No Subscription):**
```json
{
  "statusCode": 200,
  "data": {
    "hasActiveSubscription": false,
    "planType": "free",
    "boostMultiplier": 1.0
  },
  "message": "No active subscription",
  "success": true
}
```

---

### Get Subscription Plans

Retrieves available subscription plans with features.

```
GET /api/v1/leaderboard/plans
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "plans": [
      {
        "planType": "free",
        "boostMultiplier": 1.0,
        "boostPercentage": 0,
        "features": [
          "Basic leaderboard visibility",
          "Standard scoring",
          "No boost multiplier"
        ]
      },
      {
        "planType": "basic",
        "boostMultiplier": 1.1,
        "boostPercentage": 10,
        "features": [
          "10% score boost",
          "Priority leaderboard visibility",
          "Basic analytics"
        ]
      },
      {
        "planType": "pro",
        "boostMultiplier": 1.2,
        "boostPercentage": 20,
        "features": [
          "20% score boost",
          "Enhanced leaderboard visibility",
          "Advanced analytics",
          "Priority support"
        ]
      },
      {
        "planType": "premium",
        "boostMultiplier": 1.3,
        "boostPercentage": 30,
        "features": [
          "30% score boost",
          "Maximum leaderboard visibility",
          "Full analytics suite",
          "Priority support",
          "Early access to features"
        ]
      }
    ]
  },
  "message": "Subscription plans retrieved successfully",
  "success": true
}
```

---

## Admin Subscription Management

Admin endpoints for managing user subscriptions. Requires admin authentication.

**Base URL:** `/api/v1/admin`

### Get All Subscriptions

Retrieves all subscriptions with pagination and filtering.

```
GET /api/v1/admin/subscriptions
```

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `status` | string | - | Filter by status: `active` or `expired` |
| `planType` | string | - | Filter by plan: `free`, `basic`, `pro`, `premium` |
| `search` | string | - | Search by wallet address |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "subscriptions": [
      {
        "id": "uuid-here",
        "userWalletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "planType": "pro",
        "startDate": "2025-01-01T00:00:00.000Z",
        "endDate": "2025-02-01T00:00:00.000Z",
        "isActive": true,
        "paymentTransactionHash": "ABCD1234...",
        "paymentAmount": "25000000",
        "autoRenew": false,
        "user": {
          "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          "username": "CoolUser",
          "profileImage": "https://...",
          "isVerified": true
        }
      },
      ...
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "message": "Subscriptions retrieved successfully",
  "success": true
}
```

---

### Get Subscription Statistics

Retrieves subscription statistics for the admin dashboard.

```
GET /api/v1/admin/subscriptions/stats
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "totalByPlan": {
      "free": 1000,
      "basic": 250,
      "pro": 100,
      "premium": 50
    },
    "activeByPlan": {
      "free": 800,
      "basic": 200,
      "pro": 85,
      "premium": 45
    },
    "recentSubscriptions": [
      {
        "id": "uuid-here",
        "userWalletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "planType": "premium",
        "startDate": "2025-01-25T00:00:00.000Z",
        "endDate": "2025-02-25T00:00:00.000Z",
        "user": {
          "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          "username": "NewUser",
          "profileImage": "https://..."
        }
      },
      ...
    ]
  },
  "message": "Subscription statistics retrieved",
  "success": true
}
```

---

### Create Subscription

Creates a new subscription for a user.

```
POST /api/v1/admin/subscriptions
```

**Request Body:**
```json
{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "planType": "pro",
  "durationDays": 30,
  "paymentTransactionHash": "ABCD1234...",
  "paymentAmount": "25000000",
  "notes": "Promotional subscription"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `planType` | string | Yes | Plan type: `basic`, `pro`, or `premium` |
| `durationDays` | number | No | Duration in days (default: 30) |
| `paymentTransactionHash` | string | No | XRPL transaction hash |
| `paymentAmount` | string | No | Amount paid in drops |
| `notes` | string | No | Admin notes |

**Response:**
```json
{
  "statusCode": 201,
  "data": {
    "id": "new-uuid-here",
    "userWalletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "planType": "pro",
    "startDate": "2025-01-27T00:00:00.000Z",
    "endDate": "2025-02-26T00:00:00.000Z",
    "isActive": true,
    "boostMultiplier": 1.2,
    "remainingDays": 30
  },
  "message": "Subscription created successfully",
  "success": true
}
```

---

### Cancel Subscription

Cancels an active subscription.

```
POST /api/v1/admin/subscriptions/:subscriptionId/cancel
```

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `subscriptionId` | string | Subscription UUID |

**Request Body:**
```json
{
  "reason": "User requested cancellation"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid-here",
    "userWalletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "planType": "pro",
    "isActive": false,
    "cancelledAt": "2025-01-27T12:00:00.000Z",
    "cancelReason": "User requested cancellation"
  },
  "message": "Subscription cancelled successfully",
  "success": true
}
```

---

### Extend Subscription

Extends an existing subscription's end date.

```
POST /api/v1/admin/subscriptions/:subscriptionId/extend
```

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `subscriptionId` | string | Subscription UUID |

**Request Body:**
```json
{
  "additionalDays": 15,
  "reason": "Compensation for service outage"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid-here",
    "userWalletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "planType": "pro",
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-02-15T00:00:00.000Z",
    "isActive": true,
    "remainingDays": 40,
    "metadata": {
      "extensions": [
        {
          "additionalDays": 15,
          "previousEndDate": "2025-01-31T00:00:00.000Z",
          "newEndDate": "2025-02-15T00:00:00.000Z",
          "extendedBy": "admin-wallet",
          "reason": "Compensation for service outage",
          "at": "2025-01-27T12:00:00.000Z"
        }
      ]
    }
  },
  "message": "Subscription extended successfully",
  "success": true
}
```

---

### Get User Subscription History

Retrieves detailed user stats including subscription history.

```
GET /api/v1/admin/scoring/user/:walletAddress
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "stats": {
      "user": {
        "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "username": "CoolUser"
      },
      "scores": {
        "traderScore": 850.25,
        "creatorScore": 920.50,
        "influencerScore": 780.00
      }
    },
    "recentActivities": [...],
    "subscriptionHistory": [
      {
        "id": "uuid-1",
        "planType": "pro",
        "startDate": "2025-01-01T00:00:00.000Z",
        "endDate": "2025-02-01T00:00:00.000Z",
        "isActive": true
      },
      {
        "id": "uuid-2",
        "planType": "basic",
        "startDate": "2024-12-01T00:00:00.000Z",
        "endDate": "2025-01-01T00:00:00.000Z",
        "isActive": false
      }
    ]
  },
  "message": "Detailed user stats retrieved",
  "success": true
}
```

---

## Data Models

### SubscriptionTier

Stored in `SubscriptionTiers` table.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | string | Tier identifier: `free`, `basic`, `pro`, `premium` |
| `displayName` | string | Display name for UI |
| `description` | text | Tier description |
| `boostMultiplier` | decimal | Score multiplier (1.0 - 1.30) |
| `boostPercentage` | integer | Boost percentage for display |
| `monthlyPriceXrp` | decimal | Monthly price in XRP |
| `yearlyPriceXrp` | decimal | Yearly price in XRP |
| `features` | JSON | Array of feature strings |
| `limits` | JSON | Tier-specific limits |
| `isActive` | boolean | Whether tier is available |
| `sortOrder` | integer | Display order |
| `color` | string | Theme color (hex) |
| `icon` | string | Icon name |
| `badge` | string | Badge text |

### Subscription

Stored in `Subscriptions` table.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `userWalletAddress` | string | User's wallet address (FK) |
| `planType` | enum | `free`, `basic`, `pro`, `premium` |
| `startDate` | date | Subscription start date |
| `endDate` | date | Subscription end date |
| `isActive` | boolean | Active status |
| `paymentTransactionHash` | string | XRPL transaction hash |
| `paymentAmount` | string | Amount in drops |
| `autoRenew` | boolean | Auto-renewal flag |
| `cancelledAt` | date | Cancellation timestamp |
| `cancelReason` | text | Cancellation reason |
| `metadata` | JSON | Additional data |

---

## Boost Calculation

The boost score is calculated using the following formula:

```
finalScore = (subscriptionBoost × 0.50) + (recencyBoost × 0.30) + (engagementBoost × 0.20)
```

### Weights

| Component | Weight | Description |
|-----------|--------|-------------|
| Subscription | 50% | User's subscription tier multiplier |
| Recency | 30% | How new the content is (decays over 7 days) |
| Engagement | 20% | Likes, comments, shares, views |

### Subscription Multipliers

| Tier | Multiplier | Boost |
|------|------------|-------|
| Free | 1.0x | 0% |
| Basic | 1.10x | +10% |
| Pro | 1.20x | +20% |
| Premium | 1.30x | +30% |

---

## Error Codes

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Admin access required |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error |
