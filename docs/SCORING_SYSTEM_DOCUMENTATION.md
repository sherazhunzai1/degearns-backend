# Weighted Scoring Algorithm & Subscription Boosts

## Summary

The Weighted Scoring Algorithm is a comprehensive **monthly-based** ranking system for the DeGearns NFT Marketplace that calculates and ranks users based on their trading, creation, and social influence activities within each calendar month. The system supports subscription-based boost multipliers that give paying users an advantage in the leaderboards.

### Key Features

- **Monthly Rankings**: Each month has separate leaderboards for traders, creators, and influencers
- **Three Scoring Categories**: Traders, Creators, and Influencers
- **Subscription Tiers**: Free, Basic, Pro, and Premium with increasing boost multipliers
- **Automated Recalculation**: Hourly cron jobs recalculate all user scores for the current month
- **Historical Data**: View past months' rankings via API with month/year parameters
- **Real-time Leaderboards**: Public API endpoints for accessing rankings
- **Admin Management**: Full control over subscriptions and manual score recalculation

---

## Table of Contents

1. [How the System Works](#how-the-system-works)
2. [Scoring Categories & Weights](#scoring-categories--weights)
3. [Subscription Tiers & Boosts](#subscription-tiers--boosts)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Cron Jobs](#cron-jobs)
7. [Configuration](#configuration)
8. [Usage Examples](#usage-examples)

---

## How the System Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DeGearns NFT Marketplace                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │───▶│   Backend    │───▶│    MySQL     │      │
│  │   React.js   │    │   Node.js    │    │   Database   │      │
│  └──────────────┘    └──────┬───────┘    └──────────────┘      │
│                             │                                   │
│                             ▼                                   │
│                      ┌──────────────┐                          │
│                      │   Scoring    │  ◀── Cron Jobs           │
│                      │   Engine     │      (hourly)            │
│                      └──────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Monthly Scoring Flow

1. **Activity Logging**: User activities (trades, mints, posts, follows, etc.) are logged in the `ActivityLogs` table with timestamps
2. **Monthly Aggregation**: The scoring engine aggregates raw metrics from activity logs for the specific calendar month
3. **Normalization**: Metrics are normalized to a 0-100 scale relative to the maximum values in the system
4. **Weighted Calculation**: Normalized metrics are multiplied by category-specific weights
5. **Boost Application**: Base scores are multiplied by the user's subscription boost multiplier
6. **Storage**: Final boosted scores are stored in the `UserStats` table (updated for current month)
7. **Monthly Leaderboard**: Users are ranked by their boosted scores in each category for the specific month

### Monthly Reset Behavior

- At the start of each month, scores reset to 0 and are recalculated based on that month's activity
- Historical rankings are preserved and can be viewed by passing `month` and `year` query parameters
- Example: View December 2025 rankings with `?month=12&year=2025`

### Formula

```
Final Score = Base Score × Boost Multiplier

Where:
Base Score = Σ (Normalized Metric × Weight)
```

---

## Scoring Categories & Weights

### Top Traders

Measures trading activity and profitability.

| Metric | Weight | Description |
|--------|--------|-------------|
| Volume Bought | 25% | Total XRP spent buying NFTs |
| Volume Sold | 25% | Total XRP earned from selling NFTs |
| Number of Trades | 20% | Total count of buy/sell transactions |
| Unique Collections | 15% | Number of different collections traded |
| Profit Margin | 15% | Percentage profit from trading |

```javascript
traderScore = (
  (volumeBought × 0.25) +
  (volumeSold × 0.25) +
  (trades × 0.20) +
  (uniqueCollections × 0.15) +
  (profitMargin × 0.15)
) × boostMultiplier
```

### Top Creators

Measures creation and sales success.

| Metric | Weight | Description |
|--------|--------|-------------|
| Sales Volume | 30% | Total revenue from NFT sales |
| NFTs Sold | 20% | Number of NFTs sold |
| Collections Created | 15% | Number of collections created |
| Average Price | 15% | Average sale price of NFTs |
| Unique Buyers | 20% | Number of unique buyers |

```javascript
creatorScore = (
  (salesVolume × 0.30) +
  (nftsSold × 0.20) +
  (collections × 0.15) +
  (avgPrice × 0.15) +
  (uniqueBuyers × 0.20)
) × boostMultiplier
```

### Top Influencers

Measures social influence and engagement.

| Metric | Weight | Description |
|--------|--------|-------------|
| Followers | 25% | Total follower count |
| Likes Received | 20% | Total likes on posts |
| Comments Received | 20% | Total comments on posts |
| Posts Created | 15% | Number of posts created |
| Engagement Rate | 20% | (likes + comments) / (followers × posts) |

```javascript
influencerScore = (
  (followers × 0.25) +
  (likes × 0.20) +
  (comments × 0.20) +
  (posts × 0.15) +
  (engagementRate × 0.20)
) × boostMultiplier
```

---

## Subscription Tiers & Boosts

### Available Tiers

| Tier | Boost Multiplier | Boost Percentage | Monthly Price (Suggested) |
|------|------------------|------------------|---------------------------|
| Free | 1.00x | 0% | - |
| Basic | 1.10x | +10% | 10 XRP |
| Pro | 1.20x | +20% | 25 XRP |
| Premium | 1.30x | +30% | 50 XRP |

### Example Impact

If a user has a base trader score of 75:

| Tier | Calculation | Final Score |
|------|-------------|-------------|
| Free | 75 × 1.00 | 75.00 |
| Basic | 75 × 1.10 | 82.50 |
| Pro | 75 × 1.20 | 90.00 |
| Premium | 75 × 1.30 | 97.50 |

---

## Database Schema

### Subscriptions Table

```sql
CREATE TABLE Subscriptions (
  id UUID PRIMARY KEY,
  userWalletAddress VARCHAR(100) NOT NULL,
  planType ENUM('free', 'basic', 'pro', 'premium') DEFAULT 'free',
  startDate DATETIME NOT NULL,
  endDate DATETIME NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  paymentTransactionHash VARCHAR(100),
  paymentAmount VARCHAR(50),
  autoRenew BOOLEAN DEFAULT FALSE,
  cancelledAt DATETIME,
  cancelReason TEXT,
  metadata JSON,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### UserStats Table

```sql
CREATE TABLE UserStats (
  id UUID PRIMARY KEY,
  userWalletAddress VARCHAR(100) UNIQUE NOT NULL,

  -- Trader Metrics
  totalVolumeBought DECIMAL(30, 6) DEFAULT 0,
  totalVolumeSold DECIMAL(30, 6) DEFAULT 0,
  numberOfTrades INT DEFAULT 0,
  uniqueCollectionsTraded INT DEFAULT 0,
  profitMargin DECIMAL(10, 4) DEFAULT 0,
  traderScore DECIMAL(20, 6) DEFAULT 0,

  -- Creator Metrics
  totalSalesVolume DECIMAL(30, 6) DEFAULT 0,
  nftsSold INT DEFAULT 0,
  collectionsCreated INT DEFAULT 0,
  averageNftPrice DECIMAL(30, 6) DEFAULT 0,
  uniqueBuyers INT DEFAULT 0,
  creatorScore DECIMAL(20, 6) DEFAULT 0,

  -- Influencer Metrics
  followersCount INT DEFAULT 0,
  totalLikesReceived INT DEFAULT 0,
  totalCommentsReceived INT DEFAULT 0,
  postsCreated INT DEFAULT 0,
  engagementRate DECIMAL(10, 4) DEFAULT 0,
  influencerScore DECIMAL(20, 6) DEFAULT 0,

  -- Boosted Scores
  boostedTraderScore DECIMAL(20, 6) DEFAULT 0,
  boostedCreatorScore DECIMAL(20, 6) DEFAULT 0,
  boostedInfluencerScore DECIMAL(20, 6) DEFAULT 0,

  -- Meta
  currentBoostMultiplier DECIMAL(5, 2) DEFAULT 1.0,
  lastCalculatedAt DATETIME,
  calculationVersion INT DEFAULT 1,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### ActivityLogs Table

```sql
CREATE TABLE ActivityLogs (
  id UUID PRIMARY KEY,
  userWalletAddress VARCHAR(100) NOT NULL,
  activityType ENUM(
    'nft_buy', 'nft_sell', 'nft_mint', 'nft_list', 'nft_delist',
    'collection_create', 'drop_create', 'post_create', 'comment_create',
    'like_give', 'like_receive', 'comment_receive', 'follow_give', 'follow_receive'
  ) NOT NULL,
  relatedId UUID,
  relatedType VARCHAR(50),
  xrpAmount DECIMAL(30, 6) DEFAULT 0,
  transactionHash VARCHAR(100),
  counterpartyWalletAddress VARCHAR(100),
  collectionId UUID,
  metadata JSON,
  scoringPeriodMonth INT,
  scoringPeriodYear INT,
  processedForScoring BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

---

## API Reference

### Public Endpoints

#### Get Available Periods

Get available months for historical leaderboard data.

```
GET /api/v1/leaderboard/periods
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "currentPeriod": {
      "month": 12,
      "year": 2025,
      "name": "December 2025"
    },
    "availablePeriods": [
      {
        "month": 12,
        "year": 2025,
        "name": "December 2025",
        "isCurrent": true
      },
      {
        "month": 11,
        "year": 2025,
        "name": "November 2025",
        "isCurrent": false
      }
    ]
  },
  "message": "Available periods retrieved successfully"
}
```

#### Get Leaderboard

Retrieve rankings for a specific category and month.

```
GET /api/v1/leaderboard/:type
```

**Parameters:**
- `type`: `traders` | `creators` | `influencers`
- `page` (query): Page number (default: 1)
- `limit` (query): Results per page (default: 20, max: 100)
- `month` (query): Month (1-12), defaults to current month
- `year` (query): Year (e.g., 2025), defaults to current year

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "category": "traders",
    "period": {
      "month": 12,
      "year": 2025,
      "name": "December 2025"
    },
    "leaderboard": [
      {
        "rank": 1,
        "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "score": 97.50,
        "baseScore": 75.00,
        "boostMultiplier": 1.30,
        "planType": "premium",
        "user": {
          "walletAddress": "rXXXX...",
          "username": "TopTrader",
          "profileImage": "https://...",
          "isVerified": true
        },
        "metrics": {
          "volumeBought": 1500000000,
          "volumeBoughtXrp": "1500.000000",
          "volumeSold": 2000000000,
          "volumeSoldXrp": "2000.000000",
          "trades": 150,
          "uniqueCollections": 25,
          "profitMargin": 33.33
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 500,
      "totalPages": 25,
      "hasMore": true
    }
  },
  "message": "Top traders retrieved successfully"
}
```

#### Get User Stats

Retrieve detailed stats for a specific user for a given month.

```
GET /api/v1/leaderboard/user/:walletAddress
```

**Query Parameters:**
- `month` (query): Month (1-12), defaults to current month
- `year` (query): Year (e.g., 2025), defaults to current year

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "walletAddress": "rXXXX...",
      "username": "TopTrader",
      "profileImage": "https://...",
      "isVerified": true
    },
    "subscription": {
      "planType": "premium",
      "boostMultiplier": 1.30,
      "remainingDays": 25
    },
    "stats": {
      "totalVolumeBought": "1500000000",
      "totalVolumeSold": "2000000000",
      "numberOfTrades": 150,
      "traderScore": "75.000000",
      "boostedTraderScore": "97.500000",
      "creatorScore": "45.000000",
      "boostedCreatorScore": "58.500000",
      "influencerScore": "30.000000",
      "boostedInfluencerScore": "39.000000"
    },
    "ranks": {
      "trader": 1,
      "creator": 15,
      "influencer": 42
    },
    "lastCalculatedAt": "2025-12-26T10:00:00.000Z"
  },
  "message": "User stats retrieved successfully"
}
```

#### Get User Ranks

Get a user's rank in each category for a given month.

```
GET /api/v1/leaderboard/user/:walletAddress/ranks
```

**Query Parameters:**
- `month` (query): Month (1-12), defaults to current month
- `year` (query): Year (e.g., 2025), defaults to current year

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "walletAddress": "rXXXX...",
    "period": {
      "month": 12,
      "year": 2025,
      "name": "December 2025"
    },
    "ranks": {
      "trader": 1,
      "creator": 15,
      "influencer": 42
    }
  },
  "message": "User ranks retrieved successfully"
}
```

#### Get Subscription Plans

Get available subscription plans and their boost multipliers.

```
GET /api/v1/leaderboard/plans
```

**Response:**
```json
{
  "success": true,
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
        "boostMultiplier": 1.10,
        "boostPercentage": 10,
        "features": [
          "10% score boost",
          "Priority leaderboard visibility",
          "Basic analytics"
        ]
      },
      {
        "planType": "pro",
        "boostMultiplier": 1.20,
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
        "boostMultiplier": 1.30,
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
  "message": "Subscription plans retrieved successfully"
}
```

#### Get Leaderboard Stats

Get overall leaderboard statistics for a given month.

```
GET /api/v1/leaderboard/stats
```

**Query Parameters:**
- `month` (query): Month (1-12), defaults to current month
- `year` (query): Year (e.g., 2025), defaults to current year

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "period": {
      "month": 12,
      "year": 2025,
      "name": "December 2025"
    },
    "totalUsers": 5000,
    "subscribedUsers": 250,
    "averageScores": {
      "trader": "25.50",
      "creator": "18.75",
      "influencer": "12.30"
    },
    "lastUpdated": "2025-12-26T10:00:00.000Z"
  },
  "message": "Leaderboard statistics retrieved successfully"
}
```

#### Compare Users

Compare stats between two users for a given month.

```
GET /api/v1/leaderboard/compare/:walletAddress1/:walletAddress2
```

**Query Parameters:**
- `month` (query): Month (1-12), defaults to current month
- `year` (query): Year (e.g., 2025), defaults to current year

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "period": {
      "month": 12,
      "year": 2025,
      "name": "December 2025"
    },
    "user1": { /* full user stats */ },
    "user2": { /* full user stats */ },
    "comparison": {
      "trader": {
        "user1Score": 97.50,
        "user2Score": 85.00,
        "winner": "rWallet1..."
      },
      "creator": {
        "user1Score": 58.50,
        "user2Score": 72.00,
        "winner": "rWallet2..."
      },
      "influencer": {
        "user1Score": 39.00,
        "user2Score": 45.00,
        "winner": "rWallet2..."
      }
    }
  },
  "message": "User comparison retrieved successfully"
}
```

