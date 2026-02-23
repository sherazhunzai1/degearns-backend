const cron = require('node-cron');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { luckyDrawEvents } = require('../services/socketService');

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
 * Get the last day of the current month at 23:00
 */
const getEndOfMonthDrawTime = () => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  lastDay.setHours(23, 0, 0, 0);
  return lastDay;
};

/**
 * Execute the live lucky draw with animation
 */
const executeLiveDraw = async (LuckyDraw, LuckyDrawParticipant, User, targetMonth) => {
  logger.info(`Starting automatic live lucky draw for ${targetMonth}`);

  const luckyDraw = await LuckyDraw.findOne({ where: { month: targetMonth } });

  if (!luckyDraw) {
    logger.warn(`No lucky draw found for ${targetMonth}`);
    return { success: false, reason: 'No lucky draw found' };
  }

  if (luckyDraw.status === 'completed') {
    logger.info(`Lucky draw for ${targetMonth} already completed`);
    return { success: false, reason: 'Already completed' };
  }

  if (luckyDraw.status === 'cancelled') {
    logger.info(`Lucky draw for ${targetMonth} was cancelled`);
    return { success: false, reason: 'Draw cancelled' };
  }

  if (luckyDraw.isLiveDrawActive) {
    logger.warn(`Live draw already in progress for ${targetMonth}`);
    return { success: false, reason: 'Draw in progress' };
  }

  // Get all participants with user details
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
    logger.warn(`No participants in lucky draw for ${targetMonth}`);

    // Cancel the draw if no participants
    await luckyDraw.update({
      status: 'cancelled',
      drawnBy: 'system'
    });

    try {
      luckyDrawEvents.drawCancelled(targetMonth, {
        reason: 'No participants in this month\'s draw'
      });
    } catch (socketError) {
      logger.warn('Failed to emit draw cancelled event:', socketError.message);
    }

    return { success: false, reason: 'No participants' };
  }

  // Format participants for frontend
  const formattedParticipants = uniqueWallets.map((wallet, idx) => {
    const entry = participantEntries.find(p => p.userWalletAddress === wallet);
    return {
      index: idx,
      walletAddress: wallet,
      username: entry?.user?.username || null,
      profileImage: entry?.user?.profileImage || null,
      isVerified: entry?.user?.isVerified || false
    };
  });

  const winnersCount = Math.min(luckyDraw.totalWinners || 10, uniqueWallets.length);
  const allWinnersData = [];
  const remainingWallets = [...uniqueWallets];
  const remainingParticipants = [...formattedParticipants];

  try {
    // Mark draw as active
    await luckyDraw.update({ isLiveDrawActive: true });

    // Emit draw starting event
    luckyDrawEvents.drawStarting(targetMonth, {
      totalParticipants: uniqueWallets.length,
      totalWinners: winnersCount,
      participants: formattedParticipants
    });

    // Wait for clients to prepare
    await sleep(3000);

    // Draw each winner one by one
    for (let winnerNum = 1; winnerNum <= winnersCount; winnerNum++) {
      // Announce which winner is being drawn
      luckyDrawEvents.shuffling(targetMonth, {
        winnerNumber: winnerNum,
        totalWinners: winnersCount,
        phase: 'announce',
        message: `Drawing Winner #${winnerNum} of ${winnersCount}`,
        highlightedIndex: -1,
        highlightedParticipant: null,
        speed: 'pause'
      });

      await sleep(1500);

      // Randomly select from remaining
      const randomIndex = Math.floor(Math.random() * remainingWallets.length);
      const winnerWallet = remainingWallets[randomIndex];
      const winnerParticipantIndex = formattedParticipants.findIndex(p => p.walletAddress === winnerWallet);

      // Shuffle animation for this winner
      const shuffleRounds = 12;
      for (let i = 0; i < shuffleRounds; i++) {
        const rIdx = Math.floor(Math.random() * remainingParticipants.length);
        const highlighted = remainingParticipants[rIdx];
        const originalIndex = formattedParticipants.findIndex(p => p.walletAddress === highlighted.walletAddress);

        luckyDrawEvents.shuffling(targetMonth, {
          winnerNumber: winnerNum,
          totalWinners: winnersCount,
          phase: 'shuffle',
          round: i + 1,
          totalRounds: shuffleRounds,
          highlightedIndex: originalIndex,
          highlightedParticipant: highlighted,
          speed: i < 4 ? 'fast' : i < 8 ? 'medium' : 'slow'
        });

        const delay = i < 4 ? 100 : i < 8 ? 200 : 400;
        await sleep(delay);
      }

      // Final highlighting for this winner
      const finalRounds = 4;
      for (let i = 0; i < finalRounds; i++) {
        const isFinal = i === finalRounds - 1;
        let idx;
        if (isFinal) {
          idx = winnerParticipantIndex;
        } else {
          const rIdx = Math.floor(Math.random() * remainingParticipants.length);
          idx = formattedParticipants.findIndex(p => p.walletAddress === remainingParticipants[rIdx].walletAddress);
        }

        luckyDrawEvents.highlighting(targetMonth, {
          winnerNumber: winnerNum,
          totalWinners: winnersCount,
          round: i + 1,
          totalRounds: finalRounds,
          highlightedIndex: idx,
          highlightedParticipant: formattedParticipants[idx],
          isFinal
        });

        await sleep(800);
      }

      // Mark winner in database
      const winnerEntry = await LuckyDrawParticipant.findOne({
        where: {
          luckyDrawId: luckyDraw.id,
          userWalletAddress: winnerWallet
        }
      });
      await winnerEntry.update({ isWinner: true, winnerPosition: winnerNum });

      const winnerUser = await User.findOne({
        where: { walletAddress: winnerWallet },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });

      const winnerData = {
        position: winnerNum,
        walletAddress: winnerWallet,
        username: winnerUser?.username || null,
        profileImage: winnerUser?.profileImage || null,
        isVerified: winnerUser?.isVerified || false,
        participantId: winnerEntry.id,
        nftTokenId: winnerEntry.nftTokenId
      };

      allWinnersData.push(winnerData);

      // Announce this winner
      luckyDrawEvents.winnerSelected(targetMonth, {
        winnerNumber: winnerNum,
        totalWinners: winnersCount,
        winner: winnerData,
        allWinners: allWinnersData,
        prizeDescription: luckyDraw.prizeDescription,
        prizeAmount: luckyDraw.prizeAmount,
        prizeCurrency: luckyDraw.prizeCurrency
      });

      // Remove winner from remaining pool
      remainingWallets.splice(randomIndex, 1);
      const rpIdx = remainingParticipants.findIndex(p => p.walletAddress === winnerWallet);
      remainingParticipants.splice(rpIdx, 1);

      logger.info(`Lucky draw winner #${winnerNum} for ${targetMonth}: ${winnerWallet}`);

      // Pause between winners
      if (winnerNum < winnersCount) {
        await sleep(3000);
      }
    }

    // Update lucky draw as completed
    await luckyDraw.update({
      status: 'completed',
      drawnAt: new Date(),
      drawnBy: 'system-auto',
      totalParticipants: uniqueWallets.length,
      isLiveDrawActive: false
    });

    // Emit draw complete
    await sleep(2000);
    luckyDrawEvents.drawComplete(targetMonth, {
      winners: allWinnersData,
      totalParticipants: uniqueWallets.length,
      totalWinners: winnersCount
    });

    logger.info(`Automatic lucky draw completed for ${targetMonth}. ${winnersCount} winners drawn`);

    return {
      success: true,
      winners: allWinnersData,
      totalParticipants: uniqueWallets.length
    };

  } catch (error) {
    logger.error(`Error during automatic live draw for ${targetMonth}:`, error);

    // Reset the live draw flag
    try {
      await luckyDraw.update({ isLiveDrawActive: false });
    } catch (updateError) {
      logger.error('Failed to reset isLiveDrawActive flag:', updateError);
    }

    return { success: false, reason: 'Error during draw', error: error.message };
  }
};

