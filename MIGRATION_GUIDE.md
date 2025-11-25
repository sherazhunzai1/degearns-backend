# Migration Guide: MongoDB to MySQL with Wallet-Based Authentication

## Overview

This backend has been migrated from MongoDB/Mongoose to MySQL/Sequelize with a wallet-based authentication system for XAMAN integration.

## Key Changes

### 1. Database Migration
- **From**: MongoDB with Mongoose ODM
- **To**: MySQL with Sequelize ORM

### 2. Authentication System
- **From**: Email/password based authentication
- **To**: Wallet-based authentication (XAMAN integration)
- Users login by connecting their XRPL wallet
- Wallet address is the primary identifier
- No password required

### 3. New Data Model

#### Collections
- Every NFT now belongs to a collection
- Collections have creators (wallet addresses)
- Collections track total supply, floor price, and volume

#### Relationships
```
User (walletAddress)
  ├─> Collections (creatorWalletAddress)
  │     └─> NFTs (collectionId)
  ├─> NFTs as Creator (creatorWalletAddress)
  └─> NFTs as Owner (ownerWalletAddress)
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure:
```env
# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=xrpl_nft_marketplace
DB_USER=root
DB_PASSWORD=your_password_here

# XRPL Configuration
XRPL_NETWORK=testnet
XRPL_WSS_URL=wss://s.altnet.rippletest.net:51233

# JWT Secret
JWT_SECRET=your_jwt_secret_here
```

### 3. Create MySQL Database
```bash
mysql -u root -p
CREATE DATABASE xrpl_nft_marketplace;
exit;
```

### 4. Run Migrations
```bash
npm run db:migrate
```

This will create all tables:
- Users
- Collections
- NFTs
- Transactions

### 5. Start the Server
```bash
# Development
npm run dev

# Production
npm start
```

## API Workflow

### 1. User Authentication (XAMAN Wallet)

**Frontend Flow:**
1. User connects XAMAN wallet
2. Frontend gets wallet address
3. Frontend calls `/api/v1/auth/wallet` with wallet address
4. Backend creates user if doesn't exist or returns existing user
5. Backend returns JWT token
6. Frontend stores token and uses for authenticated requests

**Endpoint:**
```javascript
POST /api/v1/auth/wallet
Body: { "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X" }

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

### 2. Create Collection

Before minting NFTs, users must create a collection:

```javascript
POST /api/v1/collections
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "name": "My Art Collection",
  "description": "Amazing digital art",
  "image": "https://...",
  "category": "art",
  "royaltyPercentage": 10
}
```

### 3. Mint Single NFT

```javascript
POST /api/v1/nfts/mint
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "collectionId": "uuid-here",
  "name": "NFT Name",
  "description": "NFT Description",
  "image": "https://...",
  "uri": "https://metadata-uri",
  "attributes": [
    { "trait_type": "Color", "value": "Blue" }
  ],
  "walletSeed": "sXXXXXXXXXX"
}
```

### 4. Mint Bulk NFTs

```javascript
POST /api/v1/nfts/mint-bulk
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "collectionId": "uuid-here",
  "walletSeed": "sXXXXXXXXXX",
  "nfts": [
    {
      "name": "NFT #1",
      "description": "First NFT",
      "image": "https://...",
      "uri": "https://metadata-1",
      "attributes": [...]
    },
    {
      "name": "NFT #2",
      "description": "Second NFT",
      "image": "https://...",
      "uri": "https://metadata-2",
      "attributes": [...]
    }
  ]
}
```

## Database Schema

### Users Table
- `id` (UUID, PK)
- `walletAddress` (STRING, UNIQUE) - Primary identifier
- `username` (STRING, UNIQUE, NULLABLE)
- `email` (STRING, UNIQUE, NULLABLE)
- `bio`, `profileImage`, `coverImage`
- `isVerified`, `role`, `socialLinks`

### Collections Table
- `id` (UUID, PK)
- `name`, `slug` (UNIQUE)
- `creatorWalletAddress` (FK to Users.walletAddress)
- `description`, `image`, `bannerImage`
- `category`, `royaltyPercentage`
- `totalSupply`, `floorPrice`, `totalVolume`

### NFTs Table
- `id` (UUID, PK)
- `tokenId` (STRING, UNIQUE) - XRPL token ID
- `collectionId` (FK to Collections.id)
- `creatorWalletAddress` (FK to Users.walletAddress)
- `ownerWalletAddress` (FK to Users.walletAddress)
- `name`, `description`, `image`, `uri`
- `attributes` (JSON), `taxon`, `transferFee`
- `isListed`, `currentPrice`, `offerID`

### Transactions Table
- `id` (UUID, PK)
- `txHash` (STRING, UNIQUE)
- `type` (ENUM: mint, sale, transfer, list, delist, offer, burn)
- `nftId` (FK to NFTs.id)
- `fromWalletAddress`, `toWalletAddress`
- `amount`, `marketplaceFee`, `royaltyFee`

## Migration Commands

```bash
# Run all pending migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# View migration status
npx sequelize-cli db:migrate:status
```

## Breaking Changes

1. **Authentication Endpoints**:
   - ❌ Removed: `POST /api/v1/auth/register`
   - ❌ Removed: `POST /api/v1/auth/login`
   - ✅ New: `POST /api/v1/auth/wallet`

2. **NFT Endpoints**:
   - ✅ New: `POST /api/v1/nfts/mint` - Single NFT minting
   - ✅ New: `POST /api/v1/nfts/mint-bulk` - Bulk NFT minting
   - All NFTs now require `collectionId`

3. **Collection Endpoints** (All New):
   - `POST /api/v1/collections` - Create collection
   - `GET /api/v1/collections` - List collections
   - `GET /api/v1/collections/:identifier` - Get collection
   - `PUT /api/v1/collections/:id` - Update collection
   - `GET /api/v1/collections/:id/stats` - Collection stats

## Development Tips

1. **Working with Sequelize**:
   ```javascript
   const { User, Collection, NFT } = require('../models');

   // Find with associations
   const user = await User.findOne({
     where: { walletAddress: 'rXXX...' },
     include: ['collections', 'createdNFTs']
   });
   ```

2. **Wallet Address as Primary Key**:
   - Always use `walletAddress` for user identification
   - Foreign keys reference `walletAddress`, not `id`

3. **Transactions**:
   - Use Sequelize transactions for bulk operations
   - See `mintBulkNFTs` controller for example

## Testing

```bash
# Run tests
npm test

# Test database connection
node -e "require('./src/config/sequelize').connectDatabase()"
```

## Troubleshooting

1. **Migration fails**: Ensure MySQL is running and credentials are correct
2. **Foreign key constraint fails**: Run migrations in order (users -> collections -> nfts -> transactions)
3. **XRPL connection fails**: Check XRPL_WSS_URL in .env

## Support

For issues or questions, please open an issue on GitHub.
