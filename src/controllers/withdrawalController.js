const { WithdrawalOwner, Withdrawal, WithdrawalSignature, AdminWallet, AdminActivity, SolanaWithdrawalOwner, SolanaWithdrawal, SolanaWithdrawalSignature, OwnerChangeRequest, OwnerChangeSignature, sequelize } = require('../models');
const xrplConfig = require('../config/xrpl');
const { Keypair, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');
const solanaConfig = require('../config/solana');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { translateXrplError, describeXrplCode } = require('../utils/xrplErrors');
const { Op } = require('sequelize');

const WALLET_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

const SOURCE_TYPE_MAP = {
  revenue: 'revenue'
};

const SOURCE_LABELS = {
  revenue: 'Platform Revenue Wallet'
};

const SOURCE_DESCRIPTIONS = {
  revenue: 'Collects all platform fees from XRP transactions'
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
 * Get owners (public — for login allowlist, no auth required)
 */
const getOwnersPublic = async (req, res) => {
  const owners = await WithdrawalOwner.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'walletAddress'],
    order: [['position', 'ASC']]
  });

  res.status(200).json(new ApiResponse(200, { owners }, 'Owners retrieved'));
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

  await AdminActivity.create({
    adminWalletAddress: walletAddress,
    action: 'withdrawal_owner_created',
    details: { ownerId: owner.id, name, walletAddress }
  }).catch(() => {});

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

  await AdminActivity.create({
    adminWalletAddress: owner.walletAddress,
    action: 'withdrawal_owner_updated',
    details: { ownerId: owner.id, changes: updateData }
  }).catch(() => {});

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

  await AdminActivity.create({
    adminWalletAddress: owner.walletAddress,
    action: 'withdrawal_owner_deleted',
    details: { ownerId: owner.id, name: owner.name }
  }).catch(() => {});

  res.status(200).json(new ApiResponse(200, null, 'Withdrawal owner removed successfully'));
};

/**
 * Get source wallets with live XRPL balances
 */
