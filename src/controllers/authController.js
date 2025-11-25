const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, walletAddress } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { walletAddress }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ApiError(400, 'Email already registered');
      }
      if (existingUser.username === username) {
        throw new ApiError(400, 'Username already taken');
      }
      if (existingUser.walletAddress === walletAddress) {
        throw new ApiError(400, 'Wallet address already registered');
      }
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      walletAddress
    });

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`New user registered: ${user.username}`);

    res.status(201).json(
      new ApiResponse(201, {
        user,
        token,
        refreshToken
      }, 'User registered successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid credentials');
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Remove password from response
    user.password = undefined;

    logger.info(`User logged in: ${user.username}`);

    res.status(200).json(
      new ApiResponse(200, {
        user,
        token,
        refreshToken
      }, 'Login successful')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('nftsCreated', 'tokenId name image currentPrice isListed')
      .populate('nftsOwned', 'tokenId name image currentPrice isListed');

    res.status(200).json(
      new ApiResponse(200, user, 'User profile retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user (client-side token removal)
 */
const logout = async (req, res, next) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // This endpoint can be used for logging or cleanup
    logger.info(`User logged out: ${req.user.username}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Logout successful')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout
};
