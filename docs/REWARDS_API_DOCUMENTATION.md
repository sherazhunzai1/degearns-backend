# Reward Distribution System API Documentation

## Overview

The Reward Distribution System enables monthly rewards for top performers in three categories:
- **Traders** - Users who spend the most on minting NFTs
- **Creators** - Users with highest revenue from their drops
- **Influencers** - Users with most followers and engagement

### Distribution Formula

**Category Allocation:**
- Each category receives 33.33% of the total distribution amount (1/3 each)

**Rank Distribution (within each category):**
| Rank | Percentage |
|------|------------|
| 1 | 25% |
| 2 | 15% |
| 3 | 10% |
| 4-10 | ~7.14% each (50% split equally) |

**Example:**
With 3000 XRP total:
- Per category: 1000 XRP
- Rank 1: 250 XRP
- Rank 2: 150 XRP
- Rank 3: 100 XRP
- Rank 4-10: ~71.43 XRP each

---

## Base URL
```
/api/admin
```

---

## Monthly Ranking Management

### Get Distribution Formula
Get the reward distribution formula and percentages.

**Endpoint:** `GET /rankings/formula`

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "formula": {
      "categories": ["trader", "creator", "influencer"],
      "categoryAllocation": "33.33% each (1/3 of total wallet balance)",
      "rankDistribution": {
        "Rank 1": "25% of category allocation",
        "Rank 2": "15% of category allocation",
        "Rank 3": "10% of category allocation",
        "Ranks 4-10": "50% split equally (~7.14% each)"
      },
      "example": {
        "walletBalance": "3000 XRP",
        "perCategory": "1000 XRP (33.33%)",
        "rank1": "250 XRP (25%)",
        "rank2": "150 XRP (15%)",
        "rank3": "100 XRP (10%)",
        "rank4to10": "~71.43 XRP each (7.14%)"
      }
    },
    "percentages": {
      "categoryPercentage": 33.33,
      "rankPercentages": {
        "1": 25.00,
        "2": 15.00,
        "3": 10.00,
        "4": 7.14,
        "5": 7.14,
        "6": 7.14,
        "7": 7.14,
        "8": 7.14,
        "9": 7.14,
        "10": 7.16
      }
    }
  },
  "message": "Distribution formula retrieved successfully"
}
```

---

### Get Monthly Rankings
Get all rankings for a specific period.

**Endpoint:** `GET /rankings`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| month | number | Yes | Month (1-12) |
| year | number | Yes | Year (e.g., 2025) |
| category | string | No | Filter by category (trader, creator, influencer) |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "period": {
      "month": 1,
      "year": 2025
    },
    "rankings": [
      {
        "id": "uuid",
        "periodMonth": 1,
        "periodYear": 2025,
        "category": "trader",
        "rankings": [
          {
            "rank": 1,
            "walletAddress": "rXXX...",
            "username": "TopTrader",
            "profileImage": "https://...",
            "isVerified": true
          }
        ],
        "status": "finalized",
        "setBy": "admin-wallet",
        "finalizedBy": "admin-wallet",
        "finalizedAt": "2025-01-15T10:00:00Z"
      }
    ],
    "categoryStatus": {
      "trader": {
        "exists": true,
        "status": "finalized",
        "setBy": "admin-wallet",
        "setAt": "2025-01-10T10:00:00Z",
        "finalizedBy": "admin-wallet",
        "finalizedAt": "2025-01-15T10:00:00Z"
      },
      "creator": {
        "exists": true,
        "status": "draft",
        "setBy": "admin-wallet",
        "setAt": "2025-01-12T10:00:00Z",
        "finalizedBy": null,
        "finalizedAt": null
      },
      "influencer": {
        "exists": false,
        "status": "not_set"
      }
    },
    "readyForDistribution": false,
    "message": "Not all categories are finalized yet."
  }
}
```

---

### Set Monthly Ranking
Set or update rankings for a specific category.

**Endpoint:** `POST /rankings`

