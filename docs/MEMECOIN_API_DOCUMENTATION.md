# Meme Coin API Documentation

Base URL: `/api/v1/memecoins`

This document covers the meme coin creation, liquidity pool listing, trading, price history, and **liquidity-lock** APIs for both Solana (**Jupiter** aggregator) and XRPL (native AMM) networks.

> **Update — Solana now uses Jupiter, not Raydium.** Buy/sell swaps are routed through the [Jupiter aggregator](https://dev.jup.ag/) (best price across every Solana DEX). The backend builds the unsigned swap transaction; the **frontend signs and sends it**. Liquidity locking is supported on both chains — **Jupiter Lock** on Solana and a **custodial LP lock** on XRPL. The old `/raydium/*` endpoints have been replaced by `/solana/*` and `/jupiter/*` (see §15–§16).

---

## Table of Contents

1. [Create Meme Coin](#1-create-meme-coin)
2. [Confirm XRPL TrustSet](#2-confirm-xrpl-trustset)
3. [Confirm Solana Mint](#3-confirm-solana-mint)
4. [Get Single Meme Coin](#4-get-single-meme-coin)
5. [List All Meme Coins](#5-list-all-meme-coins)
6. [Get My Meme Coins](#6-get-my-meme-coins)
7. [Get Listed Meme Coins](#7-get-listed-meme-coins)
8. [Register Liquidity Pool](#8-register-liquidity-pool)
9. [Get Meme Coin Pools](#9-get-meme-coin-pools)
10. [Record Trade](#10-record-trade)
11. [Get Trades](#11-get-trades)
12. [Get Price History (OHLC)](#12-get-price-history-ohlc)
13. [Frontend Flows](#13-frontend-flows)
14. [Error Codes](#14-error-codes)
15. [Solana Swaps & Pricing (Jupiter)](#15-solana-swaps--pricing-jupiter)
16. [Liquidity Locks](#16-liquidity-locks)

---

## 1. Create Meme Coin

```
POST /memecoins
```

Creates a new meme coin. Branches by network.

### Solana Request

The frontend creates the SPL token on-chain first, then registers it here.

```json
{
  "network": "solana",
  "tokenName": "DegeCoin",
  "tokenSymbol": "DEGE",
  "totalSupply": 1000000000,
  "decimals": 9,
  "mintAddress": "YourSPLTokenMintAddress...",
  "walletAddress": "CreatorSolanaWallet...",
  "mintTxHash": "MintTransactionSignature...",
  "logo": "https://arweave.net/logo.png",
  "description": "The ultimate degen coin",
  "website": "https://degecoin.com",
  "socialLinks": {
    "twitter": "https://twitter.com/degecoin",
    "telegram": "https://t.me/degecoin"
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `network` | Yes | `"solana"` |
| `tokenName` | Yes | Full name |
| `tokenSymbol` | Yes | 1-15 alphanumeric chars |
| `totalSupply` | Yes | Must be > 0 |
| `decimals` | No | Default 6, range 0-15 |
| `mintAddress` | Yes (Solana) | SPL token mint address |
| `walletAddress` | Yes | Creator's wallet |
| `mintTxHash` | No | If provided, status is set to `minted` immediately |
| `logo` | No | Image URL |
| `description` | No | |
| `website` | No | |
| `socialLinks` | No | JSON object |

**Solana Response (201):**
```json
{
  "code": 201,
  "data": {
    "id": "uuid",
    "tokenName": "DegeCoin",
    "tokenSymbol": "DEGE",
    "network": "solana",
    "mintAddress": "YourSPLTokenMintAddress...",
    "currencyHex": null,
    "totalSupply": "1000000000",
    "decimals": 9,
    "logo": "https://arweave.net/logo.png",
    "description": "The ultimate degen coin",
    "creatorWalletAddress": "CreatorSolanaWallet...",
    "issuerWalletAddress": null,
    "status": "minted"
  },
  "message": "Solana meme coin registered successfully"
}
```

### XRPL Request

The backend builds a TrustSet transaction for the user to sign via Xaman.

```json
{
  "tokenName": "MoonToken",
  "tokenSymbol": "MOON",
  "totalSupply": 1000000,
  "decimals": 6,
  "walletAddress": "rCreatorXRPLWallet...",
  "logo": "ipfs://bafkrei...",
  "description": "To the moon"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `network` | No | Defaults to `"xrpl"` |
| `tokenName` | Yes | |
| `tokenSymbol` | Yes | |
| `totalSupply` | Yes | |
| `walletAddress` | Yes | XRPL creator wallet |

**XRPL Response (201):**
```json
{
  "code": 201,
  "data": {
    "id": "uuid",
    "tokenName": "MoonToken",
    "tokenSymbol": "MOON",
    "network": "xrpl",
    "currencyHex": "4D4F4F4E...",
    "issuerWalletAddress": "rAdminWallet...",
    "status": "pending",
    "trustSetTransaction": {
      "TransactionType": "TrustSet",
      "Account": "rCreatorXRPLWallet...",
      "LimitAmount": { ... }
    },
    "instructions": {
      "step": 1,
      "message": "Scan the QR code to set the trust line...",
      "nextEndpoint": "/api/v1/memecoins/{id}/confirm-trustline"
    }
  }
}
```

---

## 2. Confirm XRPL TrustSet

```
POST /memecoins/:id/confirm-trustline
```

XRPL only. After the user signs the TrustSet, the backend verifies it on-chain and issues tokens.

**Request:**
```json
{
  "trustSetTxHash": "XRPL_TrustSet_TxHash..."
}
```

**Response (200):**
```json
{
  "data": {
    "memeCoin": { "id": "uuid", "status": "issued", ... },
    "trustSetTxHash": "...",
    "issuanceTxHash": "..."
  },
  "message": "Token issued successfully!"
}
```

---

## 3. Confirm Solana Mint

```
POST /memecoins/:id/confirm-mint
```

Solana only. Verifies the SPL token mint transaction on-chain and updates status to `minted`.

**Request:**
```json
{
  "mintTxHash": "SolanaMintTransactionSignature..."
}
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "tokenName": "DegeCoin",
    "status": "minted",
    "issuanceTxHash": "SolanaMintTransactionSignature..."
  },
  "message": "Mint transaction verified and recorded"
}
```

---

## 4. Get Single Meme Coin

```
GET /memecoins/:id
```

Returns the coin with its active pools and latest price.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "tokenName": "DegeCoin",
    "tokenSymbol": "DEGE",
    "network": "solana",
    "mintAddress": "YourMint...",
    "totalSupply": "1000000000",
    "logo": "https://...",
    "description": "...",
    "creator": {
      "walletAddress": "Creator...",
      "username": "alice",
      "profileImage": "...",
      "isVerified": true
    },
    "pools": [
      {
        "id": "uuid",
        "poolAddress": "RaydiumPoolId...",
        "pairToken": "SOL",
        "initialPrice": "0.00005",
        "status": "active"
      }
    ],
    "isListed": true,
    "currentPrice": {
      "pricePerToken": "0.00012",
      "priceUsd": "0.0204",
      "pairToken": "SOL",
      "tradedAt": "2026-06-05T10:30:00Z"
    }
  }
}
```

---

## 5. List All Meme Coins

```
GET /memecoins
```

**Query Parameters:**

| Param | Default | Notes |
|-------|---------|-------|
| `page` | 1 | |
| `limit` | 20 | |
| `network` | — | `solana` or `xrpl`. Omit for both. |
| `status` | — | `pending`, `trust_set`, `issued`, `minted`, `failed` |
| `listed` | — | `true` to show only coins with active pools |
| `creatorWalletAddress` | — | Filter by creator |
| `search` | — | Search by name, symbol, or description |
| `sortBy` | `createdAt` | Any column name |
| `order` | `DESC` | `ASC` or `DESC` |

**Response (200):**
```json
{
  "data": {
    "memeCoins": [
      {
        "id": "uuid",
        "tokenName": "DegeCoin",
        "tokenSymbol": "DEGE",
        "network": "solana",
        "isListed": true,
        "currentPrice": { "pricePerToken": "0.00012", "priceUsd": "0.0204" },
        "creator": { ... },
        "pools": [ ... ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "pages": 3
    }
  }
}
```

---

## 6. Get My Meme Coins

```
GET /memecoins/wallet/:walletAddress
```

Returns all meme coins created by the user. **Resolves linked wallets** — if a Solana wallet is linked to an XRPL wallet, returns coins from both.

**Response (200):**
```json
{
  "data": {
    "memeCoins": [
      {
        "id": "uuid",
        "tokenName": "DegeCoin",
        "network": "solana",
        "isListed": true,
        "pools": [ ... ]
      },
      {
        "id": "uuid",
        "tokenName": "MoonToken",
        "network": "xrpl",
        "isListed": false,
        "pools": []
      }
    ]
  }
}
```

---

## 7. Get Listed Meme Coins

```
GET /memecoins/listed
```

Returns only coins with **active liquidity pools**, enriched with latest price and 24h trading stats. This is the data for the "Listed Coins" page.

**Query Parameters:**

| Param | Default | Notes |
|-------|---------|-------|
| `page` | 1 | |
| `limit` | 20 | |
| `network` | — | `solana` or `xrpl` |
| `search` | — | Search by name or symbol |
| `sortBy` | `createdAt` | |
| `order` | `DESC` | |

**Response (200):**
```json
{
  "data": {
    "memeCoins": [
      {
        "id": "uuid",
        "tokenName": "DegeCoin",
        "tokenSymbol": "DEGE",
        "network": "solana",
        "mintAddress": "YourMint...",
        "logo": "https://...",
        "creator": { "username": "alice", ... },
        "pools": [
          {
            "poolAddress": "RaydiumPool...",
            "pairToken": "SOL",
            "initialPrice": "0.00005",
            "status": "active"
          }
        ],
        "currentPrice": {
          "pricePerToken": "0.00012",
          "priceUsd": "0.0204",
          "pairToken": "SOL",
          "tradedAt": "2026-06-05T10:30:00Z"
        },
        "stats24h": {
          "volumeUsd": 15420.50,
          "trades": 342
        }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 10, "pages": 1 }
  }
}
```

---

## 8. Register Liquidity Pool

```
POST /memecoins/:id/pool
```

Called by the frontend after creating a pool on Raydium (Solana) or XRPL AMM.

**Request:**
```json
{
  "poolAddress": "RaydiumPoolId_or_XRPL_AMM_Account...",
  "poolId": "OptionalRaydiumAmmId...",
  "pairToken": "SOL",
  "pairTokenAddress": "So11111111111111111111111111111111111111112",
  "initialBaseAmount": 500000000,
  "initialPairAmount": 10.5,
  "createTxHash": "PoolCreationTx...",
  "providerWalletAddress": "LiquidityProviderWallet..."
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `poolAddress` | Yes | Raydium pool ID or XRPL AMM account |
| `pairToken` | Yes | `SOL`, `USDC`, `XRP`, etc. |
| `providerWalletAddress` | Yes | Who provided the liquidity |
| `poolId` | No | Additional pool identifier |
| `pairTokenAddress` | No | Pair token mint/issuer |
| `initialBaseAmount` | No | Meme coin amount added |
| `initialPairAmount` | No | Pair token amount added |
| `createTxHash` | No | Pool creation transaction |

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "memeCoinId": "uuid",
    "network": "solana",
    "poolAddress": "RaydiumPoolId...",
    "pairToken": "SOL",
    "initialPrice": "0.000021",
    "status": "active"
  },
  "message": "Pool registered successfully"
}
```

**Note:** `initialPrice` is auto-calculated from `initialPairAmount / initialBaseAmount`.

---

## 9. Get Meme Coin Pools

```
GET /memecoins/:id/pools
```

**Response (200):**
```json
{
  "data": {
    "pools": [
      {
        "id": "uuid",
        "poolAddress": "RaydiumPoolId...",
        "pairToken": "SOL",
        "initialBaseAmount": "500000000",
        "initialPairAmount": "10.5",
        "initialPrice": "0.000021",
        "status": "active",
        "createdAt": "2026-06-05T08:00:00Z"
      }
    ]
  }
}
```

---

## 10. Record Trade

```
POST /memecoins/:id/trade
```

Called by the frontend **after every swap** completes on Raydium or XRPL AMM. Without this, price history and volume won't populate.

**Request:**
```json
{
  "poolAddress": "RaydiumPoolId...",
  "txHash": "SwapTransactionSignature...",
  "traderWalletAddress": "TraderWallet...",
  "type": "buy",
  "tokenAmount": "50000",
  "pairAmount": "0.025",
  "pairToken": "SOL",
  "tradedAt": "2026-06-05T10:30:00Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `txHash` | Yes | On-chain swap transaction hash |
| `traderWalletAddress` | Yes | |
| `type` | Yes | `"buy"` or `"sell"` |
| `tokenAmount` | Yes | Meme coins traded (> 0) |
| `pairAmount` | Yes | SOL/XRP/USDC amount exchanged (> 0) |
| `pairToken` | Yes | `SOL`, `XRP`, `USDC`, etc. |
| `poolAddress` | No | Links to the registered pool |
| `tradedAt` | No | Defaults to now |

**What the backend computes automatically:**
- `pricePerToken` = pairAmount / tokenAmount
- `priceUsd` = pricePerToken × USD rate of pairToken (from live Binance/CoinGecko)
- `volumeUsd` = pairAmount × USD rate of pairToken

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "memeCoinId": "uuid",
    "txHash": "SwapTx...",
    "type": "buy",
    "tokenAmount": "50000",
    "pairAmount": "0.025",
    "pairToken": "SOL",
    "pricePerToken": "0.0000005",
    "priceUsd": "0.000085",
    "volumeUsd": "4.25",
    "tradedAt": "2026-06-05T10:30:00Z"
  },
  "message": "Trade recorded successfully"
}
```

**Idempotent:** If the same `txHash` is submitted again, returns 200 with the existing record.

---

## 11. Get Trades

```
GET /memecoins/:id/trades?page=1&limit=50&type=buy
```

| Param | Default | Notes |
|-------|---------|-------|
| `page` | 1 | |
| `limit` | 50 | |
| `type` | — | `buy` or `sell`. Omit for both. |

**Response (200):**
```json
{
  "data": {
    "trades": [
      {
        "id": "uuid",
        "txHash": "SwapTx...",
        "traderWalletAddress": "Trader...",
        "type": "buy",
        "tokenAmount": "50000",
        "pairAmount": "0.025",
        "pairToken": "SOL",
        "pricePerToken": "0.0000005",
        "priceUsd": "0.000085",
        "volumeUsd": "4.25",
        "tradedAt": "2026-06-05T10:30:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 342, "pages": 7 }
  }
}
```

---

## 12. Get Price History (OHLC)

```
GET /memecoins/:id/price-history?interval=1h&from=2026-06-01&to=2026-06-05
```

Returns OHLC (Open/High/Low/Close) candle data ready for chart libraries (Lightweight Charts, TradingView, etc.).

**Query Parameters:**

| Param | Default | Options |
|-------|---------|---------|
| `interval` | `1h` | `5m`, `15m`, `30m`, `1h`, `4h`, `1d` |
| `from` | 7 days ago | ISO date string |
| `to` | now | ISO date string |

**Response (200):**
```json
{
  "data": {
    "memeCoinId": "uuid",
    "interval": "1h",
    "from": "2026-06-01T00:00:00Z",
    "to": "2026-06-05T12:00:00Z",
    "candles": [
      {
        "time": "2026-06-01T00:00:00Z",
        "open": 0.00005,
        "high": 0.00008,
        "low": 0.00004,
        "close": 0.00007,
        "volume": 2500000,
        "volumeUsd": 312.50,
        "trades": 15
      },
      {
        "time": "2026-06-01T01:00:00Z",
        "open": 0.00007,
        "high": 0.00012,
        "low": 0.00006,
        "close": 0.00011,
        "volume": 4800000,
        "volumeUsd": 816.00,
        "trades": 28
      }
    ]
  }
}
```

**Frontend usage with Lightweight Charts:**
```ts
const { data } = await axios.get(`/memecoins/${coinId}/price-history?interval=1h`);

const chart = createChart(container);
const candleSeries = chart.addCandlestickSeries();
candleSeries.setData(data.candles.map(c => ({
  time: new Date(c.time).getTime() / 1000,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close
})));
```

---

## 13. Frontend Flows

### Solana Meme Coin — Create → List → Lock → Trade (Jupiter)

```
Step 1: Create SPL token on-chain (frontend, Metaplex/SPL)
        ↓ get mintAddress + mintTxHash
Step 2: POST /memecoins
        { network: "solana", mintAddress, mintTxHash, tokenName, ... }
        ↓ coin saved (status: minted)

Step 3: Optionally confirm mint
        POST /memecoins/:id/confirm-mint { mintTxHash }
        ↓ verified on-chain

Step 4: Create a liquidity pool on-chain (frontend — any DEX Jupiter routes through)
        ↓ get poolAddress + createTxHash
Step 5: POST /memecoins/solana/pool
        { mintAddress, walletAddress, poolAddress, pairToken: "SOL", initialBaseAmount, initialPairAmount, ... }
        ↓ coin is now "listed"

Step 6 (recommended): Lock the LP via Jupiter Lock (frontend, lock.jup.ag)
        ↓ get the lock account + lock tx signature
        POST /memecoins/:id/lock
        { provider: "jupiter_lock", lockAddress, assetMint, amount, unlockAt, ownerWalletAddress, lockTxHash }
        ↓ coin shows a "liquidity locked" badge

Step 7: Buy/Sell via Jupiter:
        POST /memecoins/jupiter/swap   { walletAddress, mintAddress, type: "buy"/"sell", pairToken: "SOL", amount }
        ↓ returns base64 swapTransaction → frontend signs & sends
        POST /memecoins/solana/swap/record
        { mintAddress, txHash, traderWalletAddress, type, tokenAmount, pairAmount, pairToken: "SOL" }
```

> The generic `POST /memecoins/:id/pool` and `POST /memecoins/:id/trade` endpoints still work for both networks. The Solana-specific `/solana/pool` and `/solana/swap/record` add on-chain tx verification and Jupiter defaults.

### XRPL Meme Coin — Create → List → Trade

```
Step 1: POST /memecoins
        { tokenName, tokenSymbol, totalSupply, walletAddress }
        ↓ returns TrustSet transaction for Xaman QR

Step 2: User signs TrustSet in Xaman
        ↓ get trustSetTxHash
Step 3: POST /memecoins/:id/confirm-trustline
        { trustSetTxHash }
        ↓ backend issues tokens (status: issued)

Step 4: Create XRPL AMM pool (frontend, xrpl.js AMMCreate)
        ↓ get AMM account address
Step 5: POST /memecoins/:id/pool
        { poolAddress: "AMM_Account...", pairToken: "XRP", ... }
        ↓ coin is now "listed"

Step 6: After every AMM swap:
        POST /memecoins/:id/trade
        { txHash, type: "buy"/"sell", tokenAmount, pairAmount, pairToken: "XRP", ... }
```

### Displaying Listed Coins Page

```ts
// All listed coins with price + 24h stats
const { data } = await axios.get('/memecoins/listed?page=1&limit=20');

data.memeCoins.forEach(coin => {
  console.log(coin.tokenName);
  console.log('Price:', coin.currentPrice?.priceUsd);
  console.log('24h Volume:', coin.stats24h?.volumeUsd);
  console.log('Network:', coin.network);
  console.log('Pool:', coin.pools[0]?.poolAddress);
});
```

### Displaying Price Chart

```ts
// Get OHLC candles for a specific coin
const { data } = await axios.get(`/memecoins/${coinId}/price-history?interval=1h`);

// Use data.candles with Lightweight Charts / TradingView
```

---

## 14. Error Codes

| Code | When |
|------|------|
| 400 | Missing/invalid fields, invalid addresses, wrong network for endpoint |
| 404 | Meme coin not found, pool not found |
| 409 | Token symbol already exists (XRPL) |
| 500 | Token issuance failed (XRPL), on-chain verification error |

---

## Key Differences by Network

| Aspect | XRPL | Solana |
|--------|------|--------|
| **Token creation** | Backend builds TrustSet → user signs → backend issues | Frontend mints SPL → registers on backend |
| **Identifier** | `currencyHex` + `issuerWalletAddress` | `mintAddress` |
| **Pool type** | XRPL native AMM (`AMMCreate`) | Pool on any DEX, **traded via Jupiter** |
| **Swaps** | `Payment` via AMM (backend builds, Xaman signs) | **Jupiter** swap tx (backend builds, wallet signs) |
| **Pair token** | XRP | SOL, USDC, etc. |
| **Status flow** | `pending` → `trust_set` → `issued` | `pending` → `minted` |
| **Price in** | XRP → converted to USD | SOL → converted to USD |
| **Liquidity lock** | Custodial LP lock (LP → admin locker wallet, time-released) | **Jupiter Lock** / burn (frontend), recorded + verified by backend |

---

## 15. Solana Swaps & Pricing (Jupiter)

All amounts below are in **base units** of the input token (lamports for SOL — 1 SOL = 1,000,000,000; raw token units otherwise = uiAmount × 10^decimals).

### 15.1 Register a Solana pool

```
POST /memecoins/solana/pool
```

Replaces the old `/raydium/pool`. Call after the frontend creates a liquidity pool on-chain so the coin shows as "listed".

```json
{
  "mintAddress": "YourMint...",
  "walletAddress": "Creator...",
  "poolAddress": "PoolOrMarketAddress...",
  "pairToken": "SOL",
  "initialBaseAmount": 500000000,
  "initialPairAmount": 10.5,
  "createTxHash": "PoolCreateSig..."
}
```

Returns the registered pool. `pairTokenAddress` defaults to the resolved mint (SOL/USDC/USDT). Idempotent on `poolAddress`.

### 15.2 Get a swap quote

```
POST /memecoins/jupiter/quote
```

```json
{ "mintAddress": "YourMint...", "type": "buy", "pairToken": "SOL", "amount": "100000000", "slippageBps": 100 }
```

| Field | Required | Notes |
|-------|----------|-------|
| `mintAddress` | Yes* | The meme coin. *Or pass `inputMint` + `outputMint` directly. |
| `type` | Yes* | `"buy"` (pair → coin) or `"sell"` (coin → pair). |
| `pairToken` | No | `SOL` (default), `USDC`, `USDT`, or a mint address. |
| `amount` | Yes | Base units of the **input** token. |
| `slippageBps` | No | Default 100 (1%). |

**Response (200):** `{ inputMint, outputMint, quote }` — pass `quote` straight into the swap build.

### 15.3 Build a swap transaction (buy / sell)

```
POST /memecoins/jupiter/swap
```

```json
{ "walletAddress": "Trader...", "mintAddress": "YourMint...", "type": "buy", "pairToken": "SOL", "amount": "100000000", "slippageBps": 100 }
```

Pass either the four convenience fields above (a fresh quote is fetched), or a prior `quoteResponse` from §15.2.

**Response (200):**
```json
{
  "data": {
    "swapTransaction": "<base64 VersionedTransaction>",
    "lastValidBlockHeight": 1234567,
    "quote": { ... },
    "instructions": { "nextEndpoint": "/api/v1/memecoins/solana/swap/record" }
  }
}
```

**Frontend:** deserialize the base64 → `VersionedTransaction`, sign with the wallet, send, confirm.

### 15.4 Record a completed swap

```
POST /memecoins/solana/swap/record
```

Replaces the old `/raydium/swap`. Verifies the signature on-chain and stores the trade for price history/volume.

```json
{ "mintAddress": "YourMint...", "txHash": "SwapSig...", "traderWalletAddress": "Trader...", "type": "buy", "tokenAmount": "50000", "pairAmount": "0.1", "pairToken": "SOL" }
```

Idempotent on `txHash`. **Trades and the price chart (`GET /memecoins/:id/price-history?mintAddress=...`) read current price from Jupiter** and candles from on-chain swap history.

---

## 16. Liquidity Locks

A lock proves liquidity can't be rug-pulled. Lock status is surfaced on `GET /memecoins/:id`, `GET /memecoins/listed` (as `lockStatus`), and the lock endpoints below.

**`lockStatus` / summary shape:**
```json
{ "isLocked": true, "activeLocks": 1, "totalLockedAmount": 1000000, "permanentLock": false, "nextUnlockAt": "2027-01-01T00:00:00Z" }
```

### 16.1 Record a lock (Solana — Jupiter Lock / burn)

```
POST /memecoins/:id/lock
```

The frontend locks the LP/tokens via **Jupiter Lock** (`lock.jup.ag`) or burns them, then records it here. The backend verifies `lockTxHash` on-chain.

```json
{
  "provider": "jupiter_lock",
  "lockType": "liquidity",
  "lockAddress": "JupiterLockEscrow...",
  "assetMint": "LpOrTokenMint...",
  "amount": "1000000",
  "ownerWalletAddress": "Creator...",
  "recipientWalletAddress": "Creator...",
  "unlockAt": "2027-01-01T00:00:00Z",
  "lockTxHash": "LockSig..."
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `amount` | Yes | Locked amount (> 0). |
| `ownerWalletAddress` | Yes | Who owns the locked liquidity. |
| `lockTxHash` | Yes | On-chain lock tx (verified). |
| `provider` | No | Default `jupiter_lock` (Solana). `burn`, `streamflow`, … also accepted. |
| `unlockAt` | No | Omit for a **permanent** lock (e.g. burn). |
| `lockAddress`, `assetMint`, `recipientWalletAddress`, `metadata` | No | |

Idempotent on `lockTxHash`. Returns the created lock.

### 16.2 Get locks for a coin

```
GET /memecoins/:id/locks
```
Returns `{ locks: [...], summary: { ... } }`.

```
GET /memecoins/locks?mintAddress=...                       (Solana)
GET /memecoins/locks?currencyHex=...&issuerWalletAddress=...  (XRPL)
GET /memecoins/locks?ownerWalletAddress=...&status=active
```
Query locks by on-chain identifiers / owner without the DB id.

### 16.3 Lock liquidity on XRPL (custodial LP lock)

XRPL has no smart contracts, so LP tokens are locked by sending them to the platform's server-controlled **locker (admin) wallet**, which holds them until the unlock date and then returns them.

**Step 1 — build:**
```
POST /memecoins/xrpl/lock/build
```
```json
{ "walletAddress": "rCreator...", "currencyHex": "4D4F4F4E...", "issuerWalletAddress": "rIssuer...", "lpAmount": "1000", "unlockAt": "2027-01-01T00:00:00Z" }
```
- Looks up the AMM, resolves the **LP token** (currency + AMM-account issuer), ensures the locker has a trust line, and returns an unsigned `Payment` (LP tokens → locker) for Xaman. Omit `lpAmount` to lock the creator's **full LP balance**.

**Response:** `{ lockerAddress, lpToken, amount, transaction, instructions }`.

**Step 2 — confirm:**
```
POST /memecoins/xrpl/lock/confirm
```
```json
{ "lockTxHash": "...", "walletAddress": "rCreator...", "currencyHex": "4D4F4F4E...", "issuerWalletAddress": "rIssuer...", "unlockAt": "2027-01-01T00:00:00Z" }
```
Verifies the LP tokens reached the locker and records the lock (`provider: "xrpl_custodial"`). Idempotent on `lockTxHash`.

**Step 3 — release (after `unlockAt`):**
```
POST /memecoins/xrpl/lock/release
```
```json
{ "lockId": "uuid" }
```
The locker (admin) wallet sends the LP tokens **back to the original owner** (recipient cannot be overridden). Fails if the lock is still active, permanent, or not an XRPL custodial lock. Sets the lock to `released` with the `unlockTxHash`.

> XRPL note: the owner must keep their trust line to the LP token to receive it back on release (it stays after they send the LP away).
