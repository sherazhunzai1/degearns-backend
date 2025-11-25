# XRPL NFT Marketplace Backend

A comprehensive Node.js/Express backend API for an NFT marketplace built on the XRP Ledger (XRPL) network with MySQL database and wallet-based authentication via XAMAN.

## Features

- 🔐 **Wallet-Based Authentication** - XAMAN wallet integration (no passwords required)
- 🗂️ **Collections** - Organize NFTs into collections
- 🎨 **NFT Minting** - Single and bulk NFT minting on XRPL
- 💾 **MySQL Database** - Robust relational database with Sequelize ORM
- 📝 **Complete API** - RESTful API for all marketplace operations
- 🔍 **Advanced Filtering** - Search and filter NFTs and collections
- 🛡️ **Security** - Rate limiting, helmet, CORS protection
- 📊 **Transaction Tracking** - Complete blockchain transaction history

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MySQL with Sequelize ORM
- **Blockchain**: XRPL (XRP Ledger)
- **Authentication**: JWT with wallet addresses
- **Validation**: Joi
- **Security**: Helmet, CORS, express-rate-limit
- **Logging**: Winston

## Prerequisites

- Node.js >= 18.0.0
- MySQL Server
- XRPL wallet (testnet or mainnet)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=xrpl_nft_marketplace
DB_USER=root
DB_PASSWORD=your_password

# XRPL Configuration
XRPL_NETWORK=testnet
XRPL_WSS_URL=wss://s.altnet.rippletest.net:51233

# JWT Secret
JWT_SECRET=your_secret_key_here
```

### 3. Create Database
```bash
mysql -u root -p
CREATE DATABASE xrpl_nft_marketplace;
exit;
```

### 4. Run Migrations
```bash
npm run db:migrate
```

### 5. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

## API Workflow

### 1. Authenticate with Wallet (XAMAN)
```bash
POST /api/v1/auth/wallet
Body: { "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X" }
```

### 2. Create Collection
```bash
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
```bash
POST /api/v1/nfts/mint
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "collectionId": "uuid",
  "name": "NFT Name",
  "image": "https://...",
  "uri": "https://metadata-uri",
  "walletSeed": "sXXXXXXXXXX"
}
```

### 4. Mint Bulk NFTs
```bash
POST /api/v1/nfts/mint-bulk
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "collectionId": "uuid",
  "walletSeed": "sXXXXXXXXXX",
  "nfts": [
    { "name": "NFT #1", "image": "...", "uri": "..." },
    { "name": "NFT #2", "image": "...", "uri": "..." }
  ]
}
```

## Database Schema

- **Users**: Identified by wallet address
- **Collections**: Group NFTs, track creator and stats
- **NFTs**: Belong to collections, have creator and owner
- **Transactions**: Track all blockchain transactions

## Documentation

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Complete migration guide
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - API reference

## Scripts

```bash
npm run dev              # Start development server
npm start                # Start production server
npm run db:migrate       # Run database migrations
npm run db:migrate:undo  # Undo last migration
npm test                 # Run tests
```

## License

MIT
