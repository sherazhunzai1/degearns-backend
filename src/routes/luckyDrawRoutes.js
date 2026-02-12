const express = require('express');
const router = express.Router();
const {
  recordPurchase,
  getCurrentDraw,
  getParticipants,
  getAllParticipantsForDraw,
  checkParticipation,
  drawWinner,
  getWinners,
  setPrize,
  scheduleDraw,
  cancelDraw
} = require('../controllers/luckyDrawController');

/**
 * @route   POST /api/v1/lucky-draw/participate
 * @desc    Record NFT purchase and add user to lucky draw
 * @body    buyerWalletAddress - Required: Wallet address of the buyer
 * @body    nftTokenId - Required: NFT token ID that was purchased
 * @body    purchasePrice - Optional: Purchase price in drops
 * @body    purchaseCurrency - Optional: Currency used (default: XRP)
 * @body    transactionHash - Optional: XRPL transaction hash
 * @access  Public
 */
router.post('/participate', recordPurchase);

/**
 * @route   GET /api/v1/lucky-draw/current
 * @desc    Get current month's lucky draw info and recent participants
 * @access  Public
 */
router.get('/current', getCurrentDraw);

/**
 * @route   GET /api/v1/lucky-draw/winners
 * @desc    Get past winners / draw history
 * @query   page - Optional: Page number (default: 1)
 * @query   limit - Optional: Items per page (default: 12)
 * @access  Public
 */
router.get('/winners', getWinners);

/**
 * @route   GET /api/v1/lucky-draw/check/:walletAddress
 * @desc    Check if user is participating in current lucky draw
 * @param   walletAddress - Wallet address to check
 * @access  Public
 */
router.get('/check/:walletAddress', checkParticipation);

/**
 * @route   GET /api/v1/lucky-draw/participants/:month
 * @desc    Get participants for a specific month (paginated)
 * @param   month - Month in YYYY-MM format
 * @query   page - Optional: Page number (default: 1)
 * @query   limit - Optional: Items per page (default: 50)
 * @access  Public
 */
router.get('/participants/:month', getParticipants);

/**
 * @route   GET /api/v1/lucky-draw/:month/all-participants
 * @desc    Get all unique participants for live draw display (no pagination)
 * @param   month - Month in YYYY-MM format
 * @access  Public
 */
router.get('/:month/all-participants', getAllParticipantsForDraw);

/**
 * @route   POST /api/v1/lucky-draw/draw
 * @desc    Manually trigger draw (for testing only - draws happen automatically at 23:00 UTC on last day of month)
 * @body    month - Optional: Month in YYYY-MM format (default: current month)
 * @body    adminWalletAddress - Optional: Admin wallet performing the draw
 * @body    isLiveDraw - Optional: Whether to broadcast live draw animation (default: false)
 * @access  Admin (for testing)
 * @note    Normal draws are automatic at 23:00 UTC on the last day of each month
 */
router.post('/draw', drawWinner);

/**
 * @route   PUT /api/v1/lucky-draw/:month/prize
 * @desc    Set prize for a lucky draw (admin only)
 * @param   month - Month in YYYY-MM format
 * @body    prizeDescription - Optional: Description of the prize
 * @body    prizeAmount - Optional: Prize amount
 * @body    prizeCurrency - Optional: Currency (default: XRP)
 * @access  Admin
 */
router.put('/:month/prize', setPrize);

/**
 * @route   PUT /api/v1/lucky-draw/:month/schedule
 * @desc    Schedule the draw time for a lucky draw (admin only)
 * @param   month - Month in YYYY-MM format
 * @body    drawScheduledAt - Required: ISO date string for scheduled draw time
 * @access  Admin
 */
router.put('/:month/schedule', scheduleDraw);

/**
 * @route   PUT /api/v1/lucky-draw/:month/cancel
 * @desc    Cancel a lucky draw (admin only)
 * @param   month - Month in YYYY-MM format
 * @body    adminWalletAddress - Optional: Admin wallet performing the cancellation
 * @body    reason - Optional: Reason for cancellation
 * @access  Admin
 */
router.put('/:month/cancel', cancelDraw);

module.exports = router;
