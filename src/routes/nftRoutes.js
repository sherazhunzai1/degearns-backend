const express = require('express');
const router = express.Router();
const {
  mintNFT,
  getNFTs,
  getNFT,
  listNFT,
  delistNFT,
  buyNFT,
  toggleLike,
  getUserNFTs
} = require('../controllers/nftController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { mintLimiter } = require('../middleware/rateLimiter');
const { validate, nftValidation } = require('../utils/validators');

/**
 * @route   POST /api/v1/nfts/mint
 * @desc    Mint a new NFT
 * @access  Private
 */
router.post('/mint', authenticate, mintLimiter, validate(nftValidation.mint), mintNFT);

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

/**
 * @route   POST /api/v1/nfts/:id/list
 * @desc    List NFT for sale
 * @access  Private
 */
router.post('/:id/list', authenticate, validate(nftValidation.list), listNFT);

/**
 * @route   POST /api/v1/nfts/:id/delist
 * @desc    Delist NFT from sale
 * @access  Private
 */
router.post('/:id/delist', authenticate, delistNFT);

/**
 * @route   POST /api/v1/nfts/:id/buy
 * @desc    Buy an NFT
 * @access  Private
 */
router.post('/:id/buy', authenticate, buyNFT);

/**
 * @route   POST /api/v1/nfts/:id/like
 * @desc    Like/Unlike an NFT
 * @access  Private
 */
router.post('/:id/like', authenticate, toggleLike);

/**
 * @route   GET /api/v1/nfts/user/:userId
 * @desc    Get user's NFTs
 * @access  Public
 */
router.get('/user/:userId', getUserNFTs);

module.exports = router;
