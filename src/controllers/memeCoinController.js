const { MemeCoin, User, sequelize } = require('../models');
const xrplService = require('../services/xrplService');
const xrplConfig = require('../config/xrpl');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Create a new meme coin token on XRPL
 *
 * Flow:
 * 1. User sends token details (name, symbol, supply, etc.)
 * 2. Backend saves the record and builds a TrustSet transaction
 * 3. Returns the TrustSet tx JSON for frontend to show as QR code (Xaman sign)
 * 4. After user signs the TrustSet, frontend calls /confirm-trustline
 * 5. Backend then issues tokens (Payment from admin/issuer wallet to creator)
 */
const createMemeCoin = async (req, res, next) => {
  try {
    const {
      tokenName,
      tokenSymbol,
      totalSupply,
      decimals = 6,
      logo,
      description,
      website,
      socialLinks,
      walletAddress
    } = req.body;

    // Validate required fields
    if (!tokenName) throw new ApiError(400, 'Token name is required');
    if (!tokenSymbol) throw new ApiError(400, 'Token symbol is required');
    if (!totalSupply) throw new ApiError(400, 'Total supply is required');
    if (!walletAddress) throw new ApiError(400, 'Wallet address is required');

    // Validate token symbol (alphanumeric, max 15 chars)
    const symbolCleaned = tokenSymbol.toUpperCase().trim();
    if (!/^[A-Z0-9]{1,15}$/.test(symbolCleaned)) {
      throw new ApiError(400, 'Token symbol must be 1-15 alphanumeric characters');
    }

    // Validate total supply
    const supply = parseFloat(totalSupply);
    if (isNaN(supply) || supply <= 0) {
      throw new ApiError(400, 'Total supply must be a positive number');
    }

    // Validate decimals
    const dec = parseInt(decimals);
    if (isNaN(dec) || dec < 0 || dec > 15) {
      throw new ApiError(400, 'Decimals must be between 0 and 15');
    }

    // Check user exists
    const user = await User.findOne({ where: { walletAddress } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Convert symbol to XRPL currency hex
    const currencyHex = xrplService.currencyToHex(symbolCleaned);

    // The issuer is the admin/platform wallet
    const issuerAddress = xrplConfig.getAdminWallet().address;

    // Check if this currency already exists with same issuer
    const existing = await MemeCoin.findOne({
      where: { currencyHex, issuerWalletAddress: issuerAddress }
    });
    if (existing) {
      throw new ApiError(409, `Token with symbol "${symbolCleaned}" already exists`);
    }

    // Save the meme coin record
    const memeCoin = await MemeCoin.create({
      tokenName,
      tokenSymbol: symbolCleaned,
      currencyHex,
      totalSupply: supply,
      decimals: dec,
      logo: logo || null,
      description: description || null,
      website: website || null,
      socialLinks: socialLinks || null,
      issuerWalletAddress: issuerAddress,
      creatorWalletAddress: walletAddress,
      status: 'pending',
      metadata: {
        createdVia: 'api',
        originalSymbol: tokenSymbol
      }
    });

    // Build the TrustSet transaction for the user to sign
    const trustSetTx = xrplService.buildTrustSetPayload({
      creatorWallet: walletAddress,
      issuerAddress,
      currencyHex,
      totalSupply: supply
    });

    // Prepare the transaction (autofill Fee, Sequence, etc.)
    const preparedTrustSet = await xrplService.prepareTransaction(trustSetTx);

    logger.info(`MemeCoin created: ${tokenName} (${symbolCleaned}) by ${walletAddress}, id: ${memeCoin.id}`);

    res.status(201).json(
      new ApiResponse(201, {
        memeCoin: {
          id: memeCoin.id,
          tokenName: memeCoin.tokenName,
          tokenSymbol: memeCoin.tokenSymbol,
          currencyHex: memeCoin.currencyHex,
          totalSupply: memeCoin.totalSupply,
          decimals: memeCoin.decimals,
          logo: memeCoin.logo,
          description: memeCoin.description,
          issuerWalletAddress: memeCoin.issuerWalletAddress,
          creatorWalletAddress: memeCoin.creatorWalletAddress,
          status: memeCoin.status
        },
        // Transaction payload for frontend QR code (Xaman signing)
        trustSetTransaction: preparedTrustSet,
        instructions: {
          step: 1,
          message: 'Scan the QR code with your XRPL wallet to set the trust line. After signing, call /api/v1/memecoins/:id/confirm-trustline with the transaction hash.',
          nextEndpoint: `/api/v1/memecoins/${memeCoin.id}/confirm-trustline`
        }
      }, 'Meme coin created. Please sign the TrustSet transaction to proceed.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm that the user has signed the TrustSet transaction.
 * Then issue the tokens from the admin wallet to the user.
 */
const confirmTrustline = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { trustSetTxHash } = req.body;

    if (!trustSetTxHash) {
      throw new ApiError(400, 'TrustSet transaction hash is required');
    }

    const memeCoin = await MemeCoin.findByPk(id);
    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    if (memeCoin.status === 'issued') {
      throw new ApiError(400, 'Token has already been issued');
    }

    // Verify the TrustSet transaction on XRPL
    try {
      const client = xrplConfig.getClient();
      const txResponse = await client.request({
        command: 'tx',
        transaction: trustSetTxHash
      });

      const tx = txResponse.result;

      // Verify it's a TrustSet from the creator
      if (tx.TransactionType !== 'TrustSet') {
        throw new ApiError(400, 'Transaction is not a TrustSet');
      }
      if (tx.Account !== memeCoin.creatorWalletAddress) {
        throw new ApiError(400, 'TrustSet was not signed by the token creator');
      }

      // Check transaction was successful
      const meta = tx.meta || tx.metaData;
      if (meta && meta.TransactionResult !== 'tesSUCCESS') {
        throw new ApiError(400, `TrustSet transaction failed: ${meta.TransactionResult}`);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error verifying TrustSet transaction:', error);
      throw new ApiError(400, 'Could not verify the TrustSet transaction on XRPL');
    }

    // Update status to trust_set
    await memeCoin.update({
      status: 'trust_set',
      trustSetTxHash
    });

    // Now issue the tokens from admin wallet to creator
    try {
      const issueResult = await xrplService.issueTokenFromAdmin({
        destinationAddress: memeCoin.creatorWalletAddress,
        currencyHex: memeCoin.currencyHex,
        totalSupply: memeCoin.totalSupply
      });

      const issuanceTxHash = issueResult.result.hash;

      // Update to issued
      await memeCoin.update({
        status: 'issued',
        issuanceTxHash
      });

      logger.info(`Token issued successfully: ${memeCoin.tokenName} (${memeCoin.tokenSymbol}), issuance tx: ${issuanceTxHash}`);

      res.status(200).json(
        new ApiResponse(200, {
          memeCoin: {
            id: memeCoin.id,
            tokenName: memeCoin.tokenName,
            tokenSymbol: memeCoin.tokenSymbol,
            currencyHex: memeCoin.currencyHex,
            totalSupply: memeCoin.totalSupply,
            decimals: memeCoin.decimals,
            logo: memeCoin.logo,
            issuerWalletAddress: memeCoin.issuerWalletAddress,
            creatorWalletAddress: memeCoin.creatorWalletAddress,
            status: 'issued'
          },
          trustSetTxHash,
          issuanceTxHash
        }, 'Token issued successfully! The full supply has been sent to your wallet.')
      );
    } catch (error) {
      await memeCoin.update({ status: 'failed', metadata: { ...memeCoin.metadata, issueError: error.message } });
      logger.error('Error issuing token:', error);
      throw new ApiError(500, 'TrustLine was set but token issuance failed. Please contact support.');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single meme coin by ID
 */
const getMemeCoin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const memeCoin = await MemeCoin.findByPk(id, {
      include: [{
        association: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }]
    });

    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    res.status(200).json(
      new ApiResponse(200, { memeCoin }, 'Meme coin retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * List all meme coins with pagination
 */
const getMemeCoins = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      creatorWalletAddress,
      search,
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query;

    const where = {};

    if (status) where.status = status;
    if (creatorWalletAddress) where.creatorWalletAddress = creatorWalletAddress;
    if (search) {
      where[Op.or] = [
        { tokenName: { [Op.like]: `%${search}%` } },
        { tokenSymbol: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: memeCoins } = await MemeCoin.findAndCountAll({
      where,
      include: [{
        association: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json(
      new ApiResponse(200, {
        memeCoins,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      }, 'Meme coins retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get meme coins created by a specific wallet
 */
const getMyMemeCoins = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    const memeCoins = await MemeCoin.findAll({
      where: { creatorWalletAddress: walletAddress },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(
      new ApiResponse(200, { memeCoins }, 'User meme coins retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMemeCoin,
  confirmTrustline,
  getMemeCoin,
  getMemeCoins,
  getMyMemeCoins
};
