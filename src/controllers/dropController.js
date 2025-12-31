const { Drop, DropNft, DropAllowedWallet, DropMint, Collection, User, AdminWallet, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const xrplService = require('../services/xrplService');
const xrplConfig = require('../config/xrpl');

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
 * Get explore drops - Live and Coming Soon drops for marketplace
 * Live: status='active', startDate <= now, endDate > now
 * Coming Soon: status='active', startDate within next 10 days, endDate > now
 */
const getExploreDrops = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'startDate',
      order = 'ASC'
    } = req.query;

    const now = new Date();
    const tenDaysFromNow = new Date(now.getTime() + (10 * 24 * 60 * 60 * 1000)); // 10 days in milliseconds
    const offset = (page - 1) * limit;

    const { count, rows: drops } = await Drop.findAndCountAll({
      where: {
        // Only fetch active or scheduled drops (exclude ended, paused, sold_out, draft)
        status: { [Op.in]: ['active', 'scheduled'] },
        // Combine endDate and startDate filters using Op.and to avoid key collision
        [Op.and]: [
          // End date must be greater than or equal to current date (or null for no end date)
          // This ensures drops whose end date has passed are NOT fetched
          {
            [Op.or]: [
              { endDate: null },
              { endDate: { [Op.gte]: now } }
            ]
          },
          // Start date must be either:
          // 1. Less than or equal to now (live)
          // 2. Within the next 10 days (coming soon)
          // 3. Null (no start date = live)
          {
            [Op.or]: [
              { startDate: null },
              { startDate: { [Op.lte]: now } },
              {
                startDate: {
                  [Op.and]: [
                    { [Op.gt]: now },
                    { [Op.lte]: tenDaysFromNow }
                  ]
                }
              }
            ]
          }
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

    // Add computed fields and dropStatus (live/coming_soon)
    const exploreDrops = drops.map(drop => {
      const dropData = drop.toJSON();
      const startDate = drop.startDate ? new Date(drop.startDate) : null;

      // Determine if drop is live or coming soon
      let dropStatus;
      let daysUntilStart = null;

      if (!startDate || startDate <= now) {
        // No start date or start date has passed = LIVE
        dropStatus = 'live';
      } else {
        // Start date is in the future (within 10 days) = COMING SOON
        dropStatus = 'coming_soon';
        // Calculate days until start
        const timeDiff = startDate.getTime() - now.getTime();
        daysUntilStart = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      }

      return {
        ...dropData,
        dropStatus,
        daysUntilStart,
        remainingSupply: drop.getRemainingSupply(),
        isCurrentlyActive: drop.isCurrentlyActive(),
        isSoldOut: drop.isSoldOut()
      };
    });

    // Filter out sold out drops and separate live and coming soon for frontend convenience
    const availableDrops = exploreDrops.filter(d => !d.isSoldOut);
    const liveDrops = availableDrops.filter(d => d.dropStatus === 'live');
    const comingSoonDrops = availableDrops.filter(d => d.dropStatus === 'coming_soon');

    res.status(200).json(
      new ApiResponse(200, {
        drops: availableDrops,
        liveDrops,
        comingSoonDrops,
        summary: {
          totalLive: liveDrops.length,
          totalComingSoon: comingSoonDrops.length,
          totalAvailable: availableDrops.length
        },
        pagination: {
          total: availableDrops.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(availableDrops.length / limit)
        }
      }, 'Explore drops retrieved successfully')
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
      attributes: [
        'id',
        'name',
        'description',
        'image',
        'bannerImage',
        'taxonId',
        'creatorWalletAddress',
        'totalSupply',
        'mintedCount',
        'pricePerNft',
        'royaltyPercentage',
        'status',
        'platformFeesStatus',
        'isMintingEnabled',
        'isAllowlistEnabled',
        'isFreeMint',
        'startDate',
        'endDate',
        'createdAt',
        'updatedAt'
      ],
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const dropsWithStats = drops.map(drop => {
      // Determine current workflow step
      let currentStep;
      let stepNumber;
      let stepDescription;
      let redirectUrl;

      if (drop.totalSupply === 0) {
        // No NFTs uploaded yet - Step 2
        currentStep = 'upload_nfts';
        stepNumber = 2;
        stepDescription = 'Upload bulk NFTs to this drop';
        redirectUrl = `/drops/${drop.taxonId}/upload-nfts`;
      } else if (drop.status === 'draft') {
        // NFTs uploaded but not launched - Step 3
        currentStep = 'configure_settings';
        stepNumber = 3;
        stepDescription = 'Configure settings and launch the drop';
        redirectUrl = `/drops/${drop.taxonId}/dashboard`;
      } else {
        // Drop is active, scheduled, paused, ended, or sold_out - Completed
        currentStep = 'completed';
        stepNumber = 4;
        stepDescription = 'Drop setup completed';
        redirectUrl = `/drops/${drop.taxonId}/dashboard`;
      }

      return {
        ...drop.toJSON(),
        remainingSupply: drop.getRemainingSupply(),
        isCurrentlyActive: drop.isCurrentlyActive(),
        isSoldOut: drop.isSoldOut(),
        // Workflow step information
        workflow: {
          currentStep,
          stepNumber,
          stepDescription,
          redirectUrl,
          steps: {
            1: { name: 'create_drop', label: 'Create Drop', completed: true },
            2: { name: 'upload_nfts', label: 'Upload NFTs', completed: drop.totalSupply > 0 },
            3: { name: 'configure_settings', label: 'Configure & Launch', completed: drop.status !== 'draft' },
            4: { name: 'completed', label: 'Live', completed: ['active', 'scheduled', 'paused', 'ended', 'sold_out'].includes(drop.status) }
          }
        }
      };
    });

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
 * Step 2: Upload bulk NFTs to drop using taxonId
 * Finds the drop by taxonId and creatorWalletAddress, then uploads NFTs
 * Automatically calculates totalSupply based on number of NFTs uploaded
 */
const uploadDropNftsByTaxon = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { taxonId } = req.params;
    const { walletAddress, nfts } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!nfts || !Array.isArray(nfts) || nfts.length === 0) {
      throw new ApiError(400, 'NFTs array is required');
    }

    // Find drop by taxonId and creator wallet
    const drop = await Drop.findOne({
      where: {
        taxonId: parseInt(taxonId),
        creatorWalletAddress: walletAddress,
        status: 'draft'
      },
      transaction
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found with this taxonId or you do not have permission');
    }

    // Get current max index
    const maxIndexResult = await DropNft.findOne({
      where: { dropId: drop.id },
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
        dropId: drop.id,
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
      where: { dropId: drop.id },
      transaction
    });
    await drop.update({ totalSupply: totalNfts }, { transaction });

    await transaction.commit();

    logger.info(`Uploaded ${createdNfts.length} NFTs to drop (taxonId: ${taxonId}) by ${walletAddress}`);

    // Calculate platform fees based on new total supply
    const feesBreakdown = drop.getFeesBreakdown();

    res.status(201).json(
      new ApiResponse(201, {
        dropId: drop.id,
        taxonId: drop.taxonId,
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
          authorizedMinterWallet: drop.authorizedMinterWallet,
          minterAuthorizationTxHash: drop.minterAuthorizationTxHash,
          isAuthorized: !!drop.authorizedMinterWallet
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

/**
 * Get drop dashboard data by taxonId
 */
/**
 * Get drop details by taxonId - Basic drop information for public view
 */
const getDropDetailsByTaxon = async (req, res, next) => {
  try {
    const { taxonId } = req.params;
    const { walletAddress, includeNfts = 'true', page = 1, limit = 20 } = req.query;

    // Build where clause
    const whereClause = {
      taxonId: parseInt(taxonId)
    };

    // If walletAddress provided, filter by creator
    if (walletAddress) {
      whereClause.creatorWalletAddress = walletAddress;
    }

    // Find drop by taxonId
    const drop = await Drop.findOne({
      where: whereClause,
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'coverImage', 'bio', 'isVerified']
        }
      ]
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found with this taxonId');
    }

    // Get listing stats - count of NFTs listed for sale from this drop
    const [mintedNftCount, totalVolume] = await Promise.all([
      // Count NFTs from this drop that are currently minted
      DropNft.count({
        where: {
          dropId: drop.id,
          status: 'minted'
        }
      }),
      // Get total volume from mints (using mintPrice field)
      DropMint.sum('mintPrice', {
        where: { dropId: drop.id }
      })
    ]);

    // Calculate listing percentage
    const mintedCount = drop.mintedCount || 0;

    // Build response with requested fields
    const dropDetails = {
      id: drop.id,
      taxonId: drop.taxonId,
      name: drop.name,
      description: drop.description,
      image: drop.image,
      bannerImage: drop.bannerImage,
      // Social links
      socialLinks: {
        websiteUrl: drop.websiteUrl,
        twitterUrl: drop.twitterUrl,
        discordUrl: drop.discordUrl,
        telegramUrl: drop.telegramUrl
      },
      // Creator information
      creator: drop.creator ? {
        walletAddress: drop.creator.walletAddress,
        username: drop.creator.username,
        profileImage: drop.creator.profileImage,
        coverImage: drop.creator.coverImage,
        bio: drop.creator.bio,
        isVerified: drop.creator.isVerified
      } : null,
      // Stats
      floorPrice: drop.pricePerNft,
      floorPriceXrp: (Number(drop.pricePerNft || 0) / 1000000).toFixed(6),
      mintPrice: drop.pricePerNft,
      mintPriceXrp: (Number(drop.pricePerNft || 0) / 1000000).toFixed(6),
      isFreeMint: drop.isFreeMint,
      items: drop.totalSupply,
      totalSupply: drop.totalSupply,
      mintedCount: drop.mintedCount,
      remainingSupply: drop.getRemainingSupply(),
      volume: (totalVolume || 0).toString(),
      volumeXrp: (Number(totalVolume || 0) / 1000000).toFixed(6),
      // Status
      status: drop.status,
      isMintingEnabled: drop.isMintingEnabled
    };

    // Get minted NFTs with their details if requested
    if (includeNfts === 'true') {
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Get minted NFTs from database
      const { count: totalMintedNfts, rows: mintedNfts } = await DropNft.findAndCountAll({
        where: {
          dropId: drop.id,
          status: 'minted',
          nftTokenId: { [Op.ne]: null }
        },
        order: [['mintedAt', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      // Get owner details from Users table for minted NFTs
      const minterAddresses = [...new Set(mintedNfts.map(nft => nft.mintedTo).filter(Boolean))];
      const minterUsers = await User.findAll({
        where: { walletAddress: { [Op.in]: minterAddresses } },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      });
      const minterMap = minterUsers.reduce((acc, user) => {
        acc[user.walletAddress] = user;
        return acc;
      }, {});

      // Get XRPL details for each minted NFT (owner and listing info)
      const nftsWithDetails = await Promise.all(
        mintedNfts.map(async (nft) => {
          let xrplDetails = null;
          let currentOwner = null;
          let ownerUser = null;

          if (nft.nftTokenId) {
            try {
              xrplDetails = await xrplService.getNFTDetailsWithOffers(nft.nftTokenId);
              currentOwner = xrplDetails?.owner || nft.mintedTo;

              // If owner is different from minter, get owner's user info
              if (currentOwner && currentOwner !== nft.mintedTo) {
                ownerUser = await User.findOne({
                  where: { walletAddress: currentOwner },
                  attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
                });
              } else {
                ownerUser = minterMap[nft.mintedTo] || null;
              }
            } catch (err) {
              logger.warn(`Failed to get XRPL details for NFT ${nft.nftTokenId}:`, err.message);
              currentOwner = nft.mintedTo;
              ownerUser = minterMap[nft.mintedTo] || null;
            }
          }

          return {
            id: nft.id,
            index: nft.index,
            name: nft.name,
            description: nft.description,
            image: nft.image,
            animationUrl: nft.animationUrl,
            attributes: nft.attributes,
            nftTokenId: nft.nftTokenId,
            metadataUri: nft.metadataUri,
            // Minting info
            mintedTo: nft.mintedTo,
            mintedAt: nft.mintedAt,
            transactionHash: nft.transactionHash,
            // Minter (original buyer)
            minter: minterMap[nft.mintedTo] ? {
              walletAddress: minterMap[nft.mintedTo].walletAddress,
              username: minterMap[nft.mintedTo].username,
              profileImage: minterMap[nft.mintedTo].profileImage,
              isVerified: minterMap[nft.mintedTo].isVerified
            } : {
              walletAddress: nft.mintedTo,
              username: null,
              profileImage: null,
              isVerified: false
            },
            // Current owner (may be different if NFT was transferred)
            currentOwner: {
              walletAddress: currentOwner,
              username: ownerUser?.username || null,
              profileImage: ownerUser?.profileImage || null,
              isVerified: ownerUser?.isVerified || false
            },
            // Listing info
            isListed: xrplDetails?.isListed || false,
            listingPrice: xrplDetails?.lowestSellOffer?.amount || null,
            listingPriceXrp: xrplDetails?.lowestSellOffer?.amountXrp || null,
            sellOffersCount: xrplDetails?.sellOffersCount || 0,
            lowestSellOffer: xrplDetails?.lowestSellOffer || null
          };
        })
      );

      // Calculate listing stats from the NFTs we fetched
      const listedNfts = nftsWithDetails.filter(nft => nft.isListed);
      const listedCount = listedNfts.length;

      // Calculate floor price from listings
      let floorPriceFromListings = null;
      if (listedNfts.length > 0) {
        const prices = listedNfts
          .map(nft => nft.listingPrice)
          .filter(p => p !== null)
          .map(p => parseInt(p));
        if (prices.length > 0) {
          floorPriceFromListings = Math.min(...prices);
        }
      }

      dropDetails.mintedNfts = {
        items: nftsWithDetails,
        pagination: {
          total: totalMintedNfts,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalMintedNfts / parseInt(limit))
        },
        stats: {
          totalMinted: totalMintedNfts,
          listedCount: listedCount,
          listingPercentage: totalMintedNfts > 0 ? ((listedCount / totalMintedNfts) * 100).toFixed(2) : '0.00',
          floorPriceFromListings: floorPriceFromListings?.toString() || null,
          floorPriceFromListingsXrp: floorPriceFromListings ? (floorPriceFromListings / 1000000).toFixed(6) : null
        }
      };
    }

    res.status(200).json(
      new ApiResponse(200, dropDetails, 'Drop details retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

const getDropDashboardByTaxon = async (req, res, next) => {
  try {
    const { taxonId } = req.params;
    const { walletAddress } = req.query;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Find drop by taxonId and creator wallet
    const drop = await Drop.findOne({
      where: {
        taxonId: parseInt(taxonId),
        creatorWalletAddress: walletAddress
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
      ]
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found with this taxonId or you do not have permission');
    }

    // Get various counts and platform fees wallet
    const [allowlistCount, nftStatusCounts, uniqueMintersCount, platformFeesWallet] = await Promise.all([
      DropAllowedWallet.count({ where: { dropId: drop.id } }),
      DropNft.findAll({
        where: { dropId: drop.id },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),
      DropMint.count({
        where: { dropId: drop.id },
        distinct: true,
        col: 'minterWalletAddress'
      }),
      AdminWallet.findOne({
        where: { type: 'platformFees', isActive: true },
        attributes: ['walletAddress', 'label']
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

    // Determine launch status based on workflow progress
    let launchStatus;
    let launchStatusCode;
    const now = new Date();
    const endDate = drop.endDate ? new Date(drop.endDate) : null;
    const startDate = drop.startDate ? new Date(drop.startDate) : null;

    // Check if drop has ended (time expired)
    if (endDate && endDate < now) {
      launchStatus = 'time ends';
      launchStatusCode = 7;
    } else if (drop.isSoldOut()) {
      // Check if sold out
      launchStatus = 'sold out';
      launchStatusCode = 8;
    } else if (drop.isMintingEnabled && drop.status === 'active' && (!startDate || startDate <= now)) {
      // Minting is enabled, drop is active, and start time has passed
      launchStatus = 'live';
      launchStatusCode = 6;
    } else if (drop.totalSupply === 0) {
      // No NFTs uploaded yet
      launchStatus = 'waiting for bulk NFT upload';
      launchStatusCode = 1;
    } else if (!drop.authorizedMinterWallet) {
      // NFTs uploaded but minting not authorized
      launchStatus = 'waiting for minting authorization';
      launchStatusCode = 2;
    } else if (drop.platformFeesStatus !== 'paid') {
      // Authorized but fees not paid
      launchStatus = 'waiting for payment';
      launchStatusCode = 3;
    } else if (!drop.pricePerNft || drop.pricePerNft === '0' || !drop.startDate || !drop.endDate) {
      // Fees paid but pricing/schedule not configured
      launchStatus = 'waiting for price details and schedule dates';
      launchStatusCode = 4;
    } else if (startDate && startDate > now) {
      // Everything configured but start time hasn't arrived yet
      launchStatus = 'scheduled';
      launchStatusCode = 9;
    } else {
      // Everything configured, ready to launch
      launchStatus = 'ready for launch';
      launchStatusCode = 5;
    }

    res.status(200).json(
      new ApiResponse(200, {
        // Launch status
        launchStatus,
        launchStatusCode,
        // Launch details
        launchDetails: {
          id: drop.id,
          name: drop.name,
          description: drop.description,
          image: drop.image,
          bannerImage: drop.bannerImage,
          taxonId: drop.taxonId,
          creator: drop.creator,
          collection: drop.collection,
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
          authorizedMinterWallet: drop.authorizedMinterWallet,
          minterAuthorizationTxHash: drop.minterAuthorizationTxHash,
          isAuthorized: !!drop.authorizedMinterWallet
        },
        // Platform fees
        platformFees: drop.getFeesBreakdown(),
        platformFeesStatus: drop.platformFeesStatus,
        platformFeesTransactionHash: drop.platformFeesTransactionHash,
        feesIsPaid: drop.platformFeesStatus === 'paid',
        platformFeesWallet: platformFeesWallet ? {
          walletAddress: platformFeesWallet.walletAddress,
          label: platformFeesWallet.label || 'Platform Fees Wallet'
        } : null,
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

/**
 * Update platform fees payment status by taxonId
 */
const updatePlatformFeesPaymentByTaxon = async (req, res, next) => {
  try {
    const { taxonId } = req.params;
    const { walletAddress, transactionHash, status } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Find drop by taxonId and creator wallet
    const drop = await Drop.findOne({
      where: {
        taxonId: parseInt(taxonId),
        creatorWalletAddress: walletAddress
      }
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found with this taxonId or you do not have permission');
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

    logger.info(`Platform fees updated for drop (taxonId: ${taxonId}): status=${status}, txHash=${transactionHash}`);

    res.status(200).json(
      new ApiResponse(200, {
        dropId: drop.id,
        taxonId: drop.taxonId,
        platformFeesStatus: drop.platformFeesStatus,
        platformFeesTransactionHash: drop.platformFeesTransactionHash,
        feesIsPaid: drop.platformFeesStatus === 'paid',
        feesBreakdown: drop.getFeesBreakdown()
      }, 'Platform fees payment updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize minter wallet by taxonId
 */
const authorizeMinterWalletByTaxon = async (req, res, next) => {
  try {
    const { taxonId } = req.params;
    const { walletAddress, minterWallet, transactionHash } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!minterWallet) {
      throw new ApiError(400, 'Minter wallet address is required');
    }

    // Find drop by taxonId and creator wallet
    const drop = await Drop.findOne({
      where: {
        taxonId: parseInt(taxonId),
        creatorWalletAddress: walletAddress
      }
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found with this taxonId or you do not have permission');
    }

    const updateData = {
      authorizedMinterWallet: minterWallet
    };

    // Optionally store the authorization transaction hash
    if (transactionHash) {
      updateData.minterAuthorizationTxHash = transactionHash;
    }

    await drop.update(updateData);

    logger.info(`Authorized minter wallet for drop (taxonId: ${taxonId}): ${minterWallet}`);

    res.status(200).json(
      new ApiResponse(200, {
        dropId: drop.id,
        taxonId: drop.taxonId,
        authorizedMinterWallet: minterWallet,
        minterAuthorizationTxHash: transactionHash || null,
        isAuthorized: true
      }, 'Minter wallet authorized successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Save all drop settings by taxonId (comprehensive settings update)
 * Handles: pricing, flags, schedule, allowlist, and dashboard controls
 */
const saveDropSettingsByTaxon = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { taxonId } = req.params;
    const {
      walletAddress,
      pricing,
      flags,
      schedule,
      allowlist,
      dashboard
    } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Find drop by taxonId and creator wallet
    const drop = await Drop.findOne({
      where: {
        taxonId: parseInt(taxonId),
        creatorWalletAddress: walletAddress
      },
      transaction
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found with this taxonId or you do not have permission');
    }

    // Build update object for drop
    const updateData = {};

    // Pricing Configuration
    if (pricing) {
      if (pricing.pricePerNft !== undefined) {
        updateData.pricePerNft = pricing.pricePerNft;
      }
      if (pricing.royaltyPercentage !== undefined) {
        if (pricing.royaltyPercentage < 0 || pricing.royaltyPercentage > 50) {
          throw new ApiError(400, 'Royalty percentage must be between 0 and 50');
        }
        updateData.royaltyPercentage = pricing.royaltyPercentage;
      }
      if (pricing.limitPerWallet !== undefined) {
        updateData.limitPerWallet = pricing.limitPerWallet;
      }
    }

    // NFT Flags
    if (flags) {
      if (flags.isBurnable !== undefined) updateData.isBurnable = flags.isBurnable;
      if (flags.isTransferable !== undefined) updateData.isTransferable = flags.isTransferable;
      if (flags.isOnlyXrp !== undefined) updateData.isOnlyXrp = flags.isOnlyXrp;
      if (flags.isMutable !== undefined) updateData.isMutable = flags.isMutable;
    }

    // Schedule
    if (schedule) {
      if (schedule.startDate !== undefined) updateData.startDate = schedule.startDate;
      if (schedule.endDate !== undefined) updateData.endDate = schedule.endDate;

      // Validate schedule
      if (updateData.startDate && updateData.endDate) {
        const start = new Date(updateData.startDate);
        const end = new Date(updateData.endDate);
        if (end <= start) {
          throw new ApiError(400, 'End date must be after start date');
        }
      }
    }

    // Dashboard Controls
    if (dashboard) {
      if (dashboard.isMintingEnabled !== undefined) updateData.isMintingEnabled = dashboard.isMintingEnabled;
      if (dashboard.isAllowlistOnly !== undefined) updateData.isAllowlistEnabled = dashboard.isAllowlistOnly;
      if (dashboard.isAllowlistEnabled !== undefined) updateData.isAllowlistEnabled = dashboard.isAllowlistEnabled;
      if (dashboard.isFreeMint !== undefined) updateData.isFreeMint = dashboard.isFreeMint;
    }

    // Also check for isMintingEnabled in flags (support both locations)
    if (flags && flags.isMintingEnabled !== undefined) {
      updateData.isMintingEnabled = flags.isMintingEnabled;
    }

    // Auto-update drop status based on isMintingEnabled and prerequisites
    if (updateData.isMintingEnabled !== undefined) {
      // Check prerequisites from current drop data
      const authorizedMinterWallet = drop.authorizedMinterWallet;
      const platformFeesStatus = drop.platformFeesStatus;

      // Prerequisites: minter must be authorized AND platform fees must be paid
      const prerequisitesMet = authorizedMinterWallet && platformFeesStatus === 'paid';

      if (updateData.isMintingEnabled === true && prerequisitesMet) {
        // If minting is being enabled and prerequisites are met, set status to active
        updateData.status = 'active';
        logger.info(`Drop ${drop.id} status set to active - minting enabled with prerequisites met`);
      } else if (updateData.isMintingEnabled === false && prerequisitesMet) {
        // If minting is being disabled and prerequisites were met, set status to paused
        updateData.status = 'paused';
        logger.info(`Drop ${drop.id} status set to paused - minting disabled`);
      }
    }

    // Update drop settings
    await drop.update(updateData, { transaction });

    // Handle Allowlist
    let allowlistResult = null;
    if (allowlist) {
      // Update allowlist enabled status
      if (allowlist.isEnabled !== undefined) {
        await drop.update({ isAllowlistEnabled: allowlist.isEnabled }, { transaction });
      }

      // Process allowlist entries
      if (allowlist.entries && Array.isArray(allowlist.entries) && allowlist.entries.length > 0) {
        const createdWallets = [];
        const updatedWallets = [];
        const skippedWallets = [];

        for (const entry of allowlist.entries) {
          const { walletAddress: entryWallet, nftLimit } = entry;

          if (!entryWallet) {
            skippedWallets.push({ entry, reason: 'Missing wallet address' });
            continue;
          }

          // Check if wallet already exists for this drop
          const existing = await DropAllowedWallet.findOne({
            where: { dropId: drop.id, walletAddress: entryWallet },
            transaction
          });

          if (existing) {
            // Update existing wallet
            await existing.update({ mintLimit: nftLimit || null }, { transaction });
            updatedWallets.push({ walletAddress: entryWallet, nftLimit });
          } else {
            // Create new allowlist entry
            await DropAllowedWallet.create({
              dropId: drop.id,
              walletAddress: entryWallet,
              mintLimit: nftLimit || null
            }, { transaction });
            createdWallets.push({ walletAddress: entryWallet, nftLimit });
          }
        }

        allowlistResult = {
          created: createdWallets.length,
          updated: updatedWallets.length,
          skipped: skippedWallets.length,
          total: createdWallets.length + updatedWallets.length
        };
      }
    }

    await transaction.commit();

    logger.info(`Drop settings saved for taxonId ${taxonId} by ${walletAddress}`);

    // Fetch updated drop with associations
    const updatedDrop = await Drop.findOne({
      where: { taxonId: parseInt(taxonId), creatorWalletAddress: walletAddress },
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }
      ]
    });

    // Get counts
    const [allowlistCount, nftCounts] = await Promise.all([
      DropAllowedWallet.count({ where: { dropId: drop.id } }),
      DropNft.findAll({
        where: { dropId: drop.id },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      })
    ]);

    const nftCountsObj = { available: 0, reserved: 0, minted: 0 };
    nftCounts.forEach(nc => {
      nftCountsObj[nc.status] = parseInt(nc.count);
    });

    res.status(200).json(
      new ApiResponse(200, {
        dropId: updatedDrop.id,
        taxonId: updatedDrop.taxonId,
        name: updatedDrop.name,
        // Pricing
        pricing: {
          pricePerNft: updatedDrop.pricePerNft,
          royaltyPercentage: updatedDrop.royaltyPercentage,
          limitPerWallet: updatedDrop.limitPerWallet
        },
        // Flags
        flags: {
          isBurnable: updatedDrop.isBurnable,
          isTransferable: updatedDrop.isTransferable,
          isOnlyXrp: updatedDrop.isOnlyXrp,
          isMutable: updatedDrop.isMutable
        },
        // Schedule
        schedule: {
          startDate: updatedDrop.startDate,
          endDate: updatedDrop.endDate
        },
        // Allowlist
        allowlist: {
          isEnabled: updatedDrop.isAllowlistEnabled,
          count: allowlistCount,
          updateResult: allowlistResult
        },
        // Dashboard
        dashboard: {
          status: updatedDrop.status,
          isMintingEnabled: updatedDrop.isMintingEnabled,
          isAllowlistEnabled: updatedDrop.isAllowlistEnabled,
          isFreeMint: updatedDrop.isFreeMint,
          totalSupply: updatedDrop.totalSupply,
          mintedCount: updatedDrop.mintedCount,
          nftCounts: nftCountsObj
        },
        // Computed
        remainingSupply: updatedDrop.getRemainingSupply(),
        isCurrentlyActive: updatedDrop.isCurrentlyActive(),
        isSoldOut: updatedDrop.isSoldOut(),
        feesBreakdown: updatedDrop.getFeesBreakdown()
      }, 'Drop settings saved successfully')
    );
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Mint NFTs from a drop by taxonId
 * Flow:
 * 1. User pays mint fee to creator from frontend
 * 2. Frontend calls this API with payment details
 * 3. API mints NFTs using platform wallet (authorized minter)
 * 4. Creates 0 XRP sell offers to transfer NFTs to buyer
 * 5. Returns offer details for user to accept and claim NFTs
 */
const mintDropNftsByTaxon = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { taxonId } = req.params;
    const {
      paymentTransactionHash,
      totalAmountPaid,          // Amount in drops (1 XRP = 1,000,000 drops)
      creatorWalletAddress,
      buyerWalletAddress
    } = req.body;

    // Validate required fields
    if (!paymentTransactionHash) {
      throw new ApiError(400, 'Payment transaction hash is required');
    }
    if (!totalAmountPaid) {
      throw new ApiError(400, 'Total amount paid is required');
    }
    if (!creatorWalletAddress) {
      throw new ApiError(400, 'Creator wallet address is required');
    }
    if (!buyerWalletAddress) {
      throw new ApiError(400, 'Buyer wallet address is required');
    }

    // Find drop by taxonId and creator wallet
    const drop = await Drop.findOne({
      where: {
        taxonId: parseInt(taxonId),
        creatorWalletAddress
      },
      transaction
    });

    if (!drop) {
      throw new ApiError(404, 'Drop not found with this taxonId and creator');
    }

    // Validate drop status
    if (drop.status !== 'active') {
      throw new ApiError(400, `Drop is not active. Current status: ${drop.status}`);
    }

    if (!drop.isMintingEnabled) {
      throw new ApiError(400, 'Minting is not enabled for this drop');
    }

    // Check if drop has started and not ended
    const now = new Date();
    if (drop.startDate && new Date(drop.startDate) > now) {
      throw new ApiError(400, 'Drop has not started yet');
    }
    if (drop.endDate && new Date(drop.endDate) < now) {
      throw new ApiError(400, 'Drop has ended');
    }

    // Get mint price
    const mintPrice = BigInt(drop.pricePerNft || '0');
    const totalPaid = BigInt(totalAmountPaid);

    // Handle free mint
    let nftsToMint;
    if (drop.isFreeMint || mintPrice === BigInt(0)) {
      // For free mints, default to 1 NFT or check if amount specified
      nftsToMint = 1;
    } else {
      // Calculate number of NFTs to mint
      if (totalPaid < mintPrice) {
        throw new ApiError(400, `Insufficient payment. Minimum required: ${mintPrice.toString()} drops`);
      }
      nftsToMint = Number(totalPaid / mintPrice);
    }

    // Check wallet mint limit
    if (drop.limitPerWallet) {
      const existingMints = await DropMint.count({
        where: {
          dropId: drop.id,
          minterWalletAddress: buyerWalletAddress
        },
        transaction
      });

      const remainingAllowance = drop.limitPerWallet - existingMints;
      if (remainingAllowance <= 0) {
        throw new ApiError(400, 'Wallet has reached the mint limit for this drop');
      }

      // Cap the number of NFTs to mint
      nftsToMint = Math.min(nftsToMint, remainingAllowance);
    }

    // Check if allowlist is enabled
    if (drop.isAllowlistEnabled) {
      const allowlistEntry = await DropAllowedWallet.findOne({
        where: {
          dropId: drop.id,
          walletAddress: buyerWalletAddress
        },
        transaction
      });

      if (!allowlistEntry) {
        throw new ApiError(403, 'Wallet is not on the allowlist for this drop');
      }

      // Check allowlist mint limit
      if (allowlistEntry.mintLimit) {
        const existingMints = await DropMint.count({
          where: {
            dropId: drop.id,
            minterWalletAddress: buyerWalletAddress
          },
          transaction
        });

        const remainingAllowance = allowlistEntry.mintLimit - existingMints;
        if (remainingAllowance <= 0) {
          throw new ApiError(400, 'Wallet has reached its allowlist mint limit');
        }

        nftsToMint = Math.min(nftsToMint, remainingAllowance);
      }
    }

    // Find available NFTs from the drop
    const availableNfts = await DropNft.findAll({
      where: {
        dropId: drop.id,
        status: 'available'
      },
      order: sequelize.random(),
      limit: nftsToMint,
      transaction
    });

    if (availableNfts.length === 0) {
      throw new ApiError(400, 'No NFTs available for minting in this drop');
    }

    if (availableNfts.length < nftsToMint) {
      logger.warn(`Only ${availableNfts.length} NFTs available, requested ${nftsToMint}`);
      nftsToMint = availableNfts.length;
    }

    // Get admin wallet for minting (platform fees wallet - authorized minter)
    const adminWallet = xrplConfig.getAdminWallet();
    if (!adminWallet) {
      throw new ApiError(500, 'Platform minting wallet is not configured');
    }

    // Verify admin wallet is authorized minter for this drop
    if (drop.authorizedMinterWallet !== adminWallet.address) {
      logger.error(`Authorized minter mismatch - Drop authorizedMinterWallet: ${drop.authorizedMinterWallet}, Platform wallet: ${adminWallet.address}`);
      throw new ApiError(500, `Platform wallet is not authorized to mint for this drop. Drop expects: ${drop.authorizedMinterWallet}, Platform has: ${adminWallet.address}`);
    }

    // Reserve the NFTs first
    const nftIds = availableNfts.map(nft => nft.id);
    await DropNft.update(
      { status: 'reserved' },
      {
        where: { id: { [Op.in]: nftIds } },
        transaction
      }
    );

    // Mint NFTs and create offers
    const mintedNfts = [];
    const offers = [];
    const errors = [];

    // Calculate flags for NFT minting
    let flags = 0;
    if (drop.isTransferable) flags |= 8;  // tfTransferable
    if (drop.isBurnable) flags |= 1;      // tfBurnable
    if (drop.isOnlyXrp) flags |= 2;       // tfOnlyXRP

    // Transfer fee (royalty) - convert percentage to basis points (0-50000)
    const transferFee = Math.round((drop.royaltyPercentage || 0) * 1000);

    for (const nft of availableNfts) {
      try {
        // Mint NFT on XRPL
        const mintResult = await xrplService.mintNFT({
          wallet: adminWallet,
          uri: nft.metadataUri,
          taxon: drop.taxonId,
          transferFee: transferFee,
          flags: flags
        });

        if (!mintResult.success || !mintResult.nftokenID) {
          throw new Error('Mint failed - no NFToken ID returned');
        }

        logger.info(`Minted NFT ${mintResult.nftokenID} for drop ${drop.id}`);

        // Create 0 XRP sell offer to buyer
        const offerResult = await xrplService.createSellOffer({
          wallet: adminWallet,
          nftokenID: mintResult.nftokenID,
          amount: '0',  // 0 XRP transfer offer
          destination: buyerWalletAddress
        });

        if (!offerResult.success || !offerResult.offerID) {
          throw new Error('Failed to create sell offer');
        }

        logger.info(`Created sell offer ${offerResult.offerID} for NFT ${mintResult.nftokenID}`);

        // Update NFT record in database
        await DropNft.update(
          {
            status: 'minted',
            nftTokenId: mintResult.nftokenID,
            transactionHash: mintResult.hash,
            mintedTo: buyerWalletAddress,
            mintedAt: new Date()
          },
          {
            where: { id: nft.id },
            transaction
          }
        );

        // Record the mint
        const mintIndex = drop.mintedCount + mintedNfts.length + 1;
        await DropMint.create({
          dropId: drop.id,
          minterWalletAddress: buyerWalletAddress,
          nftTokenId: mintResult.nftokenID,
          nftUri: nft.metadataUri,
          transactionHash: mintResult.hash,
          mintPrice: drop.isFreeMint ? '0' : drop.pricePerNft,
          paymentTransactionHash: paymentTransactionHash,
          mintIndex: mintIndex,
          metadata: {
            offerID: offerResult.offerID,
            offerHash: offerResult.hash,
            nftName: nft.name,
            nftImage: nft.image
          }
        }, { transaction });

        mintedNfts.push({
          id: nft.id,
          name: nft.name,
          description: nft.description,
          image: nft.image,
          attributes: nft.attributes,
          nftTokenId: mintResult.nftokenID,
          mintTransactionHash: mintResult.hash
        });

        offers.push({
          offerID: offerResult.offerID,
          offerTransactionHash: offerResult.hash,
          nftTokenId: mintResult.nftokenID,
          nftName: nft.name,
          nftImage: nft.image,
          amount: '0',
          destination: buyerWalletAddress
        });

      } catch (mintError) {
        logger.error(`Error minting NFT ${nft.id}:`, mintError);

        // Release the NFT back to available
        await DropNft.update(
          { status: 'available' },
          {
            where: { id: nft.id },
            transaction
          }
        );

        errors.push({
          nftId: nft.id,
          nftName: nft.name,
          error: mintError.message
        });
      }
    }

    // Update drop minted count
    if (mintedNfts.length > 0) {
      await drop.update({
        mintedCount: drop.mintedCount + mintedNfts.length,
        totalRevenue: (BigInt(drop.totalRevenue || '0') + (BigInt(drop.pricePerNft || '0') * BigInt(mintedNfts.length))).toString()
      }, { transaction });

      // Check if drop is sold out
      if (drop.mintedCount + mintedNfts.length >= drop.totalSupply) {
        await drop.update({ status: 'sold_out' }, { transaction });
      }
    }

    await transaction.commit();

    // Generate consolidated claim data for accepting all offers
    // Note: XRPL requires one NFTokenAcceptOffer per NFT, but we batch them for UX
    const offerIds = offers.map(offer => offer.offerID);

    // Individual transactions (required by XRPL)
    const individualTransactions = offers.map(offer => ({
      TransactionType: 'NFTokenAcceptOffer',
      NFTokenSellOffer: offer.offerID
    }));

    // Consolidated claim object for frontend
    const claimData = {
      totalOffers: offers.length,
      offerIds: offerIds,
      // Single payload containing all offer IDs for batch processing
      batchPayload: {
        type: 'NFT_CLAIM_BATCH',
        buyer: buyerWalletAddress,
        drop: {
          taxonId: drop.taxonId,
          name: drop.name
        },
        offers: offerIds,
        // For XUMM batch signing or sequential processing
        transactions: individualTransactions
      },
      // QR code data - single object with all offers for scanning
      qrCode: {
        type: 'BATCH_NFT_ACCEPT',
        version: '1.0',
        buyer: buyerWalletAddress,
        offerCount: offers.length,
        offerIds: offerIds,
        // First offer for single scan (frontend can iterate through rest)
        primaryOffer: offerIds[0] || null,
        // All transactions to execute
        transactions: individualTransactions
      }
    };

    res.status(200).json(
      new ApiResponse(200, {
        success: true,
        drop: {
          id: drop.id,
          taxonId: drop.taxonId,
          name: drop.name
        },
        payment: {
          transactionHash: paymentTransactionHash,
          totalAmountPaid: totalAmountPaid,
          totalAmountPaidXrp: (Number(totalAmountPaid) / 1000000).toFixed(6),
          mintPrice: drop.pricePerNft,
          mintPriceXrp: (Number(drop.pricePerNft || 0) / 1000000).toFixed(6)
        },
        minting: {
          requested: nftsToMint,
          successful: mintedNfts.length,
          failed: errors.length
        },
        mintedNfts: mintedNfts,
        offers: offers,
        // Consolidated claim data for single-action claiming
        claimData: claimData,
        errors: errors.length > 0 ? errors : undefined,
        // Instructions for claiming
        instructions: {
          message: offers.length === 1
            ? 'Accept the sell offer to claim your NFT'
            : `Accept all ${offers.length} sell offers to claim your NFTs`,
          note: 'XRPL requires accepting each offer individually, but your wallet can process them in sequence',
          steps: [
            '1. Use your XRPL wallet (XUMM, GemWallet, etc.)',
            '2. Sign the batch transaction or accept offers sequentially',
            '3. All NFTs will be transferred to your wallet for free'
          ]
        }
      }, `Successfully minted ${mintedNfts.length} NFT(s)`)
    );

  } catch (error) {
    await transaction.rollback();
    logger.error('Error minting drop NFTs:', error);
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
  getExploreDrops,
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
  uploadDropNftsByTaxon,
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
  getDropDashboard,
  getDropDashboardByTaxon,
  getDropDetailsByTaxon,
  updatePlatformFeesPaymentByTaxon,
  authorizeMinterWalletByTaxon,
  saveDropSettingsByTaxon,
  mintDropNftsByTaxon
};
