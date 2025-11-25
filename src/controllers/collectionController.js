const { Collection, User } = require('../models');
const xrplService = require('../services/xrplService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * List/Register a collection on the marketplace
 * This stores the collection metadata in the database
 */
const listCollection = async (req, res, next) => {
  try {
    const { name, description, image, bannerImage, category, royaltyPercentage, socialLinks, taxon } = req.body;
    const creatorWalletAddress = req.user.walletAddress;

    if (!taxon) {
      throw new ApiError(400, 'Taxon is required to identify the collection on XRPL');
    }

    // Check if taxon already exists
    const existingCollection = await Collection.findOne({ where: { taxon } });
    if (existingCollection) {
      throw new ApiError(400, 'Collection with this taxon is already listed');
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingSlug = await Collection.findOne({ where: { slug } });
    if (existingSlug) {
      throw new ApiError(400, 'Collection with this name already exists');
    }

    const collection = await Collection.create({
      name,
      slug,
      description,
      image,
      bannerImage,
      creatorWalletAddress,
      taxon,
      category: category || 'other',
      royaltyPercentage: royaltyPercentage || 0,
      socialLinks
    });

    logger.info(`Collection listed: ${collection.name} (taxon: ${taxon}) by ${creatorWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, collection, 'Collection listed successfully')
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
 * Get single collection by ID or slug with NFTs from XRPL
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
        }
      ]
    });

    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    // Fetch NFTs from XRPL using the creator's wallet address
    let nfts = [];
    let totalSupply = 0;
    try {
      const accountNFTs = await xrplService.getAccountNFTs(collection.creatorWalletAddress);

      // Filter NFTs by taxon to get only this collection's NFTs
      nfts = accountNFTs.filter(nft => {
        // Extract taxon from NFToken
        // NFTokenID structure: https://xrpl.org/nftokenid.html
        // We need to check if the taxon matches
        const nftTaxon = nft.NFTokenTaxon || 0;
        return nftTaxon === collection.taxon;
      });

      totalSupply = nfts.length;

      // Update collection stats
      if (collection.totalSupply !== totalSupply) {
        collection.totalSupply = totalSupply;
        await collection.save();
      }
    } catch (error) {
      logger.warn(`Could not fetch NFTs from XRPL for collection ${collection.id}:`, error.message);
    }

    res.status(200).json(
      new ApiResponse(200, {
        collection,
        nfts,
        totalSupply
      }, 'Collection retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update collection metadata
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
    if (name) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existingSlug = await Collection.findOne({ where: { slug, id: { [Op.ne]: id } } });
      if (existingSlug) {
        throw new ApiError(400, 'Collection with this name already exists');
      }
      collection.name = name;
      collection.slug = slug;
    }
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
 * Get collection statistics from XRPL
 */
const getCollectionStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findByPk(id);

    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    // Fetch NFTs from XRPL to calculate stats
    let stats = {
      totalSupply: collection.totalSupply,
      listedCount: 0,
      floorPrice: null,
      totalVolume: collection.totalVolume,
      owners: 0
    };

    try {
      const accountNFTs = await xrplService.getAccountNFTs(collection.creatorWalletAddress);
      const collectionNFTs = accountNFTs.filter(nft => {
        const nftTaxon = nft.NFTokenTaxon || 0;
        return nftTaxon === collection.taxon;
      });

      stats.totalSupply = collectionNFTs.length;

      // Get sell offers for each NFT to calculate floor price
      const prices = [];
      for (const nft of collectionNFTs) {
        try {
          const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
          if (sellOffers.length > 0) {
            stats.listedCount++;
            sellOffers.forEach(offer => {
              const amount = parseInt(offer.Amount);
              if (!isNaN(amount) && amount > 0) {
                prices.push(amount);
              }
            });
          }
        } catch (err) {
          // Continue if we can't get offers for this NFT
        }
      }

      if (prices.length > 0) {
        stats.floorPrice = Math.min(...prices).toString();
        collection.floorPrice = stats.floorPrice;
      }

      collection.totalSupply = stats.totalSupply;
      await collection.save();

    } catch (error) {
      logger.warn(`Could not fetch NFT stats from XRPL for collection ${collection.id}:`, error.message);
    }

    res.status(200).json(
      new ApiResponse(200, stats, 'Collection statistics retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCollection,
  getCollections,
  getCollection,
  updateCollection,
  getCollectionStats
};
