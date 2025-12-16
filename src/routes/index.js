const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const collectionRoutes = require('./collectionRoutes');
const nftRoutes = require('./nftRoutes');
const chatRoutes = require('./chatRoutes');
const postRoutes = require('./postRoutes');
const followRoutes = require('./followRoutes');
const notificationRoutes = require('./notificationRoutes');
const dropRoutes = require('./dropRoutes');
const adminWalletRoutes = require('./adminWalletRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/collections', collectionRoutes);
router.use('/nfts', nftRoutes);
router.use('/chat', chatRoutes);
router.use('/posts', postRoutes);
router.use('/follow', followRoutes);
router.use('/notifications', notificationRoutes);
router.use('/drops', dropRoutes);
router.use('/admin-wallets', adminWalletRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    database: 'MySQL',
    blockchain: 'XRPL',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
