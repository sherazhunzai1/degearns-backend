const express = require('express');
const router = express.Router();
const {
  getNFTDetail,
  getNFTOffers,
  getNFTHistory,
  notifyNFTListing,
  notifyNFTPurchase
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

/**
 * @route   POST /api/v1/nfts/notify-purchase
 * @desc    Notify seller about NFT purchase (called by frontend after purchasing NFT on XRPL)
 * @body    sellerWalletAddress - Required: Wallet address of the seller (receives notification)
 * @body    buyerWalletAddress - Required: Wallet address of the buyer
 * @body    nftTokenId - Required: NFT token ID on XRPL
 * @body    nftName - Optional: Name of the NFT
 * @body    nftDescription - Optional: Description of the NFT
 * @body    nftImage - Optional: Image URL of the NFT
 * @body    price - Optional: Sale price in drops
 * @body    collectionId - Optional: Collection ID in database
 * @body    collectionName - Optional: Name of the collection
 * @body    transactionHash - Optional: XRPL transaction hash
 * @access  Public
 */
router.post('/notify-purchase', notifyNFTPurchase);

module.exports = router;
