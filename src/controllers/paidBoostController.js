const { User, Post, PostMedia, Collection, PostBoost, NftBoost, CollectionBoost } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { getActiveSubscriptionsForWallets } = require('../utils/userHelpers');
const xrplService = require('../services/xrplService');

/**
 * Boost pricing configuration (XRP per day)
 * Can be moved to PlatformSettings for dynamic pricing
 */
const BOOST_PRICING = {
  20: 5,    // 5 XRP per day for 20% boost
  40: 10,   // 10 XRP per day for 40% boost
  60: 20,   // 20 XRP per day for 60% boost
  80: 35,   // 35 XRP per day for 80% boost
  100: 50   // 50 XRP per day for 100% boost
};

/**
 * Default boost duration in days
 */
const DEFAULT_BOOST_DURATION_DAYS = 7;

/**
 * Calculate total price for boost
 */
const calculateBoostPrice = (boostPercentage, durationDays = DEFAULT_BOOST_DURATION_DAYS) => {
  const dailyRate = BOOST_PRICING[boostPercentage] || BOOST_PRICING[20];
  return dailyRate * durationDays;
};

/**
 * Weighted random selection based on boost percentage
 * Higher percentage = higher chance of being selected first
 */
const weightedShuffle = (items) => {
  // Create weighted array where each item appears proportionally to its boost
  const weighted = [];
  items.forEach(item => {
    // Weight factor: 20% = 1x, 40% = 2x, 60% = 3x, 80% = 4x, 100% = 5x
    const weight = Math.floor(item.boostPercentage / 20);
    for (let i = 0; i < weight; i++) {
      weighted.push(item);
    }
  });

  // Shuffle the weighted array
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }

  // Remove duplicates while maintaining weighted order
  const seen = new Set();
  return weighted.filter(item => {
    const key = item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ==================== POST BOOST APIS ====================

/**
 * Create a post boost
 */
const createPostBoost = async (req, res, next) => {
  try {
    const {
      postId,
      walletAddress,
      boostPercentage,
      durationDays = DEFAULT_BOOST_DURATION_DAYS,
      paymentTransactionHash,
      paymentAmount
    } = req.body;

    // Validate required fields
    if (!postId) throw new ApiError(400, 'Post ID is required');
    if (!walletAddress) throw new ApiError(400, 'Wallet address is required');
    if (!boostPercentage) throw new ApiError(400, 'Boost percentage is required');
    if (![20, 40, 60, 80, 100].includes(boostPercentage)) {
      throw new ApiError(400, 'Boost percentage must be 20, 40, 60, 80, or 100');
    }

    // Check if post exists
    const post = await Post.findOne({
      where: { id: postId, isActive: true }
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Verify ownership
    if (post.authorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only boost your own posts');
    }

    // Check for existing active boost on this post
    const existingBoost = await PostBoost.findOne({
      where: {
        postId,
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      }
    });

    if (existingBoost) {
      throw new ApiError(400, 'This post already has an active boost. Wait for it to expire or cancel it first.');
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Calculate expected payment
    const expectedPayment = paymentAmount || calculateBoostPrice(boostPercentage, durationDays);

    // Create boost record
    const boost = await PostBoost.create({
      postId,
      userWalletAddress: walletAddress,
      boostPercentage,
      paymentAmount: expectedPayment,
      paymentTransactionHash,
      startDate,
      endDate,
      isActive: true,
      metadata: {
        durationDays,
        dailyRate: BOOST_PRICING[boostPercentage]
      }
    });

    logger.info(`Post boost created: ${boost.id} for post ${postId} at ${boostPercentage}%`);

    res.status(201).json(
      new ApiResponse(201, {
        boost: boost.toJSON(),
        pricing: {
          dailyRate: BOOST_PRICING[boostPercentage],
          totalDays: durationDays,
          totalCost: expectedPayment
        }
      }, 'Post boost created successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get boosted posts (weighted by percentage)
 */
const getBoostedPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, viewerWalletAddress } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get active boosts
    const { count, rows: boosts } = await PostBoost.findAndCountAll({
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      include: [
        {
          model: Post,
          as: 'post',
          where: { isActive: true },
          include: [
            {
              model: PostMedia,
              as: 'media'
            }
          ]
        }
      ],
      order: [['boostPercentage', 'DESC'], ['createdAt', 'DESC']]
    });

    // Apply weighted shuffle for fair distribution
    const shuffledBoosts = weightedShuffle(boosts);

    // Apply pagination after shuffle
    const paginatedBoosts = shuffledBoosts.slice(offset, offset + parseInt(limit));

    // Get author details
    const authorAddresses = [...new Set(paginatedBoosts.map(b => b.post.authorWalletAddress))];

    let authorMap = {};
    let subscriptionMap = {};

    if (authorAddresses.length > 0) {
      const authors = await User.findAll({
        where: { walletAddress: { [Op.in]: authorAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });

      authors.forEach(a => { authorMap[a.walletAddress] = a; });

      // Get subscription plans
      subscriptionMap = await getActiveSubscriptionsForWallets(authorAddresses);
    }

    // Format response
    const formattedPosts = paginatedBoosts.map(boost => {
      const post = boost.post;
      const author = authorMap[post.authorWalletAddress];

      return {
        boostId: boost.id,
        boostPercentage: boost.boostPercentage,
        boostEndDate: boost.endDate,
        post: {
          id: post.id,
          authorWalletAddress: post.authorWalletAddress,
          author: author ? {
            walletAddress: author.walletAddress,
            username: author.username,
            profileImage: author.profileImage,
            isVerified: author.isVerified,
            subscriptionPlan: subscriptionMap[author.walletAddress] || 'free'
          } : null,
          content: post.content,
          postType: post.postType,
          media: post.media ? post.media.map(m => ({
            id: m.id,
            mediaType: m.mediaType,
            mediaUrl: m.mediaUrl,
            thumbnailUrl: m.thumbnailUrl
          })) : [],
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          viewsCount: post.viewsCount,
          createdAt: post.createdAt
        }
      };
    });

    // Increment impressions for shown boosts (async, non-blocking)
    if (paginatedBoosts.length > 0) {
      const boostIds = paginatedBoosts.map(b => b.id);
      PostBoost.increment('impressions', { where: { id: boostIds } }).catch(err => {
        logger.error('Error incrementing post boost impressions:', err);
      });
    }

    res.status(200).json(
      new ApiResponse(200, {
        boostedPosts: formattedPosts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Boosted posts retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Record click on boosted post
 */
const recordPostBoostClick = async (req, res, next) => {
  try {
    const { boostId } = req.params;

    const boost = await PostBoost.findByPk(boostId);
    if (!boost) {
      throw new ApiError(404, 'Boost not found');
    }

    await boost.increment('clicks');

    res.status(200).json(
      new ApiResponse(200, { clicks: boost.clicks + 1 }, 'Click recorded')
    );
  } catch (error) {
    next(error);
  }
};

// ==================== NFT BOOST APIS ====================

/**
 * Create an NFT boost
 */
const createNftBoost = async (req, res, next) => {
  try {
    const {
      nftTokenId,
      walletAddress,
      boostPercentage,
      durationDays = DEFAULT_BOOST_DURATION_DAYS,
      paymentTransactionHash,
      paymentAmount,
      metadata // NFT details from frontend (optional)
    } = req.body;

    // Validate required fields
    if (!nftTokenId) throw new ApiError(400, 'NFT token ID is required');
    if (!walletAddress) throw new ApiError(400, 'Wallet address is required');
    if (!boostPercentage) throw new ApiError(400, 'Boost percentage is required');
    if (![20, 40, 60, 80, 100].includes(boostPercentage)) {
      throw new ApiError(400, 'Boost percentage must be 20, 40, 60, 80, or 100');
    }

    // Check for existing active boost on this NFT
    const existingBoost = await NftBoost.findOne({
      where: {
        nftTokenId,
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      }
    });

    if (existingBoost) {
      throw new ApiError(400, 'This NFT already has an active boost. Wait for it to expire or cancel it first.');
    }

    // Fetch NFT details from XRPL if not provided in metadata
    let nftMetadata = metadata || {};

    try {
      // Try to get NFT info from XRPL
      const nftInfo = await xrplService.getNFTInfo(nftTokenId);

      if (nftInfo) {
        nftMetadata.uri = nftInfo.uri || nftMetadata.uri;
        nftMetadata.owner = nftInfo.owner || walletAddress;
        nftMetadata.issuer = nftInfo.issuer || nftMetadata.issuer;
        nftMetadata.taxon = nftInfo.nft_taxon || nftMetadata.taxon;

        // Fetch metadata from URI if available
        if (nftInfo.uri && !nftMetadata.name) {
          try {
            const uriMetadata = await xrplService.fetchNFTMetadata(nftInfo.uri);
            if (uriMetadata) {
              nftMetadata.name = uriMetadata.name || nftMetadata.name;
              nftMetadata.image = uriMetadata.image || uriMetadata.image_url || uriMetadata.imageUrl || nftMetadata.image;
              nftMetadata.description = uriMetadata.description || nftMetadata.description;
            }
          } catch (err) {
            logger.warn(`Could not fetch metadata from URI for NFT ${nftTokenId}`);
          }
        }

        // Try to find collection info
        if (nftInfo.nft_taxon !== undefined && nftInfo.issuer) {
          const collection = await Collection.findOne({
            where: {
              taxon: nftInfo.nft_taxon,
              creatorWalletAddress: nftInfo.issuer
            },
            include: [{
              association: 'creator',
              attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
            }]
          });

          if (collection) {
            nftMetadata.collection = {
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
            };
          }
        }
      }
    } catch (err) {
      logger.warn(`Could not fetch NFT info from XRPL for ${nftTokenId}: ${err.message}`);
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Calculate expected payment
    const expectedPayment = paymentAmount || calculateBoostPrice(boostPercentage, durationDays);

    // Create boost record with fetched metadata
    const boost = await NftBoost.create({
      nftTokenId,
      userWalletAddress: walletAddress,
      boostPercentage,
      paymentAmount: expectedPayment,
      paymentTransactionHash,
      startDate,
      endDate,
      isActive: true,
      metadata: {
        ...nftMetadata,
        durationDays,
        dailyRate: BOOST_PRICING[boostPercentage]
      }
    });

    logger.info(`NFT boost created: ${boost.id} for NFT ${nftTokenId} at ${boostPercentage}%`);

    res.status(201).json(
      new ApiResponse(201, {
        boost: boost.toJSON(),
        pricing: {
          dailyRate: BOOST_PRICING[boostPercentage],
          totalDays: durationDays,
          totalCost: expectedPayment
        }
      }, 'NFT boost created successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get boosted NFTs (weighted by percentage)
 */
const getBoostedNfts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get active boosts
    const { count, rows: boosts } = await NftBoost.findAndCountAll({
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [['boostPercentage', 'DESC'], ['createdAt', 'DESC']]
    });

    // Apply weighted shuffle for fair distribution
    const shuffledBoosts = weightedShuffle(boosts);

    // Apply pagination after shuffle
    const paginatedBoosts = shuffledBoosts.slice(offset, offset + parseInt(limit));

    // Get user details
    const userAddresses = [...new Set(paginatedBoosts.map(b => b.userWalletAddress))];

    let userMap = {};
    let subscriptionMap = {};

    if (userAddresses.length > 0) {
      const users = await User.findAll({
        where: { walletAddress: { [Op.in]: userAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });

      users.forEach(u => { userMap[u.walletAddress] = u; });

      // Get subscription plans
      subscriptionMap = await getActiveSubscriptionsForWallets(userAddresses);
    }

    // Format response
    const formattedNfts = paginatedBoosts.map(boost => {
      const user = userMap[boost.userWalletAddress];

      return {
        boostId: boost.id,
        boostPercentage: boost.boostPercentage,
        boostEndDate: boost.endDate,
        nftTokenId: boost.nftTokenId,
        owner: user ? {
          walletAddress: user.walletAddress,
          username: user.username,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
        } : null,
        metadata: boost.metadata,
        impressions: boost.impressions,
        clicks: boost.clicks
      };
    });

    // Increment impressions (async, non-blocking)
    if (paginatedBoosts.length > 0) {
      const boostIds = paginatedBoosts.map(b => b.id);
      NftBoost.increment('impressions', { where: { id: boostIds } }).catch(err => {
        logger.error('Error incrementing NFT boost impressions:', err);
      });
    }

    res.status(200).json(
      new ApiResponse(200, {
        boostedNfts: formattedNfts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Boosted NFTs retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Record click on boosted NFT
 */
const recordNftBoostClick = async (req, res, next) => {
  try {
    const { boostId } = req.params;

    const boost = await NftBoost.findByPk(boostId);
    if (!boost) {
      throw new ApiError(404, 'Boost not found');
    }

    await boost.increment('clicks');

    res.status(200).json(
      new ApiResponse(200, { clicks: boost.clicks + 1 }, 'Click recorded')
    );
  } catch (error) {
    next(error);
  }
};

// ==================== COLLECTION BOOST APIS ====================

/**
 * Create a collection boost
 */
const createCollectionBoost = async (req, res, next) => {
  try {
    const {
      collectionId,
      walletAddress,
      boostPercentage,
      durationDays = DEFAULT_BOOST_DURATION_DAYS,
      paymentTransactionHash,
      paymentAmount
    } = req.body;

    // Validate required fields
    if (!collectionId) throw new ApiError(400, 'Collection ID is required');
    if (!walletAddress) throw new ApiError(400, 'Wallet address is required');
    if (!boostPercentage) throw new ApiError(400, 'Boost percentage is required');
    if (![20, 40, 60, 80, 100].includes(boostPercentage)) {
      throw new ApiError(400, 'Boost percentage must be 20, 40, 60, 80, or 100');
    }

    // Check for existing active boost on this collection
    const existingBoost = await CollectionBoost.findOne({
      where: {
        collectionId,
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      }
    });

    if (existingBoost) {
      throw new ApiError(400, 'This collection already has an active boost. Wait for it to expire or cancel it first.');
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Calculate expected payment
    const expectedPayment = paymentAmount || calculateBoostPrice(boostPercentage, durationDays);

    // Create boost record
    const boost = await CollectionBoost.create({
      collectionId,
      userWalletAddress: walletAddress,
      boostPercentage,
      paymentAmount: expectedPayment,
      paymentTransactionHash,
      startDate,
      endDate,
      isActive: true,
      metadata: {
        durationDays,
        dailyRate: BOOST_PRICING[boostPercentage]
      }
    });

    logger.info(`Collection boost created: ${boost.id} for collection ${collectionId} at ${boostPercentage}%`);

    res.status(201).json(
      new ApiResponse(201, {
        boost: boost.toJSON(),
        pricing: {
          dailyRate: BOOST_PRICING[boostPercentage],
          totalDays: durationDays,
          totalCost: expectedPayment
        }
      }, 'Collection boost created successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get boosted collections (weighted by percentage)
 */
const getBoostedCollections = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get active boosts (collection boosts are independent, no Collection association)
    const { count, rows: boosts } = await CollectionBoost.findAndCountAll({
      where: {
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [['boostPercentage', 'DESC'], ['createdAt', 'DESC']]
    });

    // Apply weighted shuffle for fair distribution
    const shuffledBoosts = weightedShuffle(boosts);

    // Apply pagination after shuffle
    const paginatedBoosts = shuffledBoosts.slice(offset, offset + parseInt(limit));

    // Get user details for boost creators
    const userAddresses = [...new Set(paginatedBoosts.map(b => b.userWalletAddress))];

    let userMap = {};
    let subscriptionMap = {};

    if (userAddresses.length > 0) {
      const users = await User.findAll({
        where: { walletAddress: { [Op.in]: userAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });

      users.forEach(u => { userMap[u.walletAddress] = u; });

      // Get subscription plans
      subscriptionMap = await getActiveSubscriptionsForWallets(userAddresses);
    }

    // Format response (collection details come from metadata)
    const formattedCollections = paginatedBoosts.map(boost => {
      const user = userMap[boost.userWalletAddress];
      const metadata = boost.metadata || {};

      return {
        boostId: boost.id,
        boostPercentage: boost.boostPercentage,
        boostEndDate: boost.endDate,
        collectionId: boost.collectionId,
        userWalletAddress: boost.userWalletAddress,
        user: user ? {
          walletAddress: user.walletAddress,
          username: user.username,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          subscriptionPlan: subscriptionMap[user.walletAddress] || 'free'
        } : null,
        metadata
      };
    });

    // Increment impressions (async, non-blocking)
    if (paginatedBoosts.length > 0) {
      const boostIds = paginatedBoosts.map(b => b.id);
      CollectionBoost.increment('impressions', { where: { id: boostIds } }).catch(err => {
        logger.error('Error incrementing collection boost impressions:', err);
      });
    }

    res.status(200).json(
      new ApiResponse(200, {
        boostedCollections: formattedCollections,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Boosted collections retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Record click on boosted collection
 */
const recordCollectionBoostClick = async (req, res, next) => {
  try {
    const { boostId } = req.params;

    const boost = await CollectionBoost.findByPk(boostId);
    if (!boost) {
      throw new ApiError(404, 'Boost not found');
    }

    await boost.increment('clicks');

    res.status(200).json(
      new ApiResponse(200, { clicks: boost.clicks + 1 }, 'Click recorded')
    );
  } catch (error) {
    next(error);
  }
};

// ==================== COMMON APIS ====================

/**
 * Get boost pricing
 */
const getBoostPricing = async (req, res, next) => {
  try {
    const pricing = Object.entries(BOOST_PRICING).map(([percentage, dailyRate]) => ({
      percentage: parseInt(percentage),
      dailyRate,
      weeklyRate: dailyRate * 7,
      monthlyRate: dailyRate * 30
    }));

    res.status(200).json(
      new ApiResponse(200, {
        pricing,
        defaultDurationDays: DEFAULT_BOOST_DURATION_DAYS
      }, 'Boost pricing retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's active paid boosts
 */
const getUserPaidBoosts = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const now = new Date();

    // Get all active boosts for this user
    const [postBoosts, nftBoosts, collectionBoosts] = await Promise.all([
      PostBoost.findAll({
        where: {
          userWalletAddress: walletAddress,
          isActive: true,
          endDate: { [Op.gt]: now }
        },
        include: [{
          model: Post,
          as: 'post',
          attributes: ['id', 'content', 'postType']
        }],
        order: [['endDate', 'ASC']]
      }),
      NftBoost.findAll({
        where: {
          userWalletAddress: walletAddress,
          isActive: true,
          endDate: { [Op.gt]: now }
        },
        order: [['endDate', 'ASC']]
      }),
      CollectionBoost.findAll({
        where: {
          userWalletAddress: walletAddress,
          isActive: true,
          endDate: { [Op.gt]: now }
        },
        order: [['endDate', 'ASC']]
      })
    ]);

    res.status(200).json(
      new ApiResponse(200, {
        postBoosts: postBoosts.map(b => b.toJSON()),
        nftBoosts: nftBoosts.map(b => b.toJSON()),
        collectionBoosts: collectionBoosts.map(b => b.toJSON()),
        totalActive: postBoosts.length + nftBoosts.length + collectionBoosts.length
      }, 'User paid boosts retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a paid boost
 */
const cancelPaidBoost = async (req, res, next) => {
  try {
    const { boostId } = req.params;
    const { userWalletAddress, boostType } = req.body;

    if (!boostId) throw new ApiError(400, 'Boost ID is required');
    if (!userWalletAddress) throw new ApiError(400, 'Wallet address is required');
    if (!boostType || !['post', 'nft', 'collection'].includes(boostType)) {
      throw new ApiError(400, 'Valid boost type is required (post, nft, collection)');
    }

    let boost;
    switch (boostType) {
      case 'post':
        boost = await PostBoost.findByPk(boostId);
        break;
      case 'nft':
        boost = await NftBoost.findByPk(boostId);
        break;
      case 'collection':
        boost = await CollectionBoost.findByPk(boostId);
        break;
    }

    if (!boost) {
      throw new ApiError(404, 'Boost not found');
    }

    // Verify ownership
    if (boost.userWalletAddress !== userWalletAddress) {
      throw new ApiError(403, 'You can only cancel your own boosts');
    }

    // Deactivate the boost
    boost.isActive = false;
    await boost.save();

    logger.info(`Paid boost ${boostId} (${boostType}) cancelled by ${userWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, { boostId, boostType, isActive: false }, 'Boost cancelled successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get boost statistics for a specific boost
 */
const getBoostStats = async (req, res, next) => {
  try {
    const { boostId } = req.params;
    const { boostType } = req.query;

    if (!boostId) throw new ApiError(400, 'Boost ID is required');
    if (!boostType || !['post', 'nft', 'collection'].includes(boostType)) {
      throw new ApiError(400, 'Valid boost type is required (post, nft, collection)');
    }

    let boost;
    switch (boostType) {
      case 'post':
        boost = await PostBoost.findByPk(boostId);
        break;
      case 'nft':
        boost = await NftBoost.findByPk(boostId);
        break;
      case 'collection':
        boost = await CollectionBoost.findByPk(boostId);
        break;
    }

    if (!boost) {
      throw new ApiError(404, 'Boost not found');
    }

    const ctr = boost.impressions > 0 ? ((boost.clicks / boost.impressions) * 100).toFixed(2) : 0;

    res.status(200).json(
      new ApiResponse(200, {
        boostId: boost.id,
        boostType,
        boostPercentage: boost.boostPercentage,
        impressions: boost.impressions,
        clicks: boost.clicks,
        ctr: `${ctr}%`,
        startDate: boost.startDate,
        endDate: boost.endDate,
        remainingDays: boost.getRemainingDays(),
        isActive: boost.isCurrentlyActive(),
        paymentAmount: boost.paymentAmount
      }, 'Boost statistics retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Post boosts
  createPostBoost,
  getBoostedPosts,
  recordPostBoostClick,

  // NFT boosts
  createNftBoost,
  getBoostedNfts,
  recordNftBoostClick,

  // Collection boosts
  createCollectionBoost,
  getBoostedCollections,
  recordCollectionBoostClick,

  // Common
  getBoostPricing,
  getUserPaidBoosts,
  cancelPaidBoost,
  getBoostStats,

  // Export pricing for reference
  BOOST_PRICING,
  DEFAULT_BOOST_DURATION_DAYS
};
