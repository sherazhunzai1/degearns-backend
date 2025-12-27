/**
 * Subscription Tier Routes
 *
 * API endpoints for subscription tier operations:
 *
 * PUBLIC ENDPOINTS:
 * - GET /subscription-tiers - Get all subscription tiers
 * - GET /subscription-tiers/compare - Compare all tiers side by side
 * - GET /subscription-tiers/pricing - Get pricing information
 * - GET /subscription-tiers/features - Get all tier features
 * - GET /subscription-tiers/features/:name - Get features for specific tier
 * - GET /subscription-tiers/:name - Get specific tier by name
 *
 * AUTHENTICATED ENDPOINTS:
 * - GET /subscription-tiers/my-subscription - Get current user's subscription
 * - GET /subscription-tiers/upgrade-options - Get available upgrade options
 * - POST /subscription-tiers/subscribe - Subscribe to a plan
 * - POST /subscription-tiers/cancel - Cancel current subscription
 */

const express = require('express');
const router = express.Router();
const subscriptionTierController = require('../controllers/subscriptionTierController');
const { authenticate } = require('../middleware/auth');

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

// ===== AUTHENTICATED ROUTES =====
// Note: These must be defined BEFORE the /:name route to avoid conflicts

/**
 * @route GET /api/v1/subscription-tiers/my-subscription
 * @desc Get current user's subscription with tier details
 * @access Private (requires authentication)
 */
router.get('/my-subscription', authenticate, subscriptionTierController.getMySubscription);

/**
 * @route GET /api/v1/subscription-tiers/upgrade-options
 * @desc Get available upgrade options based on current subscription
 * @access Private (requires authentication)
 */
router.get('/upgrade-options', authenticate, subscriptionTierController.getUpgradeOptions);

/**
 * @route POST /api/v1/subscription-tiers/subscribe
 * @desc Subscribe to a plan or upgrade current subscription
 * @access Private (requires authentication)
 * @body {string} planType - Plan to subscribe to (basic, pro, premium)
 * @body {string} billingCycle - Billing cycle (monthly, yearly)
 * @body {string} paymentTransactionHash - XRPL payment transaction hash
 * @body {string} paymentAmount - Amount paid in drops (optional)
 */
router.post('/subscribe', authenticate, subscriptionTierController.subscribeToPlan);

/**
 * @route POST /api/v1/subscription-tiers/cancel
 * @desc Cancel current subscription
 * @access Private (requires authentication)
 * @body {string} reason - Cancellation reason (optional)
 */
router.post('/cancel', authenticate, subscriptionTierController.cancelMySubscription);

// ===== WILDCARD ROUTE (must be last) =====

/**
 * @route GET /api/v1/subscription-tiers/:name
 * @desc Get a specific tier by name
 * @access Public
 * @param {string} name - Tier name (free, basic, pro, premium)
 */
router.get('/:name', subscriptionTierController.getTierByName);

module.exports = router;
