# DeGearns Backend - Project Documentation

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [Core Functionalities](#5-core-functionalities)
6. [API Endpoints](#6-api-endpoints)
7. [Backend Approach](#7-backend-approach)
8. [Security Measures](#8-security-measures)
9. [Deployment & DevOps](#9-deployment--devops)

---

## 1. Introduction

### 1.1 Project Overview

**DeGearns** is a comprehensive NFT marketplace backend built on the **XRP Ledger (XRPL)** blockchain. It provides a complete ecosystem for NFT trading, collection management, social features, gamification through leaderboards, and a subscription-based rewards system.

### 1.2 Project Vision

The platform aims to create a vibrant NFT community by combining:
- **Decentralized NFT Trading** - Leveraging XRPL's native NFT capabilities
- **Social Engagement** - Posts, follows, likes, comments, and messaging
- **Gamification** - Leaderboards for traders, creators, and influencers
- **Subscription Tiers** - Premium features with score boost multipliers
- **NFT Drops** - Managed minting events with allowlists and phase controls

### 1.3 Key Differentiators

| Feature | Description |
|---------|-------------|
| **XRPL Native** | Direct integration with XRP Ledger for fast, low-cost transactions |
| **Hybrid Architecture** | Combines on-chain NFT data with off-chain metadata storage |
| **Real-time Stats** | Live calculation of trading volumes, scores, and rankings |
| **Multi-tier Subscriptions** | Free, Basic, Pro, and Premium tiers with boost multipliers |
| **Comprehensive Social Layer** | Full social media features integrated with NFT activities |

---

## 2. Technology Stack

### 2.1 Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Runtime** | Node.js | ≥18.0.0 | Server-side JavaScript runtime |
| **Framework** | Express.js | 4.18.2 | Web application framework |
| **Database** | MySQL | 8.x | Relational data storage |
| **ORM** | Sequelize | 6.35.2 | Database abstraction layer |
| **Blockchain** | XRPL | 3.0.0 | XRP Ledger integration |

### 2.2 Dependencies Overview

```
Production Dependencies:
├── express (4.18.2)      - Web framework
├── sequelize (6.35.2)    - ORM for MySQL
├── mysql2 (3.6.5)        - MySQL driver
├── xrpl (3.0.0)          - XRP Ledger SDK
├── jsonwebtoken (9.0.2)  - JWT authentication
├── joi (17.11.0)         - Request validation
├── helmet (7.1.0)        - Security headers
├── cors (2.8.5)          - Cross-origin resource sharing
├── compression (1.7.4)   - Response compression
├── express-rate-limit    - API rate limiting
├── winston (3.11.0)      - Logging framework
├── morgan (1.10.0)       - HTTP request logging
└── node-cron (4.2.1)     - Scheduled tasks

Development Dependencies:
├── jest (29.7.0)         - Testing framework
├── nodemon (3.0.2)       - Development auto-reload
├── eslint (8.56.0)       - Code linting
├── sequelize-cli (6.6.2) - Database migrations
└── supertest (6.3.3)     - API testing
```

### 2.3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│              (Web App / Mobile App / Third-party)                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                               │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│    │ Helmet  │  │  CORS   │  │  Rate   │  │  Compression    │  │
│    │Security │  │         │  │ Limiter │  │                 │  │
│    └─────────┘  └─────────┘  └─────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS SERVER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ROUTE HANDLERS                         │   │
│  │  /auth  /collections  /nfts  /drops  /posts  /chat  ...  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     CONTROLLERS                           │   │
│  │  Business logic, request handling, response formatting    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      SERVICES                             │   │
│  │  XRPLService  ScoringEngine  NotificationService  etc.   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│     MySQL DATABASE      │     │    XRP LEDGER (XRPL)    │
│  ┌───────────────────┐  │     │  ┌───────────────────┐  │
│  │ Users             │  │     │  │ NFTs              │  │
│  │ Collections       │  │     │  │ Offers            │  │
│  │ Posts             │  │     │  │ Transactions      │  │
│  │ Subscriptions     │  │     │  │ Account Data      │  │
│  │ Notifications     │  │     │  └───────────────────┘  │
│  │ ...               │  │     │                         │
│  └───────────────────┘  │     │  Mainnet / Testnet     │
└─────────────────────────┘     └─────────────────────────┘
```

---

## 3. System Architecture

### 3.1 Project Structure

```
degearns-backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.js   # Database connection config
│   │   ├── xrpl.js       # XRPL client configuration
│   │   └── scoring.js    # Scoring algorithm config
│   │
│   ├── controllers/      # Request handlers
│   │   ├── authController.js
│   │   ├── collectionController.js
│   │   ├── nftController.js
│   │   ├── dropController.js
│   │   ├── postController.js
│   │   ├── leaderboardController.js
│   │   ├── subscriptionTierController.js
│   │   └── admin/        # Admin-specific controllers
│   │
│   ├── models/           # Sequelize models
│   │   ├── User.js
│   │   ├── Collection.js
│   │   ├── Drop.js
│   │   ├── Post.js
│   │   ├── Subscription.js
│   │   ├── UserStats.js
│   │   └── ...
│   │
│   ├── routes/           # API route definitions
│   │   ├── index.js      # Route aggregator
│   │   ├── authRoutes.js
│   │   ├── collectionRoutes.js
│   │   └── ...
│   │
│   ├── services/         # Business logic services
│   │   ├── xrplService.js        # XRPL blockchain operations
│   │   ├── scoringEngine.js      # User score calculations
│   │   ├── boostEngine.js        # Subscription boost logic
│   │   ├── notificationService.js # Push notifications
│   │   └── dropStatusService.js  # Drop phase management
│   │
│   ├── middleware/       # Express middleware
│   │   ├── auth.js       # JWT authentication
│   │   ├── errorHandler.js
│   │   └── validator.js
│   │
│   ├── utils/            # Utility functions
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── logger.js
│   │   └── userHelpers.js
│   │
│   ├── migrations/       # Database migrations
│   └── server.js         # Application entry point
│
├── docs/                 # Documentation
├── tests/                # Test files
├── package.json
├── ecosystem.config.js   # PM2 configuration
└── .env                  # Environment variables
```

### 3.2 Request Flow

```
1. Client Request
       │
       ▼
2. Middleware Pipeline
   ├── Helmet (Security Headers)
   ├── CORS (Cross-Origin)
   ├── Rate Limiter
   ├── Body Parser
   └── Morgan (Logging)
       │
       ▼
3. Route Handler
   └── Validates route parameters
       │
       ▼
4. Controller
   ├── Request validation (Joi)
   ├── Business logic execution
   ├── Service layer calls
   └── Response formatting
       │
       ▼
5. Service Layer
   ├── Database operations (Sequelize)
   ├── XRPL interactions
   └── External API calls
       │
       ▼
6. Response
   └── ApiResponse wrapper
```

---

## 4. Database Design

### 4.1 Entity Relationship Overview

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    User     │──────<│     Follow      │>──────│    User     │
│             │       └─────────────────┘       │  (Target)   │
└─────────────┘                                 └─────────────┘
      │ 1
      │
      │ *
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    Post     │──────<│    PostLike     │>──────│    User     │
│             │       └─────────────────┘       └─────────────┘
└─────────────┘
      │ 1
      │
      │ *
┌─────────────────┐
│   PostComment   │
└─────────────────┘

┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    User     │──────<│  Subscription   │>──────│Subscription │
│             │       │                 │       │    Tier     │
└─────────────┘       └─────────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    User     │──────<│   Collection    │       │   DropNft   │
│  (Creator)  │       │                 │       │             │
└─────────────┘       └─────────────────┘       └─────────────┘
                              │                        │
                              │                        │
                      ┌───────┴───────┐       ┌───────┴───────┐
                      │     Drop      │──────<│   DropMint    │
                      └───────────────┘       └───────────────┘
```

### 4.2 Core Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| **User** | Platform users | walletAddress, username, profileImage, isVerified, role |
| **Collection** | NFT collections | taxon, creatorWalletAddress, name, slug, floorPrice |
| **Drop** | Minting events | taxonId, status, mintPrice, maxSupply, phases |
| **Post** | Social posts | content, authorWalletAddress, mediaType, likesCount |
| **Subscription** | User subscriptions | planType, startDate, endDate, isActive |
| **SubscriptionTier** | Tier definitions | name, boostMultiplier, monthlyPriceXrp, features |
| **UserStats** | Calculated scores | traderScore, creatorScore, influencerScore |
| **Notification** | User notifications | type, recipientWalletAddress, message, isRead |

### 4.3 Key Relationships

```sql
-- User -> Collections (One-to-Many)
Collection.creatorWalletAddress → User.walletAddress

-- User -> Posts (One-to-Many)
Post.authorWalletAddress → User.walletAddress

-- User -> Subscriptions (One-to-Many)
Subscription.userWalletAddress → User.walletAddress

-- Subscription -> SubscriptionTier (Many-to-One)
Subscription.planType → SubscriptionTier.name

-- Collection -> Drops (One-to-Many)
Drop.taxonId → Collection.taxon

-- Drop -> DropNfts (One-to-Many)
DropNft.dropId → Drop.id

-- Drop -> DropMints (One-to-Many)
DropMint.dropId → Drop.id
```

---

## 5. Core Functionalities

### 5.1 NFT Marketplace

#### Collection Management
- **List Collection**: Register NFT collections with metadata (name, description, image, category)
- **Collection Discovery**: Browse, search, and filter collections
- **Collection Stats**: Real-time floor price, volume, and listing counts from XRPL
- **Collection History**: Track mints, sales, and transfers

#### NFT Operations
- **NFT Detail**: Fetch complete NFT information including owner, offers, and history
- **Buy/Sell Offers**: View and manage NFT offers directly from XRPL
- **Incoming Offers**: Track buy offers received on owned NFTs
- **Transaction History**: Complete transaction trail from blockchain

### 5.2 NFT Drops (Launchpad)

```
DROP LIFECYCLE:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   DRAFT     │───>│   PENDING   │───>│   ACTIVE    │───>│  COMPLETED  │
│  (Setup)    │    │ (Scheduled) │    │  (Minting)  │    │   (Ended)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

#### Features:
- **Multi-phase Drops**: Allowlist → Public phases
- **Allowlist Management**: Whitelist specific wallets
- **NFT Upload**: Bulk upload NFT metadata and images
- **Mint Reservation**: Reserve NFTs before blockchain confirmation
- **Revenue Tracking**: Monitor mint revenue and platform fees

### 5.3 Social Features

#### Posts & Feed
- Create posts with text, images, or videos
- Personal feed and following feed
- Like and comment on posts
- User profiles with post history

#### Messaging
- **Direct Messages**: Private 1:1 conversations
- **Group Chats**: Create and manage group conversations
- Real-time message delivery

#### Follow System
- Follow/unfollow users
- Follower and following lists
- Activity notifications

### 5.4 Leaderboard & Gamification

#### Score Categories

| Category | Metrics | Weight |
|----------|---------|--------|
| **Trader Score** | Volume bought/sold, trades, unique collections, profit margin | Configurable |
| **Creator Score** | Sales volume, NFTs sold, collections created, unique buyers | Configurable |
| **Influencer Score** | Followers, likes, comments, posts, engagement rate | Configurable |

#### Scoring Formula
```
Base Score = Σ (Normalized_Metric × Weight)
Boosted Score = Base Score × Subscription_Multiplier
```

#### Monthly Rankings
- Scores calculated on a monthly basis
- Historical period comparisons
- Rank tracking across categories

### 5.5 Subscription System

#### Tier Structure

| Tier | Boost | Monthly (XRP) | Yearly (XRP) | Key Features |
|------|-------|---------------|--------------|--------------|
| **Free** | 1.0x | - | - | Basic features |
| **Basic** | 1.1x (10%) | 10 | 100 | Priority visibility, basic analytics |
| **Pro** | 1.2x (20%) | 25 | 250 | Advanced analytics, priority support |
| **Premium** | 1.3x (30%) | 50 | 500 | Full suite, dedicated support, API access |

#### Subscription Features
- XRPL payment integration
- Automatic tier-based boost multipliers
- Subscription badge display
- Upgrade/downgrade paths

### 5.6 Notification System

#### Notification Types
- `new_follower` - Someone followed you
- `post_like` - Someone liked your post
- `post_comment` - Someone commented on your post
- `nft_sold` - Your NFT was purchased
- `new_offer` - Received offer on your NFT
- `drop_mint` - Someone minted from your drop
- `subscription_activated` - Subscription confirmed

---

## 6. API Endpoints

### 6.1 Endpoint Overview

| Module | Base Path | Endpoints | Description |
|--------|-----------|-----------|-------------|
| Auth | `/auth` | 5 | User authentication & profiles |
| Collections | `/collections` | 12 | NFT collection management |
| NFTs | `/nfts` | 6 | NFT details & operations |
| Drops | `/drops` | 25+ | Drop/launchpad management |
| Posts | `/posts` | 12 | Social posts & interactions |
| Follow | `/follow` | 4 | Follow relationships |
| Chat | `/chat` | 6 | Direct messaging |
| Group Chat | `/group-chat` | 10 | Group conversations |
| Leaderboard | `/leaderboard` | 8 | Scores & rankings |
| Subscriptions | `/subscription-tiers` | 10 | Subscription management |
| Notifications | `/notifications` | 6 | User notifications |
| Admin | `/admin` | 20+ | Administrative functions |

### 6.2 Key API Endpoints

#### Authentication
```
POST   /auth/wallet              - Authenticate with wallet
GET    /auth/me                  - Get current user profile
PUT    /auth/profile             - Update profile
PUT    /auth/profile-picture     - Update profile image
PUT    /auth/cover-picture       - Update cover image
```

#### Collections
```
POST   /collections/list         - Register a collection
GET    /collections              - Get all collections
GET    /collections/:identifier  - Get collection details
GET    /collections/wallet/:addr - Get user's collections
GET    /collections/search       - Search collections
GET    /collections/:taxon/history - Get collection history
```

#### NFTs
```
GET    /nfts/:nftTokenId         - Get NFT details
GET    /nfts/:nftTokenId/offers  - Get NFT offers
GET    /nfts/:nftTokenId/history - Get transaction history
GET    /nfts/incoming-offers/:wallet - Get incoming offers
POST   /nfts/notify-listing      - Notify followers of listing
POST   /nfts/notify-purchase     - Notify seller of sale
```

#### Drops
```
POST   /drops                    - Create new drop
GET    /drops                    - Get all drops
GET    /drops/active             - Get active drops
GET    /drops/:id                - Get drop details
PUT    /drops/:id                - Update drop
POST   /drops/:id/nfts           - Upload NFTs to drop
POST   /drops/:id/reserve        - Reserve NFTs for mint
POST   /drops/:id/confirm-mint   - Confirm mint transaction
GET    /drops/:id/eligibility    - Check wallet eligibility
```

#### Leaderboard
```
GET    /leaderboard/:type        - Get leaderboard (traders/creators/influencers)
GET    /leaderboard/user/:addr   - Get user stats
GET    /leaderboard/user/:addr/ranks - Get user ranks
GET    /leaderboard/compare/:a/:b - Compare two users
POST   /leaderboard/recalculate  - Recalculate user scores
```

#### Subscriptions
```
GET    /subscription-tiers       - Get all tiers
GET    /subscription-tiers/:name - Get tier by name
GET    /subscription-tiers/my-subscription - Get user's subscription
GET    /subscription-tiers/upgrade-options - Get upgrade options
POST   /subscription-tiers/subscribe - Subscribe to plan
POST   /subscription-tiers/cancel - Cancel subscription
```

---

## 7. Backend Approach

### 7.1 Design Principles

#### 1. **Separation of Concerns**
```
Routes → Controllers → Services → Models
   │          │            │         │
   │          │            │         └── Data access layer
   │          │            └── Business logic layer
   │          └── Request handling layer
   └── API definition layer
```

#### 2. **Hybrid Data Architecture**
- **On-chain (XRPL)**: NFTs, offers, transactions, ownership
- **Off-chain (MySQL)**: User profiles, social data, subscriptions, scores

#### 3. **RESTful API Design**
- Resource-based URLs
- Standard HTTP methods (GET, POST, PUT, DELETE)
- Consistent response format using `ApiResponse` wrapper

### 7.2 Key Architectural Decisions

#### XRPL Integration Strategy
```javascript
// Real-time blockchain queries for:
- NFT ownership verification
- Sell/buy offer retrieval
- Transaction history
- Account balances

// Cached/stored in database:
- Collection metadata
- User profiles
- Social interactions
- Calculated scores
```

#### Subscription Boost System
```javascript
// Boost multipliers applied to scores
const BOOST_MULTIPLIERS = {
  free: 1.0,
  basic: 1.1,   // 10% boost
  pro: 1.2,     // 20% boost
  premium: 1.3  // 30% boost
};

// Score calculation
boostedScore = baseScore * boostMultiplier;
```

#### Lazy Loading for Circular Dependencies
```javascript
// Prevent circular dependency issues
const getSubscriptionModel = () => {
  const { Subscription } = require('../models');
  return Subscription;
};
```

### 7.3 Error Handling

#### Centralized Error Handler
```javascript
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

// Usage
throw new ApiError(404, 'Collection not found');
throw new ApiError(400, 'Invalid wallet address');
```

#### Consistent Response Format
```javascript
// Success Response
{
  "success": true,
  "statusCode": 200,
  "message": "Collections retrieved successfully",
  "data": { ... }
}

// Error Response
{
  "success": false,
  "statusCode": 400,
  "message": "Validation error",
  "stack": "..." // Only in development
}
```

### 7.4 Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| **Batch Queries** | `getActiveSubscriptionsForWallets()` for bulk subscription lookup |
| **Pagination** | All list endpoints support `page` and `limit` parameters |
| **Database Indexing** | Composite indexes on frequently queried fields |
| **Response Compression** | Gzip compression via `compression` middleware |
| **Connection Pooling** | Sequelize connection pool for database connections |

---

## 8. Security Measures

### 8.1 Security Stack

| Layer | Implementation |
|-------|----------------|
| **HTTP Headers** | Helmet.js - XSS, clickjacking, MIME sniffing protection |
| **CORS** | Configurable origin whitelist |
| **Rate Limiting** | express-rate-limit per IP address |
| **Authentication** | JWT tokens with wallet-based auth |
| **Input Validation** | Joi schema validation on all inputs |
| **SQL Injection** | Sequelize parameterized queries |

### 8.2 Authentication Flow

```
1. User signs message with wallet
2. Backend verifies signature
3. JWT token issued
4. Token included in subsequent requests
5. Middleware validates token
```

### 8.3 Environment Configuration

```env
# Required Environment Variables
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://user:pass@host:port/db
JWT_SECRET=your-secret-key
XRPL_NETWORK=mainnet|testnet
XRPL_SERVER=wss://xrplcluster.com
```

---

## 9. Deployment & DevOps

### 9.1 PM2 Process Management

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'xrpl-nft-marketplace',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 9.2 Available Scripts

```bash
# Development
npm run dev           # Start with nodemon

# Production
npm start             # Start server
npm run pm2:start:prod # Start with PM2 (production)
npm run pm2:restart   # Restart PM2 processes
npm run pm2:logs      # View PM2 logs

# Database
npm run db:migrate    # Run migrations
npm run db:migrate:undo # Rollback migration
npm run db:seed       # Seed database

# Maintenance
npm run scores:recalculate # Recalculate all user scores

# Quality
npm run lint          # Run ESLint
npm run lint:fix      # Fix linting issues
npm test              # Run tests
```

### 9.3 Logging

```javascript
// Winston logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

---

## Appendix

### A. API Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### B. Contact & Support

- **Repository**: degearns-backend
- **Version**: 1.0.0
- **License**: MIT

---

*Document generated on: January 2026*
*DeGearns NFT Marketplace Backend Documentation v1.0*
