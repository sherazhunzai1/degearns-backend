const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransaction,
  getUserTransactions,
  getNFTTransactions
} = require('../controllers/transactionController');
const { optionalAuth } = require('../middleware/auth');

/**
 * @route   GET /api/v1/transactions
 * @desc    Get all transactions with filters
 * @access  Public
 */
router.get('/', optionalAuth, getTransactions);

/**
 * @route   GET /api/v1/transactions/:hash
 * @desc    Get transaction by hash
 * @access  Public
 */
router.get('/:hash', getTransaction);

/**
 * @route   GET /api/v1/transactions/user/:userId
 * @desc    Get user's transaction history
 * @access  Public
 */
router.get('/user/:userId', getUserTransactions);

/**
 * @route   GET /api/v1/transactions/nft/:nftId
 * @desc    Get NFT transaction history
 * @access  Public
 */
router.get('/nft/:nftId', getNFTTransactions);

module.exports = router;
