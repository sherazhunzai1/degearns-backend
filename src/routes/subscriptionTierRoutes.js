/**
 * Subscription Tier Routes
 *
 * API endpoints for subscription tier operations:
 *
 * PUBLIC ENDPOINTS (No authentication required):
 * - GET /subscription-tiers - Get all subscription tiers
 * - GET /subscription-tiers/compare - Compare all tiers side by side
 * - GET /subscription-tiers/pricing - Get pricing information
 * - GET /subscription-tiers/features - Get all tier features
 * - GET /subscription-tiers/features/:name - Get features for specific tier
 * - GET /subscription-tiers/:name - Get specific tier by name
 * - GET /subscription-tiers/my-subscription?walletAddress=xxx - Get user's subscription
 * - GET /subscription-tiers/upgrade-options?walletAddress=xxx - Get available upgrades
 * - POST /subscription-tiers/subscribe - Subscribe to a plan (walletAddress in body)
 * - POST /subscription-tiers/cancel - Cancel subscription (walletAddress in body)
 */

const express = require('express');
const router = express.Router();
const subscriptionTierController = require('../controllers/subscriptionTierController');

// ===== PUBLIC ROUTES =====

/**
 * @route GET /api/v1/subscription-tiers
 * @desc Get all active subscription tiers
 * @access Public
 * @query {string} includeInactive - Set to 'true' to include inactive tiers
 */
router.get('/', subscriptionTierController.getAllTiers);

/**
 * @route GET /api/v1/subscription-tiers/compare
 * @desc Compare all tiers side by side with feature matrix
 * @access Public
 */
router.get('/compare', subscriptionTierController.compareTiers);

/**
 * @route GET /api/v1/subscription-tiers/pricing
 * @desc Get tier pricing information
 * @access Public
 */
router.get('/pricing', subscriptionTierController.getTierPricing);

/**
 * @route GET /api/v1/subscription-tiers/features
 * @desc Get features for all tiers
 * @access Public
 */
router.get('/features', subscriptionTierController.getTierFeatures);

/**
 * @route GET /api/v1/subscription-tiers/features/:name
 * @desc Get features for a specific tier
 * @access Public
 * @param {string} name - Tier name (free, basic, pro, premium)
 */
router.get('/features/:name', subscriptionTierController.getTierFeatures);

// ===== USER SUBSCRIPTION ROUTES =====
// Note: These must be defined BEFORE the /:name route to avoid conflicts

/**
 * @route GET /api/v1/subscription-tiers/my-subscription
 * @desc Get user's subscription with tier details
 * @access Public
 * @query {string} walletAddress - User's wallet address (required)
 */
router.get('/my-subscription', subscriptionTierController.getMySubscription);

/**
 * @route GET /api/v1/subscription-tiers/upgrade-options
 * @desc Get available upgrade options based on current subscription
 * @access Public
 * @query {string} walletAddress - User's wallet address (required)
 */
router.get('/upgrade-options', subscriptionTierController.getUpgradeOptions);

/**
 * @route POST /api/v1/subscription-tiers/subscribe
 * @desc Subscribe to a plan or upgrade current subscription
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {string} planType - Plan to subscribe to (basic, pro, premium)
 * @body {string} billingCycle - Billing cycle (monthly, yearly)
 * @body {string} paymentTransactionHash - XRPL payment transaction hash
 * @body {string} paymentAmount - Amount paid in drops (optional)
 */
router.post('/subscribe', subscriptionTierController.subscribeToPlan);

/**
 * @route POST /api/v1/subscription-tiers/cancel
 * @desc Cancel current subscription
 * @access Public
 * @body {string} walletAddress - User's wallet address (required)
 * @body {string} reason - Cancellation reason (optional)
 */
router.post('/cancel', subscriptionTierController.cancelMySubscription);

// ===== WILDCARD ROUTE (must be last) =====

/**
 * @route GET /api/v1/subscription-tiers/:name
 * @desc Get a specific tier by name
 * @access Public
 * @param {string} name - Tier name (free, basic, pro, premium)
 */
router.get('/:name', subscriptionTierController.getTierByName);

module.exports = router;