const getSourceWallets = async (req, res) => {
  // Single source wallet: the admin wallet from .env (ADMIN_WALLET_SECRET_NUMBERS / ADMIN_WALLET_SEED)
  let walletAddress = null;
  let configured = false;

  try {
    const adminWallet = xrplConfig.getAdminWallet();
    walletAddress = adminWallet.address;
    configured = true;
  } catch (e) {}

  const walletInfo = {
    type: 'revenue',
    label: SOURCE_LABELS.revenue,
    description: SOURCE_DESCRIPTIONS.revenue,
    walletAddress,
    balanceDrops: '0',
    configured
  };

  if (walletAddress) {
    try {
      const client = await xrplConfig.getClientAsync();
      const response = await client.request({
        command: 'account_info',
        account: walletAddress
      });
      if (response.result && response.result.account_data) {
        walletInfo.balanceDrops = response.result.account_data.Balance;
      }
    } catch (error) {
      logger.warn(`Failed to fetch balance for admin wallet (${walletAddress}): ${error.message}`);
    }
  }

  res.status(200).json(new ApiResponse(200, { wallets: [walletInfo] }, 'Source wallets retrieved successfully'));
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

  // Validate admin wallet (single source) from .env
  let adminWalletObj;
  try {
    adminWalletObj = xrplConfig.getAdminWallet();
  } catch (e) {
    throw new ApiError(400, 'Admin wallet not configured in .env');
  }

  const adminAddress = adminWalletObj.address;

  // Get balance from admin wallet
  let combinedBalance = BigInt(0);

  {
    try {
      const client = await xrplConfig.getClientAsync();
      const response = await client.request({
        command: 'account_info',
        account: adminAddress
      });
      if (response.result && response.result.account_data) {
        combinedBalance = BigInt(response.result.account_data.Balance);
      }
    } catch (error) {
      logger.warn(`Failed to fetch balance for admin wallet: ${error.message}`);
    }
  }

  if (totalBigInt > combinedBalance) {
    throw new ApiError(400, `Insufficient balance. Requested: ${totalAmount} drops, Available: ${combinedBalance.toString()} drops`);
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

  // Single source — all funds from admin wallet
  const sourceBreakdown = [{
    type: 'revenue',
    label: SOURCE_LABELS.revenue,
    walletAddress: adminAddress,
    amount: totalAmount,
    availableBalance: combinedBalance.toString()
  }];

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

  await AdminActivity.create({
    adminWalletAddress: initiator.walletAddress,
    action: 'withdrawal_created',
    details: { withdrawalId: withdrawal.id, totalAmount, reason, initiatedBy: initiator.id, initiatorName: initiator.name }
  }).catch(() => {});

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
        const adminWallet = xrplConfig.getAdminWallet();

        for (const split of splits) {
          const paymentTx = {
            TransactionType: 'Payment',
            Account: adminWallet.address,
            Destination: split.walletAddress,
            Amount: split.amount
          };

          const prepared = await client.autofill(paymentTx);
          const signed = adminWallet.sign(prepared);
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
            const failCode = result.result.meta.TransactionResult;
            const friendly = describeXrplCode(failCode);
            transactionHashes.push({
              ownerName: split.name,
              ownerWallet: split.walletAddress,
              amount: split.amount,
              hash: result.result.hash || null,
              status: 'failed',
              error: friendly ? friendly.message : 'The payment could not be completed on the XRP Ledger.',
              errorCode: failCode
            });
            logger.error(`Payment to ${split.name} failed: ${failCode}`);
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
        if (error instanceof ApiError) throw error;
        throw translateXrplError(error, { action: 'execute the on-chain payout' });
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

  await AdminActivity.create({
    adminWalletAddress: owner.walletAddress,
    action: updatedWithdrawal.status === 'completed' ? 'withdrawal_completed' : 'withdrawal_signed',
    details: { withdrawalId: withdrawal.id, ownerId, ownerName: owner.name, status: updatedWithdrawal.status }
  }).catch(() => {});

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

  await AdminActivity.create({
    adminWalletAddress: rejecter.walletAddress,
    action: 'withdrawal_rejected',
    details: { withdrawalId: withdrawal.id, ownerId, ownerName: rejecter.name, reason }
  }).catch(() => {});

  res.status(200).json(new ApiResponse(200, { withdrawal: updatedWithdrawal }, 'Withdrawal rejected successfully'));
};

// ==================== OWNER CHANGE REQUEST OPERATIONS ====================

/**
 * Get owner change requests with pagination
 */
const getOwnerChangeRequests = async (req, res) => {
  const { network, status, page = 1, limit = 20 } = req.query;

  if (!network || !['xrpl', 'solana'].includes(network)) {
    throw new ApiError(400, 'Query parameter "network" is required and must be "xrpl" or "solana"');
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = { network };
  if (status) {
    where.status = status;
  }

  const { count, rows: requests } = await OwnerChangeRequest.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: OwnerChangeSignature,
        as: 'signatures'
      }
    ]
  });

  res.status(200).json(new ApiResponse(200, {
    requests,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Owner change requests retrieved successfully'));
};

/**
 * Create a new owner change request
 */
const createOwnerChangeRequest = async (req, res) => {
  const { network, targetOwnerId, newOwnerName, newOwnerWallet, initiatedBy } = req.body;

  if (!network || !['xrpl', 'solana'].includes(network)) {
    throw new ApiError(400, 'Field "network" is required and must be "xrpl" or "solana"');
  }

  if (!targetOwnerId) {
    throw new ApiError(400, 'Target owner ID is required');
  }

  if (!newOwnerName) {
    throw new ApiError(400, 'New owner name is required');
  }

  if (!newOwnerWallet) {
    throw new ApiError(400, 'New owner wallet address is required');
  }

  if (!initiatedBy) {
    throw new ApiError(400, 'Initiating owner ID is required');
  }

  // Select the correct model based on network
  const OwnerModel = network === 'xrpl' ? WithdrawalOwner : SolanaWithdrawalOwner;

  // Validate XRPL wallet format if applicable
  if (network === 'xrpl' && !WALLET_ADDRESS_REGEX.test(newOwnerWallet)) {
    throw new ApiError(400, 'Invalid XRPL wallet address format');
  }

  // Look up the target owner
  const targetOwner = await OwnerModel.findOne({
    where: { id: targetOwnerId, isActive: true }
  });

  if (!targetOwner) {
    throw new ApiError(404, 'Target owner not found or is not active');
  }

  // Look up the initiator
  const initiator = await OwnerModel.findOne({
    where: { id: initiatedBy, isActive: true }
  });

  if (!initiator) {
    throw new ApiError(400, 'Initiating owner not found or is not active');
  }

  // Initiator cannot target themselves
  if (initiatedBy === targetOwnerId) {
    throw new ApiError(400, 'You cannot propose to remove yourself');
  }

  // Check no pending change request already exists for this network
  const existingPending = await OwnerChangeRequest.findOne({
    where: { network, status: 'pending' }
  });

  if (existingPending) {
    throw new ApiError(409, 'A pending owner change request already exists for this network. Resolve it before creating a new one.');
  }

  // Validate newOwnerWallet is not already an active owner
  const existingOwner = await OwnerModel.findOne({
    where: { walletAddress: newOwnerWallet, isActive: true }
  });

  if (existingOwner) {
    throw new ApiError(409, 'The new wallet address is already an active owner');
  }

  // Create the request and auto-sign within a transaction
  const result = await sequelize.transaction(async (t) => {
    const changeRequest = await OwnerChangeRequest.create({
      network,
      targetOwnerId,
      targetOwnerName: targetOwner.name,
      targetOwnerWallet: targetOwner.walletAddress,
      newOwnerName,
      newOwnerWallet,
      initiatedBy,
      initiatorName: initiator.name,
      status: 'pending',
      requiredSignatures: 2
    }, { transaction: t });

    // Auto-sign for the initiator
    await OwnerChangeSignature.create({
      changeRequestId: changeRequest.id,
      ownerId: initiatedBy,
      ownerName: initiator.name,
      signedAt: new Date()
    }, { transaction: t });

    return changeRequest;
  });

  // Fetch the full request with signatures
  const changeRequest = await OwnerChangeRequest.findByPk(result.id, {
    include: [{ model: OwnerChangeSignature, as: 'signatures' }]
  });

  logger.info(`Owner change request created: ${changeRequest.id}, network: ${network}, target: ${targetOwner.name}, replacement: ${newOwnerName}, initiated by: ${initiator.name}`);

  res.status(201).json(new ApiResponse(201, { changeRequest }, 'Owner change request created successfully'));
};

/**
 * Sign an owner change request
 * When required signatures are met, execute the owner swap
 */
const signOwnerChangeRequest = async (req, res) => {
  const { id } = req.params;
  const { ownerId } = req.body;

  if (!ownerId) {
    throw new ApiError(400, 'Owner ID is required');
  }

  const changeRequest = await OwnerChangeRequest.findByPk(id, {
    include: [{ model: OwnerChangeSignature, as: 'signatures' }]
  });

  if (!changeRequest) {
    throw new ApiError(404, 'Owner change request not found');
  }

  if (changeRequest.status !== 'pending') {
    throw new ApiError(400, `Cannot sign a change request with status: ${changeRequest.status}`);
  }

  // Select the correct model based on network
  const OwnerModel = changeRequest.network === 'xrpl' ? WithdrawalOwner : SolanaWithdrawalOwner;

  // Validate signer is an active owner
  const signer = await OwnerModel.findOne({
    where: { id: ownerId, isActive: true }
  });

  if (!signer) {
    throw new ApiError(400, 'Signer not found or is not active');
  }

  // Target owner cannot sign their own removal
  if (ownerId === changeRequest.targetOwnerId) {
    throw new ApiError(400, 'The target owner cannot sign their own removal');
  }

  // Check if already signed
  const existingSignature = await OwnerChangeSignature.findOne({
    where: { changeRequestId: id, ownerId }
  });

  if (existingSignature) {
    throw new ApiError(409, 'This owner has already signed this change request');
  }

  // Execute within a transaction
  await sequelize.transaction(async (t) => {
    // Create the signature
    await OwnerChangeSignature.create({
      changeRequestId: id,
      ownerId,
      ownerName: signer.name,
      signedAt: new Date()
    }, { transaction: t });

    const signatureCount = changeRequest.signatures.length + 1;

    // If we have enough signatures, execute the owner swap
    if (signatureCount >= changeRequest.requiredSignatures) {
      logger.info(`Owner change request ${id}: ${signatureCount} signatures collected (required: ${changeRequest.requiredSignatures}). Executing owner swap...`);

      // Deactivate the target owner
      const targetOwner = await OwnerModel.findByPk(changeRequest.targetOwnerId, { transaction: t });
      if (targetOwner) {
        await targetOwner.update({ isActive: false }, { transaction: t });
      }

      // Create the new owner with the same position
      await OwnerModel.create({
        name: changeRequest.newOwnerName,
        walletAddress: changeRequest.newOwnerWallet,
        position: targetOwner ? targetOwner.position : 1,
        isActive: true
      }, { transaction: t });

      // Update the change request status
      await changeRequest.update({
        status: 'approved',
        completedAt: new Date()
      }, { transaction: t });

      logger.info(`Owner change request ${id} approved. ${changeRequest.targetOwnerName} replaced by ${changeRequest.newOwnerName}`);
    }
  });

  // Fetch the updated request with signatures
  const updatedRequest = await OwnerChangeRequest.findByPk(id, {
    include: [{ model: OwnerChangeSignature, as: 'signatures' }]
  });

  const message = updatedRequest.status === 'approved'
    ? 'Owner change request signed and executed successfully'
    : 'Owner change request signed successfully';

  res.status(200).json(new ApiResponse(200, { changeRequest: updatedRequest }, message));
};

/**
 * Reject an owner change request
 */
const rejectOwnerChangeRequest = async (req, res) => {
  const { id } = req.params;
  const { ownerId, reason } = req.body;

  if (!ownerId) {
    throw new ApiError(400, 'Owner ID is required');
  }

  const changeRequest = await OwnerChangeRequest.findByPk(id);

  if (!changeRequest) {
    throw new ApiError(404, 'Owner change request not found');
  }

  if (changeRequest.status !== 'pending') {
    throw new ApiError(400, `Cannot reject a change request with status: ${changeRequest.status}`);
  }

  // Select the correct model based on network
  const OwnerModel = changeRequest.network === 'xrpl' ? WithdrawalOwner : SolanaWithdrawalOwner;

  // Any active owner (including the target) can reject
  const rejecter = await OwnerModel.findOne({
    where: { id: ownerId, isActive: true }
  });

  if (!rejecter) {
    throw new ApiError(400, 'Owner not found or is not active');
  }

  await changeRequest.update({
    status: 'rejected',
    rejectedBy: ownerId,
    rejectorName: rejecter.name,
    rejectionReason: reason || null,
    rejectedAt: new Date()
  });

  logger.info(`Owner change request ${id} rejected by ${rejecter.name}: ${reason || 'No reason provided'}`);

  // Fetch updated request with signatures
  const updatedRequest = await OwnerChangeRequest.findByPk(id, {
    include: [{ model: OwnerChangeSignature, as: 'signatures' }]
  });

  res.status(200).json(new ApiResponse(200, { changeRequest: updatedRequest }, 'Owner change request rejected successfully'));
};

module.exports = {
  getOwners,
  getOwnersPublic,
  createOwner,
  updateOwner,
  deleteOwner,
  getSourceWallets,
  getWithdrawals,
  getStats,
  createWithdrawal,
  signWithdrawal,
  rejectWithdrawal,
  // Solana withdrawal owners
  getSolanaOwners,
  getSolanaOwnersPublic,
  createSolanaOwner,
  updateSolanaOwner,
  deleteSolanaOwner,
  // Solana withdrawal operations
  getSolanaSourceWallets,
  getSolanaWithdrawals,
  getSolanaStats,
  createSolanaWithdrawal,
  signSolanaWithdrawal,
  rejectSolanaWithdrawal,
  // Combined login allowlist
  getAllOwnersPublic,
  // Owner change requests
  getOwnerChangeRequests,
  createOwnerChangeRequest,
  signOwnerChangeRequest,
  rejectOwnerChangeRequest
};

// ==================== SOLANA WITHDRAWAL OPERATIONS ====================

/**
 * Get Solana source wallets with live balances
 */
async function getSolanaSourceWallets(req, res) {
  const wallets = [];

  const secretKey = process.env.SOLANA_ADMIN_SECRET_KEY || process.env.SOL_WALLET_PRIVATE_KEY;

  const walletInfo = {
    type: 'solana_revenue',
    label: 'Platform Revenue Wallet',
    description: 'Solana platform revenue wallet',
    walletAddress: null,
    balanceLamports: '0',
    configured: false
  };

  if (secretKey) {
    try {
      const adminKeypair = Keypair.fromSecretKey(bs58.decode(secretKey));
      walletInfo.walletAddress = adminKeypair.publicKey.toBase58();
      walletInfo.configured = true;

      try {
        const connection = solanaConfig.getConnection();
        const balance = await connection.getBalance(adminKeypair.publicKey);
        walletInfo.balanceLamports = balance.toString();
      } catch (error) {
        logger.warn(`Failed to fetch Solana balance for ${walletInfo.walletAddress}: ${error.message}`);
      }
    } catch (error) {
      logger.warn(`Failed to load Solana admin keypair: ${error.message}`);
    }
  }

  wallets.push(walletInfo);

  res.status(200).json(new ApiResponse(200, { wallets }, 'Solana source wallets retrieved successfully'));
}

/**
 * Get Solana withdrawals with pagination
 */
async function getSolanaWithdrawals(req, res) {
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

  const { count, rows: withdrawals } = await SolanaWithdrawal.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: SolanaWithdrawalOwner,
        as: 'initiator',
        attributes: ['id', 'name', 'walletAddress']
      },
      {
        model: SolanaWithdrawalSignature,
        as: 'signatures',
        include: [
          {
            model: SolanaWithdrawalOwner,
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
      chain: data.chain,
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
  }, 'Solana withdrawals retrieved successfully'));
}

/**
 * Get Solana withdrawal statistics
 */
async function getSolanaStats(req, res) {
  const [pending, completed, rejected, completedSum] = await Promise.all([
    SolanaWithdrawal.count({ where: { status: 'pending_signatures' } }),
    SolanaWithdrawal.count({ where: { status: 'completed' } }),
    SolanaWithdrawal.count({ where: { status: 'rejected' } }),
    SolanaWithdrawal.findAll({
      where: { status: 'completed' },
      attributes: ['totalAmount']
    })
  ]);

  let totalWithdrawnLamports = BigInt(0);
  for (const w of completedSum) {
    totalWithdrawnLamports += BigInt(w.totalAmount);
  }

  res.status(200).json(new ApiResponse(200, {
    pending,
    completed,
    rejected,
    totalWithdrawnLamports: totalWithdrawnLamports.toString()
  }, 'Solana withdrawal statistics retrieved successfully'));
}

/**
 * Create a new Solana withdrawal request
 */
async function createSolanaWithdrawal(req, res) {
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
    throw new ApiError(400, 'Total amount must be a valid numeric string (lamports)');
  }

  if (totalBigInt <= BigInt(0)) {
    throw new ApiError(400, 'Total amount must be greater than 0');
  }

  // Validate active Solana owners exist
  const activeOwners = await SolanaWithdrawalOwner.findAll({
    where: { isActive: true },
    order: [['position', 'ASC']]
  });

  if (activeOwners.length === 0) {
    throw new ApiError(400, 'No active Solana withdrawal owners found');
  }

  // Validate the initiator is an active owner
  const initiator = activeOwners.find(o => o.id === initiatedBy);
  if (!initiator) {
    throw new ApiError(400, 'Initiating owner must be one of the active Solana withdrawal owners');
  }

  // Validate source wallet is configured and has sufficient balance
  const secretKey = process.env.SOLANA_ADMIN_SECRET_KEY || process.env.SOL_WALLET_PRIVATE_KEY;
  if (!secretKey) {
    throw new ApiError(400, 'Solana admin wallet not configured. Set SOLANA_ADMIN_SECRET_KEY or SOL_WALLET_PRIVATE_KEY.');
  }

  let adminKeypair;
  try {
    adminKeypair = Keypair.fromSecretKey(bs58.decode(secretKey));
  } catch (error) {
    throw new ApiError(400, 'Failed to load Solana admin keypair: ' + error.message);
  }

  const adminAddress = adminKeypair.publicKey.toBase58();

  // Get live balance
  let balanceLamports = BigInt(0);
  try {
    const connection = solanaConfig.getConnection();
    const balance = await connection.getBalance(adminKeypair.publicKey);
    balanceLamports = BigInt(balance);
  } catch (error) {
    logger.warn(`Failed to fetch Solana balance: ${error.message}`);
    throw new ApiError(400, 'Failed to fetch Solana wallet balance: ' + error.message);
  }

  if (totalBigInt > balanceLamports) {
    throw new ApiError(400, `Insufficient balance. Requested: ${totalAmount} lamports, Available: ${balanceLamports.toString()} lamports`);
  }

  // Compute per-owner amount
  const ownerCount = BigInt(activeOwners.length);
  const perOwnerAmount = totalBigInt / ownerCount;
  const remainder = totalBigInt % ownerCount;

  // Build splits snapshot
  const splits = activeOwners.map((owner, index) => ({
    ownerId: owner.id,
    name: owner.name,
    walletAddress: owner.walletAddress,
    amount: (index === 0 ? (perOwnerAmount + remainder) : perOwnerAmount).toString()
  }));

  // Single source breakdown
  const sourceBreakdown = [{
    type: 'solana_revenue',
    label: 'Platform Revenue Wallet',
    walletAddress: adminAddress,
    amount: totalAmount,
    availableBalance: balanceLamports.toString()
  }];

  // Create withdrawal within a transaction
  const result = await sequelize.transaction(async (t) => {
    const withdrawal = await SolanaWithdrawal.create({
      chain: 'solana',
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
    await SolanaWithdrawalSignature.create({
      withdrawalId: withdrawal.id,
      ownerId: initiatedBy,
      signedAt: new Date()
    }, { transaction: t });

    return withdrawal;
  });

  // Fetch the full withdrawal with associations
  const withdrawal = await SolanaWithdrawal.findByPk(result.id, {
    include: [
      {
        model: SolanaWithdrawalOwner,
        as: 'initiator',
        attributes: ['id', 'name', 'walletAddress']
      },
      {
        model: SolanaWithdrawalSignature,
        as: 'signatures',
        include: [
          {
            model: SolanaWithdrawalOwner,
            as: 'owner',
            attributes: ['id', 'name', 'walletAddress']
          }
        ]
      }
    ]
  });

  logger.info(`Solana withdrawal created: ${withdrawal.id}, amount: ${totalAmount} lamports, initiated by: ${initiator.name}`);

  await AdminActivity.create({
    adminWalletAddress: initiator.walletAddress,
    action: 'solana_withdrawal_created',
    details: { withdrawalId: withdrawal.id, totalAmount, reason, initiatedBy: initiator.id, initiatorName: initiator.name, chain: 'solana' }
  }).catch(() => {});

  res.status(201).json(new ApiResponse(201, { withdrawal }, 'Solana withdrawal created successfully'));
}

/**
 * Sign a Solana withdrawal (add signature)
 * When all required signatures are collected, execute on-chain SOL transfers
 */
async function signSolanaWithdrawal(req, res) {
  const { id } = req.params;
  const { ownerId } = req.body;

  if (!ownerId) {
    throw new ApiError(400, 'Owner ID is required');
  }

  const withdrawal = await SolanaWithdrawal.findByPk(id, {
    include: [
      {
        model: SolanaWithdrawalSignature,
        as: 'signatures'
      }
    ]
  });

  if (!withdrawal) {
    throw new ApiError(404, 'Solana withdrawal not found');
  }

  if (withdrawal.status !== 'pending_signatures') {
    throw new ApiError(400, `Cannot sign a withdrawal with status: ${withdrawal.status}`);
  }

  // Validate ownerId is an active owner
  const owner = await SolanaWithdrawalOwner.findOne({
    where: { id: ownerId, isActive: true }
  });

  if (!owner) {
    throw new ApiError(400, 'Owner not found or is not active');
  }

  // Check if already signed
  const existingSignature = await SolanaWithdrawalSignature.findOne({
    where: { withdrawalId: id, ownerId }
  });

  if (existingSignature) {
    throw new ApiError(409, 'This owner has already signed this withdrawal');
  }

  // Use a sequelize transaction for atomicity
  const result = await sequelize.transaction(async (t) => {
    // Create the signature
    await SolanaWithdrawalSignature.create({
      withdrawalId: id,
      ownerId,
      signedAt: new Date()
    }, { transaction: t });

    // Count total signatures now
    const signatureCount = withdrawal.signatures.length + 1;

    // If we have all required signatures, execute on-chain
    if (signatureCount >= withdrawal.requiredSignatures) {
      logger.info(`Solana withdrawal ${id}: All ${withdrawal.requiredSignatures} signatures collected. Executing on-chain SOL transfers...`);

      const transactionHashes = [];
      const splits = withdrawal.splits;

      try {
        const connection = solanaConfig.getConnection();

        // Load admin keypair from env
        const secretKey = process.env.SOLANA_ADMIN_SECRET_KEY || process.env.SOL_WALLET_PRIVATE_KEY;
        if (!secretKey) {
          throw new Error('Solana admin wallet not configured');
        }
        const adminKeypair = Keypair.fromSecretKey(bs58.decode(secretKey));

        for (const split of splits) {
          try {
            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: adminKeypair.publicKey,
                toPubkey: new PublicKey(split.walletAddress),
                lamports: parseInt(split.amount)
              })
            );

            const signature = await connection.sendTransaction(transaction, [adminKeypair]);
            await connection.confirmTransaction(signature, 'confirmed');

            transactionHashes.push({
              ownerName: split.name,
              ownerWallet: split.walletAddress,
              amount: split.amount,
              signature: signature,
              status: 'success'
            });

            logger.info(`SOL payment to ${split.name} (${split.walletAddress}): ${split.amount} lamports - Sig: ${signature}`);
          } catch (txError) {
            transactionHashes.push({
              ownerName: split.name,
              ownerWallet: split.walletAddress,
              amount: split.amount,
              signature: null,
              status: 'failed',
              error: txError.message
            });
            logger.error(`SOL payment to ${split.name} failed: ${txError.message}`);
          }
        }

        // Update withdrawal to completed
        await withdrawal.update({
          status: 'completed',
          completedAt: new Date(),
          transactionHashes
        }, { transaction: t });

        logger.info(`Solana withdrawal ${id} completed. ${transactionHashes.length} payments executed.`);
      } catch (error) {
        logger.error(`Solana withdrawal ${id} on-chain execution failed: ${error.message}`);
        throw new ApiError(500, `On-chain SOL payment execution failed: ${error.message}`);
      }
    }

    return signatureCount;
  });

  // Fetch the updated withdrawal
  const updatedWithdrawal = await SolanaWithdrawal.findByPk(id, {
    include: [
      {
        model: SolanaWithdrawalOwner,
        as: 'initiator',
        attributes: ['id', 'name', 'walletAddress']
      },
      {
        model: SolanaWithdrawalSignature,
        as: 'signatures',
        include: [
          {
            model: SolanaWithdrawalOwner,
            as: 'owner',
            attributes: ['id', 'name', 'walletAddress']
          }
        ]
      }
    ]
  });

  const message = updatedWithdrawal.status === 'completed'
    ? 'Solana withdrawal signed and executed successfully'
    : 'Solana withdrawal signed successfully';

  await AdminActivity.create({
    adminWalletAddress: owner.walletAddress,
    action: updatedWithdrawal.status === 'completed' ? 'solana_withdrawal_completed' : 'solana_withdrawal_signed',
    details: { withdrawalId: withdrawal.id, ownerId, ownerName: owner.name, status: updatedWithdrawal.status, chain: 'solana' }
  }).catch(() => {});

  res.status(200).json(new ApiResponse(200, { withdrawal: updatedWithdrawal }, message));
}

