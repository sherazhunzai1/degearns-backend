const express = require('express');
const router = express.Router();
const {
  createMemeCoin,
  confirmTrustline,
  getMemeCoin,
  getMemeCoins,
  getMyMemeCoins
} = require('../controllers/memeCoinController');

/**
 * @route   POST /api/v1/memecoins
 * @desc    Create a new meme coin token (returns TrustSet tx for QR signing)
 * @access  Public
 */
router.post('/', createMemeCoin);

/**
 * @route   POST /api/v1/memecoins/:id/confirm-trustline
 * @desc    Confirm TrustSet was signed, then issue tokens to creator
 * @access  Public
 */
router.post('/:id/confirm-trustline', confirmTrustline);

/**
 * @route   GET /api/v1/memecoins
 * @desc    List all meme coins with pagination, search, filters
 * @access  Public
 */
router.get('/', getMemeCoins);

/**
 * @route   GET /api/v1/memecoins/wallet/:walletAddress
 * @desc    Get meme coins created by a specific wallet
 * @access  Public
 */
router.get('/wallet/:walletAddress', getMyMemeCoins);

/**
 * @route   GET /api/v1/memecoins/:id
 * @desc    Get a single meme coin by ID
 * @access  Public
 */
router.get('/:id', getMemeCoin);

module.exports = router;
