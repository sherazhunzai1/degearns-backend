const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  txHash: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['mint', 'sale', 'transfer', 'list', 'delist', 'offer', 'burn'],
    required: true
  },
  nft: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NFT',
    required: true
  },
  nftTokenId: {
    type: String,
    required: true
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fromAddress: {
    type: String,
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  toAddress: {
    type: String
  },
  amount: {
    type: String,
    default: '0'
  },
  marketplaceFee: {
    type: String,
    default: '0'
  },
  royaltyFee: {
    type: String,
    default: '0'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  offerID: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ nft: 1 });
transactionSchema.index({ from: 1 });
transactionSchema.index({ to: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