/**
 * Reject a Solana withdrawal
 */
async function rejectSolanaWithdrawal(req, res) {
  const { id } = req.params;
  const { ownerId, reason } = req.body;

  if (!ownerId) {
    throw new ApiError(400, 'Owner ID is required');
  }

  const withdrawal = await SolanaWithdrawal.findByPk(id);

  if (!withdrawal) {
    throw new ApiError(404, 'Solana withdrawal not found');
  }

  if (withdrawal.status !== 'pending_signatures') {
    throw new ApiError(400, `Cannot reject a withdrawal with status: ${withdrawal.status}`);
  }

  // Validate ownerId is an active owner
  const owner = await SolanaWithdrawalOwner.findOne({
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

  logger.info(`Solana withdrawal ${id} rejected by ${owner.name}: ${reason || 'No reason provided'}`);

  // Fetch updated withdrawal with associations
  const updatedWithdrawal = await SolanaWithdrawal.findByPk(id, {
    include: [
      {
        model: SolanaWithdrawalOwner,
        as: 'initiator',
        attributes: ['id', 'name', 'walletAddress']
      },
      {
        model: SolanaWithdrawalSignature,
        as: 'signatures',
        include: [
          {
            model: SolanaWithdrawalOwner,
            as: 'owner',
            attributes: ['id', 'name', 'walletAddress']
          }
        ]
      }
    ]
  });

  await AdminActivity.create({
    adminWalletAddress: owner.walletAddress,
    action: 'solana_withdrawal_rejected',
    details: { withdrawalId: withdrawal.id, ownerId, ownerName: owner.name, reason, chain: 'solana' }
  }).catch(() => {});

  res.status(200).json(new ApiResponse(200, { withdrawal: updatedWithdrawal }, 'Solana withdrawal rejected successfully'));
}

// ==================== SOLANA WITHDRAWAL OWNERS ====================

async function getSolanaOwners(req, res) {
  const owners = await SolanaWithdrawalOwner.findAll({
    where: { isActive: true },
    order: [['position', 'ASC']]
  });
  res.status(200).json(new ApiResponse(200, { owners }, 'Solana withdrawal owners retrieved'));
}

async function getSolanaOwnersPublic(req, res) {
  const owners = await SolanaWithdrawalOwner.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'walletAddress'],
    order: [['position', 'ASC']]
  });
  res.status(200).json(new ApiResponse(200, { owners }, 'Solana owners retrieved'));
}

