const { Wallet } = require('xrpl');
const NFT = require('../models/NFT');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const xrplService = require('../services/xrplService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

/**
 * Mint a new NFT
 */
const mintNFT = async (req, res, next) => {
  try {
    const { name, description, image, uri, category, tags, attributes, taxon, transferFee, royalties } = req.body;
    const userId = req.user._id;

    // Get user's wallet (in production, user would sign this transaction)
    // For demo purposes, we'll use a provided wallet seed or create test wallet
    const userWallet = Wallet.fromSeed(req.body.walletSeed || process.env.ADMIN_WALLET_SEED);

    // Mint NFT on XRPL
    const mintResult = await xrplService.mintNFT({
      wallet: userWallet,
      uri,
      taxon: taxon || 0,
      transferFee: transferFee || 0,
      flags: 8 // tfTransferable
    });

    if (!mintResult.success) {
      throw new ApiError(500, 'Failed to mint NFT on XRPL');
    }

    // Create NFT record in database
    const nft = await NFT.create({
      tokenId: mintResult.nftokenID,
      name,
      description,
      image,
      uri,
      creator: userId,
      owner: userId,
      ownerWalletAddress: userWallet.address,
      category,
      tags,
      attributes,
      taxon: taxon || 0,
      transferFee: transferFee || 0,
      royalties: royalties || 0,
      transactionHash: mintResult.hash
    });

    // Update user's created NFTs
    await User.findByIdAndUpdate(userId, {
      $push: { nftsCreated: nft._id, nftsOwned: nft._id }
    });

    // Create transaction record
    await Transaction.create({
      txHash: mintResult.hash,
      type: 'mint',
      nft: nft._id,
      nftTokenId: mintResult.nftokenID,
      from: userId,
      fromAddress: userWallet.address,
      status: 'completed'
    });

    logger.info(`NFT minted: ${nft.tokenId} by user ${req.user.username}`);

    res.status(201).json(
      new ApiResponse(201, nft, 'NFT minted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all NFTs with filters
 */
const getNFTs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      isListed,
      sortBy = 'createdAt',
      order = 'desc',
      search
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (isListed !== undefined) query.isListed = isListed === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

    const nfts = await NFT.find(query)
      .populate('creator', 'username profileImage walletAddress')
      .populate('owner', 'username profileImage walletAddress')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await NFT.countDocuments(query);

    res.status(200).json(
      new ApiResponse(200, {
        nfts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'NFTs retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get single NFT by ID
 */
const getNFT = async (req, res, next) => {
  try {
    const { id } = req.params;

    const nft = await NFT.findById(id)
      .populate('creator', 'username profileImage walletAddress')
      .populate('owner', 'username profileImage walletAddress');

    if (!nft) {
      throw new ApiError(404, 'NFT not found');
    }

    // Increment views
    nft.views += 1;
    await nft.save();

    // Get offers from XRPL
    const sellOffers = await xrplService.getNFTSellOffers(nft.tokenId);
    const buyOffers = await xrplService.getNFTBuyOffers(nft.tokenId);

    res.status(200).json(
      new ApiResponse(200, {
        nft,
        sellOffers,
        buyOffers
      }, 'NFT retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * List NFT for sale
 */
const listNFT = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price, destination, expiration } = req.body;
    const userId = req.user._id;

    const nft = await NFT.findById(id);

    if (!nft) {
      throw new ApiError(404, 'NFT not found');
    }

    if (nft.owner.toString() !== userId.toString()) {
      throw new ApiError(403, 'You do not own this NFT');
    }

    if (nft.isListed) {
      throw new ApiError(400, 'NFT is already listed');
    }

    // Create sell offer on XRPL
    const userWallet = Wallet.fromSeed(req.body.walletSeed || process.env.ADMIN_WALLET_SEED);

    const offerResult = await xrplService.createSellOffer({
      wallet: userWallet,
      nftokenID: nft.tokenId,
      amount: price,
      destination,
      expiration
    });

    if (!offerResult.success) {
      throw new ApiError(500, 'Failed to create sell offer on XRPL');
    }

    // Update NFT record
    nft.isListed = true;
    nft.currentPrice = price;
    nft.offerID = offerResult.offerID;
    await nft.save();

    // Create transaction record
    await Transaction.create({
      txHash: offerResult.hash,
      type: 'list',
      nft: nft._id,
      nftTokenId: nft.tokenId,
      from: userId,
      fromAddress: userWallet.address,
      amount: price,
      offerID: offerResult.offerID,
      status: 'completed'
    });

    logger.info(`NFT listed: ${nft.tokenId} for ${price} drops`);

    res.status(200).json(
      new ApiResponse(200, nft, 'NFT listed successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delist NFT
 */
const delistNFT = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const nft = await NFT.findById(id);

    if (!nft) {
      throw new ApiError(404, 'NFT not found');
    }

    if (nft.owner.toString() !== userId.toString()) {
      throw new ApiError(403, 'You do not own this NFT');
    }

    if (!nft.isListed) {
      throw new ApiError(400, 'NFT is not listed');
    }

    // Cancel offer on XRPL
    const userWallet = Wallet.fromSeed(req.body.walletSeed || process.env.ADMIN_WALLET_SEED);

    const cancelResult = await xrplService.cancelOffer({
      wallet: userWallet,
      offerIDs: [nft.offerID]
    });

    if (!cancelResult.success) {
      throw new ApiError(500, 'Failed to cancel offer on XRPL');
    }

    // Update NFT record
    nft.isListed = false;
    nft.currentPrice = null;
    nft.offerID = null;
    await nft.save();

    // Create transaction record
    await Transaction.create({
      txHash: cancelResult.hash,
      type: 'delist',
      nft: nft._id,
      nftTokenId: nft.tokenId,
      from: userId,
      fromAddress: userWallet.address,
      status: 'completed'
    });

    logger.info(`NFT delisted: ${nft.tokenId}`);

    res.status(200).json(
      new ApiResponse(200, nft, 'NFT delisted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Buy NFT
 */
const buyNFT = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const nft = await NFT.findById(id).populate('owner');

    if (!nft) {
      throw new ApiError(404, 'NFT not found');
    }

    if (!nft.isListed) {
      throw new ApiError(400, 'NFT is not listed for sale');
    }

    if (nft.owner._id.toString() === userId.toString()) {
      throw new ApiError(400, 'You cannot buy your own NFT');
    }

    // Accept offer on XRPL
    const buyerWallet = Wallet.fromSeed(req.body.walletSeed);

    const acceptResult = await xrplService.acceptOffer({
      wallet: buyerWallet,
      offerID: nft.offerID
    });

    if (!acceptResult.success) {
      throw new ApiError(500, 'Failed to accept offer on XRPL');
    }

    const previousOwner = nft.owner._id;

    // Update NFT record
    nft.owner = userId;
    nft.ownerWalletAddress = buyerWallet.address;
    nft.isListed = false;
    const salePrice = nft.currentPrice;
    nft.currentPrice = null;
    nft.offerID = null;
    await nft.save();

    // Update users' NFT arrays
    await User.findByIdAndUpdate(previousOwner, {
      $pull: { nftsOwned: nft._id }
    });

    await User.findByIdAndUpdate(userId, {
      $push: { nftsOwned: nft._id }
    });

    // Create transaction record
    await Transaction.create({
      txHash: acceptResult.hash,
      type: 'sale',
      nft: nft._id,
      nftTokenId: nft.tokenId,
      from: previousOwner,
      fromAddress: nft.ownerWalletAddress,
      to: userId,
      toAddress: buyerWallet.address,
      amount: salePrice,
      status: 'completed'
    });

    logger.info(`NFT purchased: ${nft.tokenId} by user ${req.user.username}`);

    res.status(200).json(
      new ApiResponse(200, nft, 'NFT purchased successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Like/Unlike NFT
 */
const toggleLike = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const nft = await NFT.findById(id);

    if (!nft) {
      throw new ApiError(404, 'NFT not found');
    }

    const hasLiked = nft.likedBy.includes(userId);

    if (hasLiked) {
      nft.likedBy = nft.likedBy.filter(id => id.toString() !== userId.toString());
      nft.likes -= 1;
    } else {
      nft.likedBy.push(userId);
      nft.likes += 1;
    }

    await nft.save();

    res.status(200).json(
      new ApiResponse(200, { liked: !hasLiked, likes: nft.likes }, 'Like toggled successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's NFTs
 */
const getUserNFTs = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { type = 'owned' } = req.query; // owned or created

    const query = type === 'created' ? { creator: userId } : { owner: userId };

    const nfts = await NFT.find(query)
      .populate('creator', 'username profileImage')
      .populate('owner', 'username profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json(
      new ApiResponse(200, nfts, 'User NFTs retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  mintNFT,
  getNFTs,
  getNFT,
  listNFT,
  delistNFT,
  buyNFT,
  toggleLike,
  getUserNFTs
};
