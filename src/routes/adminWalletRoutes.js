const express = require('express');
const router = express.Router();
const adminWalletController = require('../controllers/adminWalletController');

// Public endpoint for frontend to get platform fees wallet
router.get('/platform-fees', adminWalletController.getPlatformFeesWallet);

// Admin wallet CRUD operations
router.post('/', adminWalletController.createAdminWallet);
router.get('/', adminWalletController.getAdminWallets);
router.get('/type/:type', adminWalletController.getAdminWalletByType);
router.get('/:id', adminWalletController.getAdminWalletById);
router.put('/:id', adminWalletController.updateAdminWallet);
router.delete('/:id', adminWalletController.deleteAdminWallet);

module.exports = router;
