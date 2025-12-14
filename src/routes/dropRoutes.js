const express = require('express');
const router = express.Router();
const dropController = require('../controllers/dropController');

// Drop CRUD operations
router.post('/', dropController.createDrop);
router.get('/', dropController.getDrops);
router.get('/active', dropController.getActiveDrops);
router.get('/upcoming', dropController.getUpcomingDrops);
router.get('/:id', dropController.getDropById);
router.put('/:id', dropController.updateDrop);
router.delete('/:id', dropController.deleteDrop);

// Drop status and settings
router.put('/:id/status', dropController.updateDropStatus);
router.put('/:id/toggle', dropController.toggleDropSettings);
router.put('/:id/payment', dropController.updatePaymentStatus);

// Drop statistics
router.get('/:id/stats', dropController.getDropStats);

// Allowlist management
router.get('/:id/allowlist', dropController.getAllowedWallets);
router.post('/:id/allowlist', dropController.addAllowedWallets);
router.delete('/:id/allowlist', dropController.removeAllowedWallets);

// Wallet eligibility
router.get('/:id/eligibility', dropController.checkWalletEligibility);

// NFT management within drops
router.post('/:id/nfts', dropController.uploadDropNfts);
router.get('/:id/nfts', dropController.getDropNfts);
router.get('/:id/nfts/random', dropController.getRandomAvailableNfts);
router.get('/:id/nfts/:nftId', dropController.getDropNftById);
router.put('/:id/nfts/:nftId', dropController.updateDropNft);
router.delete('/:id/nfts', dropController.deleteDropNfts);

// Minting flow
router.post('/:id/reserve', dropController.reserveNftsForMint);
router.post('/:id/release', dropController.releaseReservedNfts);
router.post('/:id/confirm-mint', dropController.confirmMint);
router.post('/:id/mint', dropController.recordMint);
router.get('/:id/mints', dropController.getDropMints);

// User-specific routes
router.get('/user/:walletAddress/mints', dropController.getUserMints);
router.get('/creator/:walletAddress', dropController.getCreatorDrops);

module.exports = router;
