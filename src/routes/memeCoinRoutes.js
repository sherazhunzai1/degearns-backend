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
  getPriceHistory
} = require('../controllers/memeCoinController');

/**
 * @route   POST /api/v1/memecoins
 * @desc    Create a new meme coin.
 *          XRPL: returns TrustSet tx for QR signing.
 *          Solana: registers an SPL token (frontend creates on-chain).
 * @access  Public
 */
router.post('/', createMemeCoin);

/**
 * @route   GET /api/v1/memecoins/listed
 * @desc    Get all listed meme coins (with active liquidity pools).
 *          Includes 24h volume + latest price for each coin.
 * @access  Public
 */
router.get('/listed', getListedMemeCoins);

/**
 * @route   GET /api/v1/memecoins
 * @desc    List all meme coins with pagination/filters.
 *          Filters: network, status, listed (true/false), search, creatorWalletAddress.
 * @access  Public
 */
router.get('/', getMemeCoins);

/**
 * @route   GET /api/v1/memecoins/wallet/:walletAddress
 * @desc    Get meme coins created by a wallet (includes all linked wallets).
 * @access  Public
 */
router.get('/wallet/:walletAddress', getMyMemeCoins);

/**
 * @route   POST /api/v1/memecoins/:id/confirm-trustline
 * @desc    XRPL only: Confirm TrustSet was signed, then issue tokens.
 * @access  Public
 */
router.post('/:id/confirm-trustline', confirmTrustline);

/**
 * @route   POST /api/v1/memecoins/:id/confirm-mint
 * @desc    Solana only: Confirm SPL token mint transaction on-chain.
 * @access  Public
 */
router.post('/:id/confirm-mint', confirmMint);

/**
 * @route   POST /api/v1/memecoins/:id/pool
 * @desc    Register a liquidity pool for a meme coin.
 *          Solana: Raydium pool. XRPL: native AMM.
 * @access  Public
 */
router.post('/:id/pool', registerPool);

/**
 * @route   GET /api/v1/memecoins/:id/pools
 * @desc    Get all pools for a meme coin.
 * @access  Public
 */
router.get('/:id/pools', getMemeCoinPools);

/**
 * @route   POST /api/v1/memecoins/:id/trade
 * @desc    Record a trade (called after on-chain swap completes).
 * @access  Public
 */
router.post('/:id/trade', recordTrade);

/**
 * @route   GET /api/v1/memecoins/:id/trades
 * @desc    Get trade history for a meme coin.
 * @access  Public
 */
router.get('/:id/trades', getTrades);

/**
 * @route   GET /api/v1/memecoins/:id/price-history
 * @desc    Get OHLC candle data for price graph.
 *          Query: interval (5m/15m/30m/1h/4h/1d), from, to
 * @access  Public
 */
router.get('/:id/price-history', getPriceHistory);

/**
 * @route   GET /api/v1/memecoins/:id
 * @desc    Get a single meme coin (with active pool + latest price).
 * @access  Public
 */
router.get('/:id', getMemeCoin);

module.exports = router;
