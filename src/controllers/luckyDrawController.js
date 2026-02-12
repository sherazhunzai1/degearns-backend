const { Op } = require('sequelize');
const { LuckyDraw, LuckyDrawParticipant, User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { luckyDrawEvents } = require('../services/socketService');

/**
 * Helper to calculate countdown info
 */
const getCountdownInfo = (drawScheduledAt) => {
  if (!drawScheduledAt) {
    return null;
  }

  const now = new Date();
  const scheduledTime = new Date(drawScheduledAt);
  const diffMs = scheduledTime.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isExpired: true,
      scheduledAt: scheduledTime.toISOString(),
      remainingMs: 0,
      remainingSeconds: 0,
      remainingMinutes: 0,
      remainingHours: 0,
      remainingDays: 0
    };
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return {
    isExpired: false,
    scheduledAt: scheduledTime.toISOString(),
    remainingMs: diffMs,
    remainingSeconds: seconds % 60,
    remainingMinutes: minutes % 60,
    remainingHours: hours % 24,
    remainingDays: days,
    formatted: `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`
  };
};

/**
 * Sleep helper for animation delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get current month in YYYY-MM format
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

    // Get user details for socket event
    const user = await User.findOne({
      where: { walletAddress: buyerWalletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    // Emit socket event for new participant
    try {
      luckyDrawEvents.newParticipant(currentMonth, {
        participant: {
          walletAddress: buyerWalletAddress,
          username: user?.username || null,
          profileImage: user?.profileImage || null,
          isVerified: user?.isVerified || false,
          nftTokenId,
          purchasedAt: participant.purchasedAt
        },
        totalParticipants: uniqueParticipants
      });
    } catch (socketError) {
      logger.warn('Failed to emit socket event for new participant:', socketError.message);
    }

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

    // Get winner details if completed
    let winnerDetails = null;
    if (luckyDraw.status === 'completed' && luckyDraw.winnerWalletAddress) {
      const winnerUser = await User.findOne({
        where: { walletAddress: luckyDraw.winnerWalletAddress },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });
      winnerDetails = {
        walletAddress: luckyDraw.winnerWalletAddress,
        username: winnerUser?.username || null,
        profileImage: winnerUser?.profileImage || null,
        isVerified: winnerUser?.isVerified || false,
        drawnAt: luckyDraw.drawnAt
      };
    }

    // Calculate countdown info
    const countdown = getCountdownInfo(luckyDraw.drawScheduledAt);

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
          drawScheduledAt: luckyDraw.drawScheduledAt,
          isLiveDrawActive: luckyDraw.isLiveDrawActive,
          countdown,
          winner: winnerDetails
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
 * Supports live draw with real-time animation
 * @route POST /api/v1/lucky-draw/draw
 */
