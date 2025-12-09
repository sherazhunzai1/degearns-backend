const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const collectionRoutes = require('./collectionRoutes');
const nftRoutes = require('./nftRoutes');
const chatRoutes = require('./chatRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/collections', collectionRoutes);
router.use('/nfts', nftRoutes);
router.use('/chat', chatRoutes);

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
