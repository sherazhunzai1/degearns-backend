# XRPL NFT Marketplace Backend

A comprehensive Node.js/Express backend API for an NFT marketplace built on the XRP Ledger (XRPL) network.

## Features

- 🔐 User authentication & authorization (JWT)
- 🎨 NFT minting on XRPL
- 📝 NFT listing and delisting
- 💰 NFT buying and selling
- ❤️ Like/favorite NFTs
- 👥 User profiles and social features (follow/unfollow)
- 📊 Transaction history tracking
- 🔍 Search and filter functionality
- 🛡️ Security features (rate limiting, helmet, CORS)
- 📝 Comprehensive logging

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Blockchain**: XRPL (XRP Ledger)
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Joi
- **Security**: Helmet, CORS, express-rate-limit
- **Logging**: Winston

## Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or cloud instance)
- XRPL wallet (testnet or mainnet)

## Project Structure

```
degearns-backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.js  # MongoDB connection
│   │   └── xrpl.js      # XRPL client configuration
│   ├── controllers/     # Request handlers
│   │   ├── authController.js
│   │   ├── nftController.js
│   │   ├── userController.js
│   │   └── transactionController.js
│   ├── models/          # Database models
│   │   ├── User.js
│   │   ├── NFT.js
│   │   └── Transaction.js
│   ├── routes/          # API routes
│   │   ├── authRoutes.js
│   │   ├── nftRoutes.js
│   │   ├── userRoutes.js
│   │   ├── transactionRoutes.js
│   │   └── index.js
│   ├── middleware/      # Custom middleware
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── services/        # Business logic
│   │   └── xrplService.js
│   ├── utils/           # Utility functions
│   │   ├── logger.js
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   └── validators.js
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── logs/                # Application logs
├── .env.example         # Environment variables example
├── .gitignore
├── package.json
└── README.md
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd degearns-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000

   MONGODB_URI=mongodb://localhost:27017/xrpl-nft-marketplace

   XRPL_NETWORK=testnet
   XRPL_WSS_URL=wss://s.altnet.rippletest.net:51233

   ADMIN_WALLET_SEED=your_wallet_seed_here
   ADMIN_WALLET_ADDRESS=your_wallet_address_here

   JWT_SECRET=your_secret_key_here
   JWT_EXPIRES_IN=7d

   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Run the server**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/v1/auth/register` | Register new user | Public |
| POST | `/api/v1/auth/login` | Login user | Public |
| GET | `/api/v1/auth/me` | Get current user | Private |
| POST | `/api/v1/auth/logout` | Logout user | Private |

### NFTs

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/v1/nfts/mint` | Mint new NFT | Private |
| GET | `/api/v1/nfts` | Get all NFTs (with filters) | Public |
| GET | `/api/v1/nfts/:id` | Get single NFT | Public |
| POST | `/api/v1/nfts/:id/list` | List NFT for sale | Private |
| POST | `/api/v1/nfts/:id/delist` | Delist NFT | Private |
| POST | `/api/v1/nfts/:id/buy` | Buy NFT | Private |
| POST | `/api/v1/nfts/:id/like` | Like/Unlike NFT | Private |
| GET | `/api/v1/nfts/user/:userId` | Get user's NFTs | Public |

### Users

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/users/search` | Search users | Public |
| GET | `/api/v1/users/:id` | Get user profile | Public |
| PUT | `/api/v1/users/profile` | Update profile | Private |
| POST | `/api/v1/users/:id/follow` | Follow/Unfollow user | Private |
| GET | `/api/v1/users/favorites` | Get favorites | Private |
| POST | `/api/v1/users/favorites/:nftId` | Toggle favorite | Private |

### Transactions

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/transactions` | Get all transactions | Public |
| GET | `/api/v1/transactions/:hash` | Get transaction by hash | Public |
| GET | `/api/v1/transactions/user/:userId` | Get user transactions | Public |
| GET | `/api/v1/transactions/nft/:nftId` | Get NFT transactions | Public |

## API Usage Examples

### Register User

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepassword123",
    "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Mint NFT

```bash
curl -X POST http://localhost:5000/api/v1/nfts/mint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "My Awesome NFT",
    "description": "This is an amazing NFT",
    "image": "https://example.com/image.jpg",
    "uri": "https://example.com/metadata.json",
    "category": "art",
    "tags": ["digital", "art"],
    "walletSeed": "sXXXXXXXXXXXXXXXXXXX"
  }'
```

### List NFT for Sale

```bash
curl -X POST http://localhost:5000/api/v1/nfts/:id/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "price": "1000000",
    "walletSeed": "sXXXXXXXXXXXXXXXXXXX"
  }'
```

## XRPL Integration

### Networks

- **Testnet**: `wss://s.altnet.rippletest.net:51233` (for development)
- **Devnet**: `wss://s.devnet.rippletest.net:51233` (for testing)
- **Mainnet**: `wss://xrplcluster.com` (for production)

### Getting Testnet Credentials

1. Visit [XRPL Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)
2. Generate a testnet wallet
3. Copy the wallet seed and address
4. Add them to your `.env` file

### NFT Operations

The backend supports all XRPL NFT operations:
- **Minting**: Create new NFTs with metadata
- **Listing**: Create sell offers for NFTs
- **Buying**: Accept sell offers
- **Delisting**: Cancel sell offers
- **Burning**: Destroy NFTs (can be added)

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Rate Limiting**: Protection against brute force attacks
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing configuration
- **Input Validation**: Joi schema validation
- **Error Handling**: Centralized error handling

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | - |
| `XRPL_NETWORK` | XRPL network (testnet/mainnet) | testnet |
| `XRPL_WSS_URL` | XRPL WebSocket URL | - |
| `ADMIN_WALLET_SEED` | Admin wallet seed | - |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `CORS_ORIGIN` | Allowed CORS origin | * |

## Development

### Running in Development Mode

```bash
npm run dev
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Testing

```bash
npm test
```

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a production MongoDB instance
3. Configure XRPL mainnet settings
4. Set up proper logging and monitoring
5. Use a process manager like PM2
6. Set up SSL/TLS certificates
7. Configure firewall and security groups

### Using PM2

```bash
npm install -g pm2
pm2 start src/server.js --name xrpl-nft-api
pm2 save
pm2 startup
```

## Error Handling

The API uses consistent error responses:

```json
{
  "success": false,
  "message": "Error message here"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

## Logging

Logs are stored in the `logs/` directory:
- `combined.log`: All logs
- `error.log`: Error logs only

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

## Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Advanced search and filtering
- [ ] NFT collections support
- [ ] Auction functionality
- [ ] Email notifications
- [ ] Admin dashboard
- [ ] Analytics and statistics
- [ ] Multi-chain support

## Resources

- [XRPL Documentation](https://xrpl.org/)
- [XRPL NFTs Guide](https://xrpl.org/nfts.html)
- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