/**
 * Initialize lucky draw cron jobs
 * @param {Object} models - Sequelize models
 */
const initLuckyDrawJobs = (models) => {
  const { LuckyDraw, LuckyDrawParticipant, User } = models;

  // Run at 23:00 on the last day of every month
  // Cron expression: minute hour day month weekday
  // We use a workaround since cron doesn't have "last day of month"
  // This runs at 23:00 on days 28-31 and checks if it's the last day
  const monthlyDrawJob = cron.schedule('0 23 28-31 * *', async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if tomorrow is a new month (meaning today is last day)
    if (tomorrow.getMonth() !== now.getMonth()) {
      const currentMonth = getCurrentMonth();
      logger.info(`Triggering automatic lucky draw for ${currentMonth}`);

      try {
        const result = await executeLiveDraw(LuckyDraw, LuckyDrawParticipant, User, currentMonth);
        logger.info(`Automatic draw result for ${currentMonth}:`, result);
      } catch (error) {
        logger.error(`Failed to execute automatic draw for ${currentMonth}:`, error);
      }
    } else {
      logger.debug(`Not the last day of month, skipping lucky draw check`);
    }
  }, {
    scheduled: false,
    timezone: 'UTC'
  });

  // Job to auto-schedule draw time for new months
  const scheduleSetupJob = cron.schedule('0 0 1 * *', async () => {
    // Run at midnight on the 1st of every month
    const currentMonth = getCurrentMonth();
    logger.info(`Setting up lucky draw schedule for ${currentMonth}`);

    try {
      let luckyDraw = await LuckyDraw.findOne({ where: { month: currentMonth } });

      if (!luckyDraw) {
        const drawTime = getEndOfMonthDrawTime();
        luckyDraw = await LuckyDraw.create({
          month: currentMonth,
          status: 'active',
          totalParticipants: 0,
          drawScheduledAt: drawTime
        });
        logger.info(`Created lucky draw for ${currentMonth} scheduled at ${drawTime.toISOString()}`);
      } else if (!luckyDraw.drawScheduledAt) {
        const drawTime = getEndOfMonthDrawTime();
        await luckyDraw.update({ drawScheduledAt: drawTime });
        logger.info(`Updated lucky draw schedule for ${currentMonth} to ${drawTime.toISOString()}`);
      }
    } catch (error) {
      logger.error(`Failed to setup lucky draw for ${currentMonth}:`, error);
    }
  }, {
    scheduled: false,
    timezone: 'UTC'
  });

  return {
    start: () => {
      monthlyDrawJob.start();
      scheduleSetupJob.start();
      logger.info('Lucky draw cron jobs started');

      // Ensure current month has a draw scheduled
      ensureCurrentMonthScheduled(LuckyDraw);
    },
    stop: () => {
      monthlyDrawJob.stop();
      scheduleSetupJob.stop();
      logger.info('Lucky draw cron jobs stopped');
    },
    // Manual trigger for testing
    triggerDraw: async (month) => {
      const targetMonth = month || getCurrentMonth();
      return await executeLiveDraw(LuckyDraw, LuckyDrawParticipant, User, targetMonth);
    }
  };
};

/**
 * Ensure current month has a lucky draw with scheduled time
 */
const ensureCurrentMonthScheduled = async (LuckyDraw) => {
  try {
    const currentMonth = getCurrentMonth();
    let luckyDraw = await LuckyDraw.findOne({ where: { month: currentMonth } });

    if (!luckyDraw) {
      const drawTime = getEndOfMonthDrawTime();
      luckyDraw = await LuckyDraw.create({
        month: currentMonth,
        status: 'active',
        totalParticipants: 0,
        drawScheduledAt: drawTime
      });
      logger.info(`Created lucky draw for ${currentMonth} scheduled at ${drawTime.toISOString()}`);
    } else if (!luckyDraw.drawScheduledAt && luckyDraw.status === 'active') {
      const drawTime = getEndOfMonthDrawTime();
      await luckyDraw.update({ drawScheduledAt: drawTime });
      logger.info(`Set draw schedule for ${currentMonth} to ${drawTime.toISOString()}`);
    }
  } catch (error) {
    logger.error('Failed to ensure current month scheduled:', error);
  }
};

module.exports = {
  initLuckyDrawJobs,
  getCurrentMonth,
  getEndOfMonthDrawTime
};
