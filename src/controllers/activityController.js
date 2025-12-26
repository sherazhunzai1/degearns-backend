/**
 * Activity Controller
 *
 * Handles logging of user activities for the scoring system.
 * These endpoints are called from the frontend after blockchain transactions complete.
 * All endpoints are open (no authentication required).
 *
 * NOTE: These APIs are independent of database records. Collections and NFTs
 * are minted on XRPL from the frontend and may not exist in the database.
 */

const { ActivityLog } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

/**
 * Log collection creation activity
 * @route POST /api/v1/activities/collection-create
 */
exports.logCollectionCreate = async (req, res) => {
  try {
    const {
      walletAddress,
      taxon,
      collectionName,
      transactionHash,
      metadata
    } = req.body;

    // Validate required fields
    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!taxon && taxon !== 0) {
      throw new ApiError(400, 'Taxon is required');
    }

    // Check if activity already logged for this collection (by wallet + taxon)
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'collection_create',
        metadata: {
          taxon: taxon
        }
      }
    });

    // Alternative check using transactionHash if provided
    let existingByTxHash = null;
    if (transactionHash) {
      existingByTxHash = await ActivityLog.findOne({
        where: {
          userWalletAddress: walletAddress,
          activityType: 'collection_create',
          transactionHash: transactionHash
        }
      });
    }

    if (existingActivity || existingByTxHash) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity || existingByTxHash,
          alreadyLogged: true
        }, 'Activity already logged for this collection')
      );
    }

    // Log the activity
    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'collection_create',
      relatedId: null,
      relatedType: 'collection',
      transactionHash: transactionHash || null,
      metadata: {
        taxon: taxon,
        collectionName: collectionName || null,
        issuerAddress: walletAddress,
        ...metadata
      }
    });

    logger.info(`Collection create activity logged: ${walletAddress} created collection with taxon ${taxon}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Collection creation activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging collection create activity:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to log collection creation activity'
    });
  }
};

/**
 * Log drop creation activity
 * @route POST /api/v1/activities/drop-create
 */
exports.logDropCreate = async (req, res) => {
  try {
    const {
      walletAddress,
      taxon,
      dropName,
      transactionHash,
      metadata
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!taxon && taxon !== 0) {
      throw new ApiError(400, 'Taxon is required');
    }

    // Check for duplicate by transactionHash
    let existingActivity = null;
    if (transactionHash) {
      existingActivity = await ActivityLog.findOne({
        where: {
          userWalletAddress: walletAddress,
          activityType: 'drop_create',
          transactionHash: transactionHash
        }
      });
    }

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Activity already logged for this drop')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'drop_create',
      relatedId: null,
      relatedType: 'drop',
      transactionHash: transactionHash || null,
      metadata: {
        taxon: taxon,
        dropName: dropName || null,
        issuerAddress: walletAddress,
        ...metadata
      }
    });

    logger.info(`Drop create activity logged: ${walletAddress} created drop with taxon ${taxon}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Drop creation activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging drop create activity:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to log drop creation activity'
    });
  }
};

/**
 * Log NFT mint activity (minting from a drop)
 * @route POST /api/v1/activities/nft-mint
 */