**Request Body:**
```json
{
  "month": 1,
  "year": 2025,
  "category": "trader",
  "rankings": [
    { "rank": 1, "walletAddress": "rXXX..." },
    { "rank": 2, "walletAddress": "rYYY..." },
    { "rank": 3, "walletAddress": "rZZZ..." },
    { "rank": 4, "walletAddress": "rAAA..." },
    { "rank": 5, "walletAddress": "rBBB..." },
    { "rank": 6, "walletAddress": "rCCC..." },
    { "rank": 7, "walletAddress": "rDDD..." },
    { "rank": 8, "walletAddress": "rEEE..." },
    { "rank": 9, "walletAddress": "rFFF..." },
    { "rank": 10, "walletAddress": "rGGG..." }
  ],
  "notes": "January 2025 top traders based on mint volume"
}
```

**Notes:**
- All 10 ranks must be provided
- Rankings are automatically enriched with user data from the database
- Updating an existing ranking resets its status to "draft"
- Cannot modify rankings that have already been distributed

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "ranking": {
      "id": "uuid",
      "periodMonth": 1,
      "periodYear": 2025,
      "category": "trader",
      "rankings": [...],
      "status": "draft",
      "setBy": "admin-wallet",
      "notes": "January 2025 top traders based on mint volume"
    }
  },
  "message": "trader rankings created successfully"
}
```

---

### Get Category Ranking
Get ranking for a specific category and period.

**Endpoint:** `GET /rankings/:year/:month/:category`

**URL Parameters:**
- `year` - Year (e.g., 2025)
- `month` - Month (1-12)
- `category` - trader, creator, or influencer

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "ranking": {
      "id": "uuid",
      "periodMonth": 1,
      "periodYear": 2025,
      "category": "trader",
      "rankings": [...],
      "status": "finalized"
    }
  }
}
```

---

### Finalize Ranking
Lock a category ranking for distribution.

**Endpoint:** `POST /rankings/finalize`

**Request Body:**
```json
{
  "month": 1,
  "year": 2025,
  "category": "trader"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "ranking": {
      "id": "uuid",
      "status": "finalized",
      "finalizedBy": "admin-wallet",
      "finalizedAt": "2025-01-15T10:00:00Z"
    },
    "allCategoriesFinalized": false,
    "message": "trader ranking finalized. Other categories still pending."
  }
}
```

---

### Unfinalize Ranking
Revert a finalized ranking to draft for editing.

**Endpoint:** `POST /rankings/unfinalize`

**Request Body:**
```json
{
  "month": 1,
  "year": 2025,
  "category": "trader"
}
```

**Notes:**
- Cannot unfinalize rankings that have already been distributed

---

### Delete Ranking
Delete a ranking for a specific category.

**Endpoint:** `DELETE /rankings/:year/:month/:category`

**Notes:**
- Cannot delete rankings that have already been distributed

---

## Reward Distribution

### Get Distribution Status
Check if a period is ready for distribution.