### Authenticated Endpoints

#### Get My Subscription

Get the authenticated user's active subscription.

```
GET /api/v1/leaderboard/subscription
Authorization: Bearer <token>
```

#### Recalculate My Scores

Trigger score recalculation for the authenticated user for a specific month.

```
POST /api/v1/leaderboard/recalculate
Authorization: Bearer <token>
```

**Query Parameters:**
- `month` (query): Month (1-12), defaults to current month
- `year` (query): Year (e.g., 2025), defaults to current year

### Admin Endpoints

#### Recalculate All Scores

Trigger a full score recalculation for all users.

```
POST /api/v1/admin/scoring/recalculate-all
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "processed": 5000,
    "errors": 0,
    "total": 5000,
    "durationMs": 45000
  },
  "message": "Score recalculation completed"
}
```

#### Recalculate User Scores

Recalculate scores for a specific user.

```
POST /api/v1/admin/scoring/recalculate/:walletAddress
```

#### Get Scoring Jobs Status

Get the status of scoring cron jobs.

```
GET /api/v1/admin/scoring/jobs/status
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "jobs": 3,
    "running": {
      "recalculate": false,
      "fullRebuild": false,
      "checkSubscriptions": false
    },
    "schedules": {
      "recalculateScores": "0 * * * *",
      "fullRebuild": "0 3 * * *",
      "checkSubscriptions": "*/15 * * * *"
    }
  },
  "message": "Scoring jobs status retrieved"
}
```

