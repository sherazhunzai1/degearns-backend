const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Subscription } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { getActiveSubscriptionPlan, checkCoverImageUpdateEligibility } = require('../utils/userHelpers');

/**
 * Generate a unique referral code (6 alphanumeric characters, uppercase)
 */
const generateReferralCode = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars: 0,O,1,I
  let code;
  let exists = true;

  while (exists) {
    code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    const existing = await User.findOne({ where: { referralCode: code } });
    exists = !!existing;
  }

  return code;
};

/**
 * Get or create user by wallet address (XAMAN wallet connection)
 * This endpoint is called after user connects their XAMAN wallet
 */
const getOrCreateUser = async (req, res, next) => {
  try {
    const { walletAddress, referralCode: refCode } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Try to find existing user
    let user = await User.findOne({
      where: { walletAddress }
    });

    let isNewUser = false;

    // If user exists, check if they are banned
    if (user && user.isBanned) {
      logger.warn(`Banned user attempted to authenticate: ${walletAddress}`);
      throw new ApiError(403, 'Your account has been banned', {
        isBanned: true,
        banReason: user.banReason || 'No reason provided',
        bannedAt: user.bannedAt
      });
    }

    // If user doesn't exist, create new user with wallet address as default username
    if (!user) {
      // Use wallet address as referral code
      const newReferralCode = walletAddress;

      // Look up the referrer by referral code (which is their wallet address)
      let referredBy = null;
      if (refCode) {
        const referrer = await User.findOne({
          where: {
            [Op.or]: [
              { referralCode: refCode },
              { walletAddress: refCode }
            ]
          }
        });
        if (referrer) {
          // Anti-abuse: prevent self-referral
          if (referrer.walletAddress === walletAddress) {
            logger.warn(`Self-referral attempt blocked: ${walletAddress}`);
          } else if (referrer.isBanned) {
            // Anti-abuse: don't accept referrals from banned users
            logger.warn(`Referral from banned user blocked: ${referrer.walletAddress}`);
          } else {
            referredBy = referrer.walletAddress;
            logger.info(`User ${walletAddress} referred by ${referredBy} (code: ${refCode})`);
          }
        } else {
          logger.warn(`Invalid referral code used during signup: ${refCode}`);
        }
      }

      user = await User.create({
        walletAddress,
        username: walletAddress,  // Set wallet address as default username
        role: 'user',
        referralCode: newReferralCode,
        referredBy
      });

      isNewUser = true;
      logger.info(`New user created with wallet: ${walletAddress}, referralCode: ${newReferralCode}`);
    }

    logger.info(`User authenticated: ${walletAddress}`);

    // Get user's subscription plan
    const subscriptionPlan = await getActiveSubscriptionPlan(walletAddress);

    // Build response with subscription plan
    const userData = {
      ...user.toJSON(),
      subscriptionPlan
    };

    res.status(200).json(
      new ApiResponse(200, {
        user: userData,
        isNewUser
      }, 'User authenticated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user profile by wallet address
 */
const getMe = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const user = await User.findOne({
      where: { walletAddress },
      include: [
        {
          association: 'collections',
          attributes: ['id', 'name', 'slug', 'image', 'totalSupply', 'taxon']
        }
      ]
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Get user's subscription plan
    const subscriptionPlan = await getActiveSubscriptionPlan(walletAddress);

    // Build response with subscription plan
    const userData = {
      ...user.toJSON(),
      subscriptionPlan
    };

    res.status(200).json(
      new ApiResponse(200, userData, 'User profile retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * Supports updating: displayName, username, bio, email, and social links (facebook, twitter, instagram)
 */
const updateProfile = async (req, res, next) => {
  try {
    const {
      walletAddress,
      displayName,
      username,
      email,
      bio,
      facebook,
      twitter,
      instagram
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const user = await User.findOne({ where: { walletAddress } });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Handle username update (displayName is treated as username)
    const newUsername = displayName || username;
    if (newUsername && newUsername !== user.username) {
      const existingUser = await User.findOne({ where: { username: newUsername } });
      if (existingUser) {
        throw new ApiError(400, 'Username already taken');
      }
      user.username = newUsername;
    }

    // Update basic fields
    if (email !== undefined) {
      // Check if email is being changed and if it's already taken
      if (email && email !== user.email) {
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
          throw new ApiError(400, 'Email already taken');
        }
      }
      user.email = email;
    }

    if (bio !== undefined) user.bio = bio;

    // Handle social links - merge with existing
    const currentSocialLinks = user.socialLinks || {};
    const updatedSocialLinks = { ...currentSocialLinks };

    if (facebook !== undefined) updatedSocialLinks.facebook = facebook;
    if (twitter !== undefined) updatedSocialLinks.twitter = twitter;
    if (instagram !== undefined) updatedSocialLinks.instagram = instagram;

    // Only update if there are changes
    if (facebook !== undefined || twitter !== undefined || instagram !== undefined) {
      user.socialLinks = updatedSocialLinks;
    }

    await user.save();

    logger.info(`User profile updated: ${user.walletAddress}`);

    // Get user's subscription plan
    const subscriptionPlan = await getActiveSubscriptionPlan(walletAddress);

    // Build response with subscription plan
    const userData = {
      ...user.toJSON(),
      subscriptionPlan
    };

    res.status(200).json(
      new ApiResponse(200, userData, 'Profile updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile picture
 */
const updateProfilePicture = async (req, res, next) => {
  try {
    const { walletAddress, profileImage } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!profileImage) {
      throw new ApiError(400, 'Profile image URL is required');
    }

    const user = await User.findOne({ where: { walletAddress } });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    user.profileImage = profileImage;
    await user.save();

    logger.info(`Profile picture updated for: ${user.walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, { profileImage: user.profileImage }, 'Profile picture updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update user cover picture
 * Rate limited based on subscription plan:
 * - free/BASIC: once per month
 * - DEGEN: once per week
 * - DEGEN+: unlimited
 */
const updateCoverPicture = async (req, res, next) => {
  try {
    const { walletAddress, coverImage } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!coverImage) {
      throw new ApiError(400, 'Cover image URL is required');
    }

    const user = await User.findOne({ where: { walletAddress } });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if user is eligible to update cover image based on subscription
    const eligibility = await checkCoverImageUpdateEligibility(walletAddress, user.lastCoverImageUpdate);

    if (!eligibility.canUpdate) {
      throw new ApiError(403, eligibility.message, {
        nextUpdateTime: eligibility.nextUpdateTime,
        subscriptionPlan: eligibility.subscriptionPlan,
        upgradeMessage: eligibility.upgradeMessage
      });
    }

    // Update cover image and track the update time
    user.coverImage = coverImage;
    user.lastCoverImageUpdate = new Date();
    await user.save();

    logger.info(`Cover picture updated for: ${user.walletAddress} (subscription: ${eligibility.subscriptionPlan})`);

    res.status(200).json(
      new ApiResponse(200, {
        coverImage: user.coverImage,
        lastCoverImageUpdate: user.lastCoverImageUpdate,
        subscriptionPlan: eligibility.subscriptionPlan
      }, 'Cover picture updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user can update cover image
 * Returns eligibility status based on subscription plan
 */
const canUpdateCoverImage = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const user = await User.findOne({ where: { walletAddress } });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check eligibility based on subscription
    const eligibility = await checkCoverImageUpdateEligibility(walletAddress, user.lastCoverImageUpdate);

    res.status(200).json(
      new ApiResponse(200, {
        canUpdate: eligibility.canUpdate,
        nextUpdateTime: eligibility.nextUpdateTime,
        subscriptionPlan: eligibility.subscriptionPlan,
        message: eligibility.message,
        upgradeMessage: eligibility.upgradeMessage,
        lastCoverImageUpdate: user.lastCoverImageUpdate
      }, 'Cover image update eligibility retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's referral info (code, link, and stats)
 */
const getReferralInfo = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const user = await User.findOne({ where: { walletAddress } });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Set referral code to wallet address if user doesn't have one (for existing users before this feature)
    if (!user.referralCode) {
      user.referralCode = walletAddress;
      await user.save();
    }

    // Count total referrals
    const totalReferrals = await User.count({ where: { referredBy: walletAddress } });

    // Get referred users list
    const referredUsers = await User.findAll({
      where: { referredBy: walletAddress },
      attributes: ['walletAddress', 'username', 'profileImage', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.status(200).json(
      new ApiResponse(200, {
        referralCode: user.referralCode,
        referralLink: `https://degearns.com/signup?ref=${user.referralCode}`,
        totalReferrals,
        referredUsers,
        referredBy: user.referredBy
      }, 'Referral info retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrCreateUser,
  getMe,
  updateProfile,
  updateProfilePicture,
  updateCoverPicture,
  canUpdateCoverImage,
  getReferralInfo
};
