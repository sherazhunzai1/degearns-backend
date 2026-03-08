# Referral System API Documentation

Base URL: `/api/v1/referrals`

---

## 1. Get Referral Dashboard

Returns referral stats, earnings breakdown, and recent transactions for a user's profile page.

**Endpoint:** `GET /dashboard`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "referralCode": "ABC123",
    "referralLink": "https://degearns.com/signup?ref=ABC123",
    "totalReferrals": 12,
    "totalEarnings": "5000000",
    "pendingRewards": "0",
    "claimableRewards": "2000000",
    "paidRewards": "3000000",
    "frozenRewards": "0",
    "nextPayoutDate": "2026-04-01T00:00:00.000Z",
    "transactions": [
      {
        "id": "uuid",
        "referrerWalletAddress": "rXXX...",
        "referredWalletAddress": "rYYY...",
        "serviceType": "subscription",
        "serviceName": "pro",
        "purchaseAmount": "10000000",
        "rewardAmount": "1000000",
        "rewardPercentage": "10.00",
        "status": "claimable",
        "purchaseTransactionHash": "ABC123...",
        "payoutTransactionHash": null,
        "paidAt": null,
        "createdAt": "2026-03-08T12:00:00.000Z",
        "referredUser": {
          "walletAddress": "rYYY...",
          "username": "john_doe",
          "profileImage": "https://..."
        }
      }
    ]
  },
  "message": "Referral dashboard retrieved successfully"
}
```

---

## 2. Get Transaction History

Paginated, filterable transaction history showing full transparency: who purchased, what they purchased, reward amount, payment date, and transaction hash.

**Endpoint:** `GET /transactions`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `status` | string | No | Filter by status: `pending`, `claimable`, `claimed`, `paid`, `frozen` |

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "referrerWalletAddress": "rXXX...",
        "referredWalletAddress": "rYYY...",
        "serviceType": "boost",
        "serviceName": "post_boost",
        "purchaseAmount": "5000000",
        "rewardAmount": "500000",
        "rewardPercentage": "10.00",
        "status": "paid",
        "purchaseTransactionHash": "ABC...",
        "payoutTransactionHash": "DEF...",
        "paidAt": "2026-03-07T10:00:00.000Z",
        "createdAt": "2026-03-05T08:00:00.000Z",
        "referredUser": {
          "walletAddress": "rYYY...",
          "username": "jane_doe",
          "profileImage": "https://..."
        }
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  },
  "message": "Transaction history retrieved successfully"
}
```

---

## 3. Get Referral Leaderboard

Public leaderboard showing all referrers ranked by number of referrals, with total rewards and claimable amounts. Each entry can display a Claim button on the frontend.

**Endpoint:** `GET /leaderboard`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "leaderboard": [
      {
        "walletAddress": "rXXX...",
        "username": "top_referrer",
        "profileImage": "https://...",
        "isVerified": true,
        "totalReferrals": 50,
        "totalRewards": "25000000",
        "claimableRewards": "5000000"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  },
  "message": "Referral leaderboard retrieved successfully"
}
```

---

## 4. Claim Rewards

Claims all claimable rewards for a user. Creates a claim batch and marks individual rewards as claimed. Payout is processed via smart contract.

**Endpoint:** `POST /claim`

**Request Body:**

```json
{
  "walletAddress": "rXXX..."
}
```

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "claimId": "uuid",
    "totalAmount": "5000000",
    "rewardCount": 8,
    "status": "pending"
  },
  "message": "Rewards claim initiated successfully. Payout will be processed shortly."
}
```

**Error Responses:**

| Status | Message |
|--------|---------|
| 400 | Wallet address is required |
| 400 | No claimable rewards available |
| 404 | User not found |

---

## 5. Get Claim History

Returns paginated history of all claim/payout batches for a user.

