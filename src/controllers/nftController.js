const { Wallet } = require('xrpl');
const { NFT, Collection, User, Transaction, sequelize } = require('../models');
const xrplService = require('../services/xrplService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Mint a single NFT
 */
const mintSingleNFT = async (req, res, next) => {
  try {
    const {
      collectionId,
      name,
      description,
      image,
      uri,
      attributes,
      taxon,
      transferFee,
      walletSeed
    } = req.body;

    const creatorWalletAddress = req.user.walletAddress;

    // Verify collection exists and user is the creator
    const collection = await Collection.findByPk(collectionId);
    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    if (collection.creatorWalletAddress !== creatorWalletAddress) {
      throw new ApiError(403, 'You are not the creator of this collection');
    }

    // Get user's wallet
    const userWallet = Wallet.fromSeed(walletSeed);
    if (userWallet.address !== creatorWalletAddress) {
      throw new ApiError(400, 'Wallet seed does not match your wallet address');
    }

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
      collectionId,
      creatorWalletAddress,
      ownerWalletAddress: creatorWalletAddress,
      taxon: taxon || 0,
      transferFee: transferFee || 0,
      attributes,
      transactionHash: mintResult.hash,
      mintedAt: new Date()
    });

    // Update collection total supply
    collection.totalSupply += 1;
    await collection.save();

    // Create transaction record
    await Transaction.create({
      txHash: mintResult.hash,
      type: 'mint',
      nftId: nft.id,
      nftTokenId: mintResult.nftokenID,
      fromWalletAddress: creatorWalletAddress,
      status: 'completed'
    });

    logger.info(`NFT minted: ${nft.tokenId} in collection ${collection.name}`);

    res.status(201).json(
      new ApiResponse(201, nft, 'NFT minted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mint bulk NFTs
 */
const mintBulkNFTs = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { collectionId, nfts, walletSeed } = req.body;

    if (!Array.isArray(nfts) || nfts.length === 0) {
      throw new ApiError(400, 'NFTs array is required and must not be empty');
    }

    const creatorWalletAddress = req.user.walletAddress;

    // Verify collection
    const collection = await Collection.findByPk(collectionId);
    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    if (collection.creatorWalletAddress !== creatorWalletAddress) {
      throw new ApiError(403, 'You are not the creator of this collection');
    }

    // Get user's wallet
    const userWallet = Wallet.fromSeed(walletSeed);
    if (userWallet.address !== creatorWalletAddress) {
      throw new ApiError(400, 'Wallet seed does not match your wallet address');
    }

    const mintedNFTs = [];
    const failedNFTs = [];

    // Mint each NFT
    for (const nftData of nfts) {
      try {
        // Mint on XRPL
        const mintResult = await xrplService.mintNFT({
          wallet: userWallet,
          uri: nftData.uri,
          taxon: nftData.taxon || 0,
          transferFee: nftData.transferFee || 0,
          flags: 8
        });

        if (!mintResult.success) {
          throw new Error('XRPL minting failed');
        }

        // Create NFT in database
        const nft = await NFT.create({
          tokenId: mintResult.nftokenID,
          name: nftData.name,
          description: nftData.description,
          image: nftData.image,
          uri: nftData.uri,
          collectionId,
          creatorWalletAddress,
          ownerWalletAddress: creatorWalletAddress,
          taxon: nftData.taxon || 0,
          transferFee: nftData.transferFee || 0,
          attributes: nftData.attributes,
          transactionHash: mintResult.hash,
          mintedAt: new Date()
        }, { transaction: t });

        // Create transaction record
        await Transaction.create({
          txHash: mintResult.hash,
          type: 'mint',
          nftId: nft.id,
          nftTokenId: mintResult.nftokenID,
          fromWalletAddress: creatorWalletAddress,
          status: 'completed'
        }, { transaction: t });

        mintedNFTs.push(nft);

      } catch (error) {
        logger.error(`Failed to mint NFT: ${nftData.name}`, error);
        failedNFTs.push({
          name: nftData.name,
          error: error.message
        });
      }
    }

    // Update collection total supply
    collection.totalSupply += mintedNFTs.length;
    await collection.save({ transaction: t });

    await t.commit();

    logger.info(`Bulk mint completed: ${mintedNFTs.length} successful, ${failedNFTs.length} failed`);

    res.status(201).json(
      new ApiResponse(201, {
        mintedNFTs,
        failedNFTs,
        summary: {
          total: nfts.length,
          successful: mintedNFTs.length,
          failed: failedNFTs.length
        }
      }, `Bulk minting completed: ${mintedNFTs.length}/${nfts.length} NFTs minted successfully`)
    );
  } catch (error) {
    await t.rollback();
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
      collectionId,
      creatorWalletAddress,
      ownerWalletAddress,
      isListed,
      sortBy = 'createdAt',
      order = 'DESC',
      search
    } = req.query;

    const where = {};

    if (collectionId) where.collectionId = collectionId;
    if (creatorWalletAddress) where.creatorWalletAddress = creatorWalletAddress;
    if (ownerWalletAddress) where.ownerWalletAddress = ownerWalletAddress;
    if (isListed !== undefined) where.isListed = isListed === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows: nfts } = await NFT.findAndCountAll({
      where,
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage']
        },
        {
          association: 'owner',
          attributes: ['walletAddress', 'username', 'profileImage']
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json(
      new ApiResponse(200, {
        nfts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
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

    const nft = await NFT.findByPk(id, {
      include: [
        {
          association: 'collection',
          include: [{
            association: 'creator',
            attributes: ['walletAddress', 'username', 'profileImage']
          }]
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        },
        {
          association: 'owner',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        },
        {
          association: 'transactions',
          limit: 10,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

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

// Export additional NFT operations (list, buy, etc.)...
module.exports = {
  mintSingleNFT,
  mintBulkNFTs,
  getNFTs,
  getNFT
};
