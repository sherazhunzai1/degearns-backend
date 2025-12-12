const express = require('express');
const router = express.Router();
const {
  getNFTDetail,
  getNFTOffers,
  getNFTHistory,
  notifyNFTListing
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

/**
 * @route   POST /api/v1/nfts/notify-listing
 * @desc    Notify followers about an NFT listing (called by frontend after creating sell offer on XRPL)
 * @body    sellerWalletAddress - Required: Wallet address of the seller
 * @body    nftTokenId - Required: NFT token ID on XRPL
 * @body    nftName - Optional: Name of the NFT
 * @body    nftImage - Optional: Image URL of the NFT
 * @body    price - Optional: Listing price
 * @body    collectionId - Optional: Collection ID in database
 * @body    collectionName - Optional: Name of the collection
 * @access  Public
 */
router.post('/notify-listing', notifyNFTListing);

module.exports = router;
