# XRPL Liquidity Pool (AMM) Implementation Plan

## Overview

XRPL has **native AMM (Automated Market Maker)** support via the **XLS-30 amendment**. This means liquidity pools are built into the ledger itself — no smart contracts needed. We'll pair the memecoin with XRP so anyone can trade it.

---

## How XRPL AMM Works

```
Creator creates MemeCoin (already done)
        |
        v
Creator creates AMM Pool (MemeCoin / XRP pair)
        |
        v
Creator deposits initial liquidity (e.g., 500,000 OTG + 1,000 XRP)
        |
        v
XRPL mints LP Tokens to the creator (proof of liquidity share)
        |
        v
Anyone can now swap XRP <-> MemeCoin via the AMM
        |
        v
Liquidity providers can deposit/withdraw at any time
```

---

## XRPL AMM Transaction Types

| Transaction    | Purpose                                          |
|----------------|--------------------------------------------------|
| `AMMCreate`    | Create a new AMM pool for a token pair           |
| `AMMDeposit`   | Add liquidity to an existing pool                |
| `AMMWithdraw`  | Remove liquidity from a pool                     |
| `AMMBid`       | Bid on the auction slot (discounted trading fee)  |
| `AMMVote`      | Vote on the pool's trading fee                   |
| `amm_info`     | Query pool info (reserves, LP token supply, fee) |

---

## API Design (3-Step Flow)

### Step 1: `POST /api/v1/memecoins/:id/create-pool`

**What it does:** Builds an `AMMCreate` transaction for the creator to sign via Xaman QR.

**Payload:**

```json
{
  "walletAddress": "rCreator...",
  "tokenAmount": "500000",
  "xrpAmount": "1000"
}
```

**AMMCreate Transaction:**

```json
{
  "TransactionType": "AMMCreate",
  "Account": "rCreator...",
  "Amount": {
    "currency": "OTG",
    "issuer": "rIssuer...",
    "value": "500000"
  },
  "Amount2": "1000000000",
  "TradingFee": 500
}
```

- `Amount` = token amount to deposit as initial liquidity
- `Amount2` = XRP in drops (1000 XRP = 1,000,000,000 drops)
- `TradingFee` = fee in basis points (500 = 0.5%)
- Creator signs via Xaman, then XRPL creates the pool and mints LP tokens

**Response:** Returns the `AMMCreate` tx JSON for QR code signing.

---

### Step 2: `POST /api/v1/memecoins/:id/confirm-pool`

**What it does:** After creator signs, verify the `AMMCreate` tx on XRPL and save pool details.

**Payload:**

```json
{
  "ammCreateTxHash": "ABC123..."
}
```

**Backend actions:**

1. Verify tx on XRPL (`command: 'tx'`)
2. Fetch pool info (`command: 'amm_info'`)
3. Save pool details to DB (new `LiquidityPool` model)
4. Update memecoin status to `pooled`

---

### Step 3: `POST /api/v1/memecoins/:id/add-liquidity` (Optional — for anyone)

**What it does:** Lets any user add liquidity to an existing pool.

**AMMDeposit Transaction:**

```json
{
  "TransactionType": "AMMDeposit",
  "Account": "rUser...",
  "Asset": {
    "currency": "OTG",
    "issuer": "rIssuer..."
  },
  "Asset2": {
    "currency": "XRP"
  },
  "Amount": {
    "currency": "OTG",
    "issuer": "rIssuer...",
    "value": "10000"
  },
  "Amount2": "20000000",
  "Flags": 1048576
}
```

---

## Additional Endpoints

| Endpoint                                 | Method | Description                                           |
|------------------------------------------|--------|-------------------------------------------------------|
| `/api/v1/memecoins/:id/pool-info`        | GET    | Get AMM pool info (reserves, price, LP supply, fee)   |
| `/api/v1/memecoins/:id/remove-liquidity` | POST   | Build `AMMWithdraw` tx for QR signing                 |
| `/api/v1/memecoins/:id/swap`             | POST   | Build a `Payment` with `DeliverMin` for token swap    |
| `/api/v1/memecoins/pools`                | GET    | List all active liquidity pools                       |

---

## New Database Model: LiquidityPool

```
LiquidityPool
├── id (UUID)
├── memeCoinId (FK -> MemeCoins.id)
├── ammAccountId (string) — XRPL AMM account address
├── tokenCurrency (string) — currency hex
├── tokenIssuer (string) — issuer address
├── pairedWith (string, default: 'XRP')
├── tradingFee (integer) — basis points (e.g., 500 = 0.5%)
├── initialTokenAmount (decimal)
├── initialXrpAmount (decimal)
├── creatorWalletAddress (string)
├── ammCreateTxHash (string)
├── status (enum: 'active', 'empty', 'removed')
├── lpTokenCurrency (string) — LP token currency code
├── metadata (JSON)
├── createdAt
└── updatedAt
```

---

## Trading Fee Recommendations

| Fee          | Use Case                        |
|--------------|---------------------------------|
| 0 (0%)       | Maximum volume, no LP revenue   |
| 100 (0.1%)   | Low fee, high volume            |
| **500 (0.5%)**| **Recommended for memecoins**  |
| 1000 (1%)    | Higher fee, less volume         |

Max allowed by XRPL: 1000 (1%)

---

## How Swaps Work (No Backend Needed)

Once the AMM pool exists, **anyone can swap** using a standard XRPL `Payment` with path-finding:

```json
{
  "TransactionType": "Payment",
  "Account": "rBuyer...",
  "Destination": "rBuyer...",
  "Amount": {
    "currency": "OTG",
    "issuer": "rIssuer...",
    "value": "1000"
  },
  "SendMax": "50000000",
  "Flags": 131072
}
```

XRPL auto-routes through the AMM. The frontend can build swap transactions directly — the backend just needs to provide pool info and token details.

---

## Implementation Priority

| Phase       | What                           | Endpoints                            |
|-------------|--------------------------------|--------------------------------------|
| **Phase 1** | Create pool + confirm          | `create-pool`, `confirm-pool`, `pool-info` |
| **Phase 2** | Add/remove liquidity           | `add-liquidity`, `remove-liquidity`  |
| **Phase 3** | Swap helper + pool listing     | `swap`, `pools`                      |

---

## Key Considerations

1. **AMM Account**: XRPL creates a special AMM account automatically — you don't manage it
2. **LP Tokens**: Minted by XRPL, represent liquidity share, can be traded
3. **One Pool Per Pair**: XRPL only allows one AMM per token pair
4. **Reserve**: Creating an AMM requires the standard owner reserve (~2 XRP)
5. **Testnet**: AMM is supported on testnet — test there first
6. **Price Discovery**: Initial price = `xrpAmount / tokenAmount` (e.g., 1000 XRP / 500000 OTG = 0.002 XRP per OTG)
