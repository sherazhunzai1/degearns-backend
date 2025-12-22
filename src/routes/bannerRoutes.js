const express = require('express');
const router = express.Router();
const { getActiveBanners, getBannerById } = require('../controllers/bannerController');

/**
 * @route   GET /api/v1/banners
 * @desc    Get active banners for homepage
 * @access  Public
 * @query   limit - Optional: Maximum number of banners to return (default: 10)
 */
router.get('/', getActiveBanners);

/**
 * @route   GET /api/v1/banners/:bannerId
 * @desc    Get a single active banner by ID
 * @access  Public
 */
router.get('/:bannerId', getBannerById);

module.exports = router;