**Endpoint:** `GET /distribution/status`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| month | number | Yes | Month (1-12) |
| year | number | Yes | Year (e.g., 2025) |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "period": {
      "month": 1,
      "year": 2025
    },
    "treasury": {
      "configured": true,
      "address": "rTreasuryAddress...",
      "balance": "3000000000",
      "balanceXrp": "3000.000000",
      "error": null
    },
    "categories": {
      "trader": {
        "exists": true,
        "status": "finalized",
        "rankings": [...],
        "setBy": "admin-wallet",
        "finalizedBy": "admin-wallet",
        "finalizedAt": "2025-01-15T10:00:00Z",
        "distributedAt": null
      },
      "creator": {
        "exists": true,
        "status": "finalized",
        ...
      },
      "influencer": {
        "exists": true,
        "status": "finalized",
        ...
      }
    },
    "readyForDistribution": true,
    "alreadyDistributed": false,
    "expectedDistribution": {
      "totalBalance": "3000.000000 XRP",
      "perCategory": "999.900000 XRP",
      "breakdown": {
        "rank1": { "percentage": "25%", "amount": "249.975000 XRP" },
        "rank2": { "percentage": "15%", "amount": "149.985000 XRP" },
        "rank3": { "percentage": "10%", "amount": "99.990000 XRP" },
        "rank4": { "percentage": "7.14%", "amount": "71.392860 XRP" },
        ...
      }
    },
    "requirements": {
      "treasuryConfigured": true,
      "allCategoriesFinalized": true,
      "notYetDistributed": true
    }
  }
}
```

---

### Execute Distribution
Execute the reward distribution for a period.

**Endpoint:** `POST /distribution/execute`

**Request Body:**
```json
{
  "month": 1,
  "year": 2025,
  "dryRun": false
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| month | number | Yes | Month (1-12) |
| year | number | Yes | Year |
| dryRun | boolean | No | If true, only preview without sending (default: false) |

**Dry Run Response:**
```json
{
  "statusCode": 200,
  "data": {
    "dryRun": true,
    "period": { "month": 1, "year": 2025 },
    "treasury": {
      "address": "rTreasuryAddress...",
      "currentBalance": "3000.000000 XRP",
      "availableForDistribution": "2980.000000 XRP",
      "reserveHeld": "20 XRP"
    },
    "distributions": [
      {
        "category": "trader",
        "rank": 1,
        "walletAddress": "rXXX...",
        "username": "TopTrader",
        "amountDrops": "249975000",
        "amountXrp": "249.975000",
        "percentage": 25,
        "transactionStatus": "preview"
      },
      ...
    ],
    "summary": {
      "totalRecipients": 30,
      "perCategory": [
        { "category": "trader", "allocation": "993.300000 XRP", "recipients": 10 },
        { "category": "creator", "allocation": "993.300000 XRP", "recipients": 10 },
        { "category": "influencer", "allocation": "993.300000 XRP", "recipients": 10 }
      ],
      "totalToDistribute": "2979.900000 XRP"
    }
  },
  "message": "Distribution preview generated"
}
```

**Actual Execution Response:**
```json
{
  "statusCode": 200,
  "data": {
    "batchId": "uuid-batch-id",
    "period": { "month": 1, "year": 2025 },
    "treasury": {
      "address": "rTreasuryAddress...",
      "previousBalance": "3000.000000 XRP"
    },
    "results": {
      "successful": [
        {
          "category": "trader",
          "rank": 1,
          "walletAddress": "rXXX...",
          "username": "TopTrader",
          "amountDrops": "249975000",
          "amountXrp": "249.975000",
          "percentage": 25,
          "transactionHash": "ABC123...",
          "rewardId": "uuid"
        },
        ...
      ],
      "failed": [],
      "totalDistributed": "2979.900000 XRP",
      "totalTransactions": 30,
      "successRate": "100.0%"
    }
  },
  "message": "Distribution completed successfully"
}
```

---

### Get Distribution Batch
Get details of a specific distribution batch.

**Endpoint:** `GET /distribution/batch/:batchId`

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "batchId": "uuid-batch-id",
    "period": {
      "month": 1,
      "year": 2025
    },
    "initiatedBy": "admin-wallet",
    "createdAt": "2025-01-20T10:00:00Z",
    "distributions": [
      {
        "id": "uuid",
        "category": "trader",
        "rank": 1,
        "recipientWallet": "rXXX...",
        "recipient": {
          "walletAddress": "rXXX...",
          "username": "TopTrader",
          "profileImage": "https://...",
          "isVerified": true
        },
        "amount": "249975000",
        "amountXrp": "249.975000",
        "transactionHash": "ABC123...",
        "transactionStatus": "completed",
        "transactionError": null,
        "paidAt": "2025-01-20T10:01:00Z"
      },
      ...
    ],
    "summary": {
      "totalRecipients": 30,
      "successful": 30,
      "failed": 0,
      "pending": 0,
      "totalAmount": "2979900000",
      "totalAmountXrp": "2979.900000",
      "byCategory": {
        "trader": { "count": 10, "amount": "993300000", "amountXrp": "993.300000" },
        "creator": { "count": 10, "amount": "993300000", "amountXrp": "993.300000" },
        "influencer": { "count": 10, "amount": "993300000", "amountXrp": "993.300000" }
      }
    }
  }
}
```

---

### Retry Failed Distributions
Retry failed transactions in a distribution batch.

**Endpoint:** `POST /distribution/retry`

**Request Body:**
```json
{
  "batchId": "uuid-batch-id"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "batchId": "uuid-batch-id",
    "totalRetried": 2,
    "results": {
      "successful": [
        {
          "id": "uuid",
          "category": "trader",
          "rank": 5,
          "walletAddress": "rXXX...",
          "transactionHash": "DEF456..."
        }
      ],
      "stillFailed": [
        {
          "id": "uuid",
          "category": "creator",
          "rank": 3,
          "walletAddress": "rYYY...",
          "error": "Account not found"
        }
      ]
    }
  },
  "message": "Retry completed: 1 successful, 1 still failed"
}
```

---

## Workflow

### Complete Distribution Workflow

1. **Set Rankings for Each Category**
   ```
   POST /admin/rankings
   { "month": 1, "year": 2025, "category": "trader", "rankings": [...] }
   POST /admin/rankings
   { "month": 1, "year": 2025, "category": "creator", "rankings": [...] }
   POST /admin/rankings
   { "month": 1, "year": 2025, "category": "influencer", "rankings": [...] }
   ```

2. **Review Rankings**
   ```
   GET /admin/rankings?month=1&year=2025
   ```

3. **Finalize Each Category**
   ```
   POST /admin/rankings/finalize
   { "month": 1, "year": 2025, "category": "trader" }
   POST /admin/rankings/finalize
   { "month": 1, "year": 2025, "category": "creator" }
   POST /admin/rankings/finalize
   { "month": 1, "year": 2025, "category": "influencer" }
   ```

4. **Check Distribution Status**
   ```
   GET /admin/distribution/status?month=1&year=2025
   ```

5. **Preview Distribution (Dry Run)**
   ```
   POST /admin/distribution/execute
   { "month": 1, "year": 2025, "dryRun": true }
   ```

6. **Execute Distribution**
   ```
   POST /admin/distribution/execute
   { "month": 1, "year": 2025, "dryRun": false }
   ```

7. **Check Batch Results**
   ```
   GET /admin/distribution/batch/{batchId}
   ```

8. **Retry Failed (if any)**
   ```
   POST /admin/distribution/retry
   { "batchId": "..." }
   ```

---

## Status Values

### Ranking Status
| Status | Description |
|--------|-------------|
| `draft` | Ranking can be edited |
| `finalized` | Ranking is locked for distribution |
| `distributed` | Rewards have been sent |

### Transaction Status
| Status | Description |
|--------|-------------|
| `pending` | Transaction not yet processed |
| `processing` | Transaction in progress |
| `completed` | Transaction successful |
| `failed` | Transaction failed (can retry) |

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid request (missing fields, invalid data) |
| 400 | Rankings not set for all categories |
| 400 | Category rankings not finalized |
| 400 | Rewards already distributed for period |
| 400 | Cannot modify distributed rankings |
| 400 | Treasury wallet not configured |
| 400 | Insufficient treasury balance |
| 404 | Ranking not found |
| 404 | Distribution batch not found |
| 500 | Failed to get treasury balance |
| 500 | Transaction submission failed |

---

## Treasury Wallet Configuration

The treasury wallet must be configured in the `.env` file:

```env
# Option 1: Family Seed
TREASURY_WALLET_SEED=sEdVXXXXXXXXXXXXXXXXXXXX

# Option 2: Secret Numbers (8 groups of 6 digits)
TREASURY_WALLET_SECRET_NUMBERS=123456,234567,345678,456789,567890,678901,789012,890123
TREASURY_WALLET_ALGORITHM=secp256k1
```

A reserve of 20 XRP is always held in the treasury wallet for account reserve and transaction fees.