#### Get Scoring Configuration

Get the current scoring configuration.

```
GET /api/v1/admin/scoring/config
```

#### Get Detailed User Stats

Get detailed user stats with activity log.

```
GET /api/v1/admin/scoring/user/:walletAddress
```

#### List Subscriptions

Get all subscriptions with pagination and filters.

```
GET /api/v1/admin/subscriptions
```

**Query Parameters:**
- `page`: Page number
- `limit`: Results per page
- `status`: `active` | `expired`
- `planType`: `free` | `basic` | `pro` | `premium`
- `search`: Search by wallet address

#### Get Subscription Stats

Get subscription statistics.

```
GET /api/v1/admin/subscriptions/stats
```

#### Create Subscription

Create or update a subscription for a user.

```
POST /api/v1/admin/subscriptions
Content-Type: application/json

{
  "walletAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "planType": "premium",
  "durationDays": 30,
  "paymentTransactionHash": "XXXXXXX...",
  "paymentAmount": "50000000",
  "notes": "Manual subscription creation"
}
```

#### Cancel Subscription

Cancel a subscription.

```
POST /api/v1/admin/subscriptions/:subscriptionId/cancel
Content-Type: application/json

{
  "reason": "User requested cancellation"
}
```

#### Extend Subscription

Extend a subscription's duration.