const drawWinner = async (req, res, next) => {
  try {
    const { month, adminWalletAddress, isLiveDraw = false } = req.body;

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

    if (luckyDraw.isLiveDrawActive) {
      throw new ApiError(400, 'A live draw is already in progress');
    }

    // Get unique participants with user details
    const participantEntries = await LuckyDrawParticipant.findAll({
      where: { luckyDrawId: luckyDraw.id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'],
        required: false
      }]
    });

    // Get unique wallets
    const uniqueWallets = [...new Set(participantEntries.map(p => p.userWalletAddress))];

    if (uniqueWallets.length === 0) {
      throw new ApiError(400, 'No participants in this lucky draw');
    }

    // Format participants for frontend
    const formattedParticipants = uniqueWallets.map(wallet => {
      const entry = participantEntries.find(p => p.userWalletAddress === wallet);
      return {
        walletAddress: wallet,
        username: entry?.user?.username || null,
        profileImage: entry?.user?.profileImage || null,
        isVerified: entry?.user?.isVerified || false
      };
    });

    // Randomly select a winner
    const randomIndex = Math.floor(Math.random() * uniqueWallets.length);
    const winnerWallet = uniqueWallets[randomIndex];

    // If live draw, perform animated selection
    if (isLiveDraw) {
      // Mark draw as active
      await luckyDraw.update({ isLiveDrawActive: true });

      // Emit draw starting event
      luckyDrawEvents.drawStarting(targetMonth, {
        totalParticipants: uniqueWallets.length,
        participants: formattedParticipants
      });

      // Shuffle animation phase (highlight random participants)
      const shuffleRounds = 15;
      for (let i = 0; i < shuffleRounds; i++) {
        const highlightIndex = Math.floor(Math.random() * uniqueWallets.length);
        const highlightedParticipant = formattedParticipants[highlightIndex];

        luckyDrawEvents.shuffling(targetMonth, {
          round: i + 1,
          totalRounds: shuffleRounds,
          highlightedIndex: highlightIndex,
          highlightedParticipant,
          speed: i < 5 ? 'fast' : i < 10 ? 'medium' : 'slow'
        });

        // Increasing delay as we slow down
        const delay = i < 5 ? 100 : i < 10 ? 200 : 400;
        await sleep(delay);
      }

      // Final highlighting phases - getting closer to winner
      const finalRounds = 5;
      for (let i = 0; i < finalRounds; i++) {
        // On last round, highlight the actual winner
        const idx = i === finalRounds - 1 ? randomIndex : Math.floor(Math.random() * uniqueWallets.length);

        luckyDrawEvents.highlighting(targetMonth, {
          round: i + 1,
          totalRounds: finalRounds,
          highlightedIndex: idx,
          highlightedParticipant: formattedParticipants[idx],
          isFinal: i === finalRounds - 1
        });

        await sleep(800);
      }

      // Mark draw as no longer active
      await luckyDraw.update({ isLiveDrawActive: false });
    }

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
      totalParticipants: uniqueWallets.length,
      isLiveDrawActive: false
    });

    // Get winner user details
    const winnerUser = await User.findOne({
      where: { walletAddress: winnerWallet },
      attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
    });

    const winnerData = {
      walletAddress: winnerWallet,
      username: winnerUser?.username || null,
      profileImage: winnerUser?.profileImage || null,
      isVerified: winnerUser?.isVerified || false,
      participantId: winnerEntry.id,
      nftTokenId: winnerEntry.nftTokenId
    };

    // Emit winner selected event (for live draw)
    if (isLiveDraw) {
      luckyDrawEvents.winnerSelected(targetMonth, {
        winner: winnerData,
        prizeDescription: luckyDraw.prizeDescription,
        prizeAmount: luckyDraw.prizeAmount,
        prizeCurrency: luckyDraw.prizeCurrency
      });

      // Emit draw complete after a short delay
      await sleep(2000);
      luckyDrawEvents.drawComplete(targetMonth, {
        winner: winnerData,
        totalParticipants: uniqueWallets.length
      });
    }

    logger.info(`Lucky draw winner for ${targetMonth}: ${winnerWallet} (drawn by: ${adminWalletAddress || 'system'}, live: ${isLiveDraw})`);

    res.status(200).json(
      new ApiResponse(200, {
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          status: 'completed',
          totalParticipants: uniqueWallets.length,
          drawnAt: new Date()
        },
        winner: winnerData,
        wasLiveDraw: isLiveDraw
      }, `Winner drawn successfully for ${targetMonth}`)
    );
  } catch (error) {
    // If error during live draw, make sure to reset the flag
    if (error && req.body?.isLiveDraw) {
      const targetMonth = req.body.month || getCurrentMonth();
      try {
        await LuckyDraw.update(
          { isLiveDrawActive: false },
          { where: { month: targetMonth } }
        );
      } catch (updateError) {
        logger.error('Failed to reset isLiveDrawActive flag:', updateError);
      }
    }
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
 * Schedule draw time (admin only)
 * @route PUT /api/v1/lucky-draw/:month/schedule
 */
const scheduleDraw = async (req, res, next) => {
  try {
    const { month } = req.params;
    const { drawScheduledAt } = req.body;

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ApiError(400, 'Invalid month format. Use YYYY-MM');
    }

    if (!drawScheduledAt) {
      throw new ApiError(400, 'Draw scheduled time is required');
    }

    const scheduledDate = new Date(drawScheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new ApiError(400, 'Invalid date format for drawScheduledAt');
    }

    if (scheduledDate <= new Date()) {
      throw new ApiError(400, 'Scheduled time must be in the future');
    }

    const luckyDraw = await getOrCreateLuckyDraw(month);

    if (luckyDraw.status === 'completed') {
      throw new ApiError(400, 'Cannot schedule a completed draw');
    }

    if (luckyDraw.status === 'cancelled') {
      throw new ApiError(400, 'Cannot schedule a cancelled draw');
    }

    await luckyDraw.update({ drawScheduledAt: scheduledDate });

    const countdown = getCountdownInfo(scheduledDate);

    // Emit countdown update to all clients in the room
    try {
      luckyDrawEvents.countdownUpdate(month, {
        drawScheduledAt: scheduledDate.toISOString(),
        countdown
      });
    } catch (socketError) {
      logger.warn('Failed to emit countdown update:', socketError.message);
    }

    logger.info(`Lucky draw for ${month} scheduled at ${scheduledDate.toISOString()}`);

    res.status(200).json(
      new ApiResponse(200, {
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          drawScheduledAt: scheduledDate,
          countdown
        }
      }, 'Draw scheduled successfully')
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

    // Emit cancellation event
    try {
      luckyDrawEvents.drawCancelled(month, {
        reason: reason || 'Draw cancelled by admin'
      });
    } catch (socketError) {
      logger.warn('Failed to emit draw cancelled event:', socketError.message);
    }

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

/**
 * Get all participants for live draw display
 * @route GET /api/v1/lucky-draw/:month/all-participants
 */
const getAllParticipantsForDraw = async (req, res, next) => {
  try {
    const { month } = req.params;

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ApiError(400, 'Invalid month format. Use YYYY-MM');
    }

    const luckyDraw = await LuckyDraw.findOne({ where: { month } });

    if (!luckyDraw) {
      throw new ApiError(404, `No lucky draw found for ${month}`);
    }

    // Get all participants with user details
    const participantEntries = await LuckyDrawParticipant.findAll({
      where: { luckyDrawId: luckyDraw.id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'],
        required: false
      }],
      order: [['purchasedAt', 'ASC']]
    });

    // Get unique wallets
    const uniqueWallets = [...new Set(participantEntries.map(p => p.userWalletAddress))];

    // Format participants
    const participants = uniqueWallets.map((wallet, index) => {
      const entry = participantEntries.find(p => p.userWalletAddress === wallet);
      const purchaseCount = participantEntries.filter(p => p.userWalletAddress === wallet).length;

      return {
        index,
        walletAddress: wallet,
        username: entry?.user?.username || null,
        profileImage: entry?.user?.profileImage || null,
        isVerified: entry?.user?.isVerified || false,
        purchaseCount,
        isWinner: entry?.isWinner || false
      };
    });

    res.status(200).json(
      new ApiResponse(200, {
        luckyDraw: {
          id: luckyDraw.id,
          month: luckyDraw.month,
          status: luckyDraw.status,
          drawScheduledAt: luckyDraw.drawScheduledAt,
          isLiveDrawActive: luckyDraw.isLiveDrawActive,
          countdown: getCountdownInfo(luckyDraw.drawScheduledAt)
        },
        participants,
        totalParticipants: participants.length
      }, 'All participants retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordPurchase,
  getCurrentDraw,
  getParticipants,
  getAllParticipantsForDraw,
  checkParticipation,
  drawWinner,
  getWinners,
  setPrize,
  scheduleDraw,
  cancelDraw
};
