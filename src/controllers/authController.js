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

    // If user doesn't exist, create new user
    if (!user) {
      user = await User.create({
        walletAddress,
        role: 'user'
      });

      logger.info(`New user created with wallet: ${walletAddress}`);
    }

    // Generate JWT token
    const token = generateToken(user.id, user.walletAddress);

    logger.info(`User authenticated: ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        user,
        token
      }, user.username ? 'Login successful' : 'User created successfully. Please complete your profile.')
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

module.exports = {
  getOrCreateUser,
  getMe
};