exports.logNftMint = async (req, res) => {
  try {
    const {
      walletAddress,
      nftTokenId,
      taxon,
      issuerAddress,
      transactionHash,
      xrpAmount,
      metadata
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!transactionHash) {
      throw new ApiError(400, 'Transaction hash is required');
    }

    // Check for duplicate
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'nft_mint',
        transactionHash: transactionHash
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Activity already logged for this transaction')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'nft_mint',
      relatedId: null,
      relatedType: 'nft',
      transactionHash: transactionHash,
      xrpAmount: xrpAmount || 0,
      metadata: {
        nftTokenId: nftTokenId || null,
        taxon: taxon || null,
        issuerAddress: issuerAddress || null,
        ...metadata
      }
    });

    logger.info(`NFT mint activity logged: ${walletAddress} minted NFT, tx: ${transactionHash}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'NFT mint activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging NFT mint activity:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to log NFT mint activity'
    });
  }
};

/**
 * Log NFT buy activity
 * @route POST /api/v1/activities/nft-buy
 */
exports.logNftBuy = async (req, res) => {
  try {
    const {
      walletAddress,
      nftTokenId,
      taxon,
      issuerAddress,
      transactionHash,
      xrpAmount,
      sellerWalletAddress,
      metadata
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!transactionHash) {
      throw new ApiError(400, 'Transaction hash is required');
    }

    if (!xrpAmount) {
      throw new ApiError(400, 'XRP amount is required');
    }

    // Check for duplicate
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'nft_buy',
        transactionHash: transactionHash
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Activity already logged for this transaction')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'nft_buy',
      relatedId: null,
      relatedType: 'nft',
      transactionHash: transactionHash,
      xrpAmount: xrpAmount,
      counterpartyWalletAddress: sellerWalletAddress || null,
      metadata: {
        nftTokenId: nftTokenId || null,
        taxon: taxon || null,
        issuerAddress: issuerAddress || null,
        ...metadata
      }
    });

    logger.info(`NFT buy activity logged: ${walletAddress} bought NFT for ${xrpAmount} drops, tx: ${transactionHash}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'NFT buy activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging NFT buy activity:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to log NFT buy activity'
    });
  }
};

/**
 * Log NFT sell activity
 * @route POST /api/v1/activities/nft-sell
 */
exports.logNftSell = async (req, res) => {
  try {
    const {
      walletAddress,
      nftTokenId,
      taxon,
      issuerAddress,
      transactionHash,
      xrpAmount,
      buyerWalletAddress,
      metadata
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!transactionHash) {
      throw new ApiError(400, 'Transaction hash is required');
    }

    if (!xrpAmount) {
      throw new ApiError(400, 'XRP amount is required');
    }

    // Check for duplicate
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'nft_sell',
        transactionHash: transactionHash
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Activity already logged for this transaction')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'nft_sell',
      relatedId: null,
      relatedType: 'nft',
      transactionHash: transactionHash,
      xrpAmount: xrpAmount,
      counterpartyWalletAddress: buyerWalletAddress || null,
      metadata: {
        nftTokenId: nftTokenId || null,
        taxon: taxon || null,
        issuerAddress: issuerAddress || null,
        ...metadata
      }
    });

    logger.info(`NFT sell activity logged: ${walletAddress} sold NFT for ${xrpAmount} drops, tx: ${transactionHash}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'NFT sell activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging NFT sell activity:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to log NFT sell activity'
    });
  }
};

/**
 * Log NFT list activity (listing for sale)
 * @route POST /api/v1/activities/nft-list
 */
exports.logNftList = async (req, res) => {
  try {
    const {
      walletAddress,
      nftTokenId,
      taxon,
      issuerAddress,
      transactionHash,
      xrpAmount,
      offerId,
      metadata
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!transactionHash) {
      throw new ApiError(400, 'Transaction hash is required');
    }

    // Check for duplicate
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'nft_list',
        transactionHash: transactionHash
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Activity already logged for this transaction')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'nft_list',
      relatedId: null,
      relatedType: 'nft',
      transactionHash: transactionHash,
      xrpAmount: xrpAmount || 0,
      metadata: {
        nftTokenId: nftTokenId || null,
        taxon: taxon || null,
        issuerAddress: issuerAddress || null,
        offerId: offerId || null,
        listPrice: xrpAmount,
        ...metadata
      }
    });

    logger.info(`NFT list activity logged: ${walletAddress} listed NFT for ${xrpAmount} drops`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'NFT listing activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging NFT list activity:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to log NFT listing activity'
    });
  }
};

/**
 * Log NFT delist activity (removing from sale)
 * @route POST /api/v1/activities/nft-delist
 */
exports.logNftDelist = async (req, res) => {
  try {
    const {
      walletAddress,
      nftTokenId,
      taxon,
      issuerAddress,
      transactionHash,
      offerId,
      metadata
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!transactionHash) {
      throw new ApiError(400, 'Transaction hash is required');
    }

    // Check for duplicate
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'nft_delist',
        transactionHash: transactionHash
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Activity already logged for this transaction')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'nft_delist',
      relatedId: null,
      relatedType: 'nft',
      transactionHash: transactionHash,
      metadata: {
        nftTokenId: nftTokenId || null,
        taxon: taxon || null,
        issuerAddress: issuerAddress || null,
        offerId: offerId || null,
        ...metadata
      }
    });

    logger.info(`NFT delist activity logged: ${walletAddress} delisted NFT`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'NFT delisting activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging NFT delist activity:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to log NFT delisting activity'
    });
  }
};

/**
 * Log post creation activity
 * @route POST /api/v1/activities/post-create
 */
exports.logPostCreate = async (req, res) => {
  try {
    const { walletAddress, postId, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    // Check for duplicate
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'post_create',
        relatedId: postId
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Activity already logged for this post')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'post_create',
      relatedId: postId,
      relatedType: 'post',
      metadata: metadata || {}
    });

    logger.info(`Post create activity logged: ${walletAddress} created post ${postId}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Post creation activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging post create activity:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to log post creation activity'
    });
  }
};

