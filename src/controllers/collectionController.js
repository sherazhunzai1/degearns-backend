const { Collection, User, UserWallet, DropMint, Drop, Follow, sequelize, Subscription, NftBoost, CollectionBoost, SolanaNftListing, AdminActivity } = require('../models');
const xrplService = require('../services/xrplService');
const xrplConfig = require('../config/xrpl');
const solanaService = require('../services/solanaService');
const chainServiceFactory = require('../services/chainServiceFactory');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { initBoostEngine } = require('../services/boostEngine');
const {
  getActiveSubscriptionsForWallets,
  enrichItemsWithSubscriptions,
  createUserInfoWithSubscription,
  resolvePrimaryWallet
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
 * If collection with same taxon AND creatorWalletAddress already exists, returns the existing collection
 * Same taxon with different creator is allowed (different wallets can have same taxon numbers)
 * This makes the endpoint idempotent - safe to call multiple times
 */
const listCollection = async (req, res, next) => {
  try {
    let { name, description, image, bannerImage, category, royaltyPercentage, socialLinks, taxon, creatorWalletAddress, network, mintAddress } = req.body;

    if (!creatorWalletAddress) {
      throw new ApiError(400, 'Creator wallet address is required');
    }

    creatorWalletAddress = await resolvePrimaryWallet(creatorWalletAddress);

    const resolvedNetwork = chainServiceFactory.normalizeNetwork(network);
    if (!chainServiceFactory.isSupportedNetwork(resolvedNetwork)) {
      throw new ApiError(400, `Unsupported network: ${network}`);
    }

    // --- Solana collection ---
    if (resolvedNetwork === 'solana') {
      if (!mintAddress) {
        throw new ApiError(400, 'mintAddress is required for Solana collections');
      }
      if (!solanaService.isValidAddress(mintAddress)) {
        throw new ApiError(400, 'Invalid Solana mint address');
      }

      // Fetch on-chain metadata if fields are empty
      if (!name || !image) {
        try {
          const asset = await solanaService.getAsset(mintAddress);
          if (asset) {
            if (!name) name = asset.content?.metadata?.name || mintAddress.slice(0, 12);
            if (!description) description = asset.content?.metadata?.description || null;
            if (!image) image = asset.content?.links?.image || asset.content?.files?.[0]?.uri || null;
            if (!royaltyPercentage && asset.royalty?.basis_points) {
              royaltyPercentage = asset.royalty.basis_points / 100;
            }
          }
        } catch (e) {
          logger.warn(`Could not fetch DAS metadata for collection ${mintAddress}: ${e.message}`);
        }
      }

      // Ensure name has a value
      if (!name) name = mintAddress.slice(0, 12);

      // Check if collection already registered
      const existingCollection = await Collection.findOne({
        where: { mintAddress, network: 'solana' },
        include: [{
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }]
      });

      if (existingCollection) {
        return res.status(200).json(
          new ApiResponse(200, existingCollection, 'Collection already listed')
        );
      }

      // Generate unique slug
      let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      let slug = baseSlug;
      let slugSuffix = 0;
      while (true) {
        const existingSlug = await Collection.findOne({ where: { slug } });
        if (!existingSlug) break;
        slugSuffix++;
        slug = `${baseSlug}-${creatorWalletAddress.substring(0, 6).toLowerCase()}${slugSuffix > 1 ? '-' + slugSuffix : ''}`;
      }

      const collection = await Collection.create({
        name,
        slug,
        description,
        image,
        bannerImage,
        creatorWalletAddress,
        network: 'solana',
        mintAddress,
        taxon: null,
        category: category || 'other',
        royaltyPercentage: royaltyPercentage || 0,
        socialLinks
      });

      logger.info(`Solana collection listed: ${collection.name} (mint: ${mintAddress}) by ${creatorWalletAddress}`);
      return res.status(201).json(
        new ApiResponse(201, collection, 'Collection listed successfully')
      );
    }

    // --- XRPL collection (existing logic) ---

    // Check if taxon is provided (0 is a valid taxon value for the first collection)
    if (taxon === undefined || taxon === null) {
      throw new ApiError(400, 'Taxon is required to identify the collection on XRPL');
    }

    const taxonNum = parseInt(taxon);
    if (isNaN(taxonNum) || taxonNum < 0) {
      throw new ApiError(400, 'Taxon must be a valid non-negative number');
    }

    // Check if collection with this taxon AND creatorWalletAddress already exists
    // Same taxon with different creator is allowed (each wallet has its own taxon sequence)
    const existingCollection = await Collection.findOne({
      where: {
        taxon: taxonNum,
        creatorWalletAddress: creatorWalletAddress
      },
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    if (existingCollection) {
      logger.info(`Collection with taxon ${taxonNum} by ${creatorWalletAddress} already listed, returning existing collection`);

      // Return existing collection with 200 status
      return res.status(200).json(
        new ApiResponse(200, existingCollection, 'Collection already listed')
      );
    }

    // Generate unique slug from name
    let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let slugSuffix = 0;

    // Keep checking until we find a unique slug
    while (true) {
      const existingSlug = await Collection.findOne({ where: { slug } });
      if (!existingSlug) break;

      slugSuffix++;
      // Append wallet prefix and counter to make slug unique
      slug = `${baseSlug}-${creatorWalletAddress.substring(0, 6).toLowerCase()}${slugSuffix > 1 ? '-' + slugSuffix : ''}`;
    }

    // Create new collection
    const collection = await Collection.create({
      name,
      slug,
      description,
      image,
      bannerImage,
      creatorWalletAddress,
      network: 'xrpl',
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
    // Log more details about the error
    logger.error('Error creating collection:', {
      message: error.message,
      name: error.name,
      errors: error.errors?.map(e => ({ message: e.message, path: e.path, value: e.value }))
    });
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
      search,
      network
    } = req.query;

    const where = {};

    if (network) where.network = network;
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

    // Split collections by network
    const xrplCollections = collections.filter(c => c.network !== 'solana');
    const solanaCollections = collections.filter(c => c.network === 'solana');

    // --- Calculate stats for XRPL collections ---
    const xrplWithStats = [];
    for (const collection of xrplCollections) {
      try {
        const taxon = collection.taxon;
        const creatorWallet = collection.creatorWalletAddress;

        const accountNFTs = await xrplService.getAccountNFTs(creatorWallet);
        const collectionNFTs = accountNFTs.filter(nft => (nft.NFTokenTaxon || 0) === taxon);

        const totalSupply = collectionNFTs.length;
        let listedCount = 0;
        const prices = [];

        for (const nft of collectionNFTs) {
          try {
            const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
            if (sellOffers && sellOffers.length > 0) {
              listedCount++;
              sellOffers.forEach(offer => {
                const amount = parseInt(offer.amount);
                if (!isNaN(amount) && amount > 0) prices.push(amount);
              });
            }
          } catch (err) {}
        }

        const floorPrice = prices.length > 0 ? Math.min(...prices).toString() : null;
        const listingPercentage = totalSupply > 0 ? ((listedCount / totalSupply) * 100).toFixed(2) : '0.00';

        collection.totalSupply = totalSupply;
        collection.floorPrice = floorPrice;
        await collection.save();

        xrplWithStats.push({
          collection,
          stats: { totalSupply, floorPrice, floorPriceFormatted: floorPrice ? (parseInt(floorPrice) / 1000000).toFixed(6) + ' XRP' : null, totalVolume: collection.totalVolume || '0', listedCount, listingPercentage, currency: 'XRP' }
        });
      } catch (error) {
        logger.error(`Error checking collection ${collection.name} on XRPL:`, error.message);
        xrplWithStats.push({
          collection,
          stats: { totalSupply: collection.totalSupply || 0, floorPrice: collection.floorPrice, floorPriceFormatted: null, totalVolume: collection.totalVolume || '0', listedCount: 0, listingPercentage: '0.00', currency: 'XRP' }
        });
      }
    }

    // --- Calculate stats for Solana collections from SolanaNftListing table ---
    const solanaWithStats = [];
    for (const collection of solanaCollections) {
      try {
        const mintAddr = collection.mintAddress;

        const [activeListings, soldListings] = await Promise.all([
          SolanaNftListing.findAll({ where: { collectionMintAddress: mintAddr, status: 'active' }, attributes: ['price'], raw: true }),
          SolanaNftListing.findAll({ where: { collectionMintAddress: mintAddr, status: 'sold' }, attributes: ['price'], raw: true })
        ]);

        const listedCount = activeListings.length;
        const activePrices = activeListings.map(l => BigInt(l.price)).filter(p => p > 0n);
        const floorPrice = activePrices.length > 0 ? activePrices.reduce((min, p) => p < min ? p : min).toString() : null;
        const totalVolume = soldListings.reduce((sum, l) => sum + BigInt(l.price), 0n).toString();

        // Try to get total supply from DAS
        let totalSupply = collection.totalSupply || 0;
        if (mintAddr) {
          try {
            const dasResult = await solanaService.getAssetsByCollection(mintAddr, 1, 1);
            totalSupply = dasResult.total || totalSupply;
          } catch (e) {}
        }

        collection.totalSupply = totalSupply;
        collection.floorPrice = floorPrice;
        collection.totalVolume = totalVolume;
        await collection.save();

        solanaWithStats.push({
          collection,
          stats: { totalSupply, floorPrice, floorPriceFormatted: floorPrice ? (Number(BigInt(floorPrice)) / 1e9).toFixed(4) + ' SOL' : null, totalVolume, listedCount, listingPercentage: totalSupply > 0 ? ((listedCount / totalSupply) * 100).toFixed(2) : '0.00', currency: 'SOL' }
        });
      } catch (error) {
        logger.error(`Error checking Solana collection ${collection.name}:`, error.message);
        solanaWithStats.push({
          collection,
          stats: { totalSupply: collection.totalSupply || 0, floorPrice: collection.floorPrice, floorPriceFormatted: null, totalVolume: collection.totalVolume || '0', listedCount: 0, listingPercentage: '0.00', currency: 'SOL' }
        });
      }
    }

    // Merge all collections with uniform format
    const collectionsWithStats = [...xrplWithStats, ...solanaWithStats];

    let formattedCollections = collectionsWithStats.map(item => ({
      ...item.collection.toJSON(),
      stats: item.stats
    }));

    // Fetch active boosted collections from CollectionBoosts table
    const regularCollectionIds = new Set(formattedCollections.map(c => c.id));

    const activeBoosts = await CollectionBoost.findAll({
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [['boostPercentage', 'DESC'], ['createdAt', 'DESC']]
    });

    // Build a map of collectionId -> highest active boost
    const boostMap = {};
    for (const boost of activeBoosts) {
      if (!boostMap[boost.collectionId] || boost.boostPercentage > boostMap[boost.collectionId].boostPercentage) {
        boostMap[boost.collectionId] = boost;
      }
    }

    // Build boosted collections from metadata (no extra DB query needed)
    let boostedFormattedCollections = [];

    for (const [collectionId, boost] of Object.entries(boostMap)) {
      // Skip if already in regular results
      if (regularCollectionIds.has(collectionId)) continue;

      const metadata = boost.metadata || {};
      boostedFormattedCollections.push({
        id: metadata.id || collectionId,
        name: metadata.name || null,
        slug: metadata.slug || null,
        description: metadata.description || null,
        image: metadata.image || null,
        bannerImage: metadata.bannerImage || null,
        taxon: metadata.taxon || null,
        category: metadata.category || null,
        creatorWalletAddress: metadata.creatorWalletAddress || null,
        isVerified: metadata.isVerified || false,
        creator: metadata.creator || null,
        isBoosted: true,
        boostInfo: {
          boostPercentage: boost.boostPercentage,
          endDate: boost.endDate,
          remainingDays: boost.getRemainingDays()
        },
        stats: {
          totalSupply: metadata.totalSupply || 0,
          floorPrice: metadata.floorPrice || null,
          totalVolume: metadata.totalVolume || '0',
          listedCount: 0,
          listingPercentage: '0.00'
        }
      });
    }

    // Sort boosted collections by boost percentage (highest first)
    boostedFormattedCollections.sort((a, b) =>
      (b.boostInfo.boostPercentage || 0) - (a.boostInfo.boostPercentage || 0)
    );

    // Increment impressions for displayed boosts (async, non-blocking)
    if (boostedFormattedCollections.length > 0) {
      const displayedBoostIds = boostedFormattedCollections
        .map(c => boostMap[c.id]?.id)
        .filter(Boolean);

      if (displayedBoostIds.length > 0) {
        CollectionBoost.increment('impressions', {
          where: { id: { [Op.in]: displayedBoostIds } }
        }).catch(err => {
          logger.error('Error incrementing collection boost impressions:', err);
        });
      }
    }

    // Also mark regular collections that have active boosts
    formattedCollections = formattedCollections.map(c => {
      const boost = boostMap[c.id];
      if (boost) {
        return {
          ...c,
          isBoosted: true,
          boostInfo: {
            boostPercentage: boost.boostPercentage,
            endDate: boost.endDate,
            remainingDays: boost.getRemainingDays()
          }
        };
      }
      return { ...c, isBoosted: false };
    });

    // Always apply boost scoring (boost is primary sort)
    if (formattedCollections.length > 0) {
      const db = require('../models');
      const boostEngine = initBoostEngine(db);
      const boostedResults = await boostEngine.boostCollections(
        formattedCollections.map(c => ({
          ...c,
          creatorWalletAddress: c.creatorWalletAddress
        }))
      );

      // Sort by boost score (primary), then by secondary sort
      boostedResults.sort((a, b) => {
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

      formattedCollections = boostedResults;
    }

    // Merge: boosted collections first, then regular results
    let allCollections = [...boostedFormattedCollections, ...formattedCollections];

    // Add subscription plans to creator data
    const creatorWallets = allCollections
      .map(c => c.creator?.walletAddress)
      .filter(Boolean);
    const subscriptionMap = await getActiveSubscriptionsForWallets(creatorWallets);

    allCollections = allCollections.map(collection => ({
      ...collection,
      creator: collection.creator ? {
        ...collection.creator,
        subscriptionPlan: subscriptionMap[collection.creator.walletAddress] || 'free'
      } : null
    }));

    res.status(200).json(
      new ApiResponse(200, {
        collections: allCollections,
        boostedCount: boostedFormattedCollections.length,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count + boostedFormattedCollections.length,
          pages: Math.ceil((count + boostedFormattedCollections.length) / limit)
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

      // Fetch active NFT boosts to check which NFTs are boosted
      const nftTokenIds = nftsWithOffers.map(item => item.nft.NFTokenID);
      const activeNftBoosts = await NftBoost.findAll({
        where: {
          nftTokenId: { [Op.in]: nftTokenIds },
          isActive: true,
          endDate: { [Op.gt]: new Date() }
        }
      });
      const boostedNftIds = new Set(activeNftBoosts.map(b => b.nftTokenId));
      logger.info(`Found ${boostedNftIds.size} boosted NFTs in this collection`);

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

      // Enrich all NFTs with owner, issuer information, metadata, and boost status
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
        isOnSale: item.isOnSale,
        isBoosted: boostedNftIds.has(item.nft.NFTokenID)
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
/**
 * Helper: fetch XRPL collections for a wallet address.
 * Returns an array of collection objects.
 */
const fetchXrplCollections = async (walletAddress) => {
  const accountNFTs = await xrplService.getAccountNFTs(walletAddress);
  if (!accountNFTs || accountNFTs.length === 0) return [];

  // Group NFTs by taxon
  const nftsByTaxon = {};
  accountNFTs.forEach(nft => {
    const taxon = nft.NFTokenTaxon || 0;
    if (!nftsByTaxon[taxon]) nftsByTaxon[taxon] = [];
    nftsByTaxon[taxon].push(nft);
  });

  const taxons = Object.keys(nftsByTaxon).map(t => parseInt(t));
  const dbCollections = await Collection.findAll({
    where: { taxon: taxons },
    include: [{ association: 'creator', attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'] }]
  });
  const collectionMap = {};
  dbCollections.forEach(col => { collectionMap[col.taxon] = col; });

  const issuerAddresses = [...new Set(accountNFTs.map(nft => nft.Issuer))];
  const allUserAddresses = [...new Set([...issuerAddresses, walletAddress])];
  const [users, subscriptionMap] = await Promise.all([
    User.findAll({ where: { walletAddress: allUserAddresses }, attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'] }),
    getActiveSubscriptionsForWallets(allUserAddresses)
  ]);
  const userMap = {};
  users.forEach(u => { userMap[u.walletAddress] = { ...u.toJSON(), subscriptionPlan: subscriptionMap[u.walletAddress] || 'free' }; });

  const activeBoosts = await CollectionBoost.findAll({
    where: { userWalletAddress: walletAddress, isActive: true, endDate: { [Op.gt]: new Date() } }
  });
  const boostedCollectionIds = new Set(activeBoosts.map(b => b.collectionId));
  const boostedTaxons = new Set();
  activeBoosts.forEach(b => { if (b.metadata?.taxon !== undefined) boostedTaxons.add(parseInt(b.metadata.taxon)); });

  const collections = await Promise.all(
    Object.entries(nftsByTaxon).map(async ([taxon, nfts]) => {
      const taxonNum = parseInt(taxon);
      const dbCollection = collectionMap[taxonNum];
      const firstNFT = nfts[0];
      const issuer = firstNFT.Issuer;

      let listedCount = 0;
      const prices = [];
      for (const nft of nfts) {
        try {
          const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
          if (sellOffers && sellOffers.length > 0) {
            listedCount++;
            sellOffers.forEach(offer => {
              const amount = parseInt(offer.amount || offer.Amount);
              if (!isNaN(amount) && amount > 0) prices.push(amount);
            });
          }
        } catch (err) {
          logger.warn(`Could not fetch sell offers for NFT ${nft.NFTokenID}`);
        }
      }

      const totalItems = nfts.length;
      const floorPrice = prices.length > 0 ? Math.min(...prices).toString() : null;
      const listedPercentage = totalItems > 0 ? ((listedCount / totalItems) * 100).toFixed(2) : '0';

      let collectionImage = dbCollection ? dbCollection.image : null;
      let collectionTitle = dbCollection ? dbCollection.name : null;
      if (!dbCollection && nfts.length > 0) {
        try {
          const metadata = await xrplService.fetchNFTMetadata(firstNFT.URI);
          if (metadata) {
            if (metadata.collection) {
              collectionTitle = typeof metadata.collection === 'string' ? metadata.collection : metadata.collection.name || metadata.collection.family || null;
            }
            if (!collectionTitle && metadata.name) collectionTitle = metadata.name;
            if (metadata.image || metadata.image_url || metadata.imageUrl) collectionImage = metadata.image || metadata.image_url || metadata.imageUrl;
          }
        } catch (err) {
          logger.warn(`Could not fetch metadata for collection taxon ${taxonNum}`);
        }
      }
      if (!collectionTitle) collectionTitle = `Collection #${taxonNum}`;

      let creatorData;
      if (dbCollection && dbCollection.creator) {
        creatorData = { ...dbCollection.creator.toJSON(), subscriptionPlan: subscriptionMap[dbCollection.creator.walletAddress] || 'free' };
      } else {
        creatorData = userMap[issuer] || { walletAddress: issuer, username: issuer, profileImage: null, isVerified: false, subscriptionPlan: subscriptionMap[issuer] || 'free' };
      }

      return {
        id: dbCollection ? dbCollection.id : crypto.randomUUID(),
        network: 'xrpl',
        walletAddress,
        taxon: taxonNum,
        title: collectionTitle,
        image: convertToIpfsHash(collectionImage),
        floorPrice,
        items: totalItems,
        listedCount,
        listedPercentage,
        volume: dbCollection ? dbCollection.totalVolume : '0',
        creator: creatorData,
        owner: userMap[walletAddress] || { walletAddress, username: walletAddress, profileImage: null, isVerified: false, subscriptionPlan: subscriptionMap[walletAddress] || 'free' },
        collectionId: dbCollection ? dbCollection.id : null,
        slug: dbCollection ? dbCollection.slug : null,
        description: dbCollection ? dbCollection.description : null,
        category: dbCollection ? dbCollection.category : null,
        isVerified: dbCollection ? dbCollection.isVerified : false,
        isRegistered: !!dbCollection,
        isBoosted: boostedTaxons.has(taxonNum) || (dbCollection && boostedCollectionIds.has(dbCollection.id))
      };
    })
  );

  return collections.filter(c => c.isRegistered || c.image);
};

/**
 * Helper: fetch Solana collections for a wallet address.
 * Returns an array of collection objects.
 */
const fetchSolanaCollections = async (walletAddress) => {
  const result = await solanaService.getAssetsByOwner(walletAddress, 1, 1000);
  const items = result.items || [];
  if (items.length === 0) return [];

  // Group NFTs by collection
  const groupMap = {};
  items.forEach(item => {
    const cg = item.grouping?.find(g => g.group_key === 'collection');
    const mint = cg?.group_value || null;
    if (!groupMap[mint]) groupMap[mint] = [];
    groupMap[mint].push({
      mintAddress: item.id,
      name: item.content?.metadata?.name || null,
      description: item.content?.metadata?.description || null,
      image: item.content?.links?.image || item.content?.files?.[0]?.uri || null
    });
  });

  // Fetch metadata for grouped collections
  const collectionMints = Object.keys(groupMap).filter(m => m !== 'null' && m !== null);
  const collectionAssets = await Promise.all(
    collectionMints.map(mint => solanaService.getAsset(mint).catch(() => null))
  );

  const collections = collectionMints.map((mint, i) => {
    const asset = collectionAssets[i];
    const nfts = groupMap[mint];
    const firstNft = nfts[0];
    return {
      id: mint,
      network: 'solana',
      walletAddress,
      collectionMintAddress: mint,
      title: asset?.content?.metadata?.name || firstNft.name || null,
      description: asset?.content?.metadata?.description || firstNft.description || null,
      image: asset?.content?.links?.image || asset?.content?.files?.[0]?.uri || firstNft.image || null,
      items: nfts.length,
      nfts,
      royalty: asset?.royalty || null
    };
  });

  // Standalone NFTs (no collection) — each becomes its own entry
  const standalone = groupMap[null] || groupMap['null'] || [];
  standalone.forEach(nft => {
    collections.push({
      id: nft.mintAddress,
      network: 'solana',
      walletAddress,
      collectionMintAddress: null,
      title: nft.name,
      description: nft.description,
      image: nft.image,
      items: 1,
      nfts: [nft],
      royalty: null
    });
  });

  return collections;
};

/**
 * Get collections for a user profile.
 * Looks up the wallet in Users + UserWallets to find all linked wallets,
 * then fetches collections from the appropriate blockchain for each wallet.
 */
const getUserCollections = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Find the user by primary wallet or linked wallet
    let user = await User.findOne({ where: { walletAddress } });
    if (!user) {
      const linked = await UserWallet.findOne({ where: { walletAddress } });
      if (linked) user = await User.findByPk(linked.userId);
    }

    // Gather all wallets to query
    let walletsToQuery = [];

    if (user) {
      // Get all linked wallets for this user
      const allWallets = await UserWallet.findAll({
        where: { userId: user.id },
        order: [['isPrimary', 'DESC']]
      });

      if (allWallets.length > 0) {
        walletsToQuery = allWallets.map(w => ({ address: w.walletAddress, network: w.network }));
      } else {
        // Fallback: only the primary wallet from Users table
        walletsToQuery = [{ address: user.walletAddress, network: user.network }];
      }
    } else {
      // User not in DB — determine network from address format and query just this wallet
      const network = solanaService.isValidAddress(walletAddress) ? 'solana' : 'xrpl';
      walletsToQuery = [{ address: walletAddress, network }];
    }

    logger.info(`Fetching collections for ${walletsToQuery.length} wallet(s): ${walletsToQuery.map(w => `${w.address.slice(0, 8)}...(${w.network})`).join(', ')}`);

    // Fetch collections from each network in parallel
    const xrplWallets = walletsToQuery.filter(w => w.network === 'xrpl');
    const solanaWallets = walletsToQuery.filter(w => w.network === 'solana');

    const [xrplResults, solanaResults] = await Promise.all([
      Promise.all(xrplWallets.map(w => fetchXrplCollections(w.address).catch(err => {
        logger.error(`Error fetching XRPL collections for ${w.address}:`, err.message);
        return [];
      }))),
      Promise.all(solanaWallets.map(w => fetchSolanaCollections(w.address).catch(err => {
        logger.error(`Error fetching Solana collections for ${w.address}:`, err.message);
        return [];
      })))
    ]);

    const allCollections = [
      ...xrplResults.flat(),
      ...solanaResults.flat()
    ];

    // Sort: registered first, then by item count
    allCollections.sort((a, b) => {
      if (a.isRegistered && !b.isRegistered) return -1;
      if (!a.isRegistered && b.isRegistered) return 1;
      return b.items - a.items;
    });

    res.status(200).json(
      new ApiResponse(200, {
        wallets: walletsToQuery,
        totalCollections: allCollections.length,
        collections: allCollections
      }, 'Collections retrieved successfully')
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

    logger.info(`Fetching boosted NFTs from NftBoosts table, sortBy: ${sortBy}`);

    // Fetch active boosts from NftBoosts table (only where endDate not crossed)
    const activeBoosts = await NftBoost.findAll({
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() } // Only fetch boosts whose endDate has not passed
      },
      order: [['boostPercentage', 'DESC'], ['createdAt', 'DESC']] // Higher boost percentage = more visibility (sorted first)
    });

    logger.info(`Found ${activeBoosts.length} active NFT boosts`);

    // Collect all user wallet addresses for batch lookup
    const rawAddresses = [...new Set(activeBoosts.map(b => b.userWalletAddress))];

    // Resolve linked wallets to primary wallets
    const resolvedAddressMap = {};
    for (const addr of rawAddresses) {
      resolvedAddressMap[addr] = await resolvePrimaryWallet(addr);
    }

    const primaryAddresses = [...new Set(Object.values(resolvedAddressMap))];

    // Fetch user info for all primary wallet addresses
    let userMap = {};
    let subscriptionMap = {};

    if (primaryAddresses.length > 0) {
      const users = await User.findAll({
        where: { walletAddress: { [Op.in]: primaryAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });
      users.forEach(u => { userMap[u.walletAddress] = u; });

      // Also map linked addresses to their primary user
      for (const [linked, primary] of Object.entries(resolvedAddressMap)) {
        if (userMap[primary]) userMap[linked] = userMap[primary];
      }

      subscriptionMap = await getActiveSubscriptionsForWallets(primaryAddresses);
      // Map subscription for linked addresses too
      for (const [linked, primary] of Object.entries(resolvedAddressMap)) {
        if (subscriptionMap[primary]) subscriptionMap[linked] = subscriptionMap[primary];
      }
    }

    // Fetch NFT details from XRPL for each boosted NFT
    const allNFTs = [];

    for (const boost of activeBoosts) {
      try {
        const nftTokenId = boost.nftTokenId;
        const metadata = boost.metadata || {};

        // Initialize NFT data variables
        let nftData = null;
        let sellOffers = [];
        let nftUri = metadata.uri || null;
        let nftTaxon = metadata.taxon || null;
        let nftIssuer = metadata.issuer || null;

        // Try to get NFT info from XRPL (nft_info command)
        try {
          nftData = await xrplService.getNFTInfo(nftTokenId);
          if (nftData) {
            nftUri = nftData.uri || nftUri;
            nftTaxon = nftData.nft_taxon || nftTaxon;
            nftIssuer = nftData.issuer || nftIssuer;
          }
        } catch (err) {
          logger.warn(`nft_info not available for ${nftTokenId}, trying getAccountNFTs`);
        }

        // Fallback: Try to find NFT in user's wallet using getAccountNFTs
        if (!nftUri && boost.userWalletAddress) {
          try {
            const walletNFTs = await xrplService.getAccountNFTs(boost.userWalletAddress);
            const foundNFT = walletNFTs.find(nft => nft.NFTokenID === nftTokenId);
            if (foundNFT) {
              nftUri = foundNFT.URI || nftUri;
              nftTaxon = foundNFT.NFTokenTaxon || nftTaxon;
              nftIssuer = foundNFT.Issuer || nftIssuer;
            }
          } catch (err) {
            logger.warn(`Could not fetch wallet NFTs for ${boost.userWalletAddress}`);
          }
        }

        // Get sell offers
        try {
          sellOffers = await xrplService.getNFTSellOffers(nftTokenId) || [];
        } catch (err) {
          // No sell offers or error
        }

        // Get lowest price if listed
        let price = null;
        let owner = boost.userWalletAddress;

        if (sellOffers.length > 0) {
          const lowestOffer = sellOffers.reduce((min, offer) =>
            parseInt(offer.amount) < parseInt(min.amount) ? offer : min
          , sellOffers[0]);
          price = lowestOffer.amount;
          owner = lowestOffer.owner;
        }

        // Fetch NFT metadata from URI if available
        let imageUrl = metadata.image || null;
        let nftName = metadata.name || null;
        let description = metadata.description || null;

        if (nftUri && !imageUrl) {
          try {
            const nftMetadata = await xrplService.fetchNFTMetadata(nftUri);
            if (nftMetadata) {
              nftName = nftName || nftMetadata.name || null;
              imageUrl = imageUrl || nftMetadata.image || nftMetadata.image_url || nftMetadata.imageUrl;
              description = description || nftMetadata.description || null;
            }
          } catch (err) {
            logger.warn(`Could not fetch metadata for NFT ${nftTokenId}`);
          }
        }

        // Get owner user info
        const ownerUser = userMap[boost.userWalletAddress];
        const ownerInfo = {
          walletAddress: boost.userWalletAddress,
          username: ownerUser?.username || boost.userWalletAddress,
          profileImage: convertToIpfsHash(ownerUser?.profileImage) || null,
          isVerified: ownerUser?.isVerified || false,
          subscriptionPlan: subscriptionMap[boost.userWalletAddress] || 'free'
        };

        allNFTs.push({
          // NFT Details
          nftTokenId,
          name: nftName,
          image: imageUrl,
          description,
          uri: nftUri,
          // Owner Details
          ownerWalletAddress: owner,
          owner: ownerInfo,
          // Listing Details
          price,
          isListed: price !== null,
          listedDate: boost.startDate.toISOString(),
          // Boost Details
          boostId: boost.id,
          boostPercentage: boost.boostPercentage,
          boostEndDate: boost.endDate,
          boostScore: boost.boostPercentage / 20, // Convert to score (1-5)
          boostDetails: {
            percentage: boost.boostPercentage,
            remainingDays: boost.getRemainingDays(),
            impressions: boost.impressions,
            clicks: boost.clicks
          }
        });
      } catch (error) {
        logger.error(`Error fetching NFT data for boost ${boost.id}:`, error.message);
      }
    }

    // Apply secondary sort if needed
    if (sortBy === 'price_low') {
      allNFTs.sort((a, b) => {
        if (!a.price && !b.price) return 0;
        if (!a.price) return 1;
        if (!b.price) return -1;
        return parseInt(a.price) - parseInt(b.price);
      });
    } else if (sortBy === 'price_high') {
      allNFTs.sort((a, b) => {
        if (!a.price && !b.price) return 0;
        if (!a.price) return 1;
        if (!b.price) return -1;
        return parseInt(b.price) - parseInt(a.price);
      });
    }
    // Default sort is already by boost (weighted shuffle)

    // Limit results
    const limitedNFTs = allNFTs.slice(0, parseInt(limit));

    // Increment impressions for returned boosts (async, non-blocking)
    if (limitedNFTs.length > 0) {
      const boostIds = limitedNFTs.map(n => n.boostId).filter(Boolean);
      NftBoost.increment('impressions', { where: { id: boostIds } }).catch(err => {
        logger.error('Error incrementing NFT boost impressions:', err);
      });
    }

    logger.info(`Found ${activeBoosts.length} boosted NFTs, returning ${limitedNFTs.length}`);

    res.status(200).json(
      new ApiResponse(200, {
        nfts: limitedNFTs,
        total: activeBoosts.length,
        limit: parseInt(limit),
        sorting: {
          primary: 'boost',
          secondary: sortBy
        }
      }, 'Boosted NFTs retrieved successfully')
    );

  } catch (error) {
    logger.error('Error fetching boosted NFTs:', error);
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
 * Get popular collections from CollectionBoosts table
 * Returns boosted collections sorted by boost percentage (higher = more visibility)
 * Maintains same response structure as original API
 */
const getPopularCollections = async (req, res, next) => {
  try {
    const { limit = 6 } = req.query;

    logger.info('Fetching popular collections from CollectionBoosts table');

    // Fetch active boosts from CollectionBoosts table (only where endDate not crossed)
    const activeBoosts = await CollectionBoost.findAll({
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [['boostPercentage', 'DESC'], ['createdAt', 'DESC']]
    });

    logger.info(`Found ${activeBoosts.length} active collection boosts`);

    // Process each boost to build response (same structure as before)
    const collectionsWithStats = [];

    for (const boost of activeBoosts) {
      try {
        const metadata = boost.metadata || {};

        // Get creator info from metadata
        let creatorInfo = metadata.creator || null;
        if (creatorInfo && creatorInfo.profileImage) {
          creatorInfo = {
            ...creatorInfo,
            profileImage: convertToIpfsHash(creatorInfo.profileImage)
          };
        }

        // Get mintedCount from metadata or default to totalSupply
        const mintedCount = metadata.totalSupply || 0;

        // Fetch up to 4 NFTs from the booster's wallet filtered by taxon
        let recentNFTs = [];
        const ownerWallet = boost.userWalletAddress; // The wallet that boosted (owns NFTs)
        const taxon = metadata.taxon;

        // Check taxon is not undefined/null (0 is a valid taxon)
        if (ownerWallet && taxon !== undefined && taxon !== null) {
          try {
            logger.info(`Fetching NFTs for wallet: ${ownerWallet}, taxon: ${taxon}`);

            // Get all NFTs owned by the wallet from XRPL
            const allNFTs = await xrplService.getAccountNFTs(ownerWallet);

            // Filter by NFTokenTaxon (same approach as collections/:taxon API)
            const collectionNFTs = allNFTs.filter(nft => {
              const nftTaxon = nft.NFTokenTaxon || 0;
              return nftTaxon === parseInt(taxon);
            });
            logger.info(`Found ${collectionNFTs.length} NFTs matching taxon ${taxon}`);

            // Take up to 4 NFTs
            const nftsToProcess = collectionNFTs.slice(0, 4);

            // Fetch metadata and sell offers for each NFT
            const nftPromises = nftsToProcess.map(async (nft) => {
              try {
                // Fetch NFT metadata
                let nftMetadata = null;
                try {
                  nftMetadata = await xrplService.fetchNFTMetadata(nft.URI);
                } catch (e) {
                  logger.warn(`Could not fetch metadata for NFT ${nft.NFTokenID}`);
                }

                // Get sell offers for listing price
                let price = null;
                let sellOfferIndex = null;
                try {
                  const sellOffers = await xrplService.getNFTSellOffers(nft.NFTokenID);
                  if (sellOffers && sellOffers.length > 0) {
                    // Get lowest sell offer
                    const lowestOffer = sellOffers.reduce((min, offer) => {
                      const amount = typeof offer.amount === 'string' ? parseInt(offer.amount) : offer.amount;
                      const minAmount = typeof min.amount === 'string' ? parseInt(min.amount) : min.amount;
                      return amount < minAmount ? offer : min;
                    }, sellOffers[0]);
                    const amountDrops = typeof lowestOffer.amount === 'string' ? parseInt(lowestOffer.amount) : lowestOffer.amount;
                    price = (amountDrops / 1000000).toFixed(6);
                    sellOfferIndex = lowestOffer.nft_offer_index;
                  }
                } catch (e) {
                  // No sell offers
                }

                // Get image URL
                let imageUrl = null;
                if (nftMetadata) {
                  imageUrl = nftMetadata.image || nftMetadata.image_url || nftMetadata.imageUrl;
                }

                return {
                  nftTokenId: nft.NFTokenID,
                  name: nftMetadata?.name || null,
                  image: imageUrl,
                  description: nftMetadata?.description || null,
                  uri: nft.URI ? xrplService.convertHexToString(nft.URI) : null,
                  price: price,
                  isListed: price !== null,
                  sellOfferIndex: sellOfferIndex
                };
              } catch (error) {
                logger.warn(`Error processing NFT ${nft.NFTokenID}:`, error.message);
                return null;
              }
            });

            const nftResults = await Promise.all(nftPromises);
            recentNFTs = nftResults.filter(nft => nft !== null);
          } catch (error) {
            logger.warn(`Could not fetch NFTs for collection ${boost.collectionId}:`, error.message);
          }
        }

        collectionsWithStats.push({
          category: metadata.category || 'other',
          collection: {
            id: metadata.id || boost.collectionId,
            name: metadata.name || null,
            slug: metadata.slug || null,
            image: metadata.image || null,
            description: metadata.description || null,
            taxon: metadata.taxon !== undefined && metadata.taxon !== null ? metadata.taxon : null,
            creator: creatorInfo,
            isVerified: metadata.isVerified || false,
            totalSupply: mintedCount,
            floorPrice: metadata.floorPrice || null,
            totalVolume: metadata.totalVolume || null
          },
          mintedCount: mintedCount,
          recentNFTs: recentNFTs
        });

      } catch (error) {
        logger.error(`Error processing collection boost ${boost.id}:`, error.message);
      }
    }

    // Limit results
    const popularCollections = collectionsWithStats.slice(0, parseInt(limit));

    // Increment impressions for returned boosts (async, non-blocking)
    if (popularCollections.length > 0) {
      const boostIds = activeBoosts.slice(0, parseInt(limit)).map(b => b.id);
      CollectionBoost.increment('impressions', { where: { id: boostIds } }).catch(err => {
        logger.error('Error incrementing collection boost impressions:', err);
      });
    }

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

/**
 * Delist (delete) a collection from the marketplace DB.
 *
 * Identify the collection by its on-chain identifier:
 *   - Solana: { mintAddress }
 *   - XRPL:   { taxon }  (optionally + ownerWalletAddress to disambiguate, since
 *             taxon is unique per creator)
 *
 * No ownership check — any caller can delist. Removes the DB record only (nothing
 * on-chain). Blocked while drops still reference the collection, to protect mint
 * history.
 */
const delist = async (req, res, next) => {
  try {
    const { mintAddress, taxon, ownerWalletAddress } = req.body;

    const hasTaxon = taxon !== undefined && taxon !== null && taxon !== '';
    if (!mintAddress && !hasTaxon) {
      throw new ApiError(400, 'Provide mintAddress (Solana) or taxon (XRPL)');
    }

    // Resolve the collection by its network-specific identifier (no owner check)
    let collection;
    if (mintAddress) {
      collection = await Collection.findOne({ where: { mintAddress, network: 'solana' } });
    } else {
      const taxonNum = parseInt(taxon, 10);
      if (isNaN(taxonNum)) {
        throw new ApiError(400, 'taxon must be a number');
      }
      // taxon is unique per creator on XRPL — if ownerWalletAddress is provided,
      // use it to target the exact collection; otherwise take the latest match.
      const where = { taxon: taxonNum, network: 'xrpl' };
      if (ownerWalletAddress) where.creatorWalletAddress = ownerWalletAddress;
      collection = await Collection.findOne({ where, order: [['createdAt', 'DESC']] });
    }

    if (!collection) {
      throw new ApiError(404, 'Collection not found');
    }

    // Protect mint history: block delisting while drops still reference it
    const dropCount = await Drop.count({ where: { collectionId: collection.id } });
    if (dropCount > 0) {
      throw new ApiError(400, `Cannot delist a collection with ${dropCount} associated drop(s). Remove the drops first.`);
    }

    const snapshot = collection.toJSON();
    const actor = ownerWalletAddress || snapshot.creatorWalletAddress;

    // Best-effort audit log — visible via GET /admin/dashboard/activities?action=collection_delete
    try {
      await AdminActivity.create({
        adminWalletAddress: actor,
        action: 'collection_delete',
        targetType: 'collection',
        targetId: collection.id,
        targetIdentifier: collection.name,
        previousValue: JSON.stringify(snapshot),
        metadata: { via: 'public_delist', network: collection.network, mintAddress: snapshot.mintAddress || null, taxon: snapshot.taxon ?? null }
      });
    } catch (logErr) {
      logger.warn(`Failed to log collection delist: ${logErr.message}`);
    }

    await collection.destroy();

    logger.info(`Collection delisted: ${snapshot.name} (${snapshot.network}, id=${snapshot.id})`);

    res.status(200).json(
      new ApiResponse(200, {
        id: snapshot.id,
        name: snapshot.name,
        network: snapshot.network,
        mintAddress: snapshot.mintAddress || null,
        taxon: snapshot.taxon ?? null,
        creatorWalletAddress: snapshot.creatorWalletAddress
      }, 'Collection delisted successfully')
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
  updateCollectionStats,
  getUserCollections,
  getCollectionStats,
  searchCollectionsAndNFTs,
  getNewNFTs,
  getTopSellers,
  getPopularCollections,
  getCollectionHistory,
  delist
};
