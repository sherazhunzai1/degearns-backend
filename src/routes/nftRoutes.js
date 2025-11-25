const express = require('express');
const router = express.Router();
const {
  mintSingleNFT,
  mintBulkNFTs,
  getNFTs,
  getNFT
} = require('../controllers/nftController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { mintLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/v1/nfts/mint
 * @desc    Mint a single NFT
 * @access  Private
 */
router.post('/mint', authenticate, mintLimiter, mintSingleNFT);

/**
 * @route   POST /api/v1/nfts/mint-bulk
 * @desc    Mint multiple NFTs in bulk
 * @access  Private
 */
router.post('/mint-bulk', authenticate, mintLimiter, mintBulkNFTs);

/**
 * @route   GET /api/v1/nfts
 * @desc    Get all NFTs with filters
 * @access  Public
 */
router.get('/', optionalAuth, getNFTs);

/**
 * @route   GET /api/v1/nfts/:id
 * @desc    Get single NFT by ID
 * @access  Public
 */
router.get('/:id', optionalAuth, getNFT);

module.exports = router;
