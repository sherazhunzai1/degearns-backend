const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Subscription, UserWallet } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { getActiveSubscriptionPlan, checkCoverImageUpdateEligibility } = require('../utils/userHelpers');
const notificationService = require('../services/notificationService');
const solanaService = require('../services/solanaService');
const chainServiceFactory = require('../services/chainServiceFactory');
const { generateToken } = require('../middleware/auth');

// In-memory store for Solana auth challenge nonces (walletAddress -> { message, expiresAt }).
// PM2 runs a single fork-mode instance, so an in-memory store is sufficient here.
const solanaAuthNonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
 * Find an existing user or create a new one for the given wallet.
 * Shared by the XRPL (XAMAN) and Solana authentication flows.
 *
 * @param {Object} params
 * @param {string} params.walletAddress - Wallet address (primary identifier)
 * @param {string} params.network - 'xrpl' or 'solana'
 * @param {string|null} params.refCode - Optional referral code used at signup
 * @returns {Promise<{user: Object, isNewUser: boolean}>}
 */
const findOrCreateUserRecord = async ({ walletAddress, network = 'xrpl', refCode = null }) => {
  // Check primary wallet on Users table
  let user = await User.findOne({ where: { walletAddress } });

  // If not found, check linked wallets
  if (!user) {
    const linkedWallet = await UserWallet.findOne({ where: { walletAddress } });
    if (linkedWallet) {
      user = await User.findByPk(linkedWallet.userId);
    }
  }

  // If user exists, check if they are banned
  if (user && user.isBanned) {
    logger.warn(`Banned user attempted to authenticate: ${walletAddress}`);
    throw new ApiError(403, 'Your account has been banned', {
      isBanned: true,
      banReason: user.banReason || 'No reason provided',
      bannedAt: user.bannedAt
    });
  }

  if (user) {
    return { user, isNewUser: false };
  }

  // Look up the referrer by referral code (which defaults to their wallet address)
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

  let isNewUser = false;
  try {
    user = await User.create({
      walletAddress,
      username: walletAddress,  // Set wallet address as default username
      role: 'user',
      network,
      referralCode: walletAddress,  // Use wallet address as referral code
      referredBy
    });

    // Also insert into UserWallet as the primary wallet
    await UserWallet.create({
      userId: user.id,
      walletAddress,
      network,
      isPrimary: true
    }).catch(() => {});

    isNewUser = true;
    logger.info(`New ${network} user created with wallet: ${walletAddress}`);
  } catch (createError) {
    // Handle race condition: if another request created the user between findOne and create
    if (createError.name === 'SequelizeUniqueConstraintError') {
      logger.info(`Race condition detected for wallet: ${walletAddress}, fetching existing user`);
      user = await User.findOne({ where: { walletAddress } });
      if (!user) {
        throw createError;
      }
    } else {
      throw createError;
    }
  }

  // Notify the referrer that a new user signed up with their referral code
  if (isNewUser && referredBy) {
    notificationService.createReferralSignupNotification({
      referrerWalletAddress: referredBy,
      newUserWalletAddress: walletAddress,
      newUserUsername: walletAddress
    });
  }

  return { user, isNewUser };
};

/**
 * Get or create user by wallet address (XAMAN / XRPL wallet connection)
 * This endpoint is called after user connects their wallet.
 * Accepts an optional `network` field ('xrpl' default, or 'solana').
 */
