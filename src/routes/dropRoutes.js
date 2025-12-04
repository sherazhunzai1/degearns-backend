const express = require('express');
const router = express.Router();
const {
  createDrop,
  getDrops,
  getDrop,
  updateDrop,
  deleteDrop,
  mintFromDrop,
  getDropMints,
  getMyMints,
  canMint
} = require('../controllers/dropController');
const { authenticate, optionalAuth } = require('../middleware/auth');

/**
 * @route   POST /api/v1/drops
 * @desc    Create a new NFT drop
 * @access  Private (requires authentication)
 */
router.post('/', authenticate, createDrop);

/**
 * @route   GET /api/v1/drops
 * @desc    Get all drops with filters
 * @access  Public
 */
router.get('/', getDrops);

/**
 * @route   GET /api/v1/drops/my-mints
 * @desc    Get current user's mints from all drops
 * @access  Private (requires authentication)
 */
router.get('/my-mints', authenticate, getMyMints);

/**
 * @route   GET /api/v1/drops/:id
 * @desc    Get single drop by ID
 * @access  Public
 */
router.get('/:id', getDrop);

/**
 * @route   PUT /api/v1/drops/:id
 * @desc    Update a drop
 * @access  Private (requires authentication, owner only)
 */
router.put('/:id', authenticate, updateDrop);

/**
 * @route   DELETE /api/v1/drops/:id
 * @desc    Delete a drop
 * @access  Private (requires authentication, owner only)
 */
router.delete('/:id', authenticate, deleteDrop);

/**
 * @route   POST /api/v1/drops/:id/mint
 * @desc    Mint an NFT from a drop
 * @access  Private (requires authentication)
 */
router.post('/:id/mint', authenticate, mintFromDrop);

/**
 * @route   GET /api/v1/drops/:id/mints
 * @desc    Get all mints for a specific drop
 * @access  Public
 */
router.get('/:id/mints', getDropMints);

/**
 * @route   GET /api/v1/drops/:id/can-mint
 * @desc    Check if user can mint from a drop
 * @access  Public (optional authentication for per-user checks)
 */
router.get('/:id/can-mint', optionalAuth, canMint);

module.exports = router;
