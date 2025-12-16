const { AdminWallet } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

/**
 * Create a new admin wallet
 */
const createAdminWallet = async (req, res, next) => {
  try {
    const { walletAddress, type, label, description, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!type) {
      throw new ApiError(400, 'Wallet type is required');
    }

    const validTypes = ['platformFees', 'royalties', 'marketplace', 'treasury', 'other'];
    if (!validTypes.includes(type)) {
      throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Check if there's already an active wallet of this type
    const existingActive = await AdminWallet.findOne({
      where: {
        type,
        isActive: true
      }
    });

    if (existingActive) {
      // Deactivate the existing wallet
      await existingActive.update({ isActive: false });
      logger.info(`Deactivated previous ${type} wallet: ${existingActive.walletAddress}`);
    }

    const adminWallet = await AdminWallet.create({
      walletAddress,
      type,
      label,
      description,
      isActive: true,
      metadata
    });

    logger.info(`Admin wallet created: ${type} - ${walletAddress}`);

    res.status(201).json(
      new ApiResponse(201, adminWallet, 'Admin wallet created successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all admin wallets
 */
const getAdminWallets = async (req, res, next) => {
  try {
    const { type, isActive } = req.query;

    const where = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const wallets = await AdminWallet.findAll({
      where,
      order: [['type', 'ASC'], ['createdAt', 'DESC']]
    });

    res.status(200).json(
      new ApiResponse(200, wallets, 'Admin wallets retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin wallet by ID
 */
const getAdminWalletById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const wallet = await AdminWallet.findByPk(id);
    if (!wallet) {
      throw new ApiError(404, 'Admin wallet not found');
    }

    res.status(200).json(
      new ApiResponse(200, wallet, 'Admin wallet retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get active admin wallet by type
 */
const getAdminWalletByType = async (req, res, next) => {
  try {
    const { type } = req.params;

    const validTypes = ['platformFees', 'royalties', 'marketplace', 'treasury', 'other'];
    if (!validTypes.includes(type)) {
      throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const wallet = await AdminWallet.findOne({
      where: {
        type,
        isActive: true
      }
    });

    if (!wallet) {
      throw new ApiError(404, `No active admin wallet found for type: ${type}`);
    }

    res.status(200).json(
      new ApiResponse(200, wallet, 'Admin wallet retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update admin wallet
 */
const updateAdminWallet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { walletAddress, label, description, isActive, metadata } = req.body;

    const wallet = await AdminWallet.findByPk(id);
    if (!wallet) {
      throw new ApiError(404, 'Admin wallet not found');
    }

    const updateData = {};
    if (walletAddress !== undefined) updateData.walletAddress = walletAddress;
    if (label !== undefined) updateData.label = label;
    if (description !== undefined) updateData.description = description;
    if (metadata !== undefined) updateData.metadata = metadata;

    // Handle isActive change
    if (isActive !== undefined && isActive !== wallet.isActive) {
      if (isActive) {
        // Deactivate any other active wallet of the same type
        await AdminWallet.update(
          { isActive: false },
          {
            where: {
              type: wallet.type,
              isActive: true,
              id: { [require('sequelize').Op.ne]: id }
            }
          }
        );
      }
      updateData.isActive = isActive;
    }

    await wallet.update(updateData);

    logger.info(`Admin wallet updated: ${wallet.type} - ${wallet.walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, wallet, 'Admin wallet updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete admin wallet
 */
const deleteAdminWallet = async (req, res, next) => {
  try {
    const { id } = req.params;

    const wallet = await AdminWallet.findByPk(id);
    if (!wallet) {
      throw new ApiError(404, 'Admin wallet not found');
    }

    await wallet.destroy();

    logger.info(`Admin wallet deleted: ${wallet.type} - ${wallet.walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, null, 'Admin wallet deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get platform fees wallet address (public endpoint for frontend)
 */
const getPlatformFeesWallet = async (req, res, next) => {
  try {
    const wallet = await AdminWallet.findOne({
      where: {
        type: 'platformFees',
        isActive: true
      },
      attributes: ['walletAddress', 'label']
    });

    if (!wallet) {
      throw new ApiError(404, 'Platform fees wallet not configured');
    }

    res.status(200).json(
      new ApiResponse(200, {
        walletAddress: wallet.walletAddress,
        label: wallet.label || 'Platform Fees Wallet'
      }, 'Platform fees wallet retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAdminWallet,
  getAdminWallets,
  getAdminWalletById,
  getAdminWalletByType,
  updateAdminWallet,
  deleteAdminWallet,
  getPlatformFeesWallet
};
