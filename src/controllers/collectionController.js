const { Collection, User } = require('../models');
const xrplService = require('../services/xrplService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * List/Register a collection on the marketplace
 */
const listCollection = async (req, res, next) => {
  try {
    const { name, description, image, bannerImage, category, royaltyPercentage, socialLinks, taxon, creatorWalletAddress } = req.body;

    if (!creatorWalletAddress) {
      throw new ApiError(400, 'Creator wallet address is required');
    }

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
 * Get all collections with stats from database only
 * For collections listing page
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
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Return collections with stats from database
    const collectionsWithStats = collections.map(collection => ({
      ...collection.toJSON(),
      stats: {
        totalSupply: collection.totalSupply,
        floorPrice: collection.floorPrice,
        totalVolume: collection.totalVolume
      }
    }));

    res.status(200).json(
      new ApiResponse(200, {
        collections: collectionsWithStats,
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
 * Get single collection with NFTs on sale from XRPL
 * For collection detail page
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
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
        }
      ]
    });

    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    // Fetch NFTs from XRPL and filter by taxon
    let nftsOnSale = [];
    let totalSupply = 0;

    try {
      const accountNFTs = await xrplService.getAccountNFTs(collection.creatorWalletAddress);

      // Filter NFTs by taxon
      const collectionNFTs = accountNFTs.filter(nft => {
        const nftTaxon = nft.NFTokenTaxon || 0;
        return nftTaxon === collection.taxon;
      });

      totalSupply = collectionNFTs.length;

      // Get only NFTs that have sell offers (on sale)
      const nftsWithOffers = [];
      for (const nft of collectionNFTs) {
        try {
          const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
          if (sellOffers && sellOffers.length > 0) {
            // NFT is on sale
            nftsWithOffers.push({
              nft,
              sellOffers,
              lowestPrice: Math.min(...sellOffers.map(offer => parseInt(offer.Amount))).toString(),
              ownerAddress: sellOffers[0].owner // Get owner from sell offer
            });
          }
        } catch (err) {
          // Continue if we can't get offers for this NFT
          logger.warn(`Could not fetch sell offers for NFT ${nft.NFTokenID}`);
        }
      }

      // Fetch owner and issuer information for all NFTs
      const ownerAddresses = [...new Set(nftsWithOffers.map(item => item.ownerAddress))];
      const issuerAddresses = [...new Set(nftsWithOffers.map(item => item.nft.Issuer))];
      const allAddresses = [...new Set([...ownerAddresses, ...issuerAddresses])];

      const users = await User.findAll({
        where: { walletAddress: allAddresses },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });

      // Create a map for quick lookup
      const userMap = {};
      users.forEach(user => {
        userMap[user.walletAddress] = {
          walletAddress: user.walletAddress,
          username: user.username,
          profileImage: user.profileImage,
          isVerified: user.isVerified
        };
      });

      // Fetch metadata and images for all NFTs
      logger.info(`Fetching metadata for ${nftsWithOffers.length} NFTs...`);
      const nftsWithMetadata = await Promise.all(
        nftsWithOffers.map(async (item) => {
          try {
            // Fetch full metadata
            const metadata = await xrplService.fetchNFTMetadata(item.nft.URI);

            // Extract image URL
            let imageUrl = null;
            if (metadata) {
              imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;
              // Handle IPFS URLs
              if (imageUrl && imageUrl.startsWith('ipfs://')) {
                imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
              }
            }

            return {
              ...item,
              metadata,
              image: imageUrl
            };
          } catch (error) {
            logger.warn(`Error fetching metadata for NFT ${item.nft.NFTokenID}:`, error.message);
            return {
              ...item,
              metadata: null,
              image: null
            };
          }
        })
      );

      // Enrich NFTs with owner, issuer information, and metadata
      nftsOnSale = nftsWithMetadata.map(item => ({
        ...item.nft,
        sellOffers: item.sellOffers,
        lowestPrice: item.lowestPrice,
        owner: item.ownerAddress,
        ownerInfo: userMap[item.ownerAddress] || null,
        issuerInfo: userMap[item.nft.Issuer] || null,
        metadata: item.metadata,
        image: item.image,
        name: item.metadata?.name || null,
        description: item.metadata?.description || null,
        attributes: item.metadata?.attributes || null
      }));

      // Update collection stats if changed
      if (collection.totalSupply !== totalSupply) {
        collection.totalSupply = totalSupply;
        await collection.save();
      }

    } catch (error) {
      logger.error(`Error fetching NFTs from XRPL for collection ${collection.id}:`, error.message);
    }

    res.status(200).json(
      new ApiResponse(200, {
        collection: {
          ...collection.toJSON(),
          stats: {
            totalSupply,
            listedCount: nftsOnSale.length,
            floorPrice: collection.floorPrice,
            totalVolume: collection.totalVolume
          }
        },
        nftsOnSale
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
    const { name, description, image, bannerImage, socialLinks, creatorWalletAddress } = req.body;

    if (!creatorWalletAddress) {
      throw new ApiError(400, 'Creator wallet address is required');
    }

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
 * Update collection statistics from XRPL
 * This can be called periodically to sync stats
 */
const updateCollectionStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findByPk(id);

    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    let stats = {
      totalSupply: 0,
      listedCount: 0,
      floorPrice: null,
      totalVolume: collection.totalVolume
    };

    try {
      const accountNFTs = await xrplService.getAccountNFTs(collection.creatorWalletAddress);
      const collectionNFTs = accountNFTs.filter(nft => {
        const nftTaxon = nft.NFTokenTaxon || 0;
        return nftTaxon === collection.taxon;
      });

      stats.totalSupply = collectionNFTs.length;

      // Get sell offers to calculate floor price
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
          // Continue
        }
      }

      if (prices.length > 0) {
        stats.floorPrice = Math.min(...prices).toString();
      }

      // Update collection in database
      collection.totalSupply = stats.totalSupply;
      collection.floorPrice = stats.floorPrice;
      await collection.save();

      logger.info(`Collection stats updated: ${collection.name}`);

    } catch (error) {
      logger.error(`Error updating collection stats from XRPL:`, error.message);
      throw new ApiError(500, 'Failed to fetch stats from XRPL');
    }

    res.status(200).json(
      new ApiResponse(200, stats, 'Collection statistics updated successfully')
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
  updateCollectionStats
};
