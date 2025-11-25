const express = require('express');
const router = express.Router();
const {
  createCollection,
  getCollections,
  getCollection,
  updateCollection,
  getCollectionStats
} = require('../controllers/collectionController');
const { authenticate, optionalAuth } = require('../middleware/auth');

/**
 * @route   POST /api/v1/collections
 * @desc    Create a new collection
 * @access  Private
 */
router.post('/', authenticate, createCollection);

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
 * @route   GET /api/v1/collections/:id/stats
 * @desc    Get collection statistics
 * @access  Public
 */
router.get('/:id/stats', getCollectionStats);

module.exports = router;
