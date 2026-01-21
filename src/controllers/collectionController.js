const { Collection, User, DropMint, Drop, Follow, sequelize, Subscription } = require('../models');
const xrplService = require('../services/xrplService');
const xrplConfig = require('../config/xrpl');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { initBoostEngine } = require('../services/boostEngine');
const {
  getActiveSubscriptionsForWallets,
  enrichItemsWithSubscriptions,
  createUserInfoWithSubscription
} = require('../utils/userHelpers');

/**
 * Helper function to convert gateway URLs to IPFS hash format
 * Strips gateway URL prefixes and returns ipfs://{hash} format
 */
const convertToIpfsHash = (url) => {
  if (!url) return url;

  // Common IPFS gateway patterns to strip
  const gatewayPatterns = [
    /^https?:\/\/[^/]+\.mypinata\.cloud\/ipfs\//,
    /^https?:\/\/gateway\.pinata\.cloud\/ipfs\//,
    /^https?:\/\/ipfs\.io\/ipfs\//,
    /^https?:\/\/cloudflare-ipfs\.com\/ipfs\//,
    /^https?:\/\/dweb\.link\/ipfs\//
  ];

  for (const pattern of gatewayPatterns) {
    if (pattern.test(url)) {
      const hash = url.replace(pattern, '').split('?')[0]; // Remove query params too
      return `ipfs://${hash}`;
    }
  }

  // Already in ipfs:// format or raw hash, return as-is
  return url;
};

/**
 * List/Register a collection on the marketplace
 * If collection with same taxon already exists, returns the existing collection
 * This makes the endpoint idempotent - safe to call multiple times
 */
