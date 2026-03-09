const { Op } = require('sequelize');
const { sequelize, User, ReferralReward, ReferralClaim, ReferralAuditLog } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

// Referral reward percentage (10% of purchase amount)
const REFERRAL_REWARD_PERCENTAGE = 10;

/**
 * Get referral dashboard data
 * Shows: number of referrals, total earnings, pending rewards, next payout, transaction list
 */
const getDashboard = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const user = await User.findOne({ where: { walletAddress } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Count total referrals
    const totalReferrals = await User.count({ where: { referredBy: walletAddress } });

    // Get reward aggregations by status
    const rewardStats = await ReferralReward.findAll({
      where: { referrerWalletAddress: walletAddress },
      attributes: [
        'status',
        [sequelize.fn('SUM', sequelize.cast(sequelize.col('rewardAmount'), 'DECIMAL(20,6)')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // Parse stats
    let totalEarnings = 0;
    let pendingRewards = 0;
    let claimableRewards = 0;
    let paidRewards = 0;
    let frozenRewards = 0;

    rewardStats.forEach(stat => {
      const amount = parseFloat(stat.total) || 0;
      switch (stat.status) {
        case 'pending':
          pendingRewards = amount;
          break;
        case 'claimable':
          claimableRewards = amount;
          break;
        case 'claimed':
        case 'paid':
          paidRewards += amount;
          break;
        case 'frozen':
          frozenRewards = amount;
          break;
      }
      totalEarnings += amount;
    });

    // Get recent transactions (rewards) with referred user info
    const transactions = await ReferralReward.findAll({
      where: { referrerWalletAddress: walletAddress },
      include: [{
        model: User,
        as: 'referredUser',
        attributes: ['walletAddress', 'username', 'profileImage']
      }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // Set referral code to wallet address if not set (backfill for existing users)
    const referralCode = user.referralCode || walletAddress;
    if (!user.referralCode) {
      await User.update({ referralCode: walletAddress }, { where: { walletAddress } });
    }

    // Get next payout date (first of next month)
    const now = new Date();
    const nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    res.status(200).json(
      new ApiResponse(200, {
        referralCode,
        referralLink: `https://degearns.com/signup?ref=${referralCode}`,
        totalReferrals,
        totalEarnings: totalEarnings.toString(),
        pendingRewards: pendingRewards.toString(),
        claimableRewards: claimableRewards.toString(),
        paidRewards: paidRewards.toString(),
        frozenRewards: frozenRewards.toString(),
        nextPayoutDate,
        transactions
      }, 'Referral dashboard retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed transaction history for transparency
 * Shows: who purchased, what they purchased, reward amount, payment date, tx hash
 */
const getTransactionHistory = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // optional filter

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const whereClause = { referrerWalletAddress: walletAddress };
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: transactions } = await ReferralReward.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'referredUser',
        attributes: ['walletAddress', 'username', 'profileImage']
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.status(200).json(
      new ApiResponse(200, {
        transactions,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      }, 'Transaction history retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get referral leaderboard
 * Shows: all referrers, number of referrals, total rewards
 */
const getLeaderboard = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Get users who have referrals, ranked by total referrals
    const referrers = await User.findAll({
      attributes: [
        'walletAddress',
        'username',
        'profileImage',
        'isVerified',
        [
          sequelize.literal(`(SELECT COUNT(*) FROM Users AS r WHERE r.referredBy = User.walletAddress)`),
          'totalReferrals'
        ],
        [
          sequelize.literal(`(SELECT COALESCE(SUM(CAST(rr.rewardAmount AS DECIMAL(20,6))), 0) FROM ReferralRewards AS rr WHERE rr.referrerWalletAddress = User.walletAddress AND rr.status IN ('paid', 'claimed', 'claimable', 'pending'))`),
          'totalRewards'
        ],
        [
          sequelize.literal(`(SELECT COALESCE(SUM(CAST(rr2.rewardAmount AS DECIMAL(20,6))), 0) FROM ReferralRewards AS rr2 WHERE rr2.referrerWalletAddress = User.walletAddress AND rr2.status = 'claimable')`),
          'claimableRewards'
        ]
      ],
      having: sequelize.literal('totalReferrals > 0'),
      order: [[sequelize.literal('totalReferrals'), 'DESC']],
      limit,
      offset: (page - 1) * limit,
      subQuery: false
    });

    // Get total count of referrers
    const [countResult] = await sequelize.query(
      `SELECT COUNT(DISTINCT referredBy) as total FROM Users WHERE referredBy IS NOT NULL`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const total = countResult.total || 0;

    res.status(200).json(
      new ApiResponse(200, {
        leaderboard: referrers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }, 'Referral leaderboard retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Claim rewards - initiates a claim for all claimable rewards
 */
const claimRewards = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const user = await User.findOne({ where: { walletAddress } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Get all claimable rewards
    const claimableRewards = await ReferralReward.findAll({
      where: {
        referrerWalletAddress: walletAddress,
        status: 'claimable'
      },
      transaction
    });

    if (claimableRewards.length === 0) {
      throw new ApiError(400, 'No claimable rewards available');
    }

    // Calculate total
    const totalAmount = claimableRewards.reduce((sum, reward) => {
      return sum + parseFloat(reward.rewardAmount);
    }, 0);

    // Create claim record
    const claim = await ReferralClaim.create({
      referrerWalletAddress: walletAddress,
      totalAmount: totalAmount.toString(),
      rewardCount: claimableRewards.length,
      status: 'pending'
    }, { transaction });

    // Update all claimable rewards to claimed status
    await ReferralReward.update(
      { status: 'claimed', claimId: claim.id },
      {
        where: {
          referrerWalletAddress: walletAddress,
          status: 'claimable'
        },
        transaction
      }
    );

    // Create audit log entries
    await ReferralAuditLog.create({
      action: 'claim_initiated',
      referrerWalletAddress: walletAddress,
      claimId: claim.id,
      amount: totalAmount.toString(),
      metadata: {
        rewardCount: claimableRewards.length,
        rewardIds: claimableRewards.map(r => r.id)
      }
    }, { transaction });

    // Create individual audit logs for each reward
    const auditLogs = claimableRewards.map(reward => ({
      action: 'reward_claimed',
      referrerWalletAddress: walletAddress,
      referredWalletAddress: reward.referredWalletAddress,
      rewardId: reward.id,
      claimId: claim.id,
      serviceType: reward.serviceType,
      amount: reward.rewardAmount
    }));
    await ReferralAuditLog.bulkCreate(auditLogs, { transaction });

    await transaction.commit();

    logger.info(`Referral claim initiated: ${claim.id} for ${walletAddress}, amount: ${totalAmount}, rewards: ${claimableRewards.length}`);

    res.status(200).json(
      new ApiResponse(200, {
        claimId: claim.id,
        totalAmount: totalAmount.toString(),
        rewardCount: claimableRewards.length,
        status: 'pending'
      }, 'Rewards claim initiated successfully. Payout will be processed shortly.')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get claim history
 */
const getClaimHistory = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const { count, rows: claims } = await ReferralClaim.findAndCountAll({
      where: { referrerWalletAddress: walletAddress },
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.status(200).json(
      new ApiResponse(200, {
        claims,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      }, 'Claim history retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit log for a user's referral activity
 */
const getAuditLog = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const { count, rows: logs } = await ReferralAuditLog.findAndCountAll({
      where: {
        [Op.or]: [
          { referrerWalletAddress: walletAddress },
          { referredWalletAddress: walletAddress }
        ]
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.status(200).json(
      new ApiResponse(200, {
        logs,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      }, 'Referral audit log retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Record a referral reward when a referred user makes a purchase.
 * Called internally by subscription/boost purchase flows.
 *
 * @param {Object} params
 * @param {string} params.purchaserWalletAddress - wallet of the user who made the purchase
 * @param {string} params.serviceType - 'subscription' or 'boost'
 * @param {string} params.serviceName - name/plan of the service
 * @param {string} params.purchaseAmount - amount paid (in drops/XRP)
 * @param {string} params.purchaseTransactionHash - tx hash of the purchase
 * @returns {Object|null} the created reward, or null if no referrer
 */
const recordReferralReward = async (params) => {
  try {
    const {
      purchaserWalletAddress,
      serviceType,
      serviceName,
      purchaseAmount,
      purchaseTransactionHash
    } = params;

    // Find the purchaser and check if they were referred
    const purchaser = await User.findOne({ where: { walletAddress: purchaserWalletAddress } });
    if (!purchaser || !purchaser.referredBy) {
      return null; // No referrer, no reward
    }

    const referrerWalletAddress = purchaser.referredBy;

    // Anti-abuse: verify referrer still exists and is not banned
    const referrer = await User.findOne({ where: { walletAddress: referrerWalletAddress } });
    if (!referrer || referrer.isBanned) {
      logger.warn(`Referral reward skipped - referrer ${referrerWalletAddress} not found or banned`);
      return null;
    }

    // Calculate reward
    const rewardAmount = (parseFloat(purchaseAmount) * REFERRAL_REWARD_PERCENTAGE / 100).toString();

    // Create reward record
    const reward = await ReferralReward.create({
      referrerWalletAddress,
      referredWalletAddress: purchaserWalletAddress,
      serviceType,
      serviceName,
      purchaseAmount,
      rewardAmount,
      rewardPercentage: REFERRAL_REWARD_PERCENTAGE,
      status: 'claimable', // Immediately claimable
      purchaseTransactionHash
    });

    // Create audit log
    await ReferralAuditLog.create({
      action: 'reward_created',
      referrerWalletAddress,
      referredWalletAddress: purchaserWalletAddress,
      rewardId: reward.id,
      serviceType,
      amount: rewardAmount,
      transactionHash: purchaseTransactionHash,
      metadata: {
        serviceName,
        purchaseAmount,
        rewardPercentage: REFERRAL_REWARD_PERCENTAGE
      }
    });

    logger.info(`Referral reward created: ${reward.id}, referrer: ${referrerWalletAddress}, amount: ${rewardAmount}, service: ${serviceType}/${serviceName}`);

    return reward;
  } catch (error) {
    logger.error(`Error recording referral reward: ${error.message}`);
    return null; // Don't let referral errors break the purchase flow
  }
};

/**
 * Freeze rewards for a user (anti-abuse, called by admin)
 */
const freezeUserRewards = async (req, res, next) => {
  try {
    const { walletAddress, reason } = req.body;

    if (!walletAddress || !reason) {
      throw new ApiError(400, 'Wallet address and reason are required');
    }

    const [updatedCount] = await ReferralReward.update(
      { status: 'frozen', frozenReason: reason },
      {
        where: {
          referrerWalletAddress: walletAddress,
          status: { [Op.in]: ['pending', 'claimable'] }
        }
      }
    );

    // Audit log
    await ReferralAuditLog.create({
      action: 'abuse_detected',
      referrerWalletAddress: walletAddress,
      metadata: { reason, frozenCount: updatedCount }
    });

    logger.warn(`Referral rewards frozen for ${walletAddress}: ${reason} (${updatedCount} rewards)`);

    res.status(200).json(
      new ApiResponse(200, {
        frozenCount: updatedCount
      }, `${updatedCount} rewards frozen for suspicious activity`)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Unfreeze rewards for a user (admin action)
 */
const unfreezeUserRewards = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const [updatedCount] = await ReferralReward.update(
      { status: 'claimable', frozenReason: null },
      {
        where: {
          referrerWalletAddress: walletAddress,
          status: 'frozen'
        }
      }
    );

    // Audit log
    await ReferralAuditLog.create({
      action: 'rewards_unfrozen',
      referrerWalletAddress: walletAddress,
      metadata: { unfrozenCount: updatedCount }
    });

    logger.info(`Referral rewards unfrozen for ${walletAddress} (${updatedCount} rewards)`);

    res.status(200).json(
      new ApiResponse(200, {
        unfrozenCount: updatedCount
      }, `${updatedCount} rewards unfrozen`)
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getTransactionHistory,
  getLeaderboard,
  claimRewards,
  getClaimHistory,
  getAuditLog,
  recordReferralReward,
  freezeUserRewards,
  unfreezeUserRewards
};
