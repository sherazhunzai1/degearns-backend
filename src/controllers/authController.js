const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

/**
 * Get or create user by wallet address (XAMAN wallet connection)
 * This endpoint is called after user connects their XAMAN wallet
 */
const getOrCreateUser = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

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
      user = await User.create({
        walletAddress,
        username: walletAddress,  // Set wallet address as default username
        role: 'user'
      });

      isNewUser = true;
      logger.info(`New user created with wallet: ${walletAddress}`);
    }

    logger.info(`User authenticated: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        user,
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

    res.status(200).json(
      new ApiResponse(200, user, 'User profile retrieved successfully')
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

    res.status(200).json(
      new ApiResponse(200, user, 'Profile updated successfully')
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

    user.coverImage = coverImage;
    await user.save();

    logger.info(`Cover picture updated for: ${user.walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, { coverImage: user.coverImage }, 'Cover picture updated successfully')
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
  updateCoverPicture
};