```
POST /api/v1/admin/subscriptions/:subscriptionId/extend
Content-Type: application/json

{
  "additionalDays": 30,
  "reason": "Courtesy extension"
}
```

---

## Cron Jobs

### Schedule Overview

| Job | Schedule | Description |
|-----|----------|-------------|
| Score Recalculation | Every hour (0 * * * *) | Recalculates scores for all users |
| Full Rebuild | Daily at 3 AM (0 3 * * *) | Complete stats rebuild from activity logs |
| Subscription Check | Every 15 min (*/15 * * * *) | Check for expired subscriptions |

### Enabling/Disabling

Cron jobs are enabled by default. To disable them, set in `.env`:

```env
ENABLE_SCORING_JOBS=false
```

### Manual Triggering

Admins can manually trigger recalculation via the admin API endpoints.

---

## Configuration

### Scoring Configuration File

Location: `src/config/scoring.js`

```javascript
module.exports = {
  // Subscription boost multipliers
  boostMultipliers: {
    free: 1.0,
    basic: 1.10,
    pro: 1.20,
    premium: 1.30
  },

  // Trader scoring weights
  traderWeights: {
    volumeBought: 0.25,
    volumeSold: 0.25,
    trades: 0.20,
    uniqueCollections: 0.15,
    profitMargin: 0.15
  },

  // Creator scoring weights
  creatorWeights: {
    salesVolume: 0.30,
    nftsSold: 0.20,
    collections: 0.15,
    avgPrice: 0.15,
    uniqueBuyers: 0.20
  },

  // Influencer scoring weights
  influencerWeights: {
    followers: 0.25,
    likes: 0.20,
    comments: 0.20,
    posts: 0.15,
    engagement: 0.20
  },

  // Scoring periods (monthly-based)
  periods: {
    useMonthlyPeriod: true,
    recalculationIntervalMs: 3600000,
    batchSize: 100
  },

  // Normalization settings
  normalization: {
    maxScore: 100,
    minLeaderboardScore: 0.01
  },

  // Cron schedules
  cronSchedules: {
    recalculateScores: '0 * * * *',
    fullRebuild: '0 3 * * *',
    checkSubscriptions: '*/15 * * * *'
  },

  algorithmVersion: 1
};
```

