const { WithdrawalOwner, Withdrawal, WithdrawalSignature, AdminWallet, sequelize } = require('../models');
const xrplConfig = require('../config/xrpl');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const WALLET_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

const SOURCE_TYPE_MAP = {
  platformFees: 'minting',
  subscriptions: 'subscriptions'
};

const SOURCE_LABELS = {
  minting: 'Platform Minting Wallet',
  subscriptions: 'Subscriptions Wallet'
};

const SOURCE_DESCRIPTIONS = {
  minting: 'Collects revenue from NFT minting and platform fees',
  subscriptions: 'Collects subscription revenue'
};

/**
 * Get all active withdrawal owners
 */
const getOwners = async (req, res) => {
  const owners = await WithdrawalOwner.findAll({
    where: { isActive: true },
    order: [['position', 'ASC']]
  });

  res.status(200).json(new ApiResponse(200, { owners }, 'Withdrawal owners retrieved successfully'));
};

/**
 * Create a new withdrawal owner
 */
const createOwner = async (req, res) => {
  const { name, walletAddress } = req.body;

  if (!name) {
    throw new ApiError(400, 'Name is required');
  }

  if (!walletAddress) {
    throw new ApiError(400, 'Wallet address is required');
  }

  if (!WALLET_ADDRESS_REGEX.test(walletAddress)) {
    throw new ApiError(400, 'Invalid XRPL wallet address format');
  }

  // Check max 3 active owners
  const activeCount = await WithdrawalOwner.count({ where: { isActive: true } });
  if (activeCount >= 3) {
    throw new ApiError(409, 'Maximum of 3 active withdrawal owners allowed');
  }

  // Check unique walletAddress
  const existing = await WithdrawalOwner.findOne({ where: { walletAddress } });
  if (existing) {
    throw new ApiError(409, 'A withdrawal owner with this wallet address already exists');
  }

  // Auto-assign position
  const maxPosition = await WithdrawalOwner.max('position', { where: { isActive: true } }) || 0;

  const owner = await WithdrawalOwner.create({
    name,
    walletAddress,
    position: maxPosition + 1,
    isActive: true
  });

  logger.info(`Withdrawal owner created: ${owner.id} - ${name} (${walletAddress})`);

  res.status(201).json(new ApiResponse(201, { owner }, 'Withdrawal owner created successfully'));
};

/**
 * Update an existing withdrawal owner
 */
