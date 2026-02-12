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

const { ActivityLog, LuckyDraw, LuckyDrawParticipant } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

/**
 * Get current month in YYYY-MM format for lucky draw
 */
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Get the last day of a specific month at 23:00 UTC
 */
const getEndOfMonthDrawTime = (month) => {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0); // Day 0 of next month = last day of current month
  lastDay.setUTCHours(23, 0, 0, 0);
  return lastDay;
};

/**
 * Get or create lucky draw for a specific month
 * Automatically sets draw time to 23:00 UTC on the last day of the month
 */
const getOrCreateLuckyDraw = async (month) => {
  let luckyDraw = await LuckyDraw.findOne({ where: { month } });

  if (!luckyDraw) {
    const drawTime = getEndOfMonthDrawTime(month);
    luckyDraw = await LuckyDraw.create({
      month,
      status: 'active',
      totalParticipants: 0,
      drawScheduledAt: drawTime
    });
    logger.info(`Created new lucky draw for month: ${month}, scheduled at ${drawTime.toISOString()}`);
  }

  return luckyDraw;
};

/**
 * Add user to lucky draw participation (called automatically on NFT purchase)
 */
const addToLuckyDraw = async (buyerWalletAddress, nftTokenId, purchasePrice, purchaseCurrency, transactionHash) => {
  try {
    const currentMonth = getCurrentMonth();
    const luckyDraw = await getOrCreateLuckyDraw(currentMonth);

    // Check if draw is still active
    if (luckyDraw.status !== 'active') {
      logger.info(`Lucky draw for ${currentMonth} is ${luckyDraw.status}, skipping participation`);
      return { added: false, reason: `Lucky draw is ${luckyDraw.status}` };
    }

    // Check if this NFT purchase is already recorded
    const existingEntry = await LuckyDrawParticipant.findOne({
      where: {
        luckyDrawId: luckyDraw.id,
        nftTokenId
      }
    });

    if (existingEntry) {
      logger.info(`NFT ${nftTokenId} already recorded in lucky draw for ${currentMonth}`);
      return { added: false, reason: 'Already recorded', participant: existingEntry };
    }

    // Create participant entry
    const participant = await LuckyDrawParticipant.create({
      luckyDrawId: luckyDraw.id,
      userWalletAddress: buyerWalletAddress,
      nftTokenId,
      purchasePrice,
      purchaseCurrency: purchaseCurrency || 'XRP',
      transactionHash,
      purchasedAt: new Date()
    });

    // Update total participants count (unique users)
    const uniqueParticipants = await LuckyDrawParticipant.count({
      where: { luckyDrawId: luckyDraw.id },
      distinct: true,
      col: 'userWalletAddress'
    });

    await luckyDraw.update({ totalParticipants: uniqueParticipants });

    logger.info(`User ${buyerWalletAddress} added to lucky draw for ${currentMonth} (NFT: ${nftTokenId})`);

    return {
      added: true,
      participant,
      luckyDraw: {
        id: luckyDraw.id,
        month: luckyDraw.month,
        totalParticipants: uniqueParticipants
      }
    };
  } catch (error) {
    logger.error('Error adding to lucky draw:', error);
    // Don't throw - lucky draw is a bonus feature, shouldn't break NFT buy activity
    return { added: false, reason: 'Error adding to lucky draw', error: error.message };
  }
};

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

    // Automatically add buyer to lucky draw participation
    let luckyDrawResult = null;
    if (nftTokenId) {
      luckyDrawResult = await addToLuckyDraw(
        walletAddress,
        nftTokenId,
        xrpAmount,
        'XRP',
        transactionHash
      );
    }

    res.status(201).json(
      new ApiResponse(201, {
        activity,
        luckyDraw: luckyDrawResult
      }, 'NFT buy activity logged successfully')
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
 * Log like given activity (user likes a post)
 * @route POST /api/v1/activities/like-give
 */
exports.logLikeGive = async (req, res) => {
  try {
    const { walletAddress, postId, postAuthorWalletAddress, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    // Check for duplicate (user can only like a post once)
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'like_give',
        relatedId: postId
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Like already logged for this post')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'like_give',
      relatedId: postId,
      relatedType: 'post',
      counterpartyWalletAddress: postAuthorWalletAddress || null,
      metadata: metadata || {}
    });

    logger.info(`Like give activity logged: ${walletAddress} liked post ${postId}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Like activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging like give activity:', error);
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
      message: 'Failed to log like activity'
    });
  }
};

/**
 * Log like received activity (user's post gets liked)
 * @route POST /api/v1/activities/like-receive
 */
exports.logLikeReceive = async (req, res) => {
  try {
    const { walletAddress, postId, likerWalletAddress, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    // For like_receive, we allow multiple entries (different users can like the same post)
    // But prevent duplicate from same liker
    if (likerWalletAddress) {
      const existingActivity = await ActivityLog.findOne({
        where: {
          userWalletAddress: walletAddress,
          activityType: 'like_receive',
          relatedId: postId,
          counterpartyWalletAddress: likerWalletAddress
        }
      });

      if (existingActivity) {
        return res.status(200).json(
          new ApiResponse(200, {
            activity: existingActivity,
            alreadyLogged: true
          }, 'Like receive already logged from this user')
        );
      }
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'like_receive',
      relatedId: postId,
      relatedType: 'post',
      counterpartyWalletAddress: likerWalletAddress || null,
      metadata: metadata || {}
    });

    logger.info(`Like receive activity logged: ${walletAddress} received like on post ${postId}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Like receive activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging like receive activity:', error);
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
      message: 'Failed to log like receive activity'
    });
  }
};