---

## Usage Examples

### Logging Activity for Scoring

When a user performs an action that should be tracked:

```javascript
const { ActivityLog } = require('./models');

// Log an NFT purchase
await ActivityLog.logActivity({
  userWalletAddress: 'rBuyerWallet...',
  activityType: 'nft_buy',
  xrpAmount: 100000000, // 100 XRP in drops
  transactionHash: 'XXXXXX...',
  counterpartyWalletAddress: 'rSellerWallet...',
  collectionId: 'collection-uuid',
  metadata: {
    nftId: 'nft-uuid',
    nftName: 'Cool NFT #1'
  }
});

// Log the corresponding sale for the seller
await ActivityLog.logActivity({
  userWalletAddress: 'rSellerWallet...',
  activityType: 'nft_sell',
  xrpAmount: 100000000,
  transactionHash: 'XXXXXX...',
  counterpartyWalletAddress: 'rBuyerWallet...',
  collectionId: 'collection-uuid'
});
```

### Manually Recalculating Scores

```javascript
const ScoringEngine = require('./services/scoringEngine');
const models = require('./models');

const scoringEngine = new ScoringEngine(models);

// Recalculate for a single user
const result = await scoringEngine.calculateUserScores('rWalletAddress...');
console.log(result.boostedScores);

// Recalculate for all users
const summary = await scoringEngine.recalculateAllScores({
  onProgress: (progress) => {
    console.log(`${progress.processed}/${progress.total} users processed`);
  }
});
```

### Creating a Subscription

```javascript
const { Subscription } = require('./models');

const subscription = await Subscription.create({
  userWalletAddress: 'rWalletAddress...',
  planType: 'premium',
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  isActive: true,
  paymentTransactionHash: 'XXXXXX...',
  paymentAmount: '50000000' // 50 XRP in drops
});
```

---

## Migration

To apply the database migrations:

```bash
npm run db:migrate
```

This will create the following tables:
- `Subscriptions`
- `UserStats`
- `ActivityLogs`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_SCORING_JOBS` | `true` | Enable/disable scoring cron jobs |

---

## Future Enhancements

1. **Redis Caching**: Add Redis for caching leaderboards for faster queries
2. **Real-time Updates**: WebSocket notifications for rank changes
3. **Custom Weights**: Allow admin to adjust weights from dashboard
4. **Yearly Leaderboards**: Aggregate yearly rankings across all months
5. **Subscription Payments**: Integrate XRPL payment processing for subscriptions
6. **Achievement Badges**: Add achievement system based on scoring milestones
