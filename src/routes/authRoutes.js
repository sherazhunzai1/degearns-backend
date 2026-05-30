const express = require('express');
const router = express.Router();
const {
  getOrCreateUser,
  getSolanaAuthNonce,
  solanaAuth,
  getMe,
  updateProfile,
  updateProfilePicture,
  updateCoverPicture,
  canUpdateCoverImage,
  getReferralInfo,
  linkWallet,
  unlinkWallet,
  getLinkedWallets
} = require('../controllers/authController');
// const { authLimiter } = require('../middleware/rateLimiter'); // Rate limiting disabled

/**
 * @route   POST /api/v1/auth/wallet
 * @desc    Get or create user by wallet address (XAMAN / XRPL login).
 *          Accepts optional `network` field ('xrpl' default, or 'solana').
 * @access  Public
 */
router.post('/wallet', getOrCreateUser);

/**
 * @route   GET /api/v1/auth/solana/nonce
 * @desc    Get a sign-in challenge nonce for a Solana wallet
 * @access  Public
 * @query   walletAddress
 */
router.get('/solana/nonce', getSolanaAuthNonce);

/**
 * @route   POST /api/v1/auth/solana
 * @desc    Authenticate a Solana wallet by verifying a signed nonce.
 *          Returns the user and a JWT.
 * @access  Public
 */
router.post('/solana', solanaAuth);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Public
 */
router.get('/me', getMe);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile (displayName, username, bio, email, social links)
 * @access  Public
 */
router.put('/profile', updateProfile);

/**
 * @route   PUT /api/v1/auth/profile-picture
 * @desc    Update user profile picture
 * @access  Public
 */
router.put('/profile-picture', updateProfilePicture);

/**
 * @route   PUT /api/v1/auth/cover-picture
 * @desc    Update user cover picture (rate limited by subscription plan)
 * @access  Public
 */
router.put('/cover-picture', updateCoverPicture);

/**
 * @route   GET /api/v1/auth/can-update-cover-image
 * @desc    Check if user can update cover image based on subscription plan
 * @access  Public
 */
router.get('/can-update-cover-image', canUpdateCoverImage);

/**
 * @route   GET /api/v1/auth/referral-info
 * @desc    Get user's referral code, link, and referral stats
 * @access  Public
 */
router.get('/referral-info', getReferralInfo);

/**
 * @route   GET /api/v1/auth/wallets
 * @desc    Get all wallets linked to a user account
 * @access  Public
 * @query   walletAddress
 */
router.get('/wallets', getLinkedWallets);

/**
 * @route   POST /api/v1/auth/link-wallet
 * @desc    Link a new wallet to a user account.
 *          Solana wallets require a signed nonce (get nonce first via GET /auth/solana/nonce).
 * @access  Public
 */
router.post('/link-wallet', linkWallet);

/**
 * @route   DELETE /api/v1/auth/unlink-wallet
 * @desc    Unlink a wallet from a user account (cannot unlink primary)
 * @access  Public
 */
router.delete('/unlink-wallet', unlinkWallet);

module.exports = router;
