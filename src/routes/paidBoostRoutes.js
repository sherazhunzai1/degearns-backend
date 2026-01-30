const express = require('express');
const router = express.Router();
const {
  // Post boosts
  createPostBoost,
  getBoostedPosts,
  recordPostBoostClick,

  // NFT boosts
  createNftBoost,
  getBoostedNfts,
  recordNftBoostClick,

  // Collection boosts
  createCollectionBoost,
  getBoostedCollections,
  recordCollectionBoostClick,

  // Common
  getBoostPricing,
  getUserPaidBoosts,
  cancelPaidBoost,
  getBoostStats
} = require('../controllers/paidBoostController');

// ==================== PRICING ====================

/**
 * @route   GET /api/v1/paid-boosts/pricing
 * @desc    Get boost pricing information
 * @access  Public
 */
router.get('/pricing', getBoostPricing);

// ==================== USER BOOSTS ====================

/**
 * @route   GET /api/v1/paid-boosts/user/:walletAddress
 * @desc    Get user's active paid boosts
 * @access  Public
 */
router.get('/user/:walletAddress', getUserPaidBoosts);

/**
 * @route   GET /api/v1/paid-boosts/stats/:boostId
 * @desc    Get statistics for a specific boost
 * @access  Public
 */
router.get('/stats/:boostId', getBoostStats);

/**
 * @route   DELETE /api/v1/paid-boosts/:boostId
 * @desc    Cancel a paid boost
 * @access  Public
 */
router.delete('/:boostId', cancelPaidBoost);

// ==================== POST BOOSTS ====================

/**
 * @route   POST /api/v1/paid-boosts/posts
 * @desc    Create a paid boost for a post
 * @access  Public
 */
router.post('/posts', createPostBoost);

/**
 * @route   GET /api/v1/paid-boosts/posts
 * @desc    Get boosted posts (weighted by percentage)
 * @access  Public
 */
router.get('/posts', getBoostedPosts);

/**
 * @route   POST /api/v1/paid-boosts/posts/:boostId/click
 * @desc    Record a click on a boosted post
 * @access  Public
 */
router.post('/posts/:boostId/click', recordPostBoostClick);

// ==================== NFT BOOSTS ====================

/**
 * @route   POST /api/v1/paid-boosts/nfts
 * @desc    Create a paid boost for an NFT
 * @access  Public
 */
router.post('/nfts', createNftBoost);

/**
 * @route   GET /api/v1/paid-boosts/nfts
 * @desc    Get boosted NFTs (weighted by percentage)
 * @access  Public
 */
router.get('/nfts', getBoostedNfts);

/**
 * @route   POST /api/v1/paid-boosts/nfts/:boostId/click
 * @desc    Record a click on a boosted NFT
 * @access  Public
 */
router.post('/nfts/:boostId/click', recordNftBoostClick);

// ==================== COLLECTION BOOSTS ====================

/**
 * @route   POST /api/v1/paid-boosts/collections
 * @desc    Create a paid boost for a collection
 * @access  Public
 */
router.post('/collections', createCollectionBoost);

/**
 * @route   GET /api/v1/paid-boosts/collections
 * @desc    Get boosted collections (weighted by percentage)
 * @access  Public
 */
router.get('/collections', getBoostedCollections);

/**
 * @route   POST /api/v1/paid-boosts/collections/:boostId/click
 * @desc    Record a click on a boosted collection
 * @access  Public
 */
router.post('/collections/:boostId/click', recordCollectionBoostClick);

module.exports = router;
