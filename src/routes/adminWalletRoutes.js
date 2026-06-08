const express = require('express');
const router = express.Router();
const adminWalletController = require('../controllers/adminWalletController');

// Public endpoint for frontend to get platform fees wallet
router.get('/platform-fees', adminWalletController.getPlatformFeesWallet);

/**
 * @route   GET /api/v1/admin-wallets/platform-fee/:network
 * @desc    Get platform fee config for a network (wallet address + fee amount).
 *          Frontend calls this before every transaction to know where/how much to pay.
 * @access  Public
 */
router.get('/platform-fee/:network', adminWalletController.getPlatformFeeConfig);

// Admin wallet CRUD operations
router.post('/', adminWalletController.createAdminWallet);
router.get('/', adminWalletController.getAdminWallets);
router.get('/type/:type', adminWalletController.getAdminWalletByType);
router.get('/:id', adminWalletController.getAdminWalletById);
router.put('/:id', adminWalletController.updateAdminWallet);
router.delete('/:id', adminWalletController.deleteAdminWallet);

module.exports = router;
