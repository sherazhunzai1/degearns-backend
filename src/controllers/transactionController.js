const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get all transactions with filters
 */
const getTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      nftId,
      userId
    } = req.query;

    const query = {};

    if (type) query.type = type;
    if (nftId) query.nft = nftId;
    if (userId) {
      query.$or = [
        { from: userId },
        { to: userId }
      ];
    }

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(query)
      .populate('nft', 'tokenId name image')
      .populate('from', 'username profileImage walletAddress')
      .populate('to', 'username profileImage walletAddress')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json(
      new ApiResponse(200, {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Transactions retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction by hash
 */
const getTransaction = async (req, res, next) => {
  try {
    const { hash } = req.params;

    const transaction = await Transaction.findOne({ txHash: hash })
      .populate('nft', 'tokenId name image')
      .populate('from', 'username profileImage walletAddress')
      .populate('to', 'username profileImage walletAddress');

    if (!transaction) {
      throw new ApiError(404, 'Transaction not found');
    }

    res.status(200).json(
      new ApiResponse(200, transaction, 'Transaction retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's transaction history
 */
const getUserTransactions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const query = {
      $or: [
        { from: userId },
        { to: userId }
      ]
    };

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(query)
      .populate('nft', 'tokenId name image')
      .populate('from', 'username profileImage')
      .populate('to', 'username profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json(
      new ApiResponse(200, {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'User transactions retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get NFT transaction history
 */
const getNFTTransactions = async (req, res, next) => {
  try {
    const { nftId } = req.params;

    const transactions = await Transaction.find({ nft: nftId })
      .populate('from', 'username profileImage walletAddress')
      .populate('to', 'username profileImage walletAddress')
      .sort({ createdAt: -1 });

    res.status(200).json(
      new ApiResponse(200, transactions, 'NFT transactions retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransactions,
  getTransaction,
  getUserTransactions,
  getNFTTransactions
};
