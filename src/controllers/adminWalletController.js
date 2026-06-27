const { AdminWallet } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const xrplConfig = require('../config/xrpl');
const solanaConfig = require('../config/solana');

/**
 * Create a new admin wallet
 */
const PLATFORM_FEES = {
  xrpl: { amount: '800000', currency: 'XRP', display: '0.8 XRP' },
  solana: { amount: '16000000', currency: 'SOL', display: '0.016 SOL' }
};

const createAdminWallet = async (req, res, next) => {
  try {
    const { walletAddress, type, network, label, description, metadata } = req.body;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    if (!type) {
      throw new ApiError(400, 'Wallet type is required');
    }

    const validTypes = ['platformFees', 'royalties', 'marketplace', 'treasury', 'subscriptions', 'rewards', 'other'];
    if (!validTypes.includes(type)) {
      throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    if (network && !['xrpl', 'solana'].includes(network)) {
      throw new ApiError(400, 'Network must be xrpl or solana');
    }

    // Check if there's already an active wallet of this type + network
    const existingWhere = { type, isActive: true };
    if (network) existingWhere.network = network;

    const existingActive = await AdminWallet.findOne({ where: existingWhere });

    if (existingActive) {
      await existingActive.update({ isActive: false });
      logger.info(`Deactivated previous ${type}/${network} wallet: ${existingActive.walletAddress}`);
    }

    const adminWallet = await AdminWallet.create({
      walletAddress,
      type,
      network: network || null,
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
    const { network } = req.query;

    const validTypes = ['platformFees', 'royalties', 'marketplace', 'treasury', 'subscriptions', 'rewards', 'other'];
    if (!validTypes.includes(type)) {
      throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const where = { type, isActive: true };
    if (network) where.network = network;

    const wallet = await AdminWallet.findOne({ where });

    if (!wallet) {
      throw new ApiError(404, `No active admin wallet found for type: ${type}${network ? ` on ${network}` : ''}`);
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

/**
 * Get platform fee configuration for a network.
 * Returns the subscription wallet address + fee amount for the specified network.
 * Frontend uses this to know where to send the fee and how much.
 */
const getPlatformFeeConfig = async (req, res, next) => {
  try {
    const { network } = req.params;

    if (!network || !['xrpl', 'solana'].includes(network)) {
      throw new ApiError(400, 'Network must be xrpl or solana');
    }

    let feeWalletAddress = null;
    let feeWalletLabel = 'Platform Fee Wallet';

    if (network === 'xrpl') {
      // Use the admin wallet from ADMIN_WALLET_SECRET_NUMBERS / ADMIN_WALLET_SEED in .env
      try {
        const adminWallet = xrplConfig.getAdminWallet();
        feeWalletAddress = adminWallet.address;
        feeWalletLabel = 'Platform Admin Wallet (XRP)';
      } catch (e) {
        throw new ApiError(404, 'XRPL admin wallet not configured in .env');
      }
    } else {
      // Solana: use the admin keypair from SOLANA_ADMIN_SECRET_KEY
      try {
        const adminKp = solanaConfig.getAdminKeypair();
        if (adminKp) {
          feeWalletAddress = adminKp.publicKey.toBase58();
          feeWalletLabel = 'Platform Admin Wallet (SOL)';
        }
      } catch (e) {}

      if (!feeWalletAddress) {
        throw new ApiError(404, 'Solana admin wallet not configured in .env');
      }
    }

    const fee = PLATFORM_FEES[network];

    res.status(200).json(
      new ApiResponse(200, {
        network,
        walletAddress: feeWalletAddress,
        label: feeWalletLabel,
        fee: {
          amount: fee.amount,
          currency: fee.currency,
          display: fee.display
        },
        actions: [
          'create-collection',
          'create-nft',
          'list-nft',
          'buy-nft',
          'create-memecoin',
          'list-memecoin',
          'buy-memecoin',
          'sell-memecoin'
        ]
      }, `Platform fee config for ${network} retrieved successfully`)
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
  getPlatformFeesWallet,
  getPlatformFeeConfig,
  PLATFORM_FEES
};
