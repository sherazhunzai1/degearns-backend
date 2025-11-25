const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateToken } = require('../middleware/auth');
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

    // Generate JWT token
    const token = generateToken(user.id, user.walletAddress);

    logger.info(`User authenticated: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        user,
        token,
        isNewUser
      }, 'User authenticated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.user.id },
      include: [
        {
          association: 'collections',
          attributes: ['id', 'name', 'slug', 'image', 'totalSupply']
        },
        {
          association: 'createdNFTs',
          attributes: ['id', 'tokenId', 'name', 'image', 'currentPrice', 'isListed'],
          limit: 10
        },
        {
          association: 'ownedNFTs',
          attributes: ['id', 'tokenId', 'name', 'image', 'currentPrice', 'isListed'],
          limit: 10
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
 */
const updateProfile = async (req, res, next) => {
  try {
    const { username, email, bio, profileImage, coverImage, socialLinks } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        throw new ApiError(400, 'Username already taken');
      }
      user.username = username;
    }

    // Update other fields
    if (email !== undefined) user.email = email;
    if (bio !== undefined) user.bio = bio;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (coverImage !== undefined) user.coverImage = coverImage;
    if (socialLinks !== undefined) user.socialLinks = socialLinks;

    await user.save();

    logger.info(`User profile updated: ${user.walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, user, 'Profile updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrCreateUser,
  getMe,
  updateProfile
};
