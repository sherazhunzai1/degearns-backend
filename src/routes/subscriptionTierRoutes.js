/**
 * Subscription Tier Routes
 *
 * API endpoints for subscription tier operations:
 * - GET /subscription-tiers - Get all subscription tiers
 * - GET /subscription-tiers/compare - Compare all tiers side by side
 * - GET /subscription-tiers/pricing - Get pricing information
 * - GET /subscription-tiers/features - Get all tier features
 * - GET /subscription-tiers/features/:name - Get features for specific tier
 * - GET /subscription-tiers/:name - Get specific tier by name
 */

const express = require('express');
const router = express.Router();
const subscriptionTierController = require('../controllers/subscriptionTierController');

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

/**
 * @route GET /api/v1/subscription-tiers/:name
 * @desc Get a specific tier by name
 * @access Public
 * @param {string} name - Tier name (free, basic, pro, premium)
 */
router.get('/:name', subscriptionTierController.getTierByName);

module.exports = router;
