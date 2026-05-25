# Solana Frontend Integration Guide

Base URL: `/api/v1`

This document covers all new and updated backend APIs needed to integrate Solana alongside the existing XRPL network. All existing XRPL endpoints continue to work unchanged.

---

## Table of Contents

1. [Authentication (Phantom / Solflare)](#1-authentication)
2. [Collections](#2-collections)
3. [NFT Browsing](#3-nft-browsing)
4. [Drops (Create & Manage)](#4-drops)
5. [Minting (Record & Verify)](#5-minting)
6. [Notifications (Listing / Purchase)](#6-notifications)
7. [Filtering by Network](#7-filtering-by-network)
8. [Error Codes](#8-error-codes)
9. [Frontend Flow Summary](#9-frontend-flow-summary)

---

## 1. Authentication

Solana uses a **sign-message** flow (nonce challenge). XRPL's `/auth/wallet` also accepts `network: "solana"` for simpler flows, but the `/auth/solana` flow is recommended because it cryptographically verifies wallet ownership.

### Step 1 — Get a nonce

```
GET /auth/solana/nonce?walletAddress=<SOLANA_ADDRESS>
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "nonce": "a1b2c3d4e5f6...",
    "message": "Sign this message to authenticate with DeGearns.\n\nWallet: 7xKX...\nNonce: a1b2c3d4e5f6...",
    "expiresIn": 300
  },
  "message": "Nonce generated successfully"
}
```

### Step 2 — Sign the message with wallet

```ts
// Phantom example
const encodedMessage = new TextEncoder().encode(data.message);
const signedMessage = await window.solana.signMessage(encodedMessage, "utf8");
const signature = bs58.encode(signedMessage.signature);
```

### Step 3 — Submit signed message

```
POST /auth/solana
```

**Body:**
```json
{
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "signature": "<base58-encoded-signature>",
  "referralCode": "rAbc123..."  // optional
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "user": {
      "id": "uuid",
      "walletAddress": "7xKX...",
      "network": "solana",
      "username": "7xKX...",
      "profileImage": null,
      "isVerified": false,
      "subscriptionPlan": "free"
    },
    "isNewUser": true,
    "token": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "Solana wallet authenticated successfully"
}
```

**Notes:**
- The `token` is a JWT (7-day expiry). Include it as `Authorization: Bearer <token>` for authenticated endpoints.
- The nonce is **single-use** and expires in 5 minutes.
- If the wallet address doesn't exist, a new user is created automatically.
- Referral notifications are sent to the referrer if `referralCode` is valid.

**Errors:**
| Code | When |
|------|------|
| 400 | Missing `walletAddress` or `signature` |
| 400 | Invalid Solana wallet address |
| 401 | Nonce expired or not found |
| 401 | Invalid signature |
| 403 | User is banned |

---

## 2. Collections

### Register a Solana collection

```
POST /collections/list
```

**Body:**
```json
{
  "name": "My Solana Collection",
  "creatorWalletAddress": "7xKX...",
  "network": "solana",
  "mintAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "description": "A cool Solana NFT collection",
  "image": "https://arweave.net/...",
  "bannerImage": "https://arweave.net/...",
  "category": "art",
  "royaltyPercentage": 5.0,
  "socialLinks": {
    "twitter": "https://twitter.com/mycollection",
    "discord": "https://discord.gg/mycollection"
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | |
| `creatorWalletAddress` | Yes | Solana address of the creator |
| `network` | Yes | Must be `"solana"` |
| `mintAddress` | Yes (Solana) | The on-chain Metaplex collection mint address |
| `taxon` | No | Only for XRPL. Ignored for Solana. |
| `category` | No | `art`, `music`, `photography`, `sports`, `gaming`, `collectibles`, `other` |
| `royaltyPercentage` | No | 0–100, default 0 |

**Response (201):**
```json
{
  "code": 201,
  "data": {
    "id": "uuid",
    "name": "My Solana Collection",
    "slug": "my-solana-collection",
    "network": "solana",
    "mintAddress": "EPjFWdd5...",
    "taxon": null,
    "creatorWalletAddress": "7xKX...",
    "category": "art",
    "royaltyPercentage": "5.00",
    "totalSupply": 0,
    "floorPrice": null,
    "totalVolume": "0"
  },
  "message": "Collection listed successfully"
}
```

**Idempotent:** If a collection with the same `mintAddress` already exists, returns `200` with the existing collection.

**Errors:**
| Code | When |
|------|------|
| 400 | Missing `mintAddress` for Solana |
| 400 | Invalid Solana mint address |

### XRPL collection (unchanged)

For XRPL, send `taxon` instead of `mintAddress`. The `network` field defaults to `"xrpl"` if omitted, so existing frontend code works without changes.

---

## 3. NFT Browsing

### Get a single Solana NFT

```
GET /nfts/<MINT_ADDRESS>?network=solana
```

**Response (200):**
```json
{
  "code": 200,
  "data": {
    "nftTokenId": "EPjFWdd5...",
    "network": "solana",
    "title": "My NFT #42",
    "description": "A rare piece from the collection",
    "image": "https://arweave.net/...",
    "attributes": [
      { "trait_type": "Background", "value": "Blue" },
      { "trait_type": "Rarity", "value": "Legendary" }
    ],
    "owner": {
      "walletAddress": "7xKX...",
      "username": "alice",
      "profileImage": "https://...",
      "isVerified": true
    },
    "collection": {
      "id": "uuid",
      "name": "My Collection",
      "mintAddress": "Col1..."
    },
    "royalty": {
      "basis_points": 500,
      "primary_sale_happened": true
    },
    "compressed": false,
    "mintAddress": "EPjFWdd5...",
    "raw": { /* full Helius DAS asset object */ }
  }
}
```

**Notes:**
- Pass `?network=solana` to use the Helius DAS API.
- Without `?network=solana`, the endpoint uses the XRPL flow.
- The `raw` field contains the complete Helius DAS response for any fields not extracted above.

### Get all NFTs in a Solana wallet

```
GET /nfts/solana/wallet/<WALLET_ADDRESS>?page=1&limit=50
```

**Response (200):**
```json
{
  "code": 200,
  "data": {
    "network": "solana",
    "walletAddress": "7xKX...",
    "total": 142,
    "items": [
      {
        "id": "EPjFWdd5...",
        "content": {
          "metadata": { "name": "My NFT #1", "description": "..." },
          "links": { "image": "https://..." },
          "files": [{ "uri": "https://...", "mime": "image/png" }]
        },
        "grouping": [{ "group_key": "collection", "group_value": "Col1..." }],
        "ownership": { "owner": "7xKX..." },
        "royalty": { "basis_points": 500 }
      }
    ],
    "page": 1,
    "limit": 50
  }
}
```

**Query params:**
| Param | Default | Max | Notes |
|-------|---------|-----|-------|
| `page` | 1 | — | 1-indexed |
| `limit` | 50 | 1000 | |

### Get all NFTs in a Solana collection

```
GET /nfts/solana/collection/<COLLECTION_MINT_ADDRESS>?page=1&limit=50
```

Same response shape as wallet NFTs. Useful for collection detail pages.

---

## 4. Drops

### Create a Solana drop

```
POST /drops
```

**Body:**
```json
{
  "creatorWalletAddress": "7xKX...",
  "name": "My Solana Drop",
  "network": "solana",
  "collectionMintAddress": "Col1...",
  "description": "First ever Solana drop on DeGearns",
  "image": "https://arweave.net/drop-cover.png",
  "websiteUrl": "https://mydrop.com",
  "twitterUrl": "https://twitter.com/mydrop"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `creatorWalletAddress` | Yes | |
| `name` | Yes | |
| `network` | Yes | Must be `"solana"` |
| `collectionMintAddress` | Yes (Solana) | Metaplex collection mint address |
| `taxonId` | No | Only for XRPL. Ignored for Solana. |

**Response (201):**
```json
{
  "code": 201,
  "data": {
    "id": "uuid",
    "name": "My Solana Drop",
    "network": "solana",
    "collectionMintAddress": "Col1...",
    "priceCurrency": "SOL",
    "taxonId": null,
    "status": "draft",
    "totalSupply": 0,
    "creatorWalletAddress": "7xKX...",
    "nextStep": "Upload NFTs using POST /drops/:id/nfts"
  },
  "message": "Solana drop created successfully. Next step: Upload bulk NFTs"
}
```

**After creation, the remaining drop setup steps are the same for both networks:**
1. `POST /drops/:id/nfts` — upload NFT metadata (name, image, attributes, metadataUri)
2. `PUT /drops/:id/settings` — set pricing (in SOL lamports), limits, schedule
3. `PUT /drops/:id/status` — activate the drop

**Pricing note:** For Solana drops, `pricePerNft` is in **lamports** (1 SOL = 1,000,000,000 lamports). The `priceCurrency` field will be `"SOL"`.

---

## 5. Minting

### Solana minting flow

Unlike XRPL where the backend mints NFTs server-side, **Solana minting happens on the frontend** using Metaplex. The backend records and verifies the mint.

**Frontend flow:**

```
1. User pays SOL to creator (on-chain transfer)
2. Frontend mints NFT using Metaplex SDK (createNft / mintV1)
3. Frontend calls POST /drops/:id/mint with the transaction details
4. Backend verifies the transaction on Solana and records the mint
```

### Record a Solana mint

```
POST /drops/:id/mint
```

**Body:**
```json
{
  "minterWalletAddress": "BuyerWallet...",
  "nftTokenId": "MintedNFTAddress...",
  "transactionHash": "5UfDuX...",
  "nftUri": "https://arweave.net/metadata.json",
  "mintPrice": "1000000000",
  "paymentTransactionHash": "3xYzAb..."
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `minterWalletAddress` | Yes | Buyer's Solana wallet |
| `nftTokenId` | Yes | The newly minted NFT's mint address |
| `transactionHash` | Yes | Solana signature of the mint transaction |
| `nftUri` | No | Metadata URI (arweave/IPFS) |
| `mintPrice` | No | Price paid in lamports (defaults to drop's `pricePerNft`) |
| `paymentTransactionHash` | No | Signature of the SOL payment to creator |

**What the backend does:**
1. Fetches the drop and validates it's active, not sold out
2. Checks the NFT hasn't already been recorded
3. **Verifies the Solana transaction on-chain** (calls `getTransaction` and checks `meta.err` is null)
4. Creates a `DropMint` record
5. Increments the drop's `mintedCount`
6. If sold out, sets drop status to `sold_out`

**Response (201):**
```json
{
  "code": 201,
  "data": {
    "id": "uuid",
    "dropId": "uuid",
    "minterWalletAddress": "BuyerWallet...",
    "network": "solana",
    "nftTokenId": "MintedNFTAddress...",
    "transactionHash": "5UfDuX...",
    "mintPrice": "1000000000",
    "mintIndex": 1,
    "drop": { "id": "uuid", "name": "My Solana Drop" },
    "minter": { "walletAddress": "BuyerWallet...", "username": "..." }
  },
  "message": "Mint recorded successfully"
}
```

**Errors:**
| Code | When |
|------|------|
| 400 | Missing required fields |
| 400 | NFT already recorded (duplicate `nftTokenId`) |
| 400 | Drop is sold out |
| 400 | Solana transaction verification failed |
| 404 | Drop not found |

---

## 6. Notifications

The notification endpoints are **already chain-agnostic**. Use them the same way for Solana:

### Notify followers about an NFT listing

```
POST /nfts/notify-listing
```

```json
{
  "sellerWalletAddress": "7xKX...",
  "nftTokenId": "MintAddress...",
  "nftName": "Cool NFT #7",
  "nftImage": "https://arweave.net/...",
  "price": "2000000000",
  "collectionName": "My Collection"
}
```

### Notify seller about an NFT purchase

```
POST /nfts/notify-purchase
```

```json
{
  "sellerWalletAddress": "Seller...",
  "buyerWalletAddress": "Buyer...",
  "nftTokenId": "MintAddress...",
  "nftName": "Cool NFT #7",
  "price": "2000000000",
  "transactionHash": "5UfDuX..."
}
```

---

## 7. Filtering by Network

All listing/browsing endpoints now accept a `network` query parameter:

| Endpoint | Filter | Example |
|----------|--------|---------|
| `GET /collections` | `?network=solana` | Only Solana collections |
| `GET /drops` | `?network=solana` | Only Solana drops |
| `GET /drops/active` | Works as-is | Returns both networks |
| `GET /drops/upcoming` | Works as-is | Returns both networks |
| `GET /drops/explore` | Works as-is | Returns both networks |

**Tip:** To show a network toggle in the UI, pass `?network=solana` or `?network=xrpl`. Omit the param to show both.

---

## 8. Error Codes

All errors follow this shape:

```json
{
  "code": 400,
  "message": "Invalid Solana wallet address",
  "data": null
}
```

| Code | Meaning |
|------|---------|
| 400 | Bad request — missing/invalid fields, duplicates, validation failures |
| 401 | Unauthorized — invalid signature, expired nonce, bad JWT |
| 403 | Forbidden — user is banned, not the owner/creator |
| 404 | Not found — user, drop, NFT, or collection doesn't exist |
| 500 | Server error — chain RPC failure, config issue |

---

## 9. Frontend Flow Summary

### Solana user sign-up / sign-in

```
GET  /auth/solana/nonce?walletAddress=...     → { nonce, message }
     ↓ Phantom signs message
POST /auth/solana { walletAddress, signature } → { user, token }
     ↓ Store token for authenticated requests
```

### Creating a collection + drop + minting

```
Step 1: Create collection on-chain (Metaplex createCollection in browser)
        ↓ get collectionMintAddress
Step 2: POST /collections/list { network: "solana", mintAddress, ... }
        ↓ registered in DB

Step 3: POST /drops { network: "solana", collectionMintAddress, name, ... }
        ↓ drop created (status: draft)
Step 4: POST /drops/:id/nfts  — upload NFT metadata
Step 5: PUT  /drops/:id/settings — set price (lamports), limits, schedule
Step 6: PUT  /drops/:id/status { status: "active" }
        ↓ drop is live

Step 7: Buyer pays SOL to creator (on-chain)
Step 8: Frontend mints NFT via Metaplex (createNft → buyer's wallet)
        ↓ get mintAddress + transactionHash
Step 9: POST /drops/:id/mint { nftTokenId, transactionHash, ... }
        ↓ backend verifies on-chain, records mint
```

### Browsing Solana NFTs

```
GET /nfts/solana/wallet/:walletAddress         → all NFTs in a wallet
GET /nfts/solana/collection/:collectionMint    → all NFTs in a collection
GET /nfts/:mintAddress?network=solana           → single NFT detail
GET /collections?network=solana                 → Solana collections
GET /drops?network=solana                       → Solana drops
```

### Key Differences from XRPL

| Aspect | XRPL | Solana |
|--------|------|--------|
| **Auth** | XAMAN QR → `POST /auth/wallet` | Phantom sign-message → `POST /auth/solana` |
| **Collection ID** | `taxon` (integer) | `mintAddress` (base58 string) |
| **Drop ID** | `taxonId` | `collectionMintAddress` |
| **NFT ID** | XRPL NFTokenID (64 hex chars) | Solana mint address (base58) |
| **Price unit** | XRP drops (1 XRP = 1,000,000) | SOL lamports (1 SOL = 1,000,000,000) |
| **Price field** | `priceCurrency: "XRP"` | `priceCurrency: "SOL"` |
| **Minting** | Backend mints via admin wallet | Frontend mints via Metaplex |
| **Mint recording** | Backend mints + records | Frontend mints → calls `/drops/:id/mint` to record |
| **NFT detail** | Bithomp API + XRPL RPC | Helius DAS API (`?network=solana`) |
| **Offers** | XRPL native NFToken offers | Not applicable (use marketplace programs) |

---

## Appendix: Environment Variables

These must be set on the backend for Solana support:

```env
SOLANA_NETWORK=devnet                                      # or mainnet-beta
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=KEY  # Helius RPC with DAS
SOLANA_ADMIN_SECRET_KEY=<base58-encoded-secret-key>        # for future server-side ops
```
