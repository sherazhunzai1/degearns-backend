const { Collection, User } = require('../models');
const xrplService = require('../services/xrplService');
const xrplConfig = require('../config/xrpl');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const crypto = require('crypto');

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

    if (!taxon) {
      throw new ApiError(400, 'Taxon is required to identify the collection on XRPL');
    }

    // Check if collection with this taxon already exists
    const existingCollection = await Collection.findOne({
      where: { taxon },
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    if (existingCollection) {
      logger.info(`Collection with taxon ${taxon} already listed, returning existing collection`);

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

    // Check each collection for at least one NFT for sale on XRPL
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

        // Check if at least one NFT has sell offers
        let hasListedNFT = false;
        for (const nft of collectionNFTs) {
          try {
            const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
            if (sellOffers && sellOffers.length > 0) {
              hasListedNFT = true;
              break; // Found at least one listed NFT, no need to check further
            }
          } catch (err) {
            // Continue checking other NFTs
          }
        }

        if (hasListedNFT) {
          // Collection has at least one NFT for sale, keep it
          validCollections.push(collection);
        } else {
          // No NFTs for sale, mark for deletion
          logger.info(`Collection ${collection.name} (taxon ${taxon}) has no NFTs for sale, marking for deletion`);
          collectionsToDelete.push(collection);
        }

      } catch (error) {
        logger.error(`Error checking collection ${collection.name} on XRPL:`, error.message);
        // On error, keep the collection to avoid accidental deletion
        validCollections.push(collection);
      }
    }

    // Delete collections without listed NFTs
    if (collectionsToDelete.length > 0) {
      const idsToDelete = collectionsToDelete.map(c => c.id);
      await Collection.destroy({ where: { id: idsToDelete } });
      logger.info(`Deleted ${collectionsToDelete.length} collections without listed NFTs`);
    }

    // Return collections with stats from database
    const collectionsWithStats = validCollections.map(collection => ({
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
          total: validCollections.length, // Use valid collections count
          pages: Math.ceil(validCollections.length / limit)
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

    // Fetch NFTs from XRPL blockchain
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

      // Extract collection metadata from XRPL NFT metadata (ONLY SOURCE)
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
            if (imageUrl && imageUrl.startsWith('ipfs://')) {
              imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }
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
            lowestPrice: hasOffers ? Math.min(...sellOffers.map(offer => parseInt(offer.Amount))).toString() : null,
            ownerAddress: hasOffers ? sellOffers[0].owner : nft.Issuer, // Owner from sell offer or issuer
            isOnSale: hasOffers
          });
        } catch (err) {
          // Include NFT even if we can't get offers
          logger.warn(`Could not fetch sell offers for NFT ${nft.NFTokenID}`);
          nftsWithOffers.push({
            nft,
            sellOffers: [],
            lowestPrice: null,
            ownerAddress: nft.Issuer,
            isOnSale: false
          });
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
      id: crypto.randomUUID(), // Generate fresh UUID for response
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
    const users = await User.findAll({
      where: { walletAddress: issuerAddresses },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    const userMap = {};
    users.forEach(user => {
      userMap[user.walletAddress] = {
        walletAddress: user.walletAddress,
        username: user.username,
        profileImage: user.profileImage,
        isVerified: user.isVerified
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
                const amount = parseInt(offer.Amount);
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
                let imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;
                if (imageUrl.startsWith('ipfs://')) {
                  imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
                }
                collectionImage = imageUrl;
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

        // Build collection object
        return {
          id: dbCollection ? dbCollection.id : crypto.randomUUID(),
          taxon: taxonNum,
          title: collectionTitle,
          image: collectionImage,
          floorPrice: floorPrice,
          items: totalItems,
          listedCount: listedCount,
          listedPercentage: listedPercentage,
          volume: dbCollection ? dbCollection.totalVolume : '0',
          creator: dbCollection ? dbCollection.creator : (userMap[issuer] || {
            walletAddress: issuer,
            username: issuer,
            profileImage: null,
            isVerified: false
          }),
          owner: userMap[walletAddress] || {
            walletAddress: walletAddress,
            username: walletAddress,
            profileImage: null,
            isVerified: false
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
 * Get statistics for all collections
 * Fetches collections from database and calculates stats from XRPL
 */
const getCollectionStats = async (req, res, next) => {
  try {
    logger.info('Fetching statistics for all collections');

    // Fetch all collections from database
    const collections = await Collection.findAll({
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (!collections || collections.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, [], 'No collections found')
      );
    }

    logger.info(`Processing stats for ${collections.length} collections`);

    // Process each collection to get stats from XRPL
    const collectionsWithStats = await Promise.all(
      collections.map(async (collection) => {
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

          // Get NFTs with sell offers and calculate stats
          let listedCount = 0;
          let floorPrice = null;
          const prices = [];
          const owners = new Set();

          for (const nft of collectionNFTs) {
            try {
              const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);

              if (sellOffers && sellOffers.length > 0) {
                listedCount++;
                const owner = sellOffers[0].owner;
                owners.add(owner);

                // Collect prices for floor price calculation
                sellOffers.forEach(offer => {
                  const amount = parseInt(offer.amount);
                  if (!isNaN(amount) && amount > 0) {
                    prices.push(amount);
                  }
                });
              } else {
                // NFT not listed, but still has an owner (the issuer or current holder)
                owners.add(nft.Issuer);
              }
            } catch (err) {
              // If we can't get offers, assume NFT is held by issuer
              owners.add(nft.Issuer);
            }
          }

          // Calculate floor price
          if (prices.length > 0) {
            floorPrice = Math.min(...prices).toString();
          }

          // Get transaction history for volume and sales count
          let totalVolume = '0';
          let totalSales = 0;
          let volumeChange = 0;

          try {
            // Get transaction history for the creator wallet
            const history = await xrplService.getNFTTransactionHistory(
              creatorWallet,
              null,
              100
            );

            // Filter transactions for this collection's NFTs
            const collectionNFTIds = new Set(collectionNFTs.map(nft => nft.NFTokenID));
            const collectionTransactions = history.filter(tx =>
              tx.type === 'NFTokenSale' && collectionNFTIds.has(tx.nftTokenId)
            );

            totalSales = collectionTransactions.length;

            // Calculate total volume
            const volume = collectionTransactions.reduce((sum, tx) => {
              const amount = typeof tx.amount === 'string'
                ? parseInt(tx.amount)
                : tx.amount;
              return sum + (amount || 0);
            }, 0);

            totalVolume = volume.toString();

            // Calculate volume change (last 30 days vs previous 30 days)
            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

            const recentVolume = collectionTransactions
              .filter(tx => new Date(tx.date).getTime() > thirtyDaysAgo)
              .reduce((sum, tx) => {
                const amount = typeof tx.amount === 'string' ? parseInt(tx.amount) : tx.amount;
                return sum + (amount || 0);
              }, 0);

            const previousVolume = collectionTransactions
              .filter(tx => {
                const txTime = new Date(tx.date).getTime();
                return txTime > sixtyDaysAgo && txTime <= thirtyDaysAgo;
              })
              .reduce((sum, tx) => {
                const amount = typeof tx.amount === 'string' ? parseInt(tx.amount) : tx.amount;
                return sum + (amount || 0);
              }, 0);

            // Calculate percentage change
            if (previousVolume > 0) {
              volumeChange = ((recentVolume - previousVolume) / previousVolume) * 100;
            } else if (recentVolume > 0) {
              volumeChange = 100; // 100% increase if previous was 0
            }

          } catch (err) {
            logger.warn(`Could not fetch transaction history for collection ${collection.name}:`, err.message);
          }

          return {
            id: collection.id,
            taxon: collection.taxon,
            name: collection.name,
            slug: collection.slug,
            image: collection.image,
            description: collection.description,
            creator: collection.creator,
            isVerified: collection.isVerified,
            stats: {
              totalSupply: totalSupply,
              volume: totalVolume,
              volumeChange: parseFloat(volumeChange.toFixed(2)),
              floorPrice: floorPrice,
              totalSales: totalSales,
              owners: owners.size,
              listed: listedCount
            }
          };

        } catch (error) {
          logger.error(`Error processing collection ${collection.name}:`, error.message);

          // Return collection with basic info if stats fail
          return {
            id: collection.id,
            taxon: collection.taxon,
            name: collection.name,
            slug: collection.slug,
            image: collection.image,
            description: collection.description,
            creator: collection.creator,
            isVerified: collection.isVerified,
            stats: {
              totalSupply: 0,
              volume: '0',
              volumeChange: 0,
              floorPrice: null,
              totalSales: 0,
              owners: 0,
              listed: 0
            }
          };
        }
      })
    );

    // Sort by volume (highest first)
    collectionsWithStats.sort((a, b) => {
      const volumeA = parseInt(a.stats.volume) || 0;
      const volumeB = parseInt(b.stats.volume) || 0;
      return volumeB - volumeA;
    });

    logger.info(`Successfully processed stats for ${collectionsWithStats.length} collections`);

    res.status(200).json(
      new ApiResponse(200, collectionsWithStats, 'Collection statistics retrieved successfully')
    );

  } catch (error) {
    logger.error('Error fetching collection statistics:', error);
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
  getCollectionStats
};
