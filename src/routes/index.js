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
const activityRoutes = require('./activityRoutes');
const boostRoutes = require('./boostRoutes');
const paidBoostRoutes = require('./paidBoostRoutes');
const subscriptionTierRoutes = require('./subscriptionTierRoutes');
const luckyDrawRoutes = require('./luckyDrawRoutes');
const referralRoutes = require('./referralRoutes');
const memeCoinRoutes = require('./memeCoinRoutes');
const collectionChatRoutes = require('./collectionChatRoutes');

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
router.use('/activities', activityRoutes);
router.use('/boost', boostRoutes);
router.use('/paid-boosts', paidBoostRoutes);
router.use('/subscription-tiers', subscriptionTierRoutes);
router.use('/lucky-draw', luckyDrawRoutes);
router.use('/referrals', referralRoutes);
router.use('/memecoins', memeCoinRoutes);
router.use('/collection-chat', collectionChatRoutes);

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