async function createSolanaOwner(req, res) {
  const { name, walletAddress } = req.body;
  if (!name) throw new ApiError(400, 'Name is required');
  if (!walletAddress) throw new ApiError(400, 'Wallet address is required');

  const activeCount = await SolanaWithdrawalOwner.count({ where: { isActive: true } });
  if (activeCount >= 3) throw new ApiError(409, 'Maximum of 3 active Solana withdrawal owners allowed');

  const existing = await SolanaWithdrawalOwner.findOne({ where: { walletAddress } });
  if (existing) throw new ApiError(409, 'A Solana withdrawal owner with this wallet address already exists');

  const maxPos = await SolanaWithdrawalOwner.max('position') || 0;
  const owner = await SolanaWithdrawalOwner.create({ name, walletAddress, position: maxPos + 1, isActive: true });

  res.status(201).json(new ApiResponse(201, { owner }, 'Solana withdrawal owner created'));
}

async function updateSolanaOwner(req, res) {
  const { id } = req.params;
  const { name, walletAddress } = req.body;

  const owner = await SolanaWithdrawalOwner.findByPk(id);
  if (!owner) throw new ApiError(404, 'Solana withdrawal owner not found');

  if (walletAddress && walletAddress !== owner.walletAddress) {
    const dup = await SolanaWithdrawalOwner.findOne({ where: { walletAddress } });
    if (dup) throw new ApiError(409, 'Wallet address already exists');
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (walletAddress !== undefined) updateData.walletAddress = walletAddress;
  await owner.update(updateData);

  res.status(200).json(new ApiResponse(200, { owner }, 'Solana withdrawal owner updated'));
}

async function deleteSolanaOwner(req, res) {
  const { id } = req.params;
  const owner = await SolanaWithdrawalOwner.findByPk(id);
  if (!owner) throw new ApiError(404, 'Solana withdrawal owner not found');
  await owner.update({ isActive: false });
  res.status(200).json(new ApiResponse(200, null, 'Solana withdrawal owner removed'));
}

/**
 * Combined public login allowlist — returns all active owners from BOTH networks.
 * Frontend checks the connected wallet against this list to gate admin panel access.
 */
async function getAllOwnersPublic(req, res) {
  const [xrplOwners, solanaOwners] = await Promise.all([
    WithdrawalOwner.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'walletAddress'],
      order: [['position', 'ASC']]
    }),
    SolanaWithdrawalOwner.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'walletAddress'],
      order: [['position', 'ASC']]
    })
  ]);

  const owners = [
    ...xrplOwners.map(o => ({ ...o.toJSON(), network: 'xrpl' })),
    ...solanaOwners.map(o => ({ ...o.toJSON(), network: 'solana' }))
  ];

  res.status(200).json(new ApiResponse(200, { owners }, 'All admin owners retrieved'));
}
