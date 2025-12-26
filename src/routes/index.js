const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const collectionRoutes = require('./collectionRoutes');
const nftRoutes = require('./nftRoutes');
const chatRoutes = require('./chatRoutes');
const groupChatRoutes = require('./groupChatRoutes');
const postRoutes = require('./postRoutes');
const followRoutes = require('./followRoutes');
const notificationRoutes = require('./notificationRoutes');
const dropRoutes = require('./dropRoutes');
const adminWalletRoutes = require('./adminWalletRoutes');
const adminRoutes = require('./adminRoutes');
const bannerRoutes = require('./bannerRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/collections', collectionRoutes);
router.use('/nfts', nftRoutes);
router.use('/chat', chatRoutes);
router.use('/group-chat', groupChatRoutes);
router.use('/posts', postRoutes);
router.use('/follow', followRoutes);
router.use('/notifications', notificationRoutes);
router.use('/drops', dropRoutes);
router.use('/admin-wallets', adminWalletRoutes);
router.use('/admin', adminRoutes);
router.use('/banners', bannerRoutes);
router.use('/leaderboard', leaderboardRoutes);

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
