# Mainnet Connection Debugging Guide

## Issue
The endpoint `GET /collections/wallet/r9kmwcKEVo3iQtPxASzZbZ8MFr3ConVBtb` returns no collections even though you created collections on XRPL mainnet.

## Most Likely Cause
**Your application is still running with the old testnet configuration** because it hasn't been restarted after creating the `.env` file.

## Solution Steps

### 1. RESTART YOUR APPLICATION

**CRITICAL**: The app must be restarted to load the new `.env` file!

```bash
# Stop your running app (Ctrl+C or kill the process)
# Then start it again:
npm start
# or
node src/server.js
# or however you normally start it
```

### 2. Verify Mainnet Connection

When the app starts, check the logs for:
```
Connected to XRPL mainnet network
```

If you see:
```
Connected to XRPL testnet network
```
Then the app is still using testnet!

### 3. Check Your .env File

Verify `/home/user/degearns-backend/.env` contains:
```bash
XRPL_NETWORK=mainnet
XRPL_WSS_URL=wss://xrplcluster.com
```

### 4. Verify Your Wallet Has NFTs on MAINNET

Use XRPL Explorer to check if your wallet has NFTs on mainnet:
- Go to: https://livenet.xrpl.org/accounts/r9kmwcKEVo3iQtPxASzZbZ8MFr3ConVBtb
- Check if NFTs are shown

**Important**: If you created NFTs on testnet, they won't appear on mainnet!

### 5. Understanding Collection Filtering

The API filters collections based on these criteria:

**Registered Collections (in database)**: Always shown

**Unregistered Collections**: Must meet ALL these criteria:
- ✓ At least 3 NFTs in the collection
- ✓ At least 1 NFT listed for sale (has sell offer)
- ✓ Collection has an image (from NFT metadata)

If your collections don't meet these criteria, they won't be returned.

### 6. Check API Logs

After restarting, make the API call again and check your logs for:

```
Fetching collections for wallet: r9kmwcKEVo3iQtPxASzZbZ8MFr3ConVBtb
Found X collections for wallet: r9kmwcKEVo3iQtPxASzZbZ8MFr3ConVBtb, Y after filtering
```

If you see:
```
Filtering out small unregistered collection taxon X with only 1 items
Filtering out unregistered collection taxon X with no listings
Filtering out unregistered collection taxon X with no image
```

This means collections were found but filtered out.

## Common Issues

### Issue: "Still getting testnet data"
**Solution**: Make sure you restarted the app AND the .env file is in the correct location

### Issue: "No collections found"
**Possible causes**:
1. Wallet has no NFTs on mainnet (check XRPL explorer)
2. Collections don't meet filtering criteria
3. App still connected to testnet (not restarted)

### Issue: "Collections exist but are filtered out"
**Solution**: Either:
- Register the collection in the database using `POST /collections/list`
- Make sure collection has 3+ NFTs, at least 1 listing, and metadata with image

## Quick Test Commands

### Test 1: Check if .env is loaded
```bash
node -e "require('dotenv').config(); console.log('Network:', process.env.XRPL_NETWORK, 'URL:', process.env.XRPL_WSS_URL)"
```

Should show:
```
Network: mainnet URL: wss://xrplcluster.com
```

### Test 2: Make API Request
```bash
curl http://localhost:5000/api/v1/collections/wallet/r9kmwcKEVo3iQtPxASzZbZ8MFr3ConVBtb
```

## Need to Register Collections?

If your collections are being filtered out, register them in the database:

```bash
POST /api/v1/collections/list
{
  "name": "Your Collection Name",
  "description": "Collection description",
  "image": "https://example.com/collection.jpg",
  "taxon": 12345,  // Your NFToken taxon number
  "creatorWalletAddress": "r9kmwcKEVo3iQtPxASzZbZ8MFr3ConVBtb"
}
```

Once registered, collections will always be shown regardless of filtering criteria.