**Endpoint:** `GET /claims`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "claims": [
      {
        "id": "uuid",
        "referrerWalletAddress": "rXXX...",
        "totalAmount": "5000000",
        "rewardCount": 8,
        "status": "completed",
        "transactionHash": "XRP_TX_HASH...",
        "processedAt": "2026-03-07T12:00:00.000Z",
        "failureReason": null,
        "createdAt": "2026-03-07T11:55:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Claim history retrieved successfully"
}
```

---

## 6. Get Audit Log

Immutable audit trail of all referral activity. Cannot be deleted. Includes: who was paid, from which referral, for which service, how much crypto, date, and tx hash.

**Endpoint:** `GET /audit-log`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | User's wallet address |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 50) |

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "action": "reward_created",
        "referrerWalletAddress": "rXXX...",
        "referredWalletAddress": "rYYY...",
        "rewardId": "uuid",
        "claimId": null,
        "serviceType": "subscription",
        "amount": "1000000",
        "transactionHash": "ABC...",
        "metadata": {
          "serviceName": "pro",
          "purchaseAmount": "10000000",
          "rewardPercentage": 10
        },
        "createdAt": "2026-03-08T12:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 120,
      "page": 1,
      "limit": 50,
      "totalPages": 3
    }
  },
  "message": "Referral audit log retrieved successfully"
}
```

**Audit Log Actions:**

| Action | Description |
|--------|-------------|
| `reward_created` | A new referral reward was generated from a purchase |
| `reward_claimable` | Reward status changed to claimable |
| `reward_claimed` | Reward was included in a claim batch |
| `reward_paid` | Reward payout was completed on-chain |
| `reward_frozen` | Reward frozen due to suspicious activity |
| `claim_initiated` | User initiated a claim for claimable rewards |
| `claim_completed` | Claim payout completed successfully |
| `claim_failed` | Claim payout failed |
| `abuse_detected` | Anti-abuse system flagged suspicious activity |
| `rewards_unfrozen` | Admin unfroze previously frozen rewards |

---

## 7. Freeze User Rewards (Admin Only)

Freezes all pending/claimable rewards for a user flagged for suspicious activity.

**Endpoint:** `POST /freeze`

**Auth:** Requires admin authentication

**Request Body:**

```json
{
  "walletAddress": "rXXX...",
  "reason": "Multiple accounts detected from same IP"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "frozenCount": 5
  },
  "message": "5 rewards frozen for suspicious activity"
}
```

---

## 8. Unfreeze User Rewards (Admin Only)

Unfreezes all frozen rewards for a user after investigation.

**Endpoint:** `POST /unfreeze`

**Auth:** Requires admin authentication

**Request Body:**

```json
{
  "walletAddress": "rXXX..."
}
```

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "unfrozenCount": 5
  },
  "message": "5 rewards unfrozen"
}
```

---

## Anti-Abuse Rules

| Rule | Description |
|------|-------------|
| No self-referral | Users cannot use their own referral code at signup |
| No banned referrers | Referral codes from banned users are rejected |
| One referrer per user | `referredBy` is set at signup and cannot be changed |
| Reward freezing | Admins can freeze rewards for suspicious activity via `/freeze` |
| Immutable audit log | All actions are permanently logged and cannot be deleted |

---

## Internal Helper: `recordReferralReward()`

Called from subscription/boost purchase flows to automatically create rewards.

```js
const { recordReferralReward } = require('../controllers/referralController');

await recordReferralReward({
  purchaserWalletAddress: 'rXXX...',
  serviceType: 'subscription',    // 'subscription' | 'boost'
  serviceName: 'pro',             // plan/boost name
  purchaseAmount: '50000000',     // in drops/XRP
  purchaseTransactionHash: 'XRPL_TX_HASH...'
});
```

Returns the created `ReferralReward` object, or `null` if no referrer exists. Errors are caught internally so they never break the purchase flow.

---

## Reward Statuses

| Status | Description |
|--------|-------------|
| `pending` | Reward created, awaiting processing |
| `claimable` | Reward available for user to claim |
| `claimed` | Reward included in a claim batch, awaiting payout |
| `paid` | Reward paid out on-chain |
| `frozen` | Reward frozen by admin due to suspicious activity |

## Claim Statuses

| Status | Description |
|--------|-------------|
| `pending` | Claim submitted, awaiting processing |
| `processing` | Payout being processed on XRPL |
| `completed` | Payout completed, tx hash recorded |
| `failed` | Payout failed, failure reason recorded |
