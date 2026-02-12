const { Op } = require('sequelize');
const { LuckyDraw, LuckyDrawParticipant, User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

/**
 * Get current month in YYYY-MM format
 */
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Get or create lucky draw for a specific month
 */
const getOrCreateLuckyDraw = async (month) => {
  let luckyDraw = await LuckyDraw.findOne({ where: { month } });

  if (!luckyDraw) {
    luckyDraw = await LuckyDraw.create({
      month,
      status: 'active',
      totalParticipants: 0
    });
    logger.info(`Created new lucky draw for month: ${month}`);
  }

  return luckyDraw;
};

/**
 * Record NFT purchase and add user to lucky draw
 * Called when a user purchases an NFT
 * @route POST /api/v1/lucky-draw/participate
 */
const recordPurchase = async (req, res, next) => {
  try {
    const {
      buyerWalletAddress,
      nftTokenId,
      purchasePrice,
      purchaseCurrency = 'XRP',
      transactionHash
    } = req.body;

    if (!buyerWalletAddress) {
      throw new ApiError(400, 'Buyer wallet address is required');
    }

    if (!nftTokenId) {
      throw new ApiError(400, 'NFT token ID is required');
    }

    const currentMonth = getCurrentMonth();
    const luckyDraw = await getOrCreateLuckyDraw(currentMonth);

    // Check if draw is still active
    if (luckyDraw.status !== 'active') {
      throw new ApiError(400, `Lucky draw for ${currentMonth} is already ${luckyDraw.status}`);
    }

    // Check if this NFT purchase is already recorded
    const existingEntry = await LuckyDrawParticipant.findOne({
      where: {
        luckyDrawId: luckyDraw.id,
        nftTokenId
      }
    });

    if (existingEntry) {
      return res.status(200).json(
        new ApiResponse(200, {
          alreadyRecorded: true,
          participant: existingEntry
        }, 'This NFT purchase is already recorded in the lucky draw')
      );
    }

    // Create participant entry
    const participant = await LuckyDrawParticipant.create({
      luckyDrawId: luckyDraw.id,
      userWalletAddress: buyerWalletAddress,
      nftTokenId,
      purchasePrice,
      purchaseCurrency,
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

    res.status(201).json(
      new ApiResponse(201, {
        participant,
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          totalParticipants: uniqueParticipants
        }
      }, 'Successfully added to lucky draw participation')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get current month's lucky draw info
 * @route GET /api/v1/lucky-draw/current
 */
const getCurrentDraw = async (req, res, next) => {
  try {
    const currentMonth = getCurrentMonth();
    const luckyDraw = await getOrCreateLuckyDraw(currentMonth);

    // Get unique participants count
    const uniqueParticipants = await LuckyDrawParticipant.count({
      where: { luckyDrawId: luckyDraw.id },
      distinct: true,
      col: 'userWalletAddress'
    });

    // Get total NFT purchases
    const totalPurchases = await LuckyDrawParticipant.count({
      where: { luckyDrawId: luckyDraw.id }
    });

    // Get recent participants
    const recentParticipants = await LuckyDrawParticipant.findAll({
      where: { luckyDrawId: luckyDraw.id },
      order: [['purchasedAt', 'DESC']],
      limit: 10,
      include: [{
        model: User,
        as: 'user',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'],
        required: false
      }]
    });

    res.status(200).json(
      new ApiResponse(200, {
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          status: luckyDraw.status,
          prizeDescription: luckyDraw.prizeDescription,
          prizeAmount: luckyDraw.prizeAmount,
          prizeCurrency: luckyDraw.prizeCurrency,
          totalParticipants: uniqueParticipants,
          totalPurchases,
          winner: luckyDraw.status === 'completed' ? {
            walletAddress: luckyDraw.winnerWalletAddress,
            drawnAt: luckyDraw.drawnAt
          } : null
        },
        recentParticipants: recentParticipants.map(p => ({
          walletAddress: p.userWalletAddress,
          username: p.user?.username || null,
          profileImage: p.user?.profileImage || null,
          nftTokenId: p.nftTokenId,
          purchasedAt: p.purchasedAt
        }))
      }, 'Current lucky draw retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get participants for a specific month
 * @route GET /api/v1/lucky-draw/participants/:month
 */
const getParticipants = async (req, res, next) => {
  try {
    const { month } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ApiError(400, 'Invalid month format. Use YYYY-MM');
    }

    const luckyDraw = await LuckyDraw.findOne({ where: { month } });

    if (!luckyDraw) {
      throw new ApiError(404, `No lucky draw found for ${month}`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: participants } = await LuckyDrawParticipant.findAndCountAll({
      where: { luckyDrawId: luckyDraw.id },
      order: [['purchasedAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [{
        model: User,
        as: 'user',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'],
        required: false
      }]
    });

    res.status(200).json(
      new ApiResponse(200, {
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          status: luckyDraw.status
        },
        participants: participants.map(p => ({
          id: p.id,
          walletAddress: p.userWalletAddress,
          username: p.user?.username || null,
          profileImage: p.user?.profileImage || null,
          isVerified: p.user?.isVerified || false,
          nftTokenId: p.nftTokenId,
          purchasePrice: p.purchasePrice,
          purchaseCurrency: p.purchaseCurrency,
          purchasedAt: p.purchasedAt,
          isWinner: p.isWinner
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Participants retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is participating in current draw
 * @route GET /api/v1/lucky-draw/check/:walletAddress
 */
const checkParticipation = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const currentMonth = getCurrentMonth();
    const luckyDraw = await LuckyDraw.findOne({ where: { month: currentMonth } });

    if (!luckyDraw) {
      return res.status(200).json(
        new ApiResponse(200, {
          isParticipating: false,
          purchaseCount: 0,
          month: currentMonth
        }, 'User is not participating in current lucky draw')
      );
    }

    const purchases = await LuckyDrawParticipant.findAll({
      where: {
        luckyDrawId: luckyDraw.id,
        userWalletAddress: walletAddress
      },
      order: [['purchasedAt', 'DESC']]
    });

    res.status(200).json(
      new ApiResponse(200, {
        isParticipating: purchases.length > 0,
        purchaseCount: purchases.length,
        month: currentMonth,
        luckyDrawStatus: luckyDraw.status,
        purchases: purchases.map(p => ({
          nftTokenId: p.nftTokenId,
          purchasePrice: p.purchasePrice,
          purchasedAt: p.purchasedAt
        }))
      }, 'Participation status retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Draw winner for a specific month (admin only)
 * @route POST /api/v1/lucky-draw/draw
 */
const drawWinner = async (req, res, next) => {
  try {
    const { month, adminWalletAddress } = req.body;

    // Use provided month or default to current month
    const targetMonth = month || getCurrentMonth();

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new ApiError(400, 'Invalid month format. Use YYYY-MM');
    }

    const luckyDraw = await LuckyDraw.findOne({ where: { month: targetMonth } });

    if (!luckyDraw) {
      throw new ApiError(404, `No lucky draw found for ${targetMonth}`);
    }

    if (luckyDraw.status === 'completed') {
      throw new ApiError(400, `Lucky draw for ${targetMonth} has already been completed`);
    }

    if (luckyDraw.status === 'cancelled') {
      throw new ApiError(400, `Lucky draw for ${targetMonth} has been cancelled`);
    }

    // Get unique participants (one entry per wallet)
    const participants = await LuckyDrawParticipant.findAll({
      where: { luckyDrawId: luckyDraw.id },
      attributes: ['userWalletAddress'],
      group: ['userWalletAddress']
    });

    if (participants.length === 0) {
      throw new ApiError(400, 'No participants in this lucky draw');
    }

    // Randomly select a winner
    const randomIndex = Math.floor(Math.random() * participants.length);
    const winnerWallet = participants[randomIndex].userWalletAddress;

    // Get one of the winner's participant entries to mark as winner
    const winnerEntry = await LuckyDrawParticipant.findOne({
      where: {
        luckyDrawId: luckyDraw.id,
        userWalletAddress: winnerWallet
      }
    });

    // Update participant as winner
    await winnerEntry.update({ isWinner: true });

    // Update lucky draw with winner
    await luckyDraw.update({
      status: 'completed',
      winnerWalletAddress: winnerWallet,
      winningParticipantId: winnerEntry.id,
      drawnAt: new Date(),
      drawnBy: adminWalletAddress || 'system',
      totalParticipants: participants.length
    });

    // Get winner user details
    const winnerUser = await User.findOne({
      where: { walletAddress: winnerWallet },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    logger.info(`Lucky draw winner for ${targetMonth}: ${winnerWallet} (drawn by: ${adminWalletAddress || 'system'})`);

    res.status(200).json(
      new ApiResponse(200, {
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          status: 'completed',
          totalParticipants: participants.length,
          drawnAt: new Date()
        },
        winner: {
          walletAddress: winnerWallet,
          username: winnerUser?.username || null,
          profileImage: winnerUser?.profileImage || null,
          isVerified: winnerUser?.isVerified || false,
          participantId: winnerEntry.id,
          nftTokenId: winnerEntry.nftTokenId
        }
      }, `Winner drawn successfully for ${targetMonth}`)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get past winners / draw history
 * @route GET /api/v1/lucky-draw/winners
 */
const getWinners = async (req, res, next) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: draws } = await LuckyDraw.findAndCountAll({
      where: { status: 'completed' },
      order: [['month', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get winner details for each draw
    const winnersWithDetails = await Promise.all(draws.map(async (draw) => {
      const winnerUser = draw.winnerWalletAddress ? await User.findOne({
        where: { walletAddress: draw.winnerWalletAddress },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }) : null;

      return {
        month: draw.month,
        winner: {
          walletAddress: draw.winnerWalletAddress,
          username: winnerUser?.username || null,
          profileImage: winnerUser?.profileImage || null,
          isVerified: winnerUser?.isVerified || false
        },
        totalParticipants: draw.totalParticipants,
        prizeDescription: draw.prizeDescription,
        prizeAmount: draw.prizeAmount,
        prizeCurrency: draw.prizeCurrency,
        drawnAt: draw.drawnAt
      };
    }));

    res.status(200).json(
      new ApiResponse(200, {
        winners: winnersWithDetails,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Winners retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Set prize for a lucky draw (admin only)
 * @route PUT /api/v1/lucky-draw/:month/prize
 */
const setPrize = async (req, res, next) => {
  try {
    const { month } = req.params;
    const { prizeDescription, prizeAmount, prizeCurrency = 'XRP' } = req.body;

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ApiError(400, 'Invalid month format. Use YYYY-MM');
    }

    const luckyDraw = await getOrCreateLuckyDraw(month);

    await luckyDraw.update({
      prizeDescription,
      prizeAmount,
      prizeCurrency
    });

    logger.info(`Prize set for ${month}: ${prizeDescription || ''} ${prizeAmount || ''} ${prizeCurrency}`);

    res.status(200).json(
      new ApiResponse(200, {
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          prizeDescription: luckyDraw.prizeDescription,
          prizeAmount: luckyDraw.prizeAmount,
          prizeCurrency: luckyDraw.prizeCurrency
        }
      }, 'Prize updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a lucky draw (admin only)
 * @route PUT /api/v1/lucky-draw/:month/cancel
 */
const cancelDraw = async (req, res, next) => {
  try {
    const { month } = req.params;
    const { adminWalletAddress, reason } = req.body;

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ApiError(400, 'Invalid month format. Use YYYY-MM');
    }

    const luckyDraw = await LuckyDraw.findOne({ where: { month } });

    if (!luckyDraw) {
      throw new ApiError(404, `No lucky draw found for ${month}`);
    }

    if (luckyDraw.status === 'completed') {
      throw new ApiError(400, `Cannot cancel completed lucky draw`);
    }

    await luckyDraw.update({
      status: 'cancelled',
      drawnBy: adminWalletAddress || 'system'
    });

    logger.info(`Lucky draw for ${month} cancelled by ${adminWalletAddress || 'system'}. Reason: ${reason || 'N/A'}`);

    res.status(200).json(
      new ApiResponse(200, {
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          status: 'cancelled'
        }
      }, `Lucky draw for ${month} has been cancelled`)
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordPurchase,
  getCurrentDraw,
  getParticipants,
  checkParticipation,
  drawWinner,
  getWinners,
  setPrize,
  cancelDraw
};
