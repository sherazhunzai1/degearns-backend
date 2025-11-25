const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const nftRoutes = require('./nftRoutes');
const userRoutes = require('./userRoutes');
const transactionRoutes = require('./transactionRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/nfts', nftRoutes);
router.use('/users', userRoutes);
router.use('/transactions', transactionRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