const getOrCreateUser = async (req, res, next) => {
  try {
    const { walletAddress, referralCode: refCode, network } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const resolvedNetwork = chainServiceFactory.normalizeNetwork(network);
    if (!chainServiceFactory.isSupportedNetwork(resolvedNetwork)) {
      throw new ApiError(400, `Unsupported network: ${network}`);
    }

    const { user, isNewUser } = await findOrCreateUserRecord({
      walletAddress,
      network: resolvedNetwork,
      refCode
    });

    logger.info(`User authenticated: ${walletAddress}`);

    // Get user's subscription plan and linked wallets in parallel
    const [subscriptionPlan, linkedWallets] = await Promise.all([
      getActiveSubscriptionPlan(user.walletAddress),
      UserWallet.findAll({
        where: { userId: user.id },
        order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']]
      })
    ]);

    res.status(200).json(
      new ApiResponse(200, {
        user: { ...user.toJSON(), subscriptionPlan },
        wallets: linkedWallets,
        isNewUser
      }, 'User authenticated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Generate a sign-in challenge nonce for a Solana wallet.
 * The frontend signs the returned `message` with the wallet and submits
 * the signature to POST /auth/solana.
 */
const getSolanaAuthNonce = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!solanaService.isValidAddress(walletAddress)) {
      throw new ApiError(400, 'Invalid Solana wallet address');
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `Sign this message to authenticate with DeGearns.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;

    solanaAuthNonces.set(walletAddress, {
      message,
      expiresAt: Date.now() + NONCE_TTL_MS
    });

    res.status(200).json(
      new ApiResponse(200, {
        nonce,
        message,
        expiresIn: NONCE_TTL_MS / 1000
      }, 'Nonce generated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate a Solana wallet by verifying a signed challenge nonce.
 * On success, get-or-creates the user and returns a JWT.
 */
const solanaAuth = async (req, res, next) => {
  try {
    const { walletAddress, signature, referralCode: refCode } = req.body;

    if (!walletAddress || !signature) {
      throw new ApiError(400, 'Wallet address and signature are required');
    }

    if (!solanaService.isValidAddress(walletAddress)) {
      throw new ApiError(400, 'Invalid Solana wallet address');
    }

    const stored = solanaAuthNonces.get(walletAddress);
    if (!stored || stored.expiresAt < Date.now()) {
      solanaAuthNonces.delete(walletAddress);
      throw new ApiError(401, 'Nonce expired or not found. Request a new nonce.');
    }

    const isValid = solanaService.verifySignature(walletAddress, stored.message, signature);

    // Nonce is single-use - consume it regardless of verification result
    solanaAuthNonces.delete(walletAddress);

    if (!isValid) {
      throw new ApiError(401, 'Invalid signature');
    }

    const { user, isNewUser } = await findOrCreateUserRecord({
      walletAddress,
      network: 'solana',
      refCode
    });

    logger.info(`Solana user authenticated: ${walletAddress}`);

    const [subscriptionPlan, linkedWallets] = await Promise.all([
      getActiveSubscriptionPlan(user.walletAddress),
      UserWallet.findAll({
        where: { userId: user.id },
        order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']]
      })
    ]);
    const token = generateToken(user.id, user.walletAddress, user.network);

    res.status(200).json(
      new ApiResponse(200, {
        user: { ...user.toJSON(), subscriptionPlan },
        wallets: linkedWallets,
        isNewUser,
        token
      }, 'Solana wallet authenticated successfully')
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

/**
 * Link a new wallet to the authenticated user's account.
 * For Solana wallets, requires a signed nonce to prove ownership.
 * For XRPL wallets, ownership is verified client-side via XAMAN.
 */
const linkWallet = async (req, res, next) => {
  try {
    const { walletAddress, network, signature, label, primaryWalletAddress } = req.body;

    if (!primaryWalletAddress) {
      throw new ApiError(400, 'Primary wallet address is required to identify the account');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address to link is required');
    }

    // Find the user by their primary or linked wallet
    let currentUser = await User.findOne({ where: { walletAddress: primaryWalletAddress } });
    if (!currentUser) {
      const linked = await UserWallet.findOne({ where: { walletAddress: primaryWalletAddress } });
      if (linked) currentUser = await User.findByPk(linked.userId);
    }

    if (!currentUser) {
      throw new ApiError(404, 'User not found');
    }

    const resolvedNetwork = chainServiceFactory.normalizeNetwork(network);
    if (!chainServiceFactory.isSupportedNetwork(resolvedNetwork)) {
      throw new ApiError(400, `Unsupported network: ${network}`);
    }

    // For Solana, verify wallet ownership via signed nonce
    if (resolvedNetwork === 'solana') {
      if (!signature) {
        throw new ApiError(400, 'Signature is required to link a Solana wallet');
      }
      if (!solanaService.isValidAddress(walletAddress)) {
        throw new ApiError(400, 'Invalid Solana wallet address');
      }

      const stored = solanaAuthNonces.get(walletAddress);
      if (!stored || stored.expiresAt < Date.now()) {
        solanaAuthNonces.delete(walletAddress);
        throw new ApiError(401, 'Nonce expired or not found. Request a new nonce via GET /auth/solana/nonce');
      }

      const isValid = solanaService.verifySignature(walletAddress, stored.message, signature);
      solanaAuthNonces.delete(walletAddress);

      if (!isValid) {
        throw new ApiError(401, 'Invalid signature');
      }
    }

    // Check if wallet is already linked to any account
    const existingUser = await User.findOne({ where: { walletAddress } });
    if (existingUser) {
      throw new ApiError(400, 'This wallet is already registered as a primary wallet on another account');
    }

    const existingLink = await UserWallet.findOne({ where: { walletAddress } });
    if (existingLink) {
      if (existingLink.userId === currentUser.id) {
        throw new ApiError(400, 'This wallet is already linked to your account');
      }
      throw new ApiError(400, 'This wallet is already linked to another account');
    }

    const linkedWallet = await UserWallet.create({
      userId: currentUser.id,
      walletAddress,
      network: resolvedNetwork,
      isPrimary: false,
      label: label || null
    });

    logger.info(`Wallet ${walletAddress} (${resolvedNetwork}) linked to user ${currentUser.walletAddress}`);

    res.status(201).json(
      new ApiResponse(201, linkedWallet, 'Wallet linked successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Unlink a wallet from the authenticated user's account.
 * Cannot unlink the primary wallet.
 */
const unlinkWallet = async (req, res, next) => {
  try {
    const { walletAddress, primaryWalletAddress } = req.body;

    if (!primaryWalletAddress) {
      throw new ApiError(400, 'Primary wallet address is required to identify the account');
    }

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address to unlink is required');
    }

    // Find the user by their primary or linked wallet
    let currentUser = await User.findOne({ where: { walletAddress: primaryWalletAddress } });
    if (!currentUser) {
      const linked = await UserWallet.findOne({ where: { walletAddress: primaryWalletAddress } });
      if (linked) currentUser = await User.findByPk(linked.userId);
    }

    if (!currentUser) {
      throw new ApiError(404, 'User not found');
    }

    // Cannot unlink primary wallet
    if (walletAddress === currentUser.walletAddress) {
      throw new ApiError(400, 'Cannot unlink your primary wallet');
    }

    const linkedWallet = await UserWallet.findOne({
      where: { walletAddress, userId: currentUser.id, isPrimary: false }
    });

    if (!linkedWallet) {
      throw new ApiError(404, 'Linked wallet not found');
    }

    await linkedWallet.destroy();

    logger.info(`Wallet ${walletAddress} unlinked from user ${currentUser.walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Wallet unlinked successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all wallets linked to the authenticated user's account.
 */
const getLinkedWallets = async (req, res, next) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Find user by primary or linked wallet
    let user = await User.findOne({ where: { walletAddress } });
    if (!user) {
      const linked = await UserWallet.findOne({ where: { walletAddress } });
      if (linked) user = await User.findByPk(linked.userId);
    }

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const wallets = await UserWallet.findAll({
      where: { userId: user.id },
      order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']]
    });

    res.status(200).json(
      new ApiResponse(200, { wallets }, 'Linked wallets retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrCreateUser,
  getSolanaAuthNonce,
  solanaAuth,
  getMe,
  updateProfile,
  updateProfilePicture,
  updateCoverPicture,
  canUpdateCoverImage,
  getReferralInfo,
  linkWallet,
  unlinkWallet,
  getLinkedWallets
};
