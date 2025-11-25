const express = require('express');
const router = express.Router();
const {
  listCollection,
  getCollections,
  getCollection,
  updateCollection,
  updateCollectionStats
} = require('../controllers/collectionController');
const { authenticate, optionalAuth } = require('../middleware/auth');

/**
 * @route   POST /api/v1/collections/list
 * @desc    List/Register a collection on the marketplace
 * @access  Private
 */
router.post('/list', authenticate, listCollection);

/**
 * @route   GET /api/v1/collections
 * @desc    Get all collections with filters
 * @access  Public
 */
router.get('/', optionalAuth, getCollections);

/**
 * @route   GET /api/v1/collections/:identifier
 * @desc    Get single collection by ID or slug
 * @access  Public
 */
router.get('/:identifier', optionalAuth, getCollection);

/**
 * @route   PUT /api/v1/collections/:id
 * @desc    Update collection
 * @access  Private
 */
router.put('/:id', authenticate, updateCollection);

/**
 * @route   PUT /api/v1/collections/:id/stats
 * @desc    Update collection statistics from XRPL
 * @access  Public
 */
router.put('/:id/stats', updateCollectionStats);

module.exports = router;
