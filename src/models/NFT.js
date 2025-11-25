const mongoose = require('mongoose');

const nftSchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: [true, 'Token ID is required'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'NFT name is required'],
    trim: true,
    maxlength: [100, 'Name must not exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description must not exceed 1000 characters']
  },
  image: {
    type: String,
    required: [true, 'Image URL is required']
  },
  uri: {
    type: String,
    required: [true, 'Metadata URI is required']
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerWalletAddress: {
    type: String,
    required: true
  },
  taxon: {
    type: Number,
    default: 0
  },
  transferFee: {
    type: Number,
    default: 0,
    min: 0,
    max: 50000
  },
  category: {
    type: String,
    enum: ['art', 'music', 'photography', 'sports', 'gaming', 'collectibles', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true
  }],
  attributes: [{
    trait_type: String,
    value: mongoose.Schema.Types.Mixed
  }],
  isListed: {
    type: Boolean,
    default: false
  },
  currentPrice: {
    type: String,
    default: null
  },
  offerID: {
    type: String,
    default: null
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  royalties: {
    type: Number,
    default: 0,
    min: 0,
    max: 50
  },
  transactionHash: {
    type: String,
    required: true
  },
  mintedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
nftSchema.index({ tokenId: 1 });
nftSchema.index({ creator: 1 });
nftSchema.index({ owner: 1 });
nftSchema.index({ isListed: 1 });
nftSchema.index({ category: 1 });
nftSchema.index({ createdAt: -1 });

const NFT = mongoose.model('NFT', nftSchema);

module.exports = NFT;
