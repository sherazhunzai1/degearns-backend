const jwt = require('jsonwebtoken');
const { User, AdminWallet } = require('../models');
const ApiError = require('../utils/ApiError');
const xrplConfig = require('../config/xrpl');

/**
 * Admin authentication middleware
 * Verifies that the user is authenticated and has admin privileges
 * Admin can be determined by:
 * 1. User role is 'admin'
 * 2. User wallet matches the platform admin wallet (ADMIN_WALLET_ADDRESS env)
 * 3. User wallet is registered as an active admin wallet of type 'treasury' or 'marketplace'
 */
const adminAuthenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'No token provided');
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database by wallet address
    const user = await User.findOne({
      where: { walletAddress: decoded.walletAddress }
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    // Check if user is banned
    if (user.isBanned) {
      throw new ApiError(403, 'Account is banned');
    }

    // Check admin privileges
    const isAdmin = await checkAdminPrivileges(user.walletAddress, user.role);

    if (!isAdmin) {
      throw new ApiError(403, 'Admin access required');
    }

    // Attach user to request
    req.user = user;
    req.isAdmin = true;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token expired'));
    }
    next(error);
  }
};

/**
 * Check if a wallet address has admin privileges
 */
const checkAdminPrivileges = async (walletAddress, userRole) => {
  // Check 1: User has admin role in database
  if (userRole === 'admin') {
    return true;
  }

  // Check 2: Wallet matches the platform admin wallet from config
  const adminWalletAddress = xrplConfig.getAdminWalletAddress();
  if (adminWalletAddress && walletAddress === adminWalletAddress) {
    return true;
  }

  // Check 3: Check ADMIN_WALLET_ADDRESS environment variable directly
  if (process.env.ADMIN_WALLET_ADDRESS && walletAddress === process.env.ADMIN_WALLET_ADDRESS) {
    return true;
  }

  // Check 4: Check if wallet is an active admin wallet (treasury or marketplace type)
  const adminWallet = await AdminWallet.findOne({
    where: {
      walletAddress,
      isActive: true,
      type: ['treasury', 'marketplace']
    }
  });

  if (adminWallet) {
    return true;
  }

  return false;
};

/**
 * Super admin authentication - only the main platform admin wallet
 * For sensitive operations like changing other admin roles
 */
const superAdminAuthenticate = async (req, res, next) => {
  try {
    // First run regular admin authentication
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({
      where: { walletAddress: decoded.walletAddress }
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    if (user.isBanned) {
      throw new ApiError(403, 'Account is banned');
    }

    // Check if this is the super admin (platform owner)
    const isSuperAdmin = await checkSuperAdminPrivileges(user.walletAddress);

    if (!isSuperAdmin) {
      throw new ApiError(403, 'Super admin access required');
    }

    req.user = user;
    req.isAdmin = true;
    req.isSuperAdmin = true;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token expired'));
    }
    next(error);
  }
};

/**
 * Check if wallet has super admin privileges
 */
const checkSuperAdminPrivileges = async (walletAddress) => {
  // Check platform admin wallet from config
  const adminWalletAddress = xrplConfig.getAdminWalletAddress();
  if (adminWalletAddress && walletAddress === adminWalletAddress) {
    return true;
  }

  // Check ADMIN_WALLET_ADDRESS environment variable
  if (process.env.ADMIN_WALLET_ADDRESS && walletAddress === process.env.ADMIN_WALLET_ADDRESS) {
    return true;
  }

  return false;
};

/**
 * Optional admin check - doesn't fail but sets isAdmin flag
 */
const optionalAdminCheck = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({
        where: { walletAddress: decoded.walletAddress }
      });

      if (user && !user.isBanned) {
        req.user = user;
        req.isAdmin = await checkAdminPrivileges(user.walletAddress, user.role);
        req.isSuperAdmin = await checkSuperAdminPrivileges(user.walletAddress);
      }
    }

    next();
  } catch (error) {
    // Continue without admin privileges
    next();
  }
};

module.exports = {
  adminAuthenticate,
  superAdminAuthenticate,
  optionalAdminCheck,
  checkAdminPrivileges,
  checkSuperAdminPrivileges
};
