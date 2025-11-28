const express = require('express');
const router = express.Router();
const {
  listCollection,
  getCollections,
  getCollection,
  updateCollection,
  updateCollectionStats,
  getUserCollections,
  getCollectionStats,
  searchCollectionsAndNFTs
} = require('../controllers/collectionController');

/**
 * @route   POST /api/v1/collections/list
 * @desc    List/Register a collection on the marketplace
 * @access  Public
 */
router.post('/list', listCollection);

/**
 * @route   GET /api/v1/collections
 * @desc    Get all collections with filters
 * @access  Public
 */
router.get('/', getCollections);

/**
 * @route   GET /api/v1/collections/wallet/:walletAddress
 * @desc    Get collections created by or owned by wallet address
 * @access  Public
 */
router.get('/wallet/:walletAddress', getUserCollections);

/**
 * @route   GET /api/v1/collections/stats
 * @desc    Get statistics for all collections
 * @access  Public
 */
router.get('/stats', getCollectionStats);

/**
 * @route   GET /api/v1/collections/search
 * @desc    Search for collections and NFTs by name
 * @access  Public
 */
router.get('/search', searchCollectionsAndNFTs);

/**
 * @route   GET /api/v1/collections/:identifier
 * @desc    Get single collection by ID or slug
 * @access  Public
 */
router.get('/:identifier', getCollection);

/**
 * @route   PUT /api/v1/collections/:id
 * @desc    Update collection
 * @access  Public
 */
router.put('/:id', updateCollection);

/**
 * @route   PUT /api/v1/collections/:id/stats
 * @desc    Update collection statistics from XRPL
 * @access  Public
 */
router.put('/:id/stats', updateCollectionStats);

module.exports = router;
