const express = require('express');
const router = express.Router();
const {
  getNFTDetail,
  getNFTOffers,
  getNFTHistory
} = require('../controllers/nftController');

/**
 * @route   GET /api/v1/nfts/:nftTokenId
 * @desc    Get single NFT detail with sale info and transaction history
 * @access  Public
 */
router.get('/:nftTokenId', getNFTDetail);

/**
 * @route   GET /api/v1/nfts/:nftTokenId/offers
 * @desc    Get NFT offers (both buy and sell)
 * @access  Public
 */
router.get('/:nftTokenId/offers', getNFTOffers);

/**
 * @route   GET /api/v1/nfts/:nftTokenId/history
 * @desc    Get NFT transaction history
 * @access  Public
 * @query   ownerAddress - Required: Current owner's wallet address
 * @query   limit - Optional: Number of transactions to fetch (default: 20)
 */
router.get('/:nftTokenId/history', getNFTHistory);

module.exports = router;
