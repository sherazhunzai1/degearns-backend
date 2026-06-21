const { User, Follow, ActivityLog } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const {
  getActiveSubscriptionsForWallets,
  enrichItemsWithSubscriptions,
  resolvePrimaryWallet
} = require('../utils/userHelpers');

/**
 * Helper function to log activity (async, non-blocking)
 */
const logActivity = async (data) => {
  try {
    await ActivityLog.logActivity(data);
  } catch (error) {
    logger.error('Error logging activity:', error);
    // Don't throw - activity logging should not block the main operation
  }
};

/**
 * Follow a user
 */
const followUser = async (req, res, next) => {
  try {
    let { followerWalletAddress, followingWalletAddress } = req.body;

    if (!followerWalletAddress || !followingWalletAddress) {
      throw new ApiError(400, 'Both follower and following wallet addresses are required');
    }

    followerWalletAddress = await resolvePrimaryWallet(followerWalletAddress);
    followingWalletAddress = await resolvePrimaryWallet(followingWalletAddress);

    // Can't follow yourself
    if (followerWalletAddress === followingWalletAddress) {
      throw new ApiError(400, 'You cannot follow yourself');
    }

    // Verify follower exists
    const follower = await User.findOne({
      where: { walletAddress: followerWalletAddress }
    });

    if (!follower) {
      throw new ApiError(404, 'Follower user not found');
    }

    // Verify following user exists
    const following = await User.findOne({
      where: { walletAddress: followingWalletAddress }
    });

    if (!following) {
      throw new ApiError(404, 'User to follow not found');
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      where: {
        followerWalletAddress,
        followingWalletAddress
      }
    });

    if (existingFollow) {
      throw new ApiError(400, 'You are already following this user');
    }

    // Create follow relationship
    const follow = await Follow.create({
      followerWalletAddress,
      followingWalletAddress
    });

    // Get updated follower count for the followed user
    const followersCount = await Follow.count({
      where: { followingWalletAddress }
    });

    // Create notification for the followed user (async, don't wait)
    notificationService.createFollowNotification({
      followId: follow.id,
      followedWalletAddress: followingWalletAddress,
      followerWalletAddress: followerWalletAddress,
      followerUsername: follower.username
    }).catch(err => logger.error('Error creating follow notification:', err));

    // Log follow_give activity for the follower (async, non-blocking)
    logActivity({
      userWalletAddress: followerWalletAddress,
      activityType: 'follow_give',
      relatedId: null,
      relatedType: 'user',
      counterpartyWalletAddress: followingWalletAddress,
      metadata: {}
    });

    // Log follow_receive activity for the followed user (async, non-blocking)
    logActivity({
      userWalletAddress: followingWalletAddress,
      activityType: 'follow_receive',
      relatedId: null,
      relatedType: 'user',
      counterpartyWalletAddress: followerWalletAddress,
      metadata: {}
    });

    logger.info(`${followerWalletAddress} followed ${followingWalletAddress}`);

    res.status(201).json(
      new ApiResponse(201, {
        follow: {
          id: follow.id,
          followerWalletAddress: follow.followerWalletAddress,
          followingWalletAddress: follow.followingWalletAddress,
          createdAt: follow.createdAt
        },
        followersCount
      }, 'User followed successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Unfollow a user
 */
const unfollowUser = async (req, res, next) => {
  try {
    let { followerWalletAddress, followingWalletAddress } = req.body;

    if (!followerWalletAddress || !followingWalletAddress) {
      throw new ApiError(400, 'Both follower and following wallet addresses are required');
    }

    followerWalletAddress = await resolvePrimaryWallet(followerWalletAddress);
    followingWalletAddress = await resolvePrimaryWallet(followingWalletAddress);

    // Find the follow relationship
    const follow = await Follow.findOne({
      where: {
        followerWalletAddress,
        followingWalletAddress
      }
    });

    if (!follow) {
      throw new ApiError(400, 'You are not following this user');
    }

    // Delete the follow relationship
    await follow.destroy();

    // Get updated follower count
    const followersCount = await Follow.count({
      where: { followingWalletAddress }
    });

    logger.info(`${followerWalletAddress} unfollowed ${followingWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        followersCount
      }, 'User unfollowed successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get followers of a user (users who follow this user)
 */
const getFollowers = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    const { page = 1, limit = 20, viewerWalletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get followers
    const { count, rows: follows } = await Follow.findAndCountAll({
      where: { followingWalletAddress: walletAddress },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get follower user details
    const followerAddresses = follows.map(f => f.followerWalletAddress);

    let followers = [];
    if (followerAddresses.length > 0) {
      const users = await User.findAll({
        where: { walletAddress: { [Op.in]: followerAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
      });

      const userMap = {};
      users.forEach(u => { userMap[u.walletAddress] = u; });

      // Check if viewer follows each follower
      let viewerFollowingSet = new Set();
      if (viewerWalletAddress) {
        const viewerFollows = await Follow.findAll({
          where: {
            followerWalletAddress: viewerWalletAddress,
            followingWalletAddress: { [Op.in]: followerAddresses }
          },
          attributes: ['followingWalletAddress']
        });
        viewerFollowingSet = new Set(viewerFollows.map(f => f.followingWalletAddress));
      }

      // Get subscription plans for all followers
      const subscriptionMap = await getActiveSubscriptionsForWallets(followerAddresses);

      followers = follows.map(follow => {
        const user = userMap[follow.followerWalletAddress];
        return {
          walletAddress: follow.followerWalletAddress,
          username: user ? user.username : follow.followerWalletAddress,
          profileImage: user ? user.profileImage : null,
          isVerified: user ? user.isVerified : false,
          bio: user ? user.bio : null,
          subscriptionPlan: subscriptionMap[follow.followerWalletAddress] || 'free',
          followedAt: follow.createdAt,
          isFollowing: viewerWalletAddress ? viewerFollowingSet.has(follow.followerWalletAddress) : undefined
        };
      });
    }

    res.status(200).json(
      new ApiResponse(200, {
        followers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Followers retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get users that a user is following
 */
const getFollowing = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;
    const { page = 1, limit = 20, viewerWalletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get following
    const { count, rows: follows } = await Follow.findAndCountAll({
      where: { followerWalletAddress: walletAddress },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Get following user details
    const followingAddresses = follows.map(f => f.followingWalletAddress);

    let following = [];
    if (followingAddresses.length > 0) {
      const users = await User.findAll({
        where: { walletAddress: { [Op.in]: followingAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
      });

      const userMap = {};
      users.forEach(u => { userMap[u.walletAddress] = u; });

      // Check if viewer follows each user (for mutual follow indicator)
      let viewerFollowingSet = new Set();
      if (viewerWalletAddress && viewerWalletAddress !== walletAddress) {
        const viewerFollows = await Follow.findAll({
          where: {
            followerWalletAddress: viewerWalletAddress,
            followingWalletAddress: { [Op.in]: followingAddresses }
          },
          attributes: ['followingWalletAddress']
        });
        viewerFollowingSet = new Set(viewerFollows.map(f => f.followingWalletAddress));
      }

      // Get subscription plans for all following users
      const subscriptionMap = await getActiveSubscriptionsForWallets(followingAddresses);

      following = follows.map(follow => {
        const user = userMap[follow.followingWalletAddress];
        return {
          walletAddress: follow.followingWalletAddress,
          username: user ? user.username : follow.followingWalletAddress,
          profileImage: user ? user.profileImage : null,
          isVerified: user ? user.isVerified : false,
          bio: user ? user.bio : null,
          subscriptionPlan: subscriptionMap[follow.followingWalletAddress] || 'free',
          followedAt: follow.createdAt,
          isFollowing: viewerWalletAddress ? (viewerWalletAddress === walletAddress ? true : viewerFollowingSet.has(follow.followingWalletAddress)) : undefined
        };
      });
    }

    res.status(200).json(
      new ApiResponse(200, {
        following,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }, 'Following retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user A follows user B
 */
const checkFollowStatus = async (req, res, next) => {
  try {
    let { followerWalletAddress, followingWalletAddress } = req.query;

    if (!followerWalletAddress || !followingWalletAddress) {
      throw new ApiError(400, 'Both follower and following wallet addresses are required');
    }

    followerWalletAddress = await resolvePrimaryWallet(followerWalletAddress);
    followingWalletAddress = await resolvePrimaryWallet(followingWalletAddress);

    const follow = await Follow.findOne({
      where: {
        followerWalletAddress,
        followingWalletAddress
      }
    });

    res.status(200).json(
      new ApiResponse(200, {
        isFollowing: !!follow,
        followedAt: follow ? follow.createdAt : null
      }, 'Follow status retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get follow counts for a user (followers and following count)
 */
const getFollowCounts = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    walletAddress = await resolvePrimaryWallet(walletAddress);

    // Get followers count (users who follow this user)
    const followersCount = await Follow.count({
      where: { followingWalletAddress: walletAddress }
    });

    // Get following count (users this user follows)
    const followingCount = await Follow.count({
      where: { followerWalletAddress: walletAddress }
    });

    res.status(200).json(
      new ApiResponse(200, {
        followersCount,
        followingCount
      }, 'Follow counts retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus,
  getFollowCounts
};