const updateOwner = async (req, res) => {
  const { id } = req.params;
  const { name, walletAddress } = req.body;

  const owner = await WithdrawalOwner.findByPk(id);
  if (!owner) {
    throw new ApiError(404, 'Withdrawal owner not found');
  }

  if (walletAddress && !WALLET_ADDRESS_REGEX.test(walletAddress)) {
    throw new ApiError(400, 'Invalid XRPL wallet address format');
  }

  // Check unique walletAddress if changing
  if (walletAddress && walletAddress !== owner.walletAddress) {
    const existing = await WithdrawalOwner.findOne({ where: { walletAddress } });
    if (existing) {
      throw new ApiError(409, 'A withdrawal owner with this wallet address already exists');
    }
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (walletAddress !== undefined) updateData.walletAddress = walletAddress;

  await owner.update(updateData);

  logger.info(`Withdrawal owner updated: ${owner.id}`);

  res.status(200).json(new ApiResponse(200, { owner }, 'Withdrawal owner updated successfully'));
};

/**
 * Delete a withdrawal owner (soft delete by setting isActive = false)
 */
const deleteOwner = async (req, res) => {
  const { id } = req.params;

  const owner = await WithdrawalOwner.findByPk(id);
  if (!owner) {
    throw new ApiError(404, 'Withdrawal owner not found');
  }

  await owner.update({ isActive: false });

  logger.info(`Withdrawal owner deactivated: ${owner.id} - ${owner.name}`);

  res.status(200).json(new ApiResponse(200, null, 'Withdrawal owner removed successfully'));
};

/**
 * Get source wallets with live XRPL balances
 */
const getSourceWallets = async (req, res) => {
  const sourceTypes = [
    { adminType: 'platformFees', sourceType: 'minting' },
    { adminType: 'subscriptions', sourceType: 'subscriptions' }
  ];

  const wallets = [];

  for (const { adminType, sourceType } of sourceTypes) {
    const adminWallet = await AdminWallet.findOne({
      where: { type: adminType, isActive: true, network: 'xrpl' }
    });

    const walletInfo = {
      type: sourceType,
      label: SOURCE_LABELS[sourceType],
      description: SOURCE_DESCRIPTIONS[sourceType],
      walletAddress: adminWallet ? adminWallet.walletAddress : null,
      balanceDrops: '0',
      configured: !!adminWallet
    };

    if (adminWallet) {
      try {
        const client = await xrplConfig.getClientAsync();
        const response = await client.request({
          command: 'account_info',
          account: adminWallet.walletAddress
        });
        if (response.result && response.result.account_data) {
          walletInfo.balanceDrops = response.result.account_data.Balance;
        }
      } catch (error) {
        logger.warn(`Failed to fetch balance for ${sourceType} wallet (${adminWallet.walletAddress}): ${error.message}`);
      }
    }

    wallets.push(walletInfo);
  }

  res.status(200).json(new ApiResponse(200, { wallets }, 'Source wallets retrieved successfully'));
};

/**
 * Get withdrawals with pagination
 */
const getWithdrawals = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) {
    where.status = status;
  }

  const { count, rows: withdrawals } = await Withdrawal.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: WithdrawalOwner,
        as: 'initiator',
        attributes: ['id', 'name', 'walletAddress']
      },
      {
        model: WithdrawalSignature,
        as: 'signatures',
        include: [
          {
            model: WithdrawalOwner,
            as: 'owner',
            attributes: ['id', 'name', 'walletAddress']
          }
        ]
      }
    ]
  });

  const formattedWithdrawals = withdrawals.map(w => {
    const data = w.toJSON();
    return {
      id: data.id,
      totalAmount: data.totalAmount,
      perOwnerAmount: data.perOwnerAmount,
      reason: data.reason,
      status: data.status,
      requiredSignatures: data.requiredSignatures,
      currentSignatures: data.signatures ? data.signatures.length : 0,
      initiator: data.initiator,
      signatures: data.signatures,
      splits: data.splits,
      sourceBreakdown: data.sourceBreakdown,
      transactionHashes: data.transactionHashes,
      rejectedBy: data.rejectedBy,
      rejectionReason: data.rejectionReason,
      completedAt: data.completedAt,
      rejectedAt: data.rejectedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  });

  res.status(200).json(new ApiResponse(200, {
    withdrawals: formattedWithdrawals,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Withdrawals retrieved successfully'));
};

/**
 * Get withdrawal statistics
 */
const getStats = async (req, res) => {
  const [pending, completed, rejected, completedSum] = await Promise.all([
    Withdrawal.count({ where: { status: 'pending_signatures' } }),
    Withdrawal.count({ where: { status: 'completed' } }),
    Withdrawal.count({ where: { status: 'rejected' } }),
    Withdrawal.findAll({
      where: { status: 'completed' },
      attributes: ['totalAmount']
    })
  ]);

  // Sum totalAmount using BigInt since amounts are stored as strings (drops)
  let totalDistributed = BigInt(0);
  for (const w of completedSum) {
    totalDistributed += BigInt(w.totalAmount);
  }

  res.status(200).json(new ApiResponse(200, {
    pending,
    completed,
    rejected,
    totalDistributed: totalDistributed.toString()
  }, 'Withdrawal statistics retrieved successfully'));
};

/**
 * Create a new withdrawal request
 */
const createWithdrawal = async (req, res) => {
  const { totalAmount, reason, initiatedBy } = req.body;

  if (!totalAmount) {
    throw new ApiError(400, 'Total amount is required');
  }

  if (!initiatedBy) {
    throw new ApiError(400, 'Initiating owner ID is required');
  }

  // Validate totalAmount is a valid positive number string
  let totalBigInt;
  try {
    totalBigInt = BigInt(totalAmount);
  } catch (e) {
    throw new ApiError(400, 'Total amount must be a valid numeric string (drops)');
  }

  if (totalBigInt <= BigInt(0)) {
    throw new ApiError(400, 'Total amount must be greater than 0');
  }

  // Validate exactly 3 active owners
  const activeOwners = await WithdrawalOwner.findAll({
    where: { isActive: true },
    order: [['position', 'ASC']]
  });

  if (activeOwners.length !== 3) {
    throw new ApiError(400, `Exactly 3 active owners are required for a withdrawal. Currently ${activeOwners.length} active.`);
  }

  // Validate the initiator is an active owner
  const initiator = activeOwners.find(o => o.id === initiatedBy);
  if (!initiator) {
    throw new ApiError(400, 'Initiating owner must be one of the active withdrawal owners');
  }

  // Validate 2 source wallets configured
  const sourceTypes = ['platformFees', 'subscriptions'];
  const sourceWallets = {};

  for (const adminType of sourceTypes) {
    const wallet = await AdminWallet.findOne({
      where: { type: adminType, isActive: true, network: 'xrpl' }
    });
    if (!wallet) {
      const sourceType = SOURCE_TYPE_MAP[adminType];
      throw new ApiError(400, `Source wallet not configured: ${sourceType} (AdminWallet type: ${adminType})`);
    }
    sourceWallets[adminType] = wallet;
  }

  // Get combined balance from all source wallets
  let combinedBalance = BigInt(0);
  const sourceBalances = {};

  for (const [adminType, wallet] of Object.entries(sourceWallets)) {
    try {
      const client = await xrplConfig.getClientAsync();
      const response = await client.request({
        command: 'account_info',
        account: wallet.walletAddress
      });
      if (response.result && response.result.account_data) {
        const balance = BigInt(response.result.account_data.Balance);
        sourceBalances[adminType] = balance;
        combinedBalance += balance;
      } else {
        sourceBalances[adminType] = BigInt(0);
      }
    } catch (error) {
      logger.warn(`Failed to fetch balance for ${adminType} wallet: ${error.message}`);
      sourceBalances[adminType] = BigInt(0);
    }
  }

  if (totalBigInt > combinedBalance) {
    throw new ApiError(400, `Insufficient combined balance. Requested: ${totalAmount} drops, Available: ${combinedBalance.toString()} drops`);
  }

  // Compute per-owner amount: floor(total / 3), remainder goes to first owner
  const perOwnerAmount = totalBigInt / BigInt(3);
  const remainder = totalBigInt % BigInt(3);

  // Build splits snapshot
  const splits = activeOwners.map((owner, index) => ({
    ownerId: owner.id,
    name: owner.name,
    walletAddress: owner.walletAddress,
    amount: (index === 0 ? (perOwnerAmount + remainder) : perOwnerAmount).toString()
  }));

  // Compute per-source breakdown: floor(total / 2), remainder goes to first source
  const perSourceAmount = totalBigInt / BigInt(sourceTypes.length);
  const sourceRemainder = totalBigInt % BigInt(sourceTypes.length);

  const sourceBreakdown = sourceTypes.map((adminType, index) => ({
    type: SOURCE_TYPE_MAP[adminType],
    adminWalletType: adminType,
    walletAddress: sourceWallets[adminType].walletAddress,
    amount: (index === 0 ? (perSourceAmount + sourceRemainder) : perSourceAmount).toString(),
    availableBalance: sourceBalances[adminType].toString()
  }));

  // Create withdrawal within a transaction
  const result = await sequelize.transaction(async (t) => {
    const withdrawal = await Withdrawal.create({
      totalAmount: totalAmount,
      perOwnerAmount: perOwnerAmount.toString(),
      reason: reason || null,
      initiatedBy,
      status: 'pending_signatures',
      requiredSignatures: 3,
      splits,
      sourceBreakdown,
      transactionHashes: null
    }, { transaction: t });

    // Auto-create first signature for the initiator
    await WithdrawalSignature.create({
      withdrawalId: withdrawal.id,
      ownerId: initiatedBy,
      signedAt: new Date()
    }, { transaction: t });

    return withdrawal;
  });

  // Fetch the full withdrawal with associations
  const withdrawal = await Withdrawal.findByPk(result.id, {
    include: [
      {
        model: WithdrawalOwner,
        as: 'initiator',
        attributes: ['id', 'name', 'walletAddress']
      },
      {
        model: WithdrawalSignature,
        as: 'signatures',
        include: [
          {
            model: WithdrawalOwner,
            as: 'owner',
            attributes: ['id', 'name', 'walletAddress']
          }
        ]
      }
    ]
  });

  logger.info(`Withdrawal created: ${withdrawal.id}, amount: ${totalAmount} drops, initiated by: ${initiator.name}`);

  res.status(201).json(new ApiResponse(201, { withdrawal }, 'Withdrawal created successfully'));
};

/**
 * Sign a withdrawal (add signature)
 * When all required signatures are collected, execute on-chain payments
 */
const signWithdrawal = async (req, res) => {
  const { id } = req.params;
  const { ownerId } = req.body;

  if (!ownerId) {
    throw new ApiError(400, 'Owner ID is required');
  }

  const withdrawal = await Withdrawal.findByPk(id, {
    include: [
      {
        model: WithdrawalSignature,
        as: 'signatures'
      }
    ]
  });

  if (!withdrawal) {
    throw new ApiError(404, 'Withdrawal not found');
  }

  if (withdrawal.status !== 'pending_signatures') {
    throw new ApiError(400, `Cannot sign a withdrawal with status: ${withdrawal.status}`);
  }

  // Validate ownerId is an active owner
  const owner = await WithdrawalOwner.findOne({
    where: { id: ownerId, isActive: true }
  });

  if (!owner) {
    throw new ApiError(400, 'Owner not found or is not active');
  }

  // Check if already signed
  const existingSignature = await WithdrawalSignature.findOne({
    where: { withdrawalId: id, ownerId }
  });

  if (existingSignature) {
    throw new ApiError(409, 'This owner has already signed this withdrawal');
  }

  // Use a sequelize transaction for atomicity
  const result = await sequelize.transaction(async (t) => {
    // Create the signature
    await WithdrawalSignature.create({
      withdrawalId: id,
      ownerId,
      signedAt: new Date()
    }, { transaction: t });

    // Count total signatures now
    const signatureCount = withdrawal.signatures.length + 1;

    // If we have all required signatures, execute on-chain
    if (signatureCount >= withdrawal.requiredSignatures) {
      logger.info(`Withdrawal ${id}: All ${withdrawal.requiredSignatures} signatures collected. Executing on-chain payments...`);

      const transactionHashes = [];
      const splits = withdrawal.splits;

      try {
        const client = await xrplConfig.getClientAsync();
        const treasuryWallet = xrplConfig.getTreasuryWallet();

        for (const split of splits) {
          const paymentTx = {
            TransactionType: 'Payment',
            Account: treasuryWallet.address,
            Destination: split.walletAddress,
            Amount: split.amount
          };

          const prepared = await client.autofill(paymentTx);
          const signed = treasuryWallet.sign(prepared);
          const result = await client.submitAndWait(signed.tx_blob);

          if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            transactionHashes.push({
              ownerName: split.name,
              ownerWallet: split.walletAddress,
              amount: split.amount,
              hash: result.result.hash,
              status: 'success'
            });
            logger.info(`Payment to ${split.name} (${split.walletAddress}): ${split.amount} drops - TX: ${result.result.hash}`);
          } else {
            transactionHashes.push({
              ownerName: split.name,
              ownerWallet: split.walletAddress,
              amount: split.amount,
              hash: result.result.hash || null,
              status: 'failed',
              error: result.result.meta.TransactionResult
            });
            logger.error(`Payment to ${split.name} failed: ${result.result.meta.TransactionResult}`);
          }
        }

        // Update withdrawal to completed
        await withdrawal.update({
          status: 'completed',
          completedAt: new Date(),
          transactionHashes
        }, { transaction: t });

        logger.info(`Withdrawal ${id} completed. ${transactionHashes.length} payments executed.`);
      } catch (error) {
        logger.error(`Withdrawal ${id} on-chain execution failed: ${error.message}`);
        throw new ApiError(500, `On-chain payment execution failed: ${error.message}`);
      }
    }

    return signatureCount;
  });

  // Fetch the updated withdrawal
  const updatedWithdrawal = await Withdrawal.findByPk(id, {
    include: [
      {
        model: WithdrawalOwner,
        as: 'initiator',
        attributes: ['id', 'name', 'walletAddress']
      },
      {
        model: WithdrawalSignature,
        as: 'signatures',
        include: [
          {
            model: WithdrawalOwner,
            as: 'owner',
            attributes: ['id', 'name', 'walletAddress']
          }
        ]
      }
    ]
  });

  const message = updatedWithdrawal.status === 'completed'
    ? 'Withdrawal signed and executed successfully'
    : 'Withdrawal signed successfully';

  res.status(200).json(new ApiResponse(200, { withdrawal: updatedWithdrawal }, message));
};

/**
 * Reject a withdrawal
 */
const rejectWithdrawal = async (req, res) => {
  const { id } = req.params;
  const { ownerId, reason } = req.body;

  if (!ownerId) {
    throw new ApiError(400, 'Owner ID is required');
  }

  const withdrawal = await Withdrawal.findByPk(id);

  if (!withdrawal) {
    throw new ApiError(404, 'Withdrawal not found');
  }

  if (withdrawal.status !== 'pending_signatures') {
    throw new ApiError(400, `Cannot reject a withdrawal with status: ${withdrawal.status}`);
  }

  // Validate ownerId is an active owner
  const owner = await WithdrawalOwner.findOne({
    where: { id: ownerId, isActive: true }
  });

  if (!owner) {
    throw new ApiError(400, 'Owner not found or is not active');
  }

  await withdrawal.update({
    status: 'rejected',
    rejectedBy: ownerId,
    rejectionReason: reason || null,
    rejectedAt: new Date()
  });

  logger.info(`Withdrawal ${id} rejected by ${owner.name}: ${reason || 'No reason provided'}`);

  // Fetch updated withdrawal with associations
  const updatedWithdrawal = await Withdrawal.findByPk(id, {
    include: [
      {
        model: WithdrawalOwner,
        as: 'initiator',
        attributes: ['id', 'name', 'walletAddress']
      },
      {
        model: WithdrawalSignature,
        as: 'signatures',
        include: [
          {
            model: WithdrawalOwner,
            as: 'owner',
            attributes: ['id', 'name', 'walletAddress']
          }
        ]
      }
    ]
  });

  res.status(200).json(new ApiResponse(200, { withdrawal: updatedWithdrawal }, 'Withdrawal rejected successfully'));
};

module.exports = {
  getOwners,
  createOwner,
  updateOwner,
  deleteOwner,
  getSourceWallets,
  getWithdrawals,
  getStats,
  createWithdrawal,
  signWithdrawal,
  rejectWithdrawal
};
