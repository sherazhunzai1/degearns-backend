const express = require('express');
const router = express.Router();
const {
  bulkUploadNFTs,
  createDrop,
  getDrops,
  getDrop,
  updateDrop,
  deleteDrop,
  mintFromDrop,
  getMintMetadata,
  getDropMints,
  getMyMints,
  canMint
} = require('../controllers/dropController');

/**
 * @route   POST /api/v1/drops/bulk-upload-nfts
 * @desc    Bulk upload NFT metadata for drops
 * @access  Public (wallet address required in body)
 */
router.post('/bulk-upload-nfts', bulkUploadNFTs);

/**
 * @route   POST /api/v1/drops
 * @desc    Create a new NFT drop
 * @access  Public (wallet address required in body)
 */
router.post('/', createDrop);

/**
 * @route   GET /api/v1/drops
 * @desc    Get all drops with filters
 * @access  Public
 */
router.get('/', getDrops);

/**
 * @route   GET /api/v1/drops/my-mints
 * @desc    Get user's mints from all drops
 * @access  Public (wallet address required in query)
 */
router.get('/my-mints', getMyMints);

/**
 * @route   GET /api/v1/drops/:id
 * @desc    Get single drop by ID
 * @access  Public
 */
router.get('/:id', getDrop);

/**
 * @route   PUT /api/v1/drops/:id
 * @desc    Update a drop (owner only)
 * @access  Public (wallet address required in body)
 */
router.put('/:id', updateDrop);

/**
 * @route   DELETE /api/v1/drops/:id
 * @desc    Delete a drop (owner only)
 * @access  Public (wallet address required in query)
 */
router.delete('/:id', deleteDrop);

/**
 * @route   GET /api/v1/drops/:id/mint-metadata
 * @desc    Get metadata and mint parameters for minting on frontend
 * @access  Public (wallet address optional for per-user checks)
 */
router.get('/:id/mint-metadata', getMintMetadata);

/**
 * @route   POST /api/v1/drops/:id/mint
 * @desc    Record an NFT mint after frontend mints on XRPL
 * @access  Public (wallet address required in body)
 */
router.post('/:id/mint', mintFromDrop);

/**
 * @route   GET /api/v1/drops/:id/mints
 * @desc    Get all mints for a specific drop
 * @access  Public
 */
router.get('/:id/mints', getDropMints);

/**
 * @route   GET /api/v1/drops/:id/can-mint
 * @desc    Check if user can mint from a drop
 * @access  Public (wallet address optional for per-user checks)
 */
router.get('/:id/can-mint', canMint);

module.exports = router;
