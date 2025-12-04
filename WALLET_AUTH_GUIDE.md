# Drop API - Wallet Address Authentication Guide

## Overview

All drop endpoints use **wallet address authentication** instead of JWT tokens, consistent with the rest of the API.

## Controller Method Updates Required

### Pattern: Replace `req.user.walletAddress` with wallet address from request

### 1. createDrop()
**Change**: Get wallet address from request body
```javascript
// OLD
const creatorWalletAddress = req.user.walletAddress;

// NEW
const { creatorWalletAddress } = req.body;

// Add validation
if (!creatorWalletAddress) {
  throw new ApiError(400, 'creatorWalletAddress is required');
}
```

### 2. updateDrop()
**Change**: Get wallet address from request body for ownership check
```javascript
// OLD
if (drop.creatorWalletAddress !== req.user.walletAddress) {
  throw new ApiError(403, 'You are not the creator of this drop');
}

// NEW
const { walletAddress } = req.body;
if (!walletAddress) {
  throw new ApiError(400, 'walletAddress is required');
}
if (drop.creatorWalletAddress !== walletAddress) {
  throw new ApiError(403, 'You are not the creator of this drop');
}
```

### 3. deleteDrop()
**Change**: Get wallet address from query parameter
```javascript
// OLD
if (drop.creatorWalletAddress !== req.user.walletAddress) {
  throw new ApiError(403, 'You are not the creator of this drop');
}

// NEW
const { walletAddress } = req.query;
if (!walletAddress) {
  throw new ApiError(400, 'walletAddress is required');
}
if (drop.creatorWalletAddress !== walletAddress) {
  throw new ApiError(403, 'You are not the creator of this drop');
}
```

### 4. mintFromDrop()
**Change**: Get minter wallet address from request body
```javascript
// OLD
const minterWalletAddress = req.user.walletAddress;

// NEW
const { minterWalletAddress } = req.body;
if (!minterWalletAddress) {
  throw new ApiError(400, 'minterWalletAddress is required');
}
```

### 5. getMintMetadata()
**Change**: Get wallet address from query parameter (optional)
```javascript
// OLD
const minterWalletAddress = req.user?.walletAddress;

// NEW
const { walletAddress } = req.query;
const minterWalletAddress = walletAddress; // Can be undefined for anonymous checks
```

### 6. getMyMints()
**Change**: Get wallet address from query parameter
```javascript
// OLD
where: { minterWalletAddress: req.user.walletAddress }

// NEW
const { walletAddress } = req.query;
if (!walletAddress) {
  throw new ApiError(400, 'walletAddress query parameter is required');
}
where: { minterWalletAddress: walletAddress }
```

### 7. canMint()
**Change**: Get wallet address from query parameter (optional)
```javascript
// OLD
const walletAddress = req.user?.walletAddress;

// NEW
const { walletAddress } = req.query;
// walletAddress can be undefined for public drops
```

## Updated API Request Examples

### Create Drop
```javascript
POST /api/v1/drops
{
  "creatorWalletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "collectionId": "uuid",
  "name": "Genesis Drop",
  "price": "10",
  "startDate": "2025-12-10T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "isPublic": true,
  "allowlist": null,
  "transferFee": 1000,
  "maxMintsPerWallet": 5
}
```

### Update Drop
```javascript
PUT /api/v1/drops/:id
{
  "walletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "name": "Updated Drop Name",
  "price": "15"
}
```

### Delete Drop
```javascript
DELETE /api/v1/drops/:id?walletAddress=rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X
```

### Record Mint
```javascript
POST /api/v1/drops/:id/mint
{
  "minterWalletAddress": "rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X",
  "nftokenId": "00080000...",
  "transactionHash": "ABC123..."
}
```

### Get My Mints
```javascript
GET /api/v1/drops/my-mints?walletAddress=rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X
```

### Get Mint Metadata
```javascript
GET /api/v1/drops/:id/mint-metadata?walletAddress=rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X
```

### Check Can Mint
```javascript
GET /api/v1/drops/:id/can-mint?walletAddress=rN7n7otQDd6FczFgLdlqtyMVrn3HMfDr8X
```

## Validation Rules

1. **Required wallet address** for operations that modify data:
   - createDrop: `creatorWalletAddress` in body
   - updateDrop: `walletAddress` in body
   - deleteDrop: `walletAddress` in query
   - mintFromDrop: `minterWalletAddress` in body

2. **Optional wallet address** for read operations with per-user data:
   - getMintMetadata: `walletAddress` in query (for allowlist checks)
   - canMint: `walletAddress` in query (for allowlist + mint limit checks)

3. **Required for filtered queries**:
   - getMyMints: `walletAddress` in query (to know whose mints to fetch)

## Error Messages

```javascript
// Missing wallet address
{
  "success": false,
  "error": {
    "status": 400,
    "message": "walletAddress is required"
  }
}

// Not the owner
{
  "success": false,
  "error": {
    "status": 403,
    "message": "You are not the creator of this drop"
  }
}

// Not on allowlist
{
  "success": false,
  "error": {
    "status": 403,
    "message": "You are not allowed to mint from this drop"
  }
}
```

## Frontend Integration

```javascript
// Store wallet address after XAMAN connection
const { walletAddress } = await xamanSDK.authorize();
localStorage.setItem('walletAddress', walletAddress);

// Use in API calls
const createDrop = async (dropData) => {
  const walletAddress = localStorage.getItem('walletAddress');

  const response = await fetch('/api/v1/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...dropData,
      creatorWalletAddress: walletAddress
    })
  });

  return await response.json();
};

const mintFromDrop = async (dropId, nftokenId, transactionHash) => {
  const walletAddress = localStorage.getItem('walletAddress');

  const response = await fetch(`/api/v1/drops/${dropId}/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      minterWalletAddress: walletAddress,
      nftokenId,
      transactionHash
    })
  });

  return await response.json();
};

const getMyMints = async () => {
  const walletAddress = localStorage.getItem('walletAddress');

  const response = await fetch(
    `/api/v1/drops/my-mints?walletAddress=${walletAddress}`
  );

  return await response.json();
};
```

## Summary of Changes

✅ **Routes**: Removed all `authenticate` and `optionalAuth` middleware
✅ **Request Parameters**: Wallet addresses now in body/query params
✅ **No JWT Headers**: Clients don't need to send Authorization headers
✅ **Consistent**: Matches the pattern used in auth and collection endpoints
✅ **Public Access**: All endpoints are public, security enforced by wallet address validation

## Next Steps

1. Update controller methods as documented above
2. Test all endpoints with wallet addresses
3. Update API documentation
4. Update frontend integration guides
