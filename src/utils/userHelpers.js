/**
 * User Helper Utilities
 * Provides functions to enrich user data with subscription information
 */

const { Subscription } = require('../models');
const { Op } = require('sequelize');
const logger = require('./logger');

/**
 * Standard user attributes to include in queries
 */
const USER_ATTRIBUTES = ['walletAddress', 'username', 'profileImage', 'isVerified'];
const USER_ATTRIBUTES_WITH_BIO = ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio'];

/**
 * Get the active subscription plan for a wallet address
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<string>} - Plan type (free, basic, pro, premium)
 */
const getActiveSubscriptionPlan = async (walletAddress) => {
  if (!walletAddress) return 'free';

  try {
    // First, find ANY subscription for this user to debug
    const anySubscription = await Subscription.findOne({
      where: { userWalletAddress: walletAddress },
      order: [['createdAt', 'DESC']]
    });

    if (anySubscription) {
      logger.info(`Found subscription for ${walletAddress}: planType=${anySubscription.planType}, isActive=${anySubscription.isActive}, endDate=${anySubscription.endDate}, now=${new Date()}`);
    } else {
      logger.info(`No subscription found for ${walletAddress}`);
    }

    // Now find active subscription
    const subscription = await Subscription.findOne({
      where: {
        userWalletAddress: walletAddress,
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });

    if (subscription) {
      logger.info(`Active subscription found for ${walletAddress}: ${subscription.planType}`);
      return subscription.planType;
    } else {
      logger.info(`No ACTIVE subscription found for ${walletAddress} (isActive must be true AND endDate must be > now)`);
      return 'free';
    }
  } catch (error) {
    logger.error(`Error getting subscription for ${walletAddress}:`, error);
    return 'free';
  }
};

/**
 * Get active subscriptions for multiple wallet addresses (batch)
 * @param {string[]} walletAddresses - Array of wallet addresses
 * @returns {Promise<Object>} - Map of walletAddress -> planType
 */
const getActiveSubscriptionsForWallets = async (walletAddresses) => {
  if (!walletAddresses || walletAddresses.length === 0) return {};

  // Remove duplicates and null/undefined values
  const uniqueAddresses = [...new Set(walletAddresses.filter(Boolean))];

  if (uniqueAddresses.length === 0) return {};

  try {
    const subscriptions = await Subscription.findAll({
      where: {
        userWalletAddress: uniqueAddresses,
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });

    // Create map of wallet -> planType (use the most recent active subscription)
    const subscriptionMap = {};
    subscriptions.forEach(sub => {
      if (!subscriptionMap[sub.userWalletAddress]) {
        subscriptionMap[sub.userWalletAddress] = sub.planType;
      }
    });

    // Default to 'free' for wallets without active subscription
    uniqueAddresses.forEach(addr => {
      if (!subscriptionMap[addr]) {
        subscriptionMap[addr] = 'free';
      }
    });

    return subscriptionMap;
  } catch (error) {
    // Return all as 'free' on error
    const defaultMap = {};
    uniqueAddresses.forEach(addr => {
      defaultMap[addr] = 'free';
    });
    return defaultMap;
  }
};

/**
 * Add subscription plan to a single user object
 * @param {Object} user - User object with walletAddress
 * @returns {Promise<Object>} - User object with subscriptionPlan added
 */
const addSubscriptionToUser = async (user) => {
  if (!user) return user;

  const walletAddress = user.walletAddress || user.wallet_address;
  if (!walletAddress) return { ...user, subscriptionPlan: 'free' };

  const planType = await getActiveSubscriptionPlan(walletAddress);

  // Handle both plain objects and Sequelize instances
  if (user.toJSON) {
    return { ...user.toJSON(), subscriptionPlan: planType };
  }
  return { ...user, subscriptionPlan: planType };
};

/**
 * Add subscription plans to multiple user objects (batch - more efficient)
 * @param {Object[]} users - Array of user objects with walletAddress
 * @returns {Promise<Object[]>} - Array of user objects with subscriptionPlan added
 */
const addSubscriptionToUsers = async (users) => {
  if (!users || users.length === 0) return users;

  // Extract all wallet addresses
  const walletAddresses = users.map(u => u?.walletAddress || u?.wallet_address).filter(Boolean);

  // Get all subscriptions in one query
  const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

  // Add subscription plan to each user
  return users.map(user => {
    if (!user) return user;

    const walletAddress = user.walletAddress || user.wallet_address;
    const planType = subscriptionMap[walletAddress] || 'free';

    // Handle both plain objects and Sequelize instances
    if (user.toJSON) {
      return { ...user.toJSON(), subscriptionPlan: planType };
    }
    return { ...user, subscriptionPlan: planType };
  });
};

/**
 * Enrich an object that has nested user fields (like creator, owner, user, etc.)
 * @param {Object} item - Object with nested user data
 * @param {string[]} userFields - Field names that contain user data (e.g., ['creator', 'owner'])
 * @param {Object} subscriptionMap - Pre-fetched subscription map (walletAddress -> planType)
 * @returns {Object} - Object with subscription plans added to user fields
 */
const enrichItemWithSubscriptions = (item, userFields, subscriptionMap) => {
  if (!item) return item;

  const enrichedItem = item.toJSON ? item.toJSON() : { ...item };

  userFields.forEach(field => {
    if (enrichedItem[field]) {
      const walletAddress = enrichedItem[field].walletAddress || enrichedItem[field].wallet_address;
      if (walletAddress) {
        enrichedItem[field] = {
          ...enrichedItem[field],
          subscriptionPlan: subscriptionMap[walletAddress] || 'free'
        };
      }
    }
  });

  return enrichedItem;
};

/**
 * Enrich multiple items that have nested user fields (batch)
 * @param {Object[]} items - Array of objects with nested user data
 * @param {string[]} userFields - Field names that contain user data
 * @returns {Promise<Object[]>} - Array with subscription plans added
 */
const enrichItemsWithSubscriptions = async (items, userFields = ['creator', 'owner', 'user']) => {
  if (!items || items.length === 0) return items;

  // Collect all wallet addresses from all user fields
  const walletAddresses = [];
  items.forEach(item => {
    if (!item) return;
    const itemData = item.toJSON ? item.toJSON() : item;
    userFields.forEach(field => {
      if (itemData[field]?.walletAddress) {
        walletAddresses.push(itemData[field].walletAddress);
      }
    });
  });

  // Get all subscriptions in one query
  const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

  // Enrich each item
  return items.map(item => enrichItemWithSubscriptions(item, userFields, subscriptionMap));
};

/**
 * Create a user info object with subscription plan (for fallback/manual cases)
 * @param {string} walletAddress - Wallet address
 * @param {Object} subscriptionMap - Pre-fetched subscription map (optional)
 * @returns {Object} - User info object with subscription plan
 */
const createUserInfoWithSubscription = (walletAddress, subscriptionMap = {}) => {
  return {
    walletAddress: walletAddress,
    username: walletAddress,
    profileImage: null,
    isVerified: false,
    subscriptionPlan: subscriptionMap[walletAddress] || 'free'
  };
};

module.exports = {
  USER_ATTRIBUTES,
  USER_ATTRIBUTES_WITH_BIO,
  getActiveSubscriptionPlan,
  getActiveSubscriptionsForWallets,
  addSubscriptionToUser,
  addSubscriptionToUsers,
  enrichItemWithSubscriptions,
  enrichItemsWithSubscriptions,
  createUserInfoWithSubscription
};
