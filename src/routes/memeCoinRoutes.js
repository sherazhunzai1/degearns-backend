const express = require('express');
const router = express.Router();
const {
  createMemeCoin,
  confirmTrustline,
  confirmMint,
  getMemeCoin,
  getMemeCoins,
  getMyMemeCoins,
  registerPool,
  getMemeCoinPools,
  getListedMemeCoins,
  recordTrade,
  getTrades,
  getPriceHistory,
  buildBuyToken,
  buildSellToken,
  confirmSwap,
  buildAMMCreate,
  confirmAMMCreate,
  getAMMInfo,
  registerRaydiumPool,
  recordRaydiumSwap
} = require('../controllers/memeCoinController');

// ==================== SPECIFIC ROUTES (must be before /:id wildcards) ====================

router.post('/', createMemeCoin);
router.get('/', getMemeCoins);
router.get('/listed', getListedMemeCoins);
router.get('/wallet/:walletAddress', getMyMemeCoins);
router.get('/trades', getTrades);
router.get('/price-history', getPriceHistory);
router.get('/amm', getAMMInfo);

// Raydium (Solana)
router.post('/raydium/pool', registerRaydiumPool);
router.post('/raydium/swap', recordRaydiumSwap);

// XRPL AMM
router.post('/amm/create', buildAMMCreate);
router.post('/confirm-amm', confirmAMMCreate);
router.post('/confirm-swap', confirmSwap);

// XRPL Swap
router.post('/swap/buy', buildBuyToken);
router.post('/swap/sell', buildSellToken);

// ==================== /:id WILDCARD ROUTES (must be last) ====================

router.post('/:id/confirm-trustline', confirmTrustline);
router.post('/:id/confirm-mint', confirmMint);
router.post('/:id/pool', registerPool);
router.get('/:id/pools', getMemeCoinPools);
router.post('/:id/trade', recordTrade);
router.get('/:id/trades', getTrades);
router.get('/:id/price-history', getPriceHistory);
router.get('/:id', getMemeCoin);

module.exports = router;
