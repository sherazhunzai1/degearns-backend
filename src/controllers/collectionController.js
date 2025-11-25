const { Collection, NFT, User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Create a new collection
 */
const createCollection = async (req, res, next) => {
  try {
    const { name, description, image, bannerImage, category, royaltyPercentage, socialLinks } = req.body;
    const creatorWalletAddress = req.user.walletAddress;

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingCollection = await Collection.findOne({ where: { slug } });
    if (existingCollection) {
      throw new ApiError(400, 'Collection with this name already exists');
    }

    const collection = await Collection.create({
      name,
      slug,
      description,
      image,
      bannerImage,
      creatorWalletAddress,
      category: category || 'other',
      royaltyPercentage: royaltyPercentage || 0,
      socialLinks
    });

    logger.info(`Collection created: ${collection.name} by ${creatorWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, collection, 'Collection created successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all collections with filters
 */
const getCollections = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      creatorWalletAddress,
      sortBy = 'createdAt',
      order = 'DESC',
      search
    } = req.query;

    const where = {};

    if (category) where.category = category;
    if (creatorWalletAddress) where.creatorWalletAddress = creatorWalletAddress;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows: collections } = await Collection.findAndCountAll({
      where,
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage']
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json(
      new ApiResponse(200, {
        collections,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }, 'Collections retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get single collection by ID or slug
 */
const getCollection = async (req, res, next) => {
  try {
    const { identifier } = req.params; // Can be ID or slug

    const collection = await Collection.findOne({
      where: {
        [Op.or]: [
          { id: identifier },
          { slug: identifier }
        ]
      },
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        },
        {
          association: 'nfts',
          attributes: ['id', 'tokenId', 'name', 'image', 'currentPrice', 'isListed'],
          limit: 12,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    res.status(200).json(
      new ApiResponse(200, collection, 'Collection retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update collection
 */
const updateCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, image, bannerImage, socialLinks } = req.body;
    const creatorWalletAddress = req.user.walletAddress;

    const collection = await Collection.findByPk(id);

    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    if (collection.creatorWalletAddress !== creatorWalletAddress) {
      throw new ApiError(403, 'You are not the creator of this collection');
    }

    // Update fields
    if (name) collection.name = name;
    if (description !== undefined) collection.description = description;
    if (image) collection.image = image;
    if (bannerImage) collection.bannerImage = bannerImage;
    if (socialLinks) collection.socialLinks = socialLinks;

    await collection.save();

    logger.info(`Collection updated: ${collection.name}`);

    res.status(200).json(
      new ApiResponse(200, collection, 'Collection updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get collection statistics
 */
const getCollectionStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findByPk(id, {
      include: [
        {
          association: 'nfts',
          attributes: ['currentPrice', 'isListed']
        }
      ]
    });

    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    const listedNFTs = collection.nfts.filter(nft => nft.isListed);
    const prices = listedNFTs
      .map(nft => parseInt(nft.currentPrice))
      .filter(price => !isNaN(price) && price > 0);

    const stats = {
      totalSupply: collection.totalSupply,
      listedCount: listedNFTs.length,
      floorPrice: prices.length > 0 ? Math.min(...prices).toString() : null,
      totalVolume: collection.totalVolume,
      owners: collection.nfts.length // This could be refined with distinct owner count
    };

    // Update floor price in collection
    if (stats.floorPrice) {
      collection.floorPrice = stats.floorPrice;
      await collection.save();
    }

    res.status(200).json(
      new ApiResponse(200, stats, 'Collection statistics retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCollection,
  getCollections,
  getCollection,
  updateCollection,
  getCollectionStats
};
