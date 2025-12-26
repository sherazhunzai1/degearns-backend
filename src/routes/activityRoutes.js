/**
 * Activity Routes
 *
 * Routes for logging user activities for the scoring system.
 * All routes are open (no authentication required).
 *
 * NOTE: These APIs are independent of database records. Collections and NFTs
 * are minted on XRPL from the frontend and may not exist in the database.
 * Use taxon and issuerAddress to identify collections instead of collectionId.
 */

const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

/**
 * @route POST /api/v1/activities/collection-create
 * @desc Log collection creation activity
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {number} taxon - Collection taxon from XRPL (required)
 * @body {string} collectionName - Collection name (optional)
 * @body {string} transactionHash - XRPL transaction hash (optional)
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/collection-create', activityController.logCollectionCreate);

/**
 * @route POST /api/v1/activities/drop-create
 * @desc Log drop creation activity
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {number} taxon - Drop/Collection taxon from XRPL (required)
 * @body {string} dropName - Drop name (optional)
 * @body {string} transactionHash - XRPL transaction hash (optional)
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/drop-create', activityController.logDropCreate);

/**
 * @route POST /api/v1/activities/nft-mint
 * @desc Log NFT mint activity (minting from a drop)
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {string} transactionHash - XRPL transaction hash (required)
 * @body {string} nftTokenId - The NFT token ID on XRPL (optional)
 * @body {number} taxon - Collection taxon (optional)
 * @body {string} issuerAddress - NFT issuer address (optional)
 * @body {number} xrpAmount - Amount paid in drops (optional)
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/nft-mint', activityController.logNftMint);

/**
 * @route POST /api/v1/activities/nft-buy
 * @desc Log NFT purchase activity
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {string} transactionHash - XRPL transaction hash (required)
 * @body {number} xrpAmount - Purchase amount in drops (required)
 * @body {string} nftTokenId - The NFT token ID (optional)
 * @body {number} taxon - Collection taxon (optional)
 * @body {string} issuerAddress - NFT issuer address (optional)
 * @body {string} sellerWalletAddress - Seller's wallet address (optional)
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/nft-buy', activityController.logNftBuy);

/**
 * @route POST /api/v1/activities/nft-sell
 * @desc Log NFT sale activity
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {string} transactionHash - XRPL transaction hash (required)
 * @body {number} xrpAmount - Sale amount in drops (required)
 * @body {string} nftTokenId - The NFT token ID (optional)
 * @body {number} taxon - Collection taxon (optional)
 * @body {string} issuerAddress - NFT issuer address (optional)
 * @body {string} buyerWalletAddress - Buyer's wallet address (optional)
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/nft-sell', activityController.logNftSell);

/**
 * @route POST /api/v1/activities/nft-list
 * @desc Log NFT listing activity (putting up for sale)
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {string} transactionHash - XRPL transaction hash (required)
 * @body {string} nftTokenId - The NFT token ID (optional)
 * @body {number} taxon - Collection taxon (optional)
 * @body {string} issuerAddress - NFT issuer address (optional)
 * @body {number} xrpAmount - Listing price in drops (optional)
 * @body {string} offerId - XRPL offer ID (optional)
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/nft-list', activityController.logNftList);

/**
 * @route POST /api/v1/activities/nft-delist
 * @desc Log NFT delisting activity (removing from sale)
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {string} transactionHash - XRPL transaction hash (required)
 * @body {string} nftTokenId - The NFT token ID (optional)
 * @body {number} taxon - Collection taxon (optional)
 * @body {string} issuerAddress - NFT issuer address (optional)
 * @body {string} offerId - XRPL offer ID being cancelled (optional)
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/nft-delist', activityController.logNftDelist);

/**
 * @route POST /api/v1/activities/post-create
 * @desc Log post creation activity
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {string} postId - The post ID (required)
 * @body {object} metadata - Additional metadata (optional)
 */
router.post('/post-create', activityController.logPostCreate);

/**
 * @route GET /api/v1/activities/user/:walletAddress
 * @desc Get user's activity history
 * @access Public
 * @param {string} walletAddress - User's wallet address
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @query {string} activityType - Filter by activity type (optional)
 * @query {number} month - Filter by month (optional)
 * @query {number} year - Filter by year (optional)
 */
router.get('/user/:walletAddress', activityController.getUserActivities);

/**
 * @route GET /api/v1/activities/user/:walletAddress/summary
 * @desc Get user's activity summary for scoring
 * @access Public
 * @param {string} walletAddress - User's wallet address
 * @query {number} month - Month (1-12), defaults to current month
 * @query {number} year - Year, defaults to current year
 */
router.get('/user/:walletAddress/summary', activityController.getUserActivitySummary);

module.exports = router;
