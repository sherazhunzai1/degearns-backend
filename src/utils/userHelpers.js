/**
 * User Helper Utilities
 * Provides functions to enrich user data with subscription information
 */

const { Op } = require('sequelize');
const logger = require('./logger');

/**
 * Get Subscription model lazily to avoid circular dependency
 */
const getSubscriptionModel = () => {
  const { Subscription } = require('../models');
  return Subscription;
};

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
    const Subscription = getSubscriptionModel();

    const subscription = await Subscription.findOne({
      where: {
        userWalletAddress: walletAddress,
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });

    return subscription ? subscription.planType : 'free';
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
    const Subscription = getSubscriptionModel();

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

/**
 * Cover image update intervals based on subscription plan (in milliseconds)
 * - free (no subscription): once per month (30 days)
 * - BASIC: once per month (30 days)
 * - DEGEN: once per week (7 days)
 * - DEGEN+: unlimited (no restriction)
 */
const COVER_IMAGE_UPDATE_INTERVALS = {
  free: 30 * 24 * 60 * 60 * 1000,      // 30 days in milliseconds (no subscription)
  'BASIC': 30 * 24 * 60 * 60 * 1000,   // 30 days in milliseconds
  'DEGEN': 7 * 24 * 60 * 60 * 1000,    // 7 days in milliseconds
  'DEGEN+': 0                           // No restriction (unlimited)
};

/**
 * Check if a user can update their cover image based on subscription plan
 * @param {string} walletAddress - User's wallet address
 * @param {Date|null} lastCoverImageUpdate - Timestamp of last cover image update
 * @returns {Promise<Object>} - Object with canUpdate, nextUpdateTime, and subscriptionPlan
 */
const checkCoverImageUpdateEligibility = async (walletAddress, lastCoverImageUpdate) => {
  // Get user's subscription plan
  const subscriptionPlan = await getActiveSubscriptionPlan(walletAddress);

  // Get the update interval for this plan
  const updateInterval = COVER_IMAGE_UPDATE_INTERVALS[subscriptionPlan] ?? COVER_IMAGE_UPDATE_INTERVALS.free;

  // DEGEN+ users can always update (interval is 0)
  if (updateInterval === 0) {
    return {
      canUpdate: true,
      nextUpdateTime: null,
      subscriptionPlan,
      message: 'You can update your cover image anytime with your DEGEN+ subscription.'
    };
  }

  // If user has never updated cover image, they can update
  if (!lastCoverImageUpdate) {
    return {
      canUpdate: true,
      nextUpdateTime: null,
      subscriptionPlan,
      message: 'You can update your cover image.'
    };
  }

  // Calculate when the user can next update
  const lastUpdate = new Date(lastCoverImageUpdate);
  const nextUpdateTime = new Date(lastUpdate.getTime() + updateInterval);
  const now = new Date();

  if (now >= nextUpdateTime) {
    return {
      canUpdate: true,
      nextUpdateTime: null,
      subscriptionPlan,
      message: 'You can update your cover image.'
    };
  }

  // Calculate remaining time
  const remainingMs = nextUpdateTime.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

  // Determine restriction message based on plan
  const planRestriction = subscriptionPlan === 'DEGEN' ? 'once per week' : 'once per month';

  let timeMessage;
  if (remainingDays > 1) {
    timeMessage = `${remainingDays} days`;
  } else if (remainingHours > 1) {
    timeMessage = `${remainingHours} hours`;
  } else {
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    timeMessage = `${remainingMinutes} minutes`;
  }

  // Determine display name for the plan
  const planDisplayName = subscriptionPlan === 'free' ? 'free' : subscriptionPlan;

  return {
    canUpdate: false,
    nextUpdateTime: nextUpdateTime.toISOString(),
    subscriptionPlan,
    message: `Your ${planDisplayName} plan allows cover image updates ${planRestriction}. You can update again in ${timeMessage}.`,
    upgradeMessage: subscriptionPlan !== 'DEGEN+'
      ? 'Upgrade to DEGEN+ for unlimited cover image updates.'
      : null
  };
};

/**
 * Pin post limits based on subscription plan
 * - free (no subscription): 0 pinned posts
 * - BASIC: 1 pinned post
 * - DEGEN: 3 pinned posts
 * - DEGEN+: 3 pinned posts
 */
const PIN_POST_LIMITS = {
  free: 0,
  'BASIC': 1,
  'DEGEN': 3,
  'DEGEN+': 3
};

/**
 * Check if a user can pin more posts based on their subscription plan
 * @param {string} walletAddress - User's wallet address
 * @param {number} currentPinnedCount - Current number of pinned posts
 * @returns {Promise<Object>} - Object with canPin, limit, currentCount, and subscriptionPlan
 */
const checkPinPostEligibility = async (walletAddress, currentPinnedCount) => {
  // Get user's subscription plan
  const subscriptionPlan = await getActiveSubscriptionPlan(walletAddress);

  // Get the pin limit for this plan
  const pinLimit = PIN_POST_LIMITS[subscriptionPlan] ?? PIN_POST_LIMITS.free;

  // Check if user can pin more posts
  const canPin = currentPinnedCount < pinLimit;

  if (canPin) {
    return {
      canPin: true,
      limit: pinLimit,
      currentCount: currentPinnedCount,
      remaining: pinLimit - currentPinnedCount,
      subscriptionPlan,
      message: `You can pin ${pinLimit - currentPinnedCount} more post(s).`
    };
  }

  // Determine upgrade message based on plan
  let upgradeMessage = null;
  if (subscriptionPlan === 'free') {
    upgradeMessage = 'Subscribe to BASIC to pin 1 post, or DEGEN/DEGEN+ to pin up to 3 posts.';
  } else if (subscriptionPlan === 'BASIC') {
    upgradeMessage = 'Upgrade to DEGEN or DEGEN+ to pin up to 3 posts.';
  }

  return {
    canPin: false,
    limit: pinLimit,
    currentCount: currentPinnedCount,
    remaining: 0,
    subscriptionPlan,
    message: `You have reached your pin limit of ${pinLimit} post(s) for your ${subscriptionPlan === 'free' ? 'free' : subscriptionPlan} plan.`,
    upgradeMessage
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
  createUserInfoWithSubscription,
  COVER_IMAGE_UPDATE_INTERVALS,
  checkCoverImageUpdateEligibility,
  PIN_POST_LIMITS,
  checkPinPostEligibility
};