/**
 * Log comment created activity (user comments on a post)
 * @route POST /api/v1/activities/comment-create
 */
exports.logCommentCreate = async (req, res) => {
  try {
    const { walletAddress, postId, commentId, postAuthorWalletAddress, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    // Check for duplicate by commentId if provided
    if (commentId) {
      const existingActivity = await ActivityLog.findOne({
        where: {
          userWalletAddress: walletAddress,
          activityType: 'comment_create',
          relatedId: commentId
        }
      });

      if (existingActivity) {
        return res.status(200).json(
          new ApiResponse(200, {
            activity: existingActivity,
            alreadyLogged: true
          }, 'Comment already logged')
        );
      }
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'comment_create',
      relatedId: commentId || postId,
      relatedType: 'comment',
      counterpartyWalletAddress: postAuthorWalletAddress || null,
      metadata: {
        postId: postId,
        commentId: commentId,
        ...metadata
      }
    });

    logger.info(`Comment create activity logged: ${walletAddress} commented on post ${postId}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Comment activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging comment create activity:', error);
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
      message: 'Failed to log comment activity'
    });
  }
};

/**
 * Log comment received activity (user's post gets a comment)
 * @route POST /api/v1/activities/comment-receive
 */
exports.logCommentReceive = async (req, res) => {
  try {
    const { walletAddress, postId, commentId, commenterWalletAddress, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!postId) {
      throw new ApiError(400, 'Post ID is required');
    }

    // Prevent duplicate from same comment
    if (commentId) {
      const existingActivity = await ActivityLog.findOne({
        where: {
          userWalletAddress: walletAddress,
          activityType: 'comment_receive',
          metadata: {
            commentId: commentId
          }
        }
      });

      if (existingActivity) {
        return res.status(200).json(
          new ApiResponse(200, {
            activity: existingActivity,
            alreadyLogged: true
          }, 'Comment receive already logged')
        );
      }
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'comment_receive',
      relatedId: postId,
      relatedType: 'post',
      counterpartyWalletAddress: commenterWalletAddress || null,
      metadata: {
        postId: postId,
        commentId: commentId,
        ...metadata
      }
    });

    logger.info(`Comment receive activity logged: ${walletAddress} received comment on post ${postId}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Comment receive activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging comment receive activity:', error);
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
      message: 'Failed to log comment receive activity'
    });
  }
};

/**
 * Log follow given activity (user follows someone)
 * @route POST /api/v1/activities/follow-give
 */
exports.logFollowGive = async (req, res) => {
  try {
    const { walletAddress, followedWalletAddress, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!followedWalletAddress) {
      throw new ApiError(400, 'Followed wallet address is required');
    }

    // Check for duplicate (user can only follow someone once)
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'follow_give',
        counterpartyWalletAddress: followedWalletAddress
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Follow already logged for this user')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'follow_give',
      relatedId: null,
      relatedType: 'user',
      counterpartyWalletAddress: followedWalletAddress,
      metadata: metadata || {}
    });

    logger.info(`Follow give activity logged: ${walletAddress} followed ${followedWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Follow activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging follow give activity:', error);
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
      message: 'Failed to log follow activity'
    });
  }
};

/**
 * Log follow received activity (user gets a new follower)
 * @route POST /api/v1/activities/follow-receive
 */
exports.logFollowReceive = async (req, res) => {
  try {
    const { walletAddress, followerWalletAddress, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!followerWalletAddress) {
      throw new ApiError(400, 'Follower wallet address is required');
    }

    // Check for duplicate
    const existingActivity = await ActivityLog.findOne({
      where: {
        userWalletAddress: walletAddress,
        activityType: 'follow_receive',
        counterpartyWalletAddress: followerWalletAddress
      }
    });

    if (existingActivity) {
      return res.status(200).json(
        new ApiResponse(200, {
          activity: existingActivity,
          alreadyLogged: true
        }, 'Follow receive already logged from this user')
      );
    }

    const activity = await ActivityLog.logActivity({
      userWalletAddress: walletAddress,
      activityType: 'follow_receive',
      relatedId: null,
      relatedType: 'user',
      counterpartyWalletAddress: followerWalletAddress,
      metadata: metadata || {}
    });

    logger.info(`Follow receive activity logged: ${walletAddress} received follower ${followerWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, { activity }, 'Follow receive activity logged successfully')
    );
  } catch (error) {
    logger.error('Error logging follow receive activity:', error);
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
      message: 'Failed to log follow receive activity'
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
            // Content creation
            posts: aggregated.post_create?.count || 0,
            // Receiving (content popularity)
            likesReceived: aggregated.like_receive?.count || 0,
            commentsReceived: aggregated.comment_receive?.count || 0,
            followersGained: aggregated.follow_receive?.count || 0
          },
          engagement: {
            // Giving (community participation)
            likesGiven: aggregated.like_give?.count || 0,
            commentsGiven: aggregated.comment_create?.count || 0,
            followsGiven: aggregated.follow_give?.count || 0,
            totalEngagementActions: (aggregated.like_give?.count || 0) +
                                    (aggregated.comment_create?.count || 0) +
                                    (aggregated.follow_give?.count || 0)
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