/**
 * Get user's activity history
 * @route GET /api/v1/activities/user/:walletAddress
 */
exports.getUserActivities = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const {
      page = 1,
      limit = 20,
      activityType,
      month,
      year
    } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = { userWalletAddress: walletAddress };

    if (activityType) {
      where.activityType = activityType;
    }

    if (month && year) {
      where.scoringPeriodMonth = parseInt(month);
      where.scoringPeriodYear = parseInt(year);
    }

    const { count, rows: activities } = await ActivityLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json(
      new ApiResponse(200, {
        walletAddress,
        activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit)),
          hasMore: offset + activities.length < count
        }
      }, 'Activities retrieved successfully')
    );
  } catch (error) {
    logger.error('Error getting user activities:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to retrieve activities'
    });
  }
};

/**
 * Get user's activity summary for scoring
 * @route GET /api/v1/activities/user/:walletAddress/summary
 */
exports.getUserActivitySummary = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { month, year } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    // Get start and end dates for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const aggregated = await ActivityLog.aggregateForUser(walletAddress, startDate, endDate);

    // Get total activity count
    const totalActivities = Object.values(aggregated).reduce((sum, act) => sum + act.count, 0);

    res.status(200).json(
      new ApiResponse(200, {
        walletAddress,
        period: {
          month: targetMonth,
          year: targetYear
        },
        summary: aggregated,
        totalActivities,
        activityBreakdown: {
          trader: {
            buys: aggregated.nft_buy?.count || 0,
            sells: aggregated.nft_sell?.count || 0,
            mints: aggregated.nft_mint?.count || 0,
            totalVolume: (aggregated.nft_buy?.totalAmount || 0) + (aggregated.nft_sell?.totalAmount || 0)
          },
          creator: {
            collections: aggregated.collection_create?.count || 0,
            drops: aggregated.drop_create?.count || 0,
            sales: aggregated.nft_sell?.count || 0
          },
          influencer: {
            posts: aggregated.post_create?.count || 0,
            likesReceived: aggregated.like_receive?.count || 0,
            commentsReceived: aggregated.comment_receive?.count || 0,
            followersGained: aggregated.follow_receive?.count || 0
          }
        }
      }, 'Activity summary retrieved successfully')
    );
  } catch (error) {
    logger.error('Error getting activity summary:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        statusCode: error.statusCode,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to retrieve activity summary'
    });
  }
};

// Keep old function names as aliases for backward compatibility
exports.getMyActivities = exports.getUserActivities;
exports.getMyActivitySummary = exports.getUserActivitySummary;
