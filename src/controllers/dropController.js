const { Drop, DropNft, DropAllowedWallet, DropMint, Collection, User, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Step 1: Create a new drop (standalone collection for bulk NFT minting)
 * Required: creatorWalletAddress, name, taxonId
 * Optional: description, image, bannerImage, social links
 * Total supply will be calculated automatically when NFTs are uploaded (Step 2)
 */
const createDrop = async (req, res, next) => {
  try {
    const {
      creatorWalletAddress,
      name,
      description,
      image,
      bannerImage,
      taxonId,
      // Social links
      websiteUrl,
      twitterUrl,
      discordUrl,
      telegramUrl,
      metadata
    } = req.body;

    if (!creatorWalletAddress) {
      throw new ApiError(400, 'Creator wallet address is required');
    }

    if (!name) {
      throw new ApiError(400, 'Drop name is required');
    }

    if (!taxonId) {
      throw new ApiError(400, 'Taxon ID is required for NFT minting');
    }

    // Check if creator already has a draft drop with same taxonId
    const existingDrop = await Drop.findOne({
      where: {
        creatorWalletAddress,
        taxonId,
        status: {
          [Op.in]: ['draft', 'scheduled', 'active']
        }
      }
    });

    if (existingDrop) {
      throw new ApiError(400, 'You already have an active drop with this taxon ID');
    }

    // Create drop as standalone entity (no collectionId required)
    // totalSupply will be 0 initially and calculated when NFTs are uploaded
    const drop = await Drop.create({
      creatorWalletAddress,
      name,
      description,
      image,
      bannerImage,
      taxonId,
      // Social links
      websiteUrl,
      twitterUrl,
      discordUrl,
      telegramUrl,
      // Default values - will be updated in Step 3
      totalSupply: 0,
      status: 'draft',
      metadata
    });

    logger.info(`Drop created: ${drop.name} (taxonId: ${taxonId}) by ${creatorWalletAddress}`);

    // Fetch drop with creator association
    const createdDrop = await Drop.findByPk(drop.id, {
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    res.status(201).json(
      new ApiResponse(201, {
        ...createdDrop.toJSON(),
        nextStep: 'Upload NFTs using POST /drops/:id/nfts'
      }, 'Drop created successfully. Next step: Upload bulk NFTs')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update drop configuration
 */
const updateDrop = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      walletAddress,
      name,
      description,
      image,
      bannerImage,
      royaltyPercentage,
      pricePerNft,
      limitPerWallet,
      totalSupply,
      isBurnable,
      isTransferable,
      isOnlyXrp,
      isMutable,
      startDate,
      endDate,
      metadata
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    // Can only update draft or scheduled drops
    if (!['draft', 'scheduled'].includes(drop.status)) {
      throw new ApiError(400, 'Can only update drops in draft or scheduled status');
    }

    // Validate totalSupply change
    if (totalSupply !== undefined && totalSupply < drop.mintedCount) {
      throw new ApiError(400, 'Total supply cannot be less than already minted count');
    }

    // Validate schedule if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        throw new ApiError(400, 'End date must be after start date');
      }
    }

    // Update fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (bannerImage !== undefined) updateData.bannerImage = bannerImage;
    if (royaltyPercentage !== undefined) updateData.royaltyPercentage = royaltyPercentage;
    if (pricePerNft !== undefined) updateData.pricePerNft = pricePerNft;
    if (limitPerWallet !== undefined) updateData.limitPerWallet = limitPerWallet;
    if (totalSupply !== undefined) updateData.totalSupply = totalSupply;
    if (isBurnable !== undefined) updateData.isBurnable = isBurnable;
    if (isTransferable !== undefined) updateData.isTransferable = isTransferable;
    if (isOnlyXrp !== undefined) updateData.isOnlyXrp = isOnlyXrp;
    if (isMutable !== undefined) updateData.isMutable = isMutable;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (metadata !== undefined) updateData.metadata = metadata;

    await drop.update(updateData);

    logger.info(`Drop updated: ${drop.id} by ${walletAddress}`);

    // Fetch updated drop with associations
    const updatedDrop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    res.status(200).json(
      new ApiResponse(200, updatedDrop, 'Drop updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get drop by ID
 */
const getDropById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.query;

    const drop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'bannerImage', 'taxon', 'category', 'description']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    // Check wallet eligibility if wallet address provided
    let walletEligibility = null;
    if (walletAddress) {
      walletEligibility = await getWalletEligibilityData(drop, walletAddress);
    }

    const response = {
      ...drop.toJSON(),
      remainingSupply: drop.getRemainingSupply(),
      isCurrentlyActive: drop.isCurrentlyActive(),
      isSoldOut: drop.isSoldOut(),
      walletEligibility
    };

    res.status(200).json(
      new ApiResponse(200, response, 'Drop retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get drops with filters
 */
const getDrops = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      creatorWalletAddress,
      collectionId,
      sortBy = 'createdAt',
      order = 'DESC',
      search
    } = req.query;

    const where = {};

    if (status) {
      if (status.includes(',')) {
        where.status = { [Op.in]: status.split(',') };
      } else {
        where.status = status;
      }
    }
    if (creatorWalletAddress) where.creatorWalletAddress = creatorWalletAddress;
    if (collectionId) where.collectionId = collectionId;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows: drops } = await Drop.findAndCountAll({
      where,
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Add computed fields
    const dropsWithStats = drops.map(drop => ({
      ...drop.toJSON(),
      remainingSupply: drop.getRemainingSupply(),
      isCurrentlyActive: drop.isCurrentlyActive(),
      isSoldOut: drop.isSoldOut()
    }));

    res.status(200).json(
      new ApiResponse(200, {
        drops: dropsWithStats,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }, 'Drops retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get active drops for marketplace
 */
const getActiveDrops = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'startDate',
      order = 'ASC'
    } = req.query;

    const now = new Date();
    const offset = (page - 1) * limit;

    const { count, rows: drops } = await Drop.findAndCountAll({
      where: {
        status: 'active',
        paymentStatus: 'paid',
        isMintingEnabled: true,
        [Op.or]: [
          { startDate: null },
          { startDate: { [Op.lte]: now } }
        ],
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gte]: now } }
        ]
      },
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'bannerImage', 'taxon', 'category']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Filter out sold out drops and add computed fields
    const activeDrops = drops
      .filter(drop => !drop.isSoldOut())
      .map(drop => ({
        ...drop.toJSON(),
        remainingSupply: drop.getRemainingSupply(),
        isCurrentlyActive: drop.isCurrentlyActive(),
        isSoldOut: drop.isSoldOut()
      }));

    res.status(200).json(
      new ApiResponse(200, {
        drops: activeDrops,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }, 'Active drops retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get upcoming drops for marketplace
 */
const getUpcomingDrops = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'startDate',
      order = 'ASC'
    } = req.query;

    const now = new Date();
    const offset = (page - 1) * limit;

    const { count, rows: drops } = await Drop.findAndCountAll({
      where: {
        status: 'scheduled',
        paymentStatus: 'paid',
        startDate: { [Op.gt]: now }
      },
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'bannerImage', 'taxon', 'category']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const upcomingDrops = drops.map(drop => ({
      ...drop.toJSON(),
      remainingSupply: drop.getRemainingSupply(),
      isSoldOut: drop.isSoldOut()
    }));

    res.status(200).json(
      new ApiResponse(200, {
        drops: upcomingDrops,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }, 'Upcoming drops retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a draft drop
 */
const deleteDrop = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only delete your own drops');
    }

    // Can only delete draft drops
    if (drop.status !== 'draft') {
      throw new ApiError(400, 'Can only delete drops in draft status');
    }

    await drop.destroy();

    logger.info(`Drop deleted: ${id} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Drop deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update drop status
 */
const updateDropStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, status } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!status) {
      throw new ApiError(400, 'Status is required');
    }

    const validStatuses = ['draft', 'scheduled', 'active', 'paused', 'ended'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    // Validate status transitions
    const currentStatus = drop.status;
    const validTransitions = {
      draft: ['scheduled', 'active'],
      scheduled: ['active', 'paused', 'ended'],
      active: ['paused', 'ended'],
      paused: ['active', 'ended'],
      ended: [],
      sold_out: []
    };

    if (!validTransitions[currentStatus].includes(status)) {
      throw new ApiError(400, `Cannot transition from ${currentStatus} to ${status}`);
    }

    // Check if payment is done before activating
    if (status === 'active' && drop.paymentStatus !== 'paid') {
      throw new ApiError(400, 'Launch fee must be paid before activating the drop');
    }

    await drop.update({ status });

    logger.info(`Drop status updated: ${id} from ${currentStatus} to ${status} by ${walletAddress}`);

    const updatedDrop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    res.status(200).json(
      new ApiResponse(200, updatedDrop, 'Drop status updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle drop settings (minting, allowlist, free mint)
 */
const toggleDropSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, setting, value } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!setting) {
      throw new ApiError(400, 'Setting name is required');
    }

    const validSettings = ['isMintingEnabled', 'isAllowlistEnabled', 'isFreeMint'];
    if (!validSettings.includes(setting)) {
      throw new ApiError(400, `Invalid setting. Must be one of: ${validSettings.join(', ')}`);
    }

    if (typeof value !== 'boolean') {
      throw new ApiError(400, 'Value must be a boolean');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    await drop.update({ [setting]: value });

    logger.info(`Drop setting updated: ${id} - ${setting} set to ${value} by ${walletAddress}`);

    const updatedDrop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    res.status(200).json(
      new ApiResponse(200, updatedDrop, `${setting} updated successfully`)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update launch fee payment status
 */
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, launchFee, transactionHash, paymentStatus } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    const updateData = {};
    if (launchFee !== undefined) updateData.launchFee = launchFee;
    if (transactionHash !== undefined) updateData.launchFeeTransactionHash = transactionHash;
    if (paymentStatus !== undefined) {
      const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        throw new ApiError(400, `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`);
      }
      updateData.paymentStatus = paymentStatus;
    }

    await drop.update(updateData);

    logger.info(`Drop payment updated: ${id} - status: ${paymentStatus} by ${walletAddress}`);

    const updatedDrop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    res.status(200).json(
      new ApiResponse(200, updatedDrop, 'Payment status updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Add wallets to allowlist
 */
const addAllowedWallets = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, wallets } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      throw new ApiError(400, 'Wallets array is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    const createdWallets = [];
    const skippedWallets = [];

    for (const wallet of wallets) {
      const { address, mintLimit, notes } = typeof wallet === 'string'
        ? { address: wallet, mintLimit: null, notes: null }
        : wallet;

      if (!address) {
        skippedWallets.push({ wallet, reason: 'Missing address' });
        continue;
      }

      // Check if wallet already exists for this drop
      const existing = await DropAllowedWallet.findOne({
        where: { dropId: id, walletAddress: address }
      });

      if (existing) {
        // Update existing wallet
        await existing.update({ mintLimit, notes });
        createdWallets.push({ ...existing.toJSON(), updated: true });
      } else {
        // Create new allowlist entry
        const newWallet = await DropAllowedWallet.create({
          dropId: id,
          walletAddress: address,
          mintLimit,
          notes
        });
        createdWallets.push({ ...newWallet.toJSON(), updated: false });
      }
    }

    logger.info(`Added ${createdWallets.length} wallets to allowlist for drop ${id}`);

    res.status(200).json(
      new ApiResponse(200, {
        added: createdWallets,
        skipped: skippedWallets
      }, 'Wallets added to allowlist successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Remove wallets from allowlist
 */
const removeAllowedWallets = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, walletAddresses } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!walletAddresses || !Array.isArray(walletAddresses) || walletAddresses.length === 0) {
      throw new ApiError(400, 'Wallet addresses array is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    const deletedCount = await DropAllowedWallet.destroy({
      where: {
        dropId: id,
        walletAddress: { [Op.in]: walletAddresses }
      }
    });

    logger.info(`Removed ${deletedCount} wallets from allowlist for drop ${id}`);

    res.status(200).json(
      new ApiResponse(200, { deletedCount }, 'Wallets removed from allowlist successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get allowed wallets for a drop
 */
const getAllowedWallets = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    const offset = (page - 1) * limit;

    const { count, rows: wallets } = await DropAllowedWallet.findAndCountAll({
      where: { dropId: id },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json(
      new ApiResponse(200, {
        wallets,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }, 'Allowed wallets retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Check wallet eligibility for minting
 */
const checkWalletEligibility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    const eligibility = await getWalletEligibilityData(drop, walletAddress);

    res.status(200).json(
      new ApiResponse(200, eligibility, 'Wallet eligibility checked successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to get wallet eligibility data
 */
const getWalletEligibilityData = async (drop, walletAddress) => {
  const now = new Date();

  // Check basic drop status
  const isActive = drop.status === 'active';
  const isMintingEnabled = drop.isMintingEnabled;
  const hasStarted = !drop.startDate || new Date(drop.startDate) <= now;
  const hasNotEnded = !drop.endDate || new Date(drop.endDate) >= now;
  const isSoldOut = drop.isSoldOut();
  const isPaid = drop.paymentStatus === 'paid';

  // Get total mints by this wallet for this drop
  const totalMintsByWallet = await DropMint.count({
    where: { dropId: drop.id, minterWalletAddress: walletAddress }
  });

  // Check allowlist if enabled
  let isAllowlisted = true;
  let allowlistMintLimit = null;
  let allowlistMintedCount = 0;

  if (drop.isAllowlistEnabled) {
    const allowedWallet = await DropAllowedWallet.findOne({
      where: { dropId: drop.id, walletAddress }
    });

    if (!allowedWallet) {
      isAllowlisted = false;
    } else {
      allowlistMintLimit = allowedWallet.mintLimit;
      allowlistMintedCount = allowedWallet.mintedCount;
    }
  }

  // Calculate remaining mint allowance
  let remainingMintAllowance = null;

  // Check drop-level limit per wallet
  if (drop.limitPerWallet !== null) {
    remainingMintAllowance = Math.max(0, drop.limitPerWallet - totalMintsByWallet);
  }

  // Check allowlist-specific limit (if more restrictive)
  if (drop.isAllowlistEnabled && isAllowlisted && allowlistMintLimit !== null) {
    const allowlistRemaining = Math.max(0, allowlistMintLimit - allowlistMintedCount);
    if (remainingMintAllowance === null || allowlistRemaining < remainingMintAllowance) {
      remainingMintAllowance = allowlistRemaining;
    }
  }

  // Determine if wallet can mint
  const canMint = isActive &&
                  isMintingEnabled &&
                  hasStarted &&
                  hasNotEnded &&
                  !isSoldOut &&
                  isPaid &&
                  isAllowlisted &&
                  (remainingMintAllowance === null || remainingMintAllowance > 0);

  // Determine reason if cannot mint
  let reason = null;
  if (!canMint) {
    if (!isActive) reason = 'Drop is not active';
    else if (!isMintingEnabled) reason = 'Minting is disabled';
    else if (!hasStarted) reason = 'Drop has not started yet';
    else if (!hasNotEnded) reason = 'Drop has ended';
    else if (isSoldOut) reason = 'Drop is sold out';
    else if (!isPaid) reason = 'Drop launch fee not paid';
    else if (!isAllowlisted) reason = 'Wallet is not on allowlist';
    else if (remainingMintAllowance !== null && remainingMintAllowance <= 0) {
      reason = 'Wallet has reached mint limit';
    }
  }

  return {
    walletAddress,
    canMint,
    reason,
    totalMintsByWallet,
    remainingMintAllowance,
    dropStatus: {
      isActive,
      isMintingEnabled,
      hasStarted,
      hasNotEnded,
      isSoldOut,
      isPaid,
      isAllowlistEnabled: drop.isAllowlistEnabled
    },
    allowlistStatus: drop.isAllowlistEnabled ? {
      isAllowlisted,
      mintLimit: allowlistMintLimit,
      mintedCount: allowlistMintedCount
    } : null,
    pricePerNft: drop.isFreeMint ? '0' : drop.pricePerNft
  };
};

/**
 * Record a successful mint
 */
const recordMint = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      minterWalletAddress,
      nftTokenId,
      nftUri,
      transactionHash,
      mintPrice,
      paymentTransactionHash,
      metadata
    } = req.body;

    if (!minterWalletAddress) {
      throw new ApiError(400, 'Minter wallet address is required');
    }

    if (!nftTokenId) {
      throw new ApiError(400, 'NFT Token ID is required');
    }

    if (!transactionHash) {
      throw new ApiError(400, 'Transaction hash is required');
    }

    const drop = await Drop.findByPk(id, { transaction });
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    // Check if NFT already recorded
    const existingMint = await DropMint.findOne({
      where: { nftTokenId },
      transaction
    });

    if (existingMint) {
      throw new ApiError(400, 'This NFT has already been recorded');
    }

    // Check if drop is sold out
    if (drop.isSoldOut()) {
      throw new ApiError(400, 'Drop is sold out');
    }

    // Create mint record
    const mintIndex = drop.mintedCount + 1;
    const mint = await DropMint.create({
      dropId: id,
      minterWalletAddress,
      nftTokenId,
      nftUri,
      transactionHash,
      mintPrice: drop.isFreeMint ? '0' : (mintPrice || drop.pricePerNft),
      paymentTransactionHash,
      mintIndex,
      metadata
    }, { transaction });

    // Update drop minted count
    await drop.increment('mintedCount', { transaction });

    // Update allowlist minted count if applicable
    if (drop.isAllowlistEnabled) {
      const allowedWallet = await DropAllowedWallet.findOne({
        where: { dropId: id, walletAddress: minterWalletAddress },
        transaction
      });

      if (allowedWallet) {
        await allowedWallet.increment('mintedCount', { transaction });
      }
    }

    // Check if drop is now sold out
    const updatedDrop = await Drop.findByPk(id, { transaction });
    if (updatedDrop.isSoldOut() && updatedDrop.status === 'active') {
      await updatedDrop.update({ status: 'sold_out' }, { transaction });
    }

    await transaction.commit();

    logger.info(`Mint recorded: ${nftTokenId} for drop ${id} by ${minterWalletAddress}`);

    // Fetch mint with associations
    const recordedMint = await DropMint.findByPk(mint.id, {
      include: [
        {
          association: 'drop',
          attributes: ['id', 'name', 'collectionId']
        },
        {
          association: 'minter',
          attributes: ['walletAddress', 'username', 'profileImage']
        }
      ]
    });

    res.status(201).json(
      new ApiResponse(201, recordedMint, 'Mint recorded successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get mints for a drop
 */
const getDropMints = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    const offset = (page - 1) * limit;

    const { count, rows: mints } = await DropMint.findAndCountAll({
      where: { dropId: id },
      include: [
        {
          association: 'minter',
          attributes: ['walletAddress', 'username', 'profileImage']
        }
      ],
      order: [['mintIndex', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json(
      new ApiResponse(200, {
        mints,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }, 'Drop mints retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get mints by a user across all drops
 */
const getUserMints = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const offset = (page - 1) * limit;

    const { count, rows: mints } = await DropMint.findAndCountAll({
      where: { minterWalletAddress: walletAddress },
      include: [
        {
          association: 'drop',
          attributes: ['id', 'name', 'collectionId', 'image'],
          include: [
            {
              association: 'collection',
              attributes: ['id', 'name', 'slug', 'image']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json(
      new ApiResponse(200, {
        mints,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }, 'User mints retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get drops by creator wallet
 */
const getCreatorDrops = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const where = { creatorWalletAddress: walletAddress };
    if (status) {
      if (status.includes(',')) {
        where.status = { [Op.in]: status.split(',') };
      } else {
        where.status = status;
      }
    }

    const offset = (page - 1) * limit;

    const { count, rows: drops } = await Drop.findAndCountAll({
      where,
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const dropsWithStats = drops.map(drop => ({
      ...drop.toJSON(),
      remainingSupply: drop.getRemainingSupply(),
      isCurrentlyActive: drop.isCurrentlyActive(),
      isSoldOut: drop.isSoldOut()
    }));

    res.status(200).json(
      new ApiResponse(200, {
        drops: dropsWithStats,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }, 'Creator drops retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get drop statistics
 */
const getDropStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const drop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    // Get unique minters count
    const uniqueMintersCount = await DropMint.count({
      where: { dropId: id },
      distinct: true,
      col: 'minterWalletAddress'
    });

    // Get total revenue (sum of all mint prices)
    const revenueResult = await DropMint.findAll({
      where: { dropId: id },
      attributes: [
        [sequelize.fn('SUM', sequelize.cast(sequelize.col('mintPrice'), 'UNSIGNED')), 'totalRevenue']
      ],
      raw: true
    });

    const totalRevenue = revenueResult[0]?.totalRevenue || '0';

    // Get allowlist count
    const allowlistCount = await DropAllowedWallet.count({
      where: { dropId: id }
    });

    // Get recent mints
    const recentMints = await DropMint.findAll({
      where: { dropId: id },
      include: [
        {
          association: 'minter',
          attributes: ['walletAddress', 'username', 'profileImage']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    res.status(200).json(
      new ApiResponse(200, {
        drop: {
          ...drop.toJSON(),
          remainingSupply: drop.getRemainingSupply(),
          isCurrentlyActive: drop.isCurrentlyActive(),
          isSoldOut: drop.isSoldOut()
        },
        stats: {
          totalMinted: drop.mintedCount,
          totalSupply: drop.totalSupply,
          remainingSupply: drop.getRemainingSupply(),
          percentageMinted: drop.totalSupply > 0
            ? ((drop.mintedCount / drop.totalSupply) * 100).toFixed(2)
            : '0.00',
          uniqueMintersCount,
          totalRevenue,
          allowlistCount
        },
        recentMints
      }, 'Drop statistics retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Upload bulk NFTs to a drop
 */
const uploadDropNfts = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { walletAddress, nfts } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!nfts || !Array.isArray(nfts) || nfts.length === 0) {
      throw new ApiError(400, 'NFTs array is required');
    }

    const drop = await Drop.findByPk(id, { transaction });
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only upload NFTs to your own drops');
    }

    // Can only upload to draft drops
    if (drop.status !== 'draft') {
      throw new ApiError(400, 'Can only upload NFTs to drops in draft status');
    }

    // Get current max index
    const maxIndexResult = await DropNft.findOne({
      where: { dropId: id },
      attributes: [[sequelize.fn('MAX', sequelize.col('index')), 'maxIndex']],
      raw: true,
      transaction
    });
    let currentIndex = maxIndexResult?.maxIndex || 0;

    const createdNfts = [];
    const skippedNfts = [];

    for (const nft of nfts) {
      const { name, description, image, animationUrl, externalUrl, attributes, metadataUri, metadata } = nft;

      if (!name || !image) {
        skippedNfts.push({ nft, reason: 'Missing required fields (name, image)' });
        continue;
      }

      currentIndex++;

      const newNft = await DropNft.create({
        dropId: id,
        index: currentIndex,
        name,
        description,
        image,
        animationUrl,
        externalUrl,
        attributes,
        metadataUri,
        status: 'available',
        metadata
      }, { transaction });

      createdNfts.push(newNft);
    }

    // Update drop totalSupply
    const totalNfts = await DropNft.count({
      where: { dropId: id },
      transaction
    });
    await drop.update({ totalSupply: totalNfts }, { transaction });

    await transaction.commit();

    logger.info(`Uploaded ${createdNfts.length} NFTs to drop ${id} by ${walletAddress}`);

    // Calculate platform fees based on new total supply
    const feesBreakdown = drop.getFeesBreakdown();

    res.status(201).json(
      new ApiResponse(201, {
        uploaded: createdNfts.length,
        skipped: skippedNfts.length,
        totalSupply: totalNfts,
        skippedDetails: skippedNfts,
        platformFees: feesBreakdown,
        nextStep: 'Configure drop settings using PUT /drops/:id/settings'
      }, 'NFTs uploaded successfully. Next step: Configure drop settings')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Step 2: Upload bulk NFTs to drop
 * Automatically calculates totalSupply based on number of NFTs uploaded
 */

/**
 * Get NFTs for a drop
 */
const getDropNfts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, status } = req.query;

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    const where = { dropId: id };
    if (status) {
      if (status.includes(',')) {
        where.status = { [Op.in]: status.split(',') };
      } else {
        where.status = status;
      }
    }

    const offset = (page - 1) * limit;

    const { count, rows: nfts } = await DropNft.findAndCountAll({
      where,
      order: [['index', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get counts by status
    const statusCounts = await DropNft.findAll({
      where: { dropId: id },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const counts = {
      available: 0,
      reserved: 0,
      minted: 0
    };
    statusCounts.forEach(sc => {
      counts[sc.status] = parseInt(sc.count);
    });

    res.status(200).json(
      new ApiResponse(200, {
        nfts,
        counts,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }, 'Drop NFTs retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single NFT from a drop
 */
const getDropNftById = async (req, res, next) => {
  try {
    const { id, nftId } = req.params;

    const nft = await DropNft.findOne({
      where: { id: nftId, dropId: id },
      include: [
        {
          association: 'drop',
          attributes: ['id', 'name', 'collectionId', 'pricePerNft', 'isFreeMint']
        }
      ]
    });

    if (!nft) {
      throw new ApiError(404, 'NFT not found');
    }

    res.status(200).json(
      new ApiResponse(200, nft, 'NFT retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update a single NFT in a drop
 */
const updateDropNft = async (req, res, next) => {
  try {
    const { id, nftId } = req.params;
    const { walletAddress, name, description, image, animationUrl, externalUrl, attributes, metadataUri, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update NFTs in your own drops');
    }

    const nft = await DropNft.findOne({
      where: { id: nftId, dropId: id }
    });

    if (!nft) {
      throw new ApiError(404, 'NFT not found');
    }

    // Can only update available NFTs
    if (nft.status !== 'available') {
      throw new ApiError(400, 'Cannot update NFT that is already reserved or minted');
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (animationUrl !== undefined) updateData.animationUrl = animationUrl;
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl;
    if (attributes !== undefined) updateData.attributes = attributes;
    if (metadataUri !== undefined) updateData.metadataUri = metadataUri;
    if (metadata !== undefined) updateData.metadata = metadata;

    await nft.update(updateData);

    logger.info(`NFT ${nftId} updated in drop ${id} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, nft, 'NFT updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete NFTs from a drop
 */
const deleteDropNfts = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { walletAddress, nftIds } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id, { transaction });
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only delete NFTs from your own drops');
    }

    // Can only delete from draft drops
    if (drop.status !== 'draft') {
      throw new ApiError(400, 'Can only delete NFTs from drops in draft status');
    }

    let deletedCount = 0;
    if (nftIds && Array.isArray(nftIds) && nftIds.length > 0) {
      // Delete specific NFTs
      deletedCount = await DropNft.destroy({
        where: {
          id: { [Op.in]: nftIds },
          dropId: id,
          status: 'available'
        },
        transaction
      });
    }

    // Update drop totalSupply
    const totalNfts = await DropNft.count({
      where: { dropId: id },
      transaction
    });
    await drop.update({ totalSupply: totalNfts }, { transaction });

    // Re-index remaining NFTs
    const remainingNfts = await DropNft.findAll({
      where: { dropId: id },
      order: [['index', 'ASC']],
      transaction
    });

    for (let i = 0; i < remainingNfts.length; i++) {
      if (remainingNfts[i].index !== i + 1) {
        await remainingNfts[i].update({ index: i + 1 }, { transaction });
      }
    }

    await transaction.commit();

    logger.info(`Deleted ${deletedCount} NFTs from drop ${id} by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        deletedCount,
        totalSupply: totalNfts
      }, 'NFTs deleted successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get random available NFTs for minting preview
 */
const getRandomAvailableNfts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { count = 1 } = req.query;

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    const requestedCount = Math.min(parseInt(count), 10); // Max 10 previews

    // Get random available NFTs
    const availableNfts = await DropNft.findAll({
      where: {
        dropId: id,
        status: 'available'
      },
      order: sequelize.random(),
      limit: requestedCount
    });

    res.status(200).json(
      new ApiResponse(200, {
        nfts: availableNfts,
        availableCount: await DropNft.count({
          where: { dropId: id, status: 'available' }
        })
      }, 'Random NFTs retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Reserve NFTs for minting (called before blockchain transaction)
 */
const reserveNftsForMint = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { walletAddress, count = 1 } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id, { transaction });
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    // Check eligibility
    const eligibility = await getWalletEligibilityData(drop, walletAddress);
    if (!eligibility.canMint) {
      throw new ApiError(400, eligibility.reason);
    }

    const requestedCount = parseInt(count);

    // Check if enough allowance
    if (eligibility.remainingMintAllowance !== null && requestedCount > eligibility.remainingMintAllowance) {
      throw new ApiError(400, `Can only mint ${eligibility.remainingMintAllowance} more NFTs`);
    }

    // Get random available NFTs
    const availableNfts = await DropNft.findAll({
      where: {
        dropId: id,
        status: 'available'
      },
      order: sequelize.random(),
      limit: requestedCount,
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (availableNfts.length < requestedCount) {
      throw new ApiError(400, `Only ${availableNfts.length} NFTs available`);
    }

    // Reserve the NFTs
    const reservedNftIds = availableNfts.map(nft => nft.id);
    await DropNft.update(
      { status: 'reserved' },
      {
        where: { id: { [Op.in]: reservedNftIds } },
        transaction
      }
    );

    await transaction.commit();

    // Fetch reserved NFTs with updated status
    const reservedNfts = await DropNft.findAll({
      where: { id: { [Op.in]: reservedNftIds } }
    });

    logger.info(`Reserved ${reservedNfts.length} NFTs for ${walletAddress} in drop ${id}`);

    res.status(200).json(
      new ApiResponse(200, {
        reservedNfts,
        pricePerNft: drop.isFreeMint ? '0' : drop.pricePerNft,
        totalPrice: drop.isFreeMint ? '0' : (BigInt(drop.pricePerNft) * BigInt(reservedNfts.length)).toString()
      }, 'NFTs reserved successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Release reserved NFTs (if mint fails or is cancelled)
 */
const releaseReservedNfts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, nftIds } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!nftIds || !Array.isArray(nftIds) || nftIds.length === 0) {
      throw new ApiError(400, 'NFT IDs array is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    // Release reserved NFTs back to available
    const releasedCount = await DropNft.update(
      { status: 'available' },
      {
        where: {
          id: { [Op.in]: nftIds },
          dropId: id,
          status: 'reserved'
        }
      }
    );

    logger.info(`Released ${releasedCount[0]} reserved NFTs in drop ${id}`);

    res.status(200).json(
      new ApiResponse(200, { releasedCount: releasedCount[0] }, 'Reserved NFTs released successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm mint (update NFT status after successful blockchain transaction)
 */
const confirmMint = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      minterWalletAddress,
      mintedNfts // Array of { nftId, nftTokenId, transactionHash }
    } = req.body;

    if (!minterWalletAddress) {
      throw new ApiError(400, 'Minter wallet address is required');
    }

    if (!mintedNfts || !Array.isArray(mintedNfts) || mintedNfts.length === 0) {
      throw new ApiError(400, 'Minted NFTs array is required');
    }

    const drop = await Drop.findByPk(id, { transaction });
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    const confirmedMints = [];
    const now = new Date();

    for (const mintInfo of mintedNfts) {
      const { nftId, nftTokenId, transactionHash, paymentTransactionHash } = mintInfo;

      if (!nftId || !nftTokenId || !transactionHash) {
        continue;
      }

      // Update the NFT status
      const nft = await DropNft.findOne({
        where: {
          id: nftId,
          dropId: id,
          status: { [Op.in]: ['reserved', 'available'] }
        },
        transaction
      });

      if (!nft) {
        continue;
      }

      // Update NFT to minted
      await nft.update({
        status: 'minted',
        mintedTo: minterWalletAddress,
        mintedAt: now,
        nftTokenId,
        transactionHash
      }, { transaction });

      // Create mint record
      const mintIndex = drop.mintedCount + confirmedMints.length + 1;
      const mint = await DropMint.create({
        dropId: id,
        minterWalletAddress,
        nftTokenId,
        nftUri: nft.metadataUri,
        transactionHash,
        mintPrice: drop.isFreeMint ? '0' : drop.pricePerNft,
        paymentTransactionHash,
        mintIndex,
        metadata: {
          dropNftId: nft.id,
          nftName: nft.name,
          nftImage: nft.image
        }
      }, { transaction });

      confirmedMints.push({
        nft: nft.toJSON(),
        mint: mint.toJSON()
      });
    }

    if (confirmedMints.length > 0) {
      // Update drop minted count
      await drop.increment('mintedCount', { by: confirmedMints.length, transaction });

      // Update allowlist minted count if applicable
      if (drop.isAllowlistEnabled) {
        const allowedWallet = await DropAllowedWallet.findOne({
          where: { dropId: id, walletAddress: minterWalletAddress },
          transaction
        });

        if (allowedWallet) {
          await allowedWallet.increment('mintedCount', { by: confirmedMints.length, transaction });
        }
      }

      // Check if drop is now sold out
      const updatedDrop = await Drop.findByPk(id, { transaction });
      const availableCount = await DropNft.count({
        where: { dropId: id, status: 'available' },
        transaction
      });

      if (availableCount === 0 && updatedDrop.status === 'active') {
        await updatedDrop.update({ status: 'sold_out' }, { transaction });
      }
    }

    await transaction.commit();

    logger.info(`Confirmed ${confirmedMints.length} mints for drop ${id} by ${minterWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        confirmedCount: confirmedMints.length,
        mints: confirmedMints
      }, 'Mints confirmed successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get platform fees calculation for a drop
 */
const getDropFees = async (req, res, next) => {
  try {
    const { id } = req.params;

    const drop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'taxon']
        }
      ]
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    const feesBreakdown = drop.getFeesBreakdown();

    res.status(200).json(
      new ApiResponse(200, {
        dropId: drop.id,
        dropName: drop.name,
        ...feesBreakdown,
        platformFeesStatus: drop.platformFeesStatus,
        platformFeesTransactionHash: drop.platformFeesTransactionHash
      }, 'Fees calculated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update platform fees payment status
 */
const updatePlatformFeesPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, transactionHash, status } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    const updateData = {
      totalPlatformFees: drop.calculatePlatformFees()
    };

    if (transactionHash) {
      updateData.platformFeesTransactionHash = transactionHash;
    }

    if (status) {
      const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
      if (!validStatuses.includes(status)) {
        throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.platformFeesStatus = status;

      // Also update legacy paymentStatus for backward compatibility
      updateData.paymentStatus = status;
    }

    await drop.update(updateData);

    logger.info(`Platform fees updated for drop ${id}: status=${status}, txHash=${transactionHash}`);

    const updatedDrop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    res.status(200).json(
      new ApiResponse(200, {
        ...updatedDrop.toJSON(),
        feesBreakdown: updatedDrop.getFeesBreakdown()
      }, 'Platform fees payment updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize a wallet for minting operations
 */
const authorizeMinterWallet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, minterWallet } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!minterWallet) {
      throw new ApiError(400, 'Minter wallet address is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    await drop.update({ authorizedMinterWallet: minterWallet });

    logger.info(`Authorized minter wallet for drop ${id}: ${minterWallet}`);

    res.status(200).json(
      new ApiResponse(200, {
        dropId: drop.id,
        authorizedMinterWallet: minterWallet
      }, 'Minter wallet authorized successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Save all drop settings at once (for dashboard save button)
 */
const saveDropSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      walletAddress,
      // Pricing
      pricePerNft,
      royaltyPercentage,
      limitPerWallet,
      // Flags
      isBurnable,
      isTransferable,
      isOnlyXrp,
      isMutable,
      // Schedule
      startDate,
      endDate,
      // Dashboard toggles
      isMintingEnabled,
      isAllowlistEnabled,
      isFreeMint,
      // Status
      status
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    const drop = await Drop.findByPk(id);
    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    if (drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only update your own drops');
    }

    // Build update object
    const updateData = {};

    // Pricing and limits
    if (pricePerNft !== undefined) updateData.pricePerNft = pricePerNft;
    if (royaltyPercentage !== undefined) {
      if (royaltyPercentage < 0 || royaltyPercentage > 50) {
        throw new ApiError(400, 'Royalty percentage must be between 0 and 50');
      }
      updateData.royaltyPercentage = royaltyPercentage;
    }
    if (limitPerWallet !== undefined) updateData.limitPerWallet = limitPerWallet;

    // Flags
    if (isBurnable !== undefined) updateData.isBurnable = isBurnable;
    if (isTransferable !== undefined) updateData.isTransferable = isTransferable;
    if (isOnlyXrp !== undefined) updateData.isOnlyXrp = isOnlyXrp;
    if (isMutable !== undefined) updateData.isMutable = isMutable;

    // Schedule
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;

    // Validate schedule
    if (updateData.startDate && updateData.endDate) {
      const start = new Date(updateData.startDate);
      const end = new Date(updateData.endDate);
      if (end <= start) {
        throw new ApiError(400, 'End date must be after start date');
      }
    }

    // Dashboard toggles
    if (isMintingEnabled !== undefined) updateData.isMintingEnabled = isMintingEnabled;
    if (isAllowlistEnabled !== undefined) updateData.isAllowlistEnabled = isAllowlistEnabled;
    if (isFreeMint !== undefined) updateData.isFreeMint = isFreeMint;

    // Status change validation
    if (status !== undefined) {
      const validStatuses = ['draft', 'scheduled', 'active', 'paused', 'ended'];
      if (!validStatuses.includes(status)) {
        throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Check if can transition to active
      if (status === 'active' && drop.platformFeesStatus !== 'paid') {
        throw new ApiError(400, 'Platform fees must be paid before activating the drop');
      }

      updateData.status = status;
    }

    await drop.update(updateData);

    logger.info(`Drop settings saved for ${id} by ${walletAddress}`);

    // Fetch updated drop with all associations
    const updatedDrop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'taxon']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    // Get counts for dashboard
    const [allowlistCount, availableNftsCount, reservedNftsCount] = await Promise.all([
      DropAllowedWallet.count({ where: { dropId: id } }),
      DropNft.count({ where: { dropId: id, status: 'available' } }),
      DropNft.count({ where: { dropId: id, status: 'reserved' } })
    ]);

    res.status(200).json(
      new ApiResponse(200, {
        ...updatedDrop.toJSON(),
        remainingSupply: updatedDrop.getRemainingSupply(),
        isCurrentlyActive: updatedDrop.isCurrentlyActive(),
        isSoldOut: updatedDrop.isSoldOut(),
        feesBreakdown: updatedDrop.getFeesBreakdown(),
        dashboard: {
          totalSupply: updatedDrop.totalSupply,
          mintedCount: updatedDrop.mintedCount,
          availableCount: availableNftsCount,
          reservedCount: reservedNftsCount,
          totalRevenue: updatedDrop.totalRevenue,
          allowlistCount,
          status: updatedDrop.status,
          isMintingEnabled: updatedDrop.isMintingEnabled,
          isAllowlistEnabled: updatedDrop.isAllowlistEnabled,
          isFreeMint: updatedDrop.isFreeMint
        }
      }, 'Drop settings saved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get drop dashboard data
 */
const getDropDashboard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.query;

    const drop = await Drop.findByPk(id, {
      include: [
        {
          association: 'collection',
          attributes: ['id', 'name', 'slug', 'image', 'bannerImage', 'taxon', 'category']
        },
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found');
    }

    // Verify ownership if walletAddress provided
    if (walletAddress && drop.creatorWalletAddress !== walletAddress) {
      throw new ApiError(403, 'You can only view dashboard for your own drops');
    }

    // Get various counts
    const [allowlistCount, nftStatusCounts, uniqueMintersCount] = await Promise.all([
      DropAllowedWallet.count({ where: { dropId: id } }),
      DropNft.findAll({
        where: { dropId: id },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),
      DropMint.count({
        where: { dropId: id },
        distinct: true,
        col: 'minterWalletAddress'
      })
    ]);

    const nftCounts = {
      available: 0,
      reserved: 0,
      minted: 0
    };
    nftStatusCounts.forEach(sc => {
      nftCounts[sc.status] = parseInt(sc.count);
    });

    res.status(200).json(
      new ApiResponse(200, {
        // Launch details
        launchDetails: {
          id: drop.id,
          name: drop.name,
          description: drop.description,
          image: drop.image,
          bannerImage: drop.bannerImage,
          creator: drop.creator,
          collection: drop.collection,
          taxon: drop.collection?.taxon,
          totalSupply: drop.totalSupply
        },
        // Pricing
        pricing: {
          pricePerNft: drop.pricePerNft,
          royaltyPercentage: drop.royaltyPercentage,
          limitPerWallet: drop.limitPerWallet
        },
        // Flags
        flags: {
          isBurnable: drop.isBurnable,
          isTransferable: drop.isTransferable,
          isOnlyXrp: drop.isOnlyXrp,
          isMutable: drop.isMutable
        },
        // Schedule
        schedule: {
          startDate: drop.startDate,
          endDate: drop.endDate
        },
        // Authorization
        authorization: {
          authorizedMinterWallet: drop.authorizedMinterWallet
        },
        // Platform fees
        platformFees: drop.getFeesBreakdown(),
        platformFeesStatus: drop.platformFeesStatus,
        platformFeesTransactionHash: drop.platformFeesTransactionHash,
        // Dashboard
        dashboard: {
          status: drop.status,
          isMintingEnabled: drop.isMintingEnabled,
          isAllowlistEnabled: drop.isAllowlistEnabled,
          isFreeMint: drop.isFreeMint,
          mintedCount: drop.mintedCount,
          totalRevenue: drop.totalRevenue,
          totalRevenueXrp: (Number(drop.totalRevenue) / 1000000).toFixed(6),
          allowlistCount,
          uniqueMintersCount,
          nftCounts
        },
        // Computed
        remainingSupply: drop.getRemainingSupply(),
        isCurrentlyActive: drop.isCurrentlyActive(),
        isSoldOut: drop.isSoldOut()
      }, 'Drop dashboard retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDrop,
  updateDrop,
  getDropById,
  getDrops,
  getActiveDrops,
  getUpcomingDrops,
  deleteDrop,
  updateDropStatus,
  toggleDropSettings,
  updatePaymentStatus,
  addAllowedWallets,
  removeAllowedWallets,
  getAllowedWallets,
  checkWalletEligibility,
  recordMint,
  getDropMints,
  getUserMints,
  getCreatorDrops,
  getDropStats,
  // NFT management
  uploadDropNfts,
  getDropNfts,
  getDropNftById,
  updateDropNft,
  deleteDropNfts,
  getRandomAvailableNfts,
  reserveNftsForMint,
  releaseReservedNfts,
  confirmMint,
  // New endpoints for frontend workflow
  getDropFees,
  updatePlatformFeesPayment,
  authorizeMinterWallet,
  saveDropSettings,
  getDropDashboard
};
