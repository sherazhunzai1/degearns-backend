# API Documentation

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication

All private endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Authentication Endpoints

### Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "user_id",
      "username": "john_doe",
      "email": "john@example.com",
      "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
      "role": "user"
    },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

---

### Login

**POST** `/auth/login`

Login to an existing account.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

---

### Get Current User

**GET** `/auth/me`

Get the current authenticated user's profile.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "_id": "user_id",
    "username": "john_doe",
    "email": "john@example.com",
    "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
    "nftsCreated": [...],
    "nftsOwned": [...]
  }
}
```

---

## NFT Endpoints

### Mint NFT

**POST** `/nfts/mint`

Mint a new NFT on the XRPL network.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "name": "My Awesome NFT",
  "description": "This is an amazing digital artwork",
  "image": "https://example.com/image.jpg",
  "uri": "https://example.com/metadata.json",
  "category": "art",
  "tags": ["digital", "art", "modern"],
  "attributes": [
    {
      "trait_type": "Color",
      "value": "Blue"
    },
    {
      "trait_type": "Rarity",
      "value": "Rare"
    }
  ],
  "taxon": 0,
  "transferFee": 5000,
  "royalties": 10,
  "walletSeed": "sXXXXXXXXXXXXXXXXXXX"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "NFT minted successfully",
  "data": {
    "_id": "nft_id",
    "tokenId": "nft_token_id",
    "name": "My Awesome NFT",
    "description": "This is an amazing digital artwork",
    "image": "https://example.com/image.jpg",
    "creator": "user_id",
    "owner": "user_id",
    "transactionHash": "tx_hash"
  }
}
```

---

### Get All NFTs

**GET** `/nfts`

Get all NFTs with optional filters.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `category` (string): Filter by category
- `isListed` (boolean): Filter by listing status
- `sortBy` (string): Sort field (default: createdAt)
- `order` (string): Sort order (asc/desc, default: desc)
- `search` (string): Search in name and description

**Example:**
```
GET /nfts?page=1&limit=20&category=art&isListed=true
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "NFTs retrieved successfully",
  "data": {
    "nfts": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

---

### Get Single NFT

**GET** `/nfts/:id`

Get detailed information about a specific NFT.

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "NFT retrieved successfully",
  "data": {
    "nft": {
      "_id": "nft_id",
      "tokenId": "nft_token_id",
      "name": "My Awesome NFT",
      "creator": {...},
      "owner": {...},
      "currentPrice": "1000000",
      "isListed": true
    },
    "sellOffers": [...],
    "buyOffers": [...]
  }
}
```

---

### List NFT for Sale

**POST** `/nfts/:id/list`

List an NFT for sale on the marketplace.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "price": "1000000",
  "destination": "rXXXXXXXXXXXX",
  "expiration": 1234567890,
  "walletSeed": "sXXXXXXXXXXXXXXXXXXX"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "NFT listed successfully",
  "data": {
    "_id": "nft_id",
    "isListed": true,
    "currentPrice": "1000000",
    "offerID": "offer_id"
  }
}
```

---

### Delist NFT

**POST** `/nfts/:id/delist`

Remove an NFT listing from the marketplace.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "walletSeed": "sXXXXXXXXXXXXXXXXXXX"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "NFT delisted successfully",
  "data": {
    "_id": "nft_id",
    "isListed": false,
    "currentPrice": null
  }
}
```

---

### Buy NFT

**POST** `/nfts/:id/buy`

Purchase a listed NFT.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "walletSeed": "sXXXXXXXXXXXXXXXXXXX"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "NFT purchased successfully",
  "data": {
    "_id": "nft_id",
    "owner": "new_owner_id",
    "isListed": false
  }
}
```

---

### Like/Unlike NFT

**POST** `/nfts/:id/like`

Toggle like status for an NFT.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "liked": true,
    "likes": 42
  }
}
```

---

### Get User's NFTs

**GET** `/nfts/user/:userId`

Get all NFTs owned or created by a user.

**Query Parameters:**
- `type` (string): "owned" or "created" (default: owned)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User NFTs retrieved successfully",
  "data": [...]
}
```

---

## User Endpoints

### Get User Profile

**GET** `/users/:id`

Get a user's public profile.

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "_id": "user_id",
    "username": "john_doe",
    "bio": "Digital artist",
    "profileImage": "https://example.com/avatar.jpg",
    "nftsCreated": [...],
    "nftsOwned": [...],
    "followers": [...],
    "following": [...]
  }
}
```

---

### Update Profile

**PUT** `/users/profile`

Update the current user's profile.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "username": "new_username",
  "bio": "Updated bio",
  "profileImage": "https://example.com/new-avatar.jpg"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile updated successfully",
  "data": {...}
}
```

---

### Follow/Unfollow User

**POST** `/users/:id/follow`

Toggle follow status for a user.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Followed successfully",
  "data": {
    "following": true,
    "followersCount": 150
  }
}
```

---

### Get Favorites

**GET** `/users/favorites`

Get the current user's favorite NFTs.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Favorites retrieved successfully",
  "data": [...]
}
```

---

### Toggle Favorite

**POST** `/users/favorites/:nftId`

Add or remove an NFT from favorites.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Added to favorites",
  "data": {
    "favorited": true
  }
}
```

---

### Search Users

**GET** `/users/search`

Search for users by username or wallet address.

**Query Parameters:**
- `query` (string, required): Search query
- `page` (number): Page number
- `limit` (number): Items per page

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [...],
    "pagination": {...}
  }
}
```

---

## Transaction Endpoints

### Get All Transactions

**GET** `/transactions`

Get all transactions with optional filters.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `type` (string): Filter by transaction type
- `nftId` (string): Filter by NFT ID
- `userId` (string): Filter by user ID

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Transactions retrieved successfully",
  "data": {
    "transactions": [...],
    "pagination": {...}
  }
}
```

---

### Get Transaction by Hash

**GET** `/transactions/:hash`

Get a specific transaction by its hash.

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Transaction retrieved successfully",
  "data": {
    "txHash": "hash",
    "type": "sale",
    "nft": {...},
    "from": {...},
    "to": {...},
    "amount": "1000000",
    "status": "completed"
  }
}
```

---

### Get User Transactions

**GET** `/transactions/user/:userId`

Get all transactions for a specific user.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User transactions retrieved successfully",
  "data": {
    "transactions": [...],
    "pagination": {...}
  }
}
```

---

### Get NFT Transactions

**GET** `/transactions/nft/:nftId`

Get transaction history for a specific NFT.

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "NFT transactions retrieved successfully",
  "data": [...]
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message description"
}
```

### Common Error Codes

- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **NFT Minting**: 10 requests per hour

---

## Data Types

### NFT Categories
- `art`
- `music`
- `photography`
- `sports`
- `gaming`
- `collectibles`
- `other`

### Transaction Types
- `mint`: NFT creation
- `sale`: NFT purchase
- `transfer`: NFT transfer
- `list`: NFT listing
- `delist`: NFT delisting
- `offer`: Offer creation
- `burn`: NFT destruction

### User Roles
- `user`: Regular user
- `admin`: Administrator
