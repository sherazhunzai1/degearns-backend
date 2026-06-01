const express = require('express');
const router = express.Router();
const {
  getNFTDetail,
  getNFTOffers,
  getNFTHistory,
  notifyNFTListing,
  notifyNFTPurchase,
  getIncomingOffers,
  getSolanaNFTsByOwner,
  getSolanaNFTsByCollection,
  createSolanaListing,
  cancelSolanaListing,
  getSolanaListings,
  getSolanaNftHistory
} = require('../controllers/nftController');

/**
 * @route   GET /api/v1/nfts/incoming-offers/:walletAddress
 * @desc    Get incoming offers for a wallet (buy offers on owned NFTs)
 * @access  Public
 */
router.get('/incoming-offers/:walletAddress', getIncomingOffers);

/**
 * @route   GET /api/v1/nfts/solana/wallet/:walletAddress
 * @desc    Get all NFTs owned by a Solana wallet via Helius DAS API
 * @access  Public
 * @query   page, limit
 */
router.get('/solana/wallet/:walletAddress', getSolanaNFTsByOwner);

/**
 * @route   GET /api/v1/nfts/solana/collection/:collectionMintAddress
 * @desc    Get all NFTs in a Solana collection via Helius DAS API
 * @access  Public
 * @query   page, limit
 */
router.get('/solana/collection/:collectionMintAddress', getSolanaNFTsByCollection);

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
 * @desc    Get NFT transaction history using Bithomp API
 * @access  Public
 * @returns {Object} transactions - Complete transaction history for the NFT
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

/**
 * @route   POST /api/v1/nfts/solana/listing
 * @desc    Create a Solana NFT listing (called after delegateSaleV1)
 * @access  Public
 */
router.post('/solana/listing', createSolanaListing);

/**
 * @route   DELETE /api/v1/nfts/solana/listing
 * @desc    Cancel a Solana NFT listing
 * @access  Public
 */
router.delete('/solana/listing', cancelSolanaListing);

/**
 * @route   GET /api/v1/nfts/solana/listings
 * @desc    Get all active Solana NFT listings (marketplace browse)
 * @access  Public
 * @query   page, limit, collectionMintAddress, sellerWalletAddress, sortBy, order
 */
router.get('/solana/listings', getSolanaListings);

/**
 * @route   GET /api/v1/nfts/solana/history/:mintAddress
 * @desc    Get sale history for a Solana NFT
 * @access  Public
 */
router.get('/solana/history/:mintAddress', getSolanaNftHistory);

/**
 * @route   GET /api/v1/nfts/solana/marketplace-authority
 * @desc    Get the marketplace authority public key (for frontend delegation)
 * @access  Public
 */
router.get('/solana/marketplace-authority', (req, res) => {
  const solanaMarketplaceService = require('../services/solanaMarketplaceService');
  const address = solanaMarketplaceService.getMarketplaceAddress();
  if (!address) {
    return res.status(503).json({ success: false, message: 'Marketplace authority not configured' });
  }
  res.status(200).json({ success: true, data: { marketplaceAuthority: address } });
});

module.exports = router;