const listCollection = async (req, res, next) => {
  try {
    const { name, description, image, bannerImage, category, royaltyPercentage, socialLinks, taxon, creatorWalletAddress } = req.body;

    if (!creatorWalletAddress) {
      throw new ApiError(400, 'Creator wallet address is required');
    }

    // Check if taxon is provided (0 is a valid taxon value for the first collection)
    if (taxon === undefined || taxon === null) {
      throw new ApiError(400, 'Taxon is required to identify the collection on XRPL');
    }

    const taxonNum = parseInt(taxon);
    if (isNaN(taxonNum) || taxonNum < 0) {
      throw new ApiError(400, 'Taxon must be a valid non-negative number');
    }

    // Check if collection with this taxon already exists
    const existingCollection = await Collection.findOne({
      where: { taxon: taxonNum },
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    if (existingCollection) {
      logger.info(`Collection with taxon ${taxonNum} already listed, returning existing collection`);

      // Return existing collection with 200 status
      return res.status(200).json(
        new ApiResponse(200, existingCollection, 'Collection already listed')
      );
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check if slug already exists (for new collections)
    const existingSlug = await Collection.findOne({ where: { slug } });
    if (existingSlug) {
      throw new ApiError(400, 'Collection with this name already exists');
    }

    // Create new collection
    const collection = await Collection.create({
      name,
      slug,
      description,
      image,
      bannerImage,
      creatorWalletAddress,
      taxon: taxonNum,
      category: category || 'other',
      royaltyPercentage: royaltyPercentage || 0,
      socialLinks
    });

    logger.info(`Collection listed: ${collection.name} (taxon: ${taxonNum}) by ${creatorWalletAddress}`);

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

    // Check each collection for at least one NFT for sale on XRPL and calculate accurate stats
    const validCollections = [];
    const collectionsToDelete = [];

    for (const collection of collections) {
      try {
        const taxon = collection.taxon;
        const creatorWallet = collection.creatorWalletAddress;

        // Fetch NFTs from XRPL for this collection
        const accountNFTs = await xrplService.getAccountNFTs(creatorWallet);
        const collectionNFTs = accountNFTs.filter(nft => {
          const nftTaxon = nft.NFTokenTaxon || 0;
          return nftTaxon === taxon;
        });

        // Calculate accurate stats from XRPL
        const totalSupply = collectionNFTs.length;
        let listedCount = 0;
        const prices = [];

        // Check each NFT for sell offers to calculate floor price and listed count
        let hasListedNFT = false;
        for (const nft of collectionNFTs) {
          try {
            const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
            if (sellOffers && sellOffers.length > 0) {
              hasListedNFT = true;
              listedCount++;

              // Collect prices for floor price calculation
              sellOffers.forEach(offer => {
                const amount = parseInt(offer.amount);
                if (!isNaN(amount) && amount > 0) {
                  prices.push(amount);
                }
              });
            }
          } catch (err) {
            // Continue checking other NFTs
          }
        }

        if (hasListedNFT) {
          // Calculate floor price
          const floorPrice = prices.length > 0 ? Math.min(...prices).toString() : null;

          // Calculate listing percentage
          const listingPercentage = totalSupply > 0
            ? ((listedCount / totalSupply) * 100).toFixed(2)
            : '0.00';

          // Collection has at least one NFT for sale, keep it with accurate stats
          validCollections.push({
            collection,
            stats: {
              totalSupply,
              floorPrice,
              totalVolume: collection.totalVolume || '0', // Keep from database
              listedCount,
              listingPercentage
            }
          });

          // Update collection stats in database
          collection.totalSupply = totalSupply;
          collection.floorPrice = floorPrice;
          await collection.save();

        } else {
          // No NFTs for sale, mark for deletion
          logger.info(`Collection ${collection.name} (taxon ${taxon}) has no NFTs for sale, marking for deletion`);
          collectionsToDelete.push(collection);
        }

      } catch (error) {
        logger.error(`Error checking collection ${collection.name} on XRPL:`, error.message);
        // On error, keep the collection with database stats to avoid accidental deletion
        validCollections.push({
          collection,
          stats: {
            totalSupply: collection.totalSupply || 0,
            floorPrice: collection.floorPrice,
            totalVolume: collection.totalVolume || '0',
            listedCount: 0,
            listingPercentage: '0.00'
          }
        });
      }
    }

    // Delete collections without listed NFTs
    if (collectionsToDelete.length > 0) {
      const idsToDelete = collectionsToDelete.map(c => c.id);
      await Collection.destroy({ where: { id: idsToDelete } });
      logger.info(`Deleted ${collectionsToDelete.length} collections without listed NFTs`);
    }

    // Format response with accurate stats from XRPL
    let collectionsWithStats = validCollections.map(item => ({
      ...item.collection.toJSON(),
      stats: item.stats
    }));

    // Always apply boost scoring (boost is primary sort)
    if (collectionsWithStats.length > 0) {
      const db = require('../models');
      const boostEngine = initBoostEngine(db);
      const boostedCollections = await boostEngine.boostCollections(
        collectionsWithStats.map(c => ({
          ...c,
          creatorWalletAddress: c.creatorWalletAddress
        }))
      );

      // Sort by boost score (primary), then by secondary sort
      boostedCollections.sort((a, b) => {
        // Primary sort: boost score (descending)
        const boostDiff = (b.boostScore || 0) - (a.boostScore || 0);
        if (Math.abs(boostDiff) > 0.01) return boostDiff;

        // Secondary sort based on sortBy parameter
        if (sortBy === 'totalVolume') {
          return parseInt(b.totalVolume || 0) - parseInt(a.totalVolume || 0);
        } else if (sortBy === 'floorPrice') {
          return parseInt(b.floorPrice || 0) - parseInt(a.floorPrice || 0);
        } else if (sortBy === 'name') {
          return (a.name || '').localeCompare(b.name || '');
        }
        // Default: createdAt (most recent first)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      collectionsWithStats = boostedCollections;
    }

    // Add subscription plans to creator data
    const creatorWallets = collectionsWithStats
      .map(c => c.creator?.walletAddress)
      .filter(Boolean);
    const subscriptionMap = await getActiveSubscriptionsForWallets(creatorWallets);

    collectionsWithStats = collectionsWithStats.map(collection => ({
      ...collection,
      creator: collection.creator ? {
        ...collection.creator,
        subscriptionPlan: subscriptionMap[collection.creator.walletAddress] || 'free'
      } : null
    }));

    res.status(200).json(
      new ApiResponse(200, {
        collections: collectionsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: validCollections.length,
          pages: Math.ceil(validCollections.length / limit)
        },
        sorting: {
          primary: 'boost',
          secondary: sortBy
        }
      }, 'Collections retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get single collection with NFTs from XRPL blockchain
 * Fetches all data directly from XRPL - no database queries
 * Requires taxon and wallet query parameters
 */
const getCollection = async (req, res, next) => {
  try {
    const { identifier } = req.params; // Collection identifier (taxon or UUID)
    const { wallet } = req.query; // Creator wallet address (required for XRPL queries)

    logger.info(`Fetching collection with identifier: ${identifier}, wallet: ${wallet}`);
    logger.info(`Using XRPL network: ${xrplConfig.getNetwork()}`);

    // Parse identifier as taxon number
    const taxon = parseInt(identifier);

    if (isNaN(taxon)) {
      throw new ApiError(400, 'Invalid collection identifier. Must be a taxon number.');
    }

    if (!wallet) {
      throw new ApiError(400, 'Wallet address is required as query parameter (?wallet=...)');
    }

    const creatorWalletAddress = wallet;
    logger.info(`Fetching collection with taxon: ${taxon}, creator: ${creatorWalletAddress}`);

    // Fetch NFTs from XRPL blockchain and extract collection metadata
    let nftsOnSale = [];
    let allNFTs = [];
    let totalSupply = 0;
    let collectionTitle = null;
    let collectionImage = null;
    let collectionDescription = null;

    try {
      const accountNFTs = await xrplService.getAccountNFTs(creatorWalletAddress);
      logger.info(`Found ${accountNFTs.length} total NFTs from creator wallet`);

      // Filter NFTs by taxon
      const collectionNFTs = accountNFTs.filter(nft => {
        const nftTaxon = nft.NFTokenTaxon || 0;
        return nftTaxon === taxon;
      });

      totalSupply = collectionNFTs.length;
      logger.info(`Found ${totalSupply} NFTs with taxon ${taxon}`);

      // Extract collection metadata from XRPL NFT metadata
      if (collectionNFTs.length > 0) {
        try {
          const firstNFTMetadata = await xrplService.fetchNFTMetadata(collectionNFTs[0].URI);
          if (firstNFTMetadata) {
            logger.info(`Extracting collection metadata from XRPL NFT metadata`);

            // Extract collection name from XRPL metadata
            if (firstNFTMetadata.collection) {
              collectionTitle = typeof firstNFTMetadata.collection === 'string'
                ? firstNFTMetadata.collection
                : firstNFTMetadata.collection.name || firstNFTMetadata.collection.family || null;
            }
            if (!collectionTitle && firstNFTMetadata.name) {
              collectionTitle = firstNFTMetadata.name;
            }

            // Extract collection image from XRPL metadata
            let imageUrl = firstNFTMetadata.image || firstNFTMetadata.image_url || firstNFTMetadata.imageUrl;
            collectionImage = imageUrl;

            // Extract description from XRPL metadata
            if (firstNFTMetadata.description) {
              collectionDescription = firstNFTMetadata.description;
            }

            logger.info(`XRPL metadata extracted - Title: ${collectionTitle}, Image: ${collectionImage ? 'Yes' : 'No'}, Description: ${collectionDescription ? 'Yes' : 'No'}`);
          }
        } catch (err) {
          logger.warn(`Could not fetch metadata from XRPL for collection taxon ${taxon}: ${err.message}`);
        }
      }

      // Fallback title if metadata extraction failed
      if (!collectionTitle) {
        collectionTitle = `Collection #${taxon}`;
      }

      // Get all NFTs with their sell offers
      const nftsWithOffers = [];
      for (const nft of collectionNFTs) {
        try {
          const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
          const hasOffers = sellOffers && sellOffers.length > 0;

          nftsWithOffers.push({
            nft,
            sellOffers: hasOffers ? sellOffers : [],
            lowestPrice: hasOffers ? Math.min(...sellOffers.map(offer => parseInt(offer.amount || offer.Amount))).toString() : null,
            ownerAddress: hasOffers ? sellOffers[0].owner : creatorWalletAddress, // Owner from sell offer or the wallet we queried
            isOnSale: hasOffers
          });
        } catch (err) {
          // Include NFT even if we can't get offers
          logger.warn(`Could not fetch sell offers for NFT ${nft.NFTokenID}`);
          nftsWithOffers.push({
            nft,
            sellOffers: [],
            lowestPrice: null,
            ownerAddress: creatorWalletAddress, // Owner is the wallet we queried from
            isOnSale: false
          });
        }
      }

      // Fetch owner and issuer information for all NFTs
      const ownerAddresses = [...new Set(nftsWithOffers.map(item => item.ownerAddress))];
      const issuerAddresses = [...new Set(nftsWithOffers.map(item => item.nft.Issuer))];
      const allAddresses = [...new Set([...ownerAddresses, ...issuerAddresses])];

      const [users, subscriptionMap] = await Promise.all([
        User.findAll({
          where: { walletAddress: allAddresses },
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }),
        getActiveSubscriptionsForWallets(allAddresses)
      ]);

      // Create a map for quick lookup with subscription plans
      const userMap = {};
      users.forEach(user => {
        userMap[user.walletAddress] = {
          walletAddress: user.walletAddress,
          username: user.username,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
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

      // Enrich all NFTs with owner, issuer information, and metadata
      allNFTs = nftsWithMetadata.map(item => ({
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
        attributes: item.metadata?.attributes || null,
        isOnSale: item.isOnSale
      }));

      // Set nftsOnSale to all NFTs (keeping key name for backward compatibility)
      nftsOnSale = allNFTs;

      // Calculate floor price from NFTs that have sell offers
      const nftsWithPrices = allNFTs.filter(nft => nft.lowestPrice && nft.isOnSale);
      const allPrices = nftsWithPrices.map(nft => parseInt(nft.lowestPrice));
      const floorPrice = allPrices.length > 0 ? Math.min(...allPrices).toString() : null;

    } catch (error) {
      logger.error(`Error fetching NFTs from XRPL for collection with taxon ${taxon}:`, error.message);
    }

    // Build collection response from XRPL data only
    const collectionData = {
      id: crypto.randomUUID(),
      taxon: taxon,
      name: collectionTitle,
      title: collectionTitle,
      description: collectionDescription,
      image: collectionImage,
      creatorWalletAddress: creatorWalletAddress,
      stats: {
        totalSupply: totalSupply,
        listedCount: allNFTs.filter(nft => nft.isOnSale).length,
        floorPrice: allNFTs.filter(nft => nft.lowestPrice).length > 0
          ? Math.min(...allNFTs.filter(nft => nft.lowestPrice).map(nft => parseInt(nft.lowestPrice))).toString()
          : null
      }
    };

    res.status(200).json(
      new ApiResponse(200, {
        collection: collectionData,
        nfts: allNFTs,
        nftsOnSale: nftsOnSale
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
              const amount = parseInt(offer.amount || offer.Amount);
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

/**
 * Get collections created by or owned by a wallet address
 * Fetches live data from XRPL and user info from database
 */
const getUserCollections = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    logger.info(`Fetching collections for wallet: ${walletAddress}`);
    logger.info(`Using XRPL network: ${xrplConfig.getNetwork()}`);
    logger.info(`Using XRPL WebSocket: ${xrplConfig.wssUrl}`);

    // Get all NFTs owned by this wallet from XRPL
    const accountNFTs = await xrplService.getAccountNFTs(walletAddress);
    logger.info(`Found ${accountNFTs?.length || 0} total NFTs for wallet ${walletAddress}`);

    if (!accountNFTs || accountNFTs.length === 0) {
      logger.warn(`No NFTs found for wallet ${walletAddress} on ${xrplConfig.getNetwork()}`);
      return res.status(200).json(
        new ApiResponse(200, [], 'No collections found for this wallet')
      );
    }

    // Group NFTs by taxon (collection identifier)
    const nftsByTaxon = {};
    accountNFTs.forEach(nft => {
      const taxon = nft.NFTokenTaxon || 0;
      if (!nftsByTaxon[taxon]) {
        nftsByTaxon[taxon] = [];
      }
      nftsByTaxon[taxon].push(nft);
    });

    // Get all collections from database that match these taxons
    const taxons = Object.keys(nftsByTaxon).map(t => parseInt(t));
    const dbCollections = await Collection.findAll({
      where: {
        taxon: taxons
      },
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    // Create a map of taxon to collection
    const collectionMap = {};
    dbCollections.forEach(col => {
      collectionMap[col.taxon] = col;
    });

    // Get all unique issuer addresses to fetch user info
    const issuerAddresses = [...new Set(accountNFTs.map(nft => nft.Issuer))];
    const allUserAddresses = [...new Set([...issuerAddresses, walletAddress])];

    const [users, subscriptionMap] = await Promise.all([
      User.findAll({
        where: { walletAddress: allUserAddresses },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }),
      getActiveSubscriptionsForWallets(allUserAddresses)
    ]);

    const userMap = {};
    users.forEach(user => {
      userMap[user.walletAddress] = {
        walletAddress: user.walletAddress,
        username: user.username,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
      };
    });

    // Build collection data for each taxon
    const collections = await Promise.all(
      Object.entries(nftsByTaxon).map(async ([taxon, nfts]) => {
        const taxonNum = parseInt(taxon);
        const dbCollection = collectionMap[taxonNum];

        // Get first NFT to determine issuer
        const firstNFT = nfts[0];
        const issuer = firstNFT.Issuer;

        // Calculate stats from XRPL
        let listedCount = 0;
        const prices = [];

        // Check which NFTs are listed (have sell offers)
        for (const nft of nfts) {
          try {
            const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
            if (sellOffers && sellOffers.length > 0) {
              listedCount++;
              sellOffers.forEach(offer => {
                const amount = parseInt(offer.amount || offer.Amount);
                if (!isNaN(amount) && amount > 0) {
                  prices.push(amount);
                }
              });
            }
          } catch (err) {
            // Continue if we can't get offers
            logger.warn(`Could not fetch sell offers for NFT ${nft.NFTokenID}`);
          }
        }

        const totalItems = nfts.length;
        const floorPrice = prices.length > 0 ? Math.min(...prices).toString() : null;
        const listedPercentage = totalItems > 0 ? ((listedCount / totalItems) * 100).toFixed(2) : '0';

        // Try to get collection image from first NFT metadata if not in database
        let collectionImage = dbCollection ? dbCollection.image : null;
        let collectionTitle = dbCollection ? dbCollection.name : null;

        if (!dbCollection && nfts.length > 0) {
          try {
            const metadata = await xrplService.fetchNFTMetadata(firstNFT.URI);
            if (metadata) {
              // Extract collection name from metadata
              if (metadata.collection) {
                // Collection can be a string or object with name field
                collectionTitle = typeof metadata.collection === 'string'
                  ? metadata.collection
                  : metadata.collection.name || metadata.collection.family || null;
              }

              // If no collection field, try using the NFT name as fallback
              if (!collectionTitle && metadata.name) {
                collectionTitle = metadata.name;
              }

              // Extract image
              if (metadata.image || metadata.image_url || metadata.imageUrl) {
                collectionImage = metadata.image || metadata.image_url || metadata.imageUrl;
              }
            }
          } catch (err) {
            logger.warn(`Could not fetch metadata for collection taxon ${taxonNum}`);
          }
        }

        // Fallback title if still no title found
        if (!collectionTitle) {
          collectionTitle = `Collection #${taxonNum}`;
        }

        // Build creator object with subscription plan
        let creatorData;
        if (dbCollection && dbCollection.creator) {
          creatorData = {
            ...dbCollection.creator.toJSON ? dbCollection.creator.toJSON() : dbCollection.creator,
            subscriptionPlan: subscriptionMap[dbCollection.creator.walletAddress] || 'free'
          };
        } else {
          creatorData = userMap[issuer] || {
            walletAddress: issuer,
            username: issuer,
            profileImage: null,
            isVerified: false,
            subscriptionPlan: subscriptionMap[issuer] || 'free'
          };
        }

        // Build collection object
        return {
          id: dbCollection ? dbCollection.id : crypto.randomUUID(),
          taxon: taxonNum,
          title: collectionTitle,
          image: convertToIpfsHash(collectionImage),
          floorPrice: floorPrice,
          items: totalItems,
          listedCount: listedCount,
          listedPercentage: listedPercentage,
          volume: dbCollection ? dbCollection.totalVolume : '0',
          creator: creatorData,
          owner: userMap[walletAddress] || {
            walletAddress: walletAddress,
            username: walletAddress,
            profileImage: null,
            isVerified: false,
            subscriptionPlan: subscriptionMap[walletAddress] || 'free'
          },
          // Include DB collection data if available
          collectionId: dbCollection ? dbCollection.id : null,
          slug: dbCollection ? dbCollection.slug : null,
          description: dbCollection ? dbCollection.description : null,
          category: dbCollection ? dbCollection.category : null,
          isVerified: dbCollection ? dbCollection.isVerified : false,
          isRegistered: !!dbCollection
        };
      })
    );

    // Filter out incomplete collections
    const filteredCollections = collections.filter(collection => {
      // Always include registered collections (in database)
      if (collection.isRegistered) {
        return true;
      }

      // For unregistered collections, only filter out if no image available
      // Removed: minimum NFT count requirement (now shows all collections)
      // Removed: listing requirement (shows collections even without active sales)
      if (!collection.image) {
        logger.info(`Filtering out unregistered collection taxon ${collection.taxon} with no image`);
        return false;
      }

      return true;
    });

    // Sort: registered collections first, then by total items (largest first)
    filteredCollections.sort((a, b) => {
      if (a.isRegistered && !b.isRegistered) return -1;
      if (!a.isRegistered && b.isRegistered) return 1;
      return b.items - a.items;
    });

    logger.info(`Found ${collections.length} collections for wallet: ${walletAddress}, ${filteredCollections.length} after filtering`);

    res.status(200).json(
      new ApiResponse(200, filteredCollections, 'Collections retrieved successfully')
    );
  } catch (error) {
    logger.error('Error fetching user collections:', error);
    next(error);
  }
};

/**
 * Get statistics for all collections including top performers
 * Fetches collections from database, calculates stats from XRPL,
 * and includes top 10 traders, creators, and influencers
 */
const getCollectionStats = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();

    logger.info('Fetching statistics for all collections and top performers');

    // Get network info
    const networkInfo = xrplConfig.getNetworkInfo();

    // Date range for the period
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Fetch top 10 traders, creators, and influencers in parallel
    const [topTraders, topCreators, topInfluencers, collections] = await Promise.all([
      // Top 10 Traders - users who spent the most on minting
      (async () => {
        const traders = await DropMint.findAll({
          attributes: [
            'minterWalletAddress',
            [sequelize.fn('SUM', sequelize.cast(sequelize.col('mintPrice'), 'UNSIGNED')), 'totalSpent'],
            [sequelize.fn('COUNT', sequelize.col('DropMint.id')), 'mintCount']
          ],
          where: { createdAt: { [Op.between]: [startDate, endDate] } },
          group: ['minterWalletAddress'],
          order: [[sequelize.literal('totalSpent'), 'DESC']],
          limit: 10,
          raw: true
        });

        return Promise.all(traders.map(async (trader, index) => {
          const user = await User.findOne({
            where: { walletAddress: trader.minterWalletAddress },
            attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
          });
          return {
            rank: index + 1,
            walletAddress: trader.minterWalletAddress,
            walletUrl: xrplConfig.getAccountUrl(trader.minterWalletAddress),
            totalSpent: trader.totalSpent || '0',
            totalSpentXrp: ((parseFloat(trader.totalSpent) || 0) / 1000000).toFixed(6),
            mintCount: parseInt(trader.mintCount) || 0,
            user: user ? {
              username: user.username,
              profileImage: user.profileImage,
              isVerified: user.isVerified,
              bio: user.bio
            } : null
          };
        }));
      })(),

      // Top 10 Creators - users with highest revenue from drops
      (async () => {
        const creators = await DropMint.findAll({
          attributes: [
            [sequelize.col('drop.creatorWalletAddress'), 'creatorWalletAddress'],
            [sequelize.fn('SUM', sequelize.cast(sequelize.col('mintPrice'), 'UNSIGNED')), 'totalRevenue'],
            [sequelize.fn('COUNT', sequelize.col('DropMint.id')), 'totalMints']
          ],
          include: [{ model: Drop, as: 'drop', attributes: [], required: true }],
          where: { createdAt: { [Op.between]: [startDate, endDate] } },
          group: ['drop.creatorWalletAddress'],
          order: [[sequelize.literal('totalRevenue'), 'DESC']],
          limit: 10,
          raw: true
        });

        return Promise.all(creators.map(async (creator, index) => {
          const user = await User.findOne({
            where: { walletAddress: creator.creatorWalletAddress },
            attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
          });

          // Get creator's drop count
          const dropCount = await Drop.count({
            where: { creatorWalletAddress: creator.creatorWalletAddress }
          });

          return {
            rank: index + 1,
            walletAddress: creator.creatorWalletAddress,
            walletUrl: xrplConfig.getAccountUrl(creator.creatorWalletAddress),
            totalRevenue: creator.totalRevenue || '0',
            totalRevenueXrp: ((parseFloat(creator.totalRevenue) || 0) / 1000000).toFixed(6),
            totalMints: parseInt(creator.totalMints) || 0,
            totalDrops: dropCount,
            user: user ? {
              username: user.username,
              profileImage: user.profileImage,
              isVerified: user.isVerified,
              bio: user.bio
            } : null
          };
        }));
      })(),

      // Top 10 Influencers - users with most followers and engagement
      (async () => {
        const influencerStats = await Follow.findAll({
          attributes: [
            'followingWalletAddress',
            [sequelize.fn('COUNT', sequelize.col('id')), 'newFollowers']
          ],
          where: { createdAt: { [Op.between]: [startDate, endDate] } },
          group: ['followingWalletAddress'],
          order: [[sequelize.literal('newFollowers'), 'DESC']],
          limit: 20,
          raw: true
        });

        const influencersWithEngagement = await Promise.all(influencerStats.map(async (influencer) => {
          const [totalFollowers, user] = await Promise.all([
            Follow.count({ where: { followingWalletAddress: influencer.followingWalletAddress } }),
            User.findOne({
              where: { walletAddress: influencer.followingWalletAddress },
              attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
            })
          ]);

          return {
            walletAddress: influencer.followingWalletAddress,
            walletUrl: xrplConfig.getAccountUrl(influencer.followingWalletAddress),
            newFollowers: parseInt(influencer.newFollowers) || 0,
            totalFollowers,
            engagementScore: parseInt(influencer.newFollowers) || 0,
            user: user ? {
              username: user.username,
              profileImage: user.profileImage,
              isVerified: user.isVerified,
              bio: user.bio
            } : null
          };
        }));

        return influencersWithEngagement
          .sort((a, b) => b.engagementScore - a.engagementScore)
          .slice(0, 10)
          .map((inf, index) => ({ rank: index + 1, ...inf }));
      })(),

      // Fetch collections
      Collection.findAll({
        include: [
          {
            association: 'creator',
            attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 20
      })
    ]);

    // Process collections for stats (simplified - avoid too many XRPL calls)
    const collectionsWithStats = await Promise.all(
      collections.slice(0, 10).map(async (collection) => {
        try {
          const taxon = collection.taxon;
          const creatorWallet = collection.creatorWalletAddress;

          // Fetch NFTs from XRPL for this collection
          const accountNFTs = await xrplService.getAccountNFTs(creatorWallet);
          const collectionNFTs = accountNFTs.filter(nft => {
            const nftTaxon = nft.NFTokenTaxon || 0;
            return nftTaxon === taxon;
          });

          const totalSupply = collectionNFTs.length;
          let listedCount = 0;
          let floorPrice = null;
          const prices = [];

          // Check first 5 NFTs for sell offers to calculate floor price
          for (const nft of collectionNFTs.slice(0, 5)) {
            try {
              const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
              if (sellOffers && sellOffers.length > 0) {
                listedCount++;
                sellOffers.forEach(offer => {
                  const amount = parseInt(offer.amount);
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
            floorPrice = Math.min(...prices).toString();
          }

          return {
            id: collection.id,
            taxon: collection.taxon,
            name: collection.name,
            slug: collection.slug,
            image: collection.image,
            creator: collection.creator,
            isVerified: collection.isVerified,
            stats: {
              totalSupply,
              floorPrice,
              floorPriceXrp: floorPrice ? (parseInt(floorPrice) / 1000000).toFixed(6) : null,
              listed: listedCount
            }
          };
        } catch (error) {
          return {
            id: collection.id,
            taxon: collection.taxon,
            name: collection.name,
            slug: collection.slug,
            image: collection.image,
            creator: collection.creator,
            isVerified: collection.isVerified,
            stats: {
              totalSupply: 0,
              floorPrice: null,
              floorPriceXrp: null,
              listed: 0
            }
          };
        }
      })
    );

    // Calculate summary stats
    const totalTraderSpent = topTraders.reduce((sum, t) => sum + (parseFloat(t.totalSpent) || 0), 0);
    const totalCreatorRevenue = topCreators.reduce((sum, c) => sum + (parseFloat(c.totalRevenue) || 0), 0);
    const totalNewFollowers = topInfluencers.reduce((sum, i) => sum + (i.newFollowers || 0), 0);

    logger.info(`Successfully processed stats for collections and top performers`);

    res.status(200).json(
      new ApiResponse(200, {
        network: {
          name: networkInfo.network,
          isTestnet: networkInfo.isTestnet,
          explorerUrl: networkInfo.explorerUrl
        },
        period: {
          month: targetMonth,
          year: targetYear,
          monthName: new Date(targetYear, targetMonth - 1, 1).toLocaleString('default', { month: 'long' })
        },
        rankings: {
          traders: {
            title: 'Top Traders',
            description: 'Users who spent the most on minting NFTs this period',
            totalSpent: totalTraderSpent.toString(),
            totalSpentXrp: (totalTraderSpent / 1000000).toFixed(6),
            list: topTraders
          },
          creators: {
            title: 'Top Creators',
            description: 'Creators with highest revenue from their drops this period',
            totalRevenue: totalCreatorRevenue.toString(),
            totalRevenueXrp: (totalCreatorRevenue / 1000000).toFixed(6),
            list: topCreators
          },
          influencers: {
            title: 'Top Influencers',
            description: 'Users with most new followers and engagement this period',
            totalNewFollowers,
            list: topInfluencers
          }
        },
        topCollections: collectionsWithStats
      }, 'Collection statistics and rankings retrieved successfully')
    );

  } catch (error) {
    logger.error('Error fetching collection statistics:', error);
    next(error);
  }
};

/**
 * Search for collections and NFTs by name
 * Searches collections in database and NFTs on XRPL blockchain
 */
const searchCollectionsAndNFTs = async (req, res, next) => {
  try {
    const { name, limit = 50 } = req.query;

    if (!name || name.trim().length === 0) {
      throw new ApiError(400, 'Search name parameter is required');
    }

    const searchTerm = name.trim().toLowerCase();
    logger.info(`Searching for collections and NFTs with name: ${searchTerm}`);

    // Step 1: Search collections in database
    const collections = await Collection.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${name}%` } },
          { description: { [Op.like]: `%${name}%` } }
        ]
      },
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ],
      limit: parseInt(limit)
    });

    logger.info(`Found ${collections.length} matching collections in database`);

    // Step 2: Fetch NFTs from XRPL for each collection and search for matching NFT names
    const matchingNFTs = [];
    const matchingCollections = collections.map(col => ({
      type: 'collection',
      id: col.id,
      taxon: col.taxon,
      name: col.name,
      slug: col.slug,
      image: col.image,
      description: col.description,
      creator: col.creator,
      isVerified: col.isVerified,
      stats: {
        totalSupply: col.totalSupply,
        floorPrice: col.floorPrice,
        totalVolume: col.totalVolume
      }
    }));

    // Fetch NFTs from XRPL for all collections and search by name
    for (const collection of collections) {
      try {
        const taxon = collection.taxon;
        const creatorWallet = collection.creatorWalletAddress;

        // Fetch NFTs from XRPL for this collection
        const accountNFTs = await xrplService.getAccountNFTs(creatorWallet);
        const collectionNFTs = accountNFTs.filter(nft => {
          const nftTaxon = nft.NFTokenTaxon || 0;
          return nftTaxon === taxon;
        });

        logger.info(`Checking ${collectionNFTs.length} NFTs from collection ${collection.name}`);

        // Check each NFT's metadata for name match
        for (const nft of collectionNFTs) {
          try {
            // Fetch metadata to get NFT name
            const metadata = await xrplService.fetchNFTMetadata(nft.URI);

            if (metadata && metadata.name) {
              const nftName = metadata.name.toLowerCase();

              // Check if NFT name matches search term
              if (nftName.includes(searchTerm)) {
                // Get sell offers for this NFT
                let sellOffers = [];
                let lowestPrice = null;
                let isOnSale = false;

                try {
                  sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
                  if (sellOffers && sellOffers.length > 0) {
                    isOnSale = true;
                    const prices = sellOffers.map(offer => parseInt(offer.amount));
                    lowestPrice = Math.min(...prices).toString();
                  }
                } catch (err) {
                  logger.warn(`Could not fetch sell offers for NFT ${nft.NFTokenID}`);
                }

                // Extract image URL
                const imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;

                // Add matching NFT to results
                matchingNFTs.push({
                  type: 'nft',
                  nftTokenId: nft.NFTokenID,
                  name: metadata.name,
                  description: metadata.description || null,
                  image: imageUrl,
                  taxon: nft.NFTokenTaxon,
                  issuer: nft.Issuer,
                  collection: {
                    id: collection.id,
                    name: collection.name,
                    slug: collection.slug
                  },
                  isOnSale: isOnSale,
                  lowestPrice: lowestPrice,
                  uri: nft.URI
                });

                logger.info(`Found matching NFT: ${metadata.name} in collection ${collection.name}`);
              }
            }
          } catch (err) {
            logger.warn(`Could not fetch metadata for NFT ${nft.NFTokenID}:`, err.message);
          }
        }
      } catch (error) {
        logger.error(`Error searching NFTs in collection ${collection.name}:`, error.message);
      }
    }

    logger.info(`Search completed: ${matchingCollections.length} collections, ${matchingNFTs.length} NFTs`);

    // Return combined results
    res.status(200).json(
      new ApiResponse(200, {
        collections: matchingCollections,
        nfts: matchingNFTs,
        summary: {
          totalCollections: matchingCollections.length,
          totalNFTs: matchingNFTs.length,
          searchTerm: name
        }
      }, 'Search completed successfully')
    );

  } catch (error) {
    logger.error('Error searching collections and NFTs:', error);
    next(error);
  }
};

/**
 * Get newest NFTs across all collections
 * Fetches collections from database and NFTs from XRPL
 * Supports sorting by: 'boost' (default), 'recent', 'price_low', 'price_high'
 */
const getNewNFTs = async (req, res, next) => {
  try {
    const { limit = 20, sortBy = 'boost' } = req.query;

    logger.info(`Fetching NFTs across all collections, sortBy: ${sortBy}`);

    // Fetch all collections from database
    const collections = await Collection.findAll({
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    logger.info(`Processing ${collections.length} collections for newest NFTs`);

    // Fetch NFTs from XRPL for all collections
    const allNFTs = [];

    for (const collection of collections) {
      try {
        const taxon = collection.taxon;
        const creatorWallet = collection.creatorWalletAddress;

        // Fetch NFTs from XRPL for this collection
        const accountNFTs = await xrplService.getAccountNFTs(creatorWallet);
        const collectionNFTs = accountNFTs.filter(nft => {
          const nftTaxon = nft.NFTokenTaxon || 0;
          return nftTaxon === taxon;
        });

        // Get NFTs with sell offers (listed NFTs)
        for (const nft of collectionNFTs) {
          try {
            const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);

            if (sellOffers && sellOffers.length > 0) {
              // NFT is listed for sale
              const lowestOffer = sellOffers.reduce((min, offer) =>
                parseInt(offer.amount) < parseInt(min.amount) ? offer : min
              , sellOffers[0]);

              // Fetch metadata
              let metadata = null;
              let imageUrl = null;
              let nftName = null;

              try {
                metadata = await xrplService.fetchNFTMetadata(nft.URI);
                if (metadata) {
                  nftName = metadata.name || null;
                  imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;
                }
              } catch (err) {
                logger.warn(`Could not fetch metadata for NFT ${nft.NFTokenID}`);
              }

              allNFTs.push({
                nftTokenId: nft.NFTokenID,
                name: nftName,
                image: imageUrl,
                description: metadata?.description || null,
                price: lowestOffer.amount,
                owner: lowestOffer.owner,
                listedDate: lowestOffer.createdAt || new Date().toISOString(),
                collection: {
                  id: collection.id,
                  name: collection.name,
                  slug: collection.slug,
                  image: collection.image,
                  taxon: collection.taxon,
                  creator: {
                    walletAddress: collection.creator?.walletAddress || collection.creatorWalletAddress,
                    username: collection.creator?.username || collection.creatorWalletAddress,
                    profileImage: collection.creator?.profileImage || null,
                    isVerified: collection.creator?.isVerified || false
                  }
                },
                uri: nft.URI
              });
            }
          } catch (err) {
            // Skip NFTs we can't get offers for
          }
        }
      } catch (error) {
        logger.error(`Error fetching NFTs from collection ${collection.name}:`, error.message);
      }
    }

    // Always apply boost scoring (boost is primary sort)
    let sortedNFTs = allNFTs;

    if (allNFTs.length > 0) {
      const db = require('../models');
      const boostEngine = initBoostEngine(db);

      // Calculate boost for each NFT based on collection creator
      sortedNFTs = await Promise.all(
        allNFTs.map(async (nft) => {
          const creatorWallet = nft.collection.creator?.walletAddress;
          if (creatorWallet) {
            const boost = await boostEngine.calculateBoostScore({
              walletAddress: creatorWallet,
              createdAt: nft.listedDate,
              likesCount: 0,
              commentsCount: 0
            });
            return {
              ...nft,
              boostScore: boost.score,
              boostDetails: boost.components
            };
          }
          return { ...nft, boostScore: 1.0, boostDetails: null };
        })
      );

      // Sort by boost score (primary), then by secondary sort
      sortedNFTs.sort((a, b) => {
        // Primary sort: boost score (descending)
        const boostDiff = (b.boostScore || 0) - (a.boostScore || 0);
        if (Math.abs(boostDiff) > 0.01) return boostDiff;

        // Secondary sort based on sortBy parameter
        if (sortBy === 'price_low') {
          return parseInt(a.price) - parseInt(b.price);
        } else if (sortBy === 'price_high') {
          return parseInt(b.price) - parseInt(a.price);
        }
        // Default: recent (by listedDate)
        return new Date(b.listedDate) - new Date(a.listedDate);
      });
    }

    // Limit results
    const limitedNFTs = sortedNFTs.slice(0, parseInt(limit));

    logger.info(`Found ${allNFTs.length} listed NFTs, returning ${limitedNFTs.length}`);

    res.status(200).json(
      new ApiResponse(200, {
        nfts: limitedNFTs,
        total: allNFTs.length,
        limit: parseInt(limit),
        sorting: {
          primary: 'boost',
          secondary: sortBy
        }
      }, 'NFTs retrieved successfully')
    );

  } catch (error) {
    logger.error('Error fetching newest NFTs:', error);
    next(error);
  }
};

/**
 * Get top sellers (users with most collections and highest volume)
 * Fetches users from database who have listed most collections
 */
const getTopSellers = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    logger.info('Fetching top sellers using boost rankings');

    // Get all collections grouped by creator
    const collections = await Collection.findAll({
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    // Group collections by creator wallet
    const sellerStats = {};

    collections.forEach(collection => {
      const wallet = collection.creatorWalletAddress;

      if (!sellerStats[wallet]) {
        sellerStats[wallet] = {
          walletAddress: wallet,
          username: collection.creator?.username || wallet,
          profileImage: collection.creator?.profileImage || null,
          isVerified: collection.creator?.isVerified || false,
          collectionsCount: 0,
          totalVolume: 0,
          // Track the earliest collection creation date for recency calculation
          earliestCreatedAt: collection.createdAt
        };
      }

      sellerStats[wallet].collectionsCount++;
      sellerStats[wallet].totalVolume += parseInt(collection.totalVolume || 0);

      // Keep track of the most recent collection for boost calculation
      if (new Date(collection.createdAt) > new Date(sellerStats[wallet].earliestCreatedAt)) {
        sellerStats[wallet].earliestCreatedAt = collection.createdAt;
      }
    });

    // Initialize boost engine and calculate boost scores for each creator
    const db = require('../models');
    const boostEngine = initBoostEngine(db);

    // Prepare items for batch boost calculation
    const creatorsArray = Object.values(sellerStats).map(seller => ({
      walletAddress: seller.walletAddress,
      createdAt: seller.earliestCreatedAt,
      // Use total volume as a proxy for engagement (views)
      viewsCount: seller.totalVolume / 1000000,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      originalData: seller
    }));

    // Calculate boost scores for all creators
    const boostedCreators = await boostEngine.calculateBatchBoostScores(creatorsArray);

    // Sort by boost score (descending) and take top N
    const sortedSellers = boostedCreators
      .sort((a, b) => (b.boostScore || 0) - (a.boostScore || 0))
      .slice(0, parseInt(limit))
      .map(item => ({
        walletAddress: item.originalData.walletAddress,
        username: item.originalData.username,
        profileImage: item.originalData.profileImage,
        isVerified: item.originalData.isVerified,
        collectionsCount: item.originalData.collectionsCount,
        totalVolume: item.originalData.totalVolume.toString(),
        boostScore: item.boostScore,
        boostDetails: item.boostDetails
      }));

    logger.info(`Found ${sortedSellers.length} top sellers ranked by boost score`);

    res.status(200).json(
      new ApiResponse(200, {
        sellers: sortedSellers,
        total: sortedSellers.length
      }, 'Top sellers retrieved successfully')
    );

  } catch (error) {
    logger.error('Error fetching top sellers:', error);
    next(error);
  }
};

/**
 * Get popular collections by minted count
 * Returns top 6 collections with most NFTs minted
 */
const getPopularCollections = async (req, res, next) => {
  try {
    logger.info('Fetching popular collections');

    // Get all collections
    const collections = await Collection.findAll({
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    logger.info(`Processing ${collections.length} collections for popularity`);

    // Process each collection to get minted count
    const collectionsWithStats = [];

    for (const collection of collections) {
      try {
        const taxon = collection.taxon;
        const creatorWallet = collection.creatorWalletAddress;

        // Fetch NFTs from XRPL to get total minted count
        const accountNFTs = await xrplService.getAccountNFTs(creatorWallet);
        const collectionNFTs = accountNFTs.filter(nft => {
          const nftTaxon = nft.NFTokenTaxon || 0;
          return nftTaxon === taxon;
        });

        const mintedCount = collectionNFTs.length;

        // Get recent 4 minted NFTs
        const recentNFTs = [];
        const nftsToFetch = collectionNFTs.slice(0, 4);

        for (const nft of nftsToFetch) {
          try {
            const metadata = await xrplService.fetchNFTMetadata(nft.URI);
            let imageUrl = null;

            if (metadata) {
              imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;

              recentNFTs.push({
                nftTokenId: nft.NFTokenID,
                name: metadata.name || null,
                image: imageUrl,
                description: metadata.description || null
              });
            }
          } catch (err) {
            logger.warn(`Could not fetch metadata for NFT ${nft.NFTokenID}`);
          }
        }

        collectionsWithStats.push({
          category: collection.category,
          collection: {
            id: collection.id,
            name: collection.name,
            slug: collection.slug,
            image: collection.image,
            description: collection.description,
            taxon: collection.taxon,
            creator: collection.creator,
            isVerified: collection.isVerified,
            totalSupply: mintedCount,
            floorPrice: collection.floorPrice,
            totalVolume: collection.totalVolume
          },
          mintedCount: mintedCount,
          recentNFTs: recentNFTs
        });

      } catch (error) {
        logger.error(`Error processing collection ${collection.name}:`, error.message);
      }
    }

    // Sort by minted count and limit to 6
    const popularCollections = collectionsWithStats
      .sort((a, b) => b.mintedCount - a.mintedCount)
      .slice(0, 6);

    logger.info(`Returning ${popularCollections.length} popular collections`);

    res.status(200).json(
      new ApiResponse(200, {
        popularCollections: popularCollections,
        total: popularCollections.length
      }, 'Popular collections retrieved successfully')
    );

  } catch (error) {
    logger.error('Error fetching popular collections:', error);
    next(error);
  }
};

/**
 * Get collection history (mints, listings, offers, sales, burns)
 * Fetches all NFT activities for a specific collection from XRPL blockchain
 * @route GET /api/v1/collections/:taxon/history
 */
const getCollectionHistory = async (req, res, next) => {
  try {
    const { taxon } = req.params;
    const { wallet, limit = 100 } = req.query;

    if (!wallet) {
      throw new ApiError(400, 'Wallet address is required as query parameter (?wallet=...)');
    }

    const taxonNum = parseInt(taxon);
    if (isNaN(taxonNum)) {
      throw new ApiError(400, 'Invalid taxon. Must be a number.');
    }

    logger.info(`Fetching collection history for taxon: ${taxonNum}, wallet: ${wallet}`);

    // Fetch collection history from XRPL
    const history = await xrplService.getCollectionHistory(wallet, taxonNum, parseInt(limit));

    logger.info(`Found ${history.length} history entries for collection taxon ${taxonNum}`);

    // Get user information for all unique addresses in history
    const allAddresses = new Set();
    history.forEach(entry => {
      if (entry.issuer) allAddresses.add(entry.issuer);
      if (entry.offerer) allAddresses.add(entry.offerer);
      if (entry.seller) allAddresses.add(entry.seller);
      if (entry.buyer) allAddresses.add(entry.buyer);
      if (entry.burner) allAddresses.add(entry.burner);
      if (entry.owner) allAddresses.add(entry.owner);
    });

    const addressArray = Array.from(allAddresses);
    const [users, subscriptionMap] = await Promise.all([
      User.findAll({
        where: { walletAddress: addressArray },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }),
      getActiveSubscriptionsForWallets(addressArray)
    ]);

    const userMap = {};
    users.forEach(user => {
      userMap[user.walletAddress] = {
        walletAddress: user.walletAddress,
        username: user.username,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
      };
    });

    // Helper function to get user info with fallback for unknown wallets
    const getUserInfo = (walletAddress) => {
      if (!walletAddress) return null;
      return userMap[walletAddress] || {
        walletAddress: walletAddress,
        username: walletAddress,
        profileImage: null,
        isVerified: false,
        subscriptionPlan: subscriptionMap[walletAddress] || 'free'
      };
    };

    // Enrich history with user information
    const enrichedHistory = history.map(entry => {
      const enriched = { ...entry };

      if (entry.issuer) {
        enriched.issuerInfo = getUserInfo(entry.issuer);
      }
      if (entry.offerer) {
        enriched.offererInfo = getUserInfo(entry.offerer);
      }
      if (entry.seller) {
        enriched.sellerInfo = getUserInfo(entry.seller);
      }
      if (entry.buyer) {
        enriched.buyerInfo = getUserInfo(entry.buyer);
      }
      if (entry.burner) {
        enriched.burnerInfo = getUserInfo(entry.burner);
      }
      if (entry.owner) {
        enriched.ownerInfo = getUserInfo(entry.owner);
      }

      return enriched;
    });

    // Calculate summary statistics
    const summary = {
      totalMints: history.filter(e => e.type === 'mint').length,
      totalListings: history.filter(e => e.type === 'listing').length,
      totalOffers: history.filter(e => e.type === 'offer').length,
      totalSales: history.filter(e => e.type === 'sale').length,
      totalBurns: history.filter(e => e.type === 'burn').length,
      totalCancelled: history.filter(e => e.type === 'offer_cancelled').length
    };

    // Calculate total volume from sales
    const totalVolume = history
      .filter(e => e.type === 'sale')
      .reduce((sum, sale) => {
        const amount = typeof sale.amount === 'string' ? parseInt(sale.amount) : sale.amount;
        return sum + (amount || 0);
      }, 0);

    summary.totalVolume = totalVolume.toString();

    res.status(200).json(
      new ApiResponse(200, {
        taxon: taxonNum,
        wallet,
        history: enrichedHistory,
        summary,
        count: enrichedHistory.length
      }, 'Collection history retrieved successfully')
    );

  } catch (error) {
    logger.error('Error fetching collection history:', error);
    next(error);
  }
};

module.exports = {
  listCollection,
  getCollections,
  getCollection,
  updateCollection,
  updateCollectionStats,
  getUserCollections,
  getCollectionStats,
  searchCollectionsAndNFTs,
  getNewNFTs,
  getTopSellers,
  getPopularCollections,
  getCollectionHistory
};
