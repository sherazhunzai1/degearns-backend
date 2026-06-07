const { MemeCoin, MemeCoinPool, MemeCoinTrade, User, sequelize } = require('../models');
const xrplService = require('../services/xrplService');
const xrplConfig = require('../config/xrpl');
const solanaService = require('../services/solanaService');
const chainServiceFactory = require('../services/chainServiceFactory');
const priceService = require('../services/priceService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const { resolvePrimaryWallet } = require('../utils/userHelpers');
const { Op } = require('sequelize');

/**
 * Create a new meme coin.
 *
 * XRPL flow: backend builds a TrustSet for the user to sign (Xaman QR),
 * then issues tokens from the admin wallet after the user confirms.
 *
 * Solana flow: the frontend creates the SPL token on-chain (Raydium / Metaplex).
 * The backend just stores the record. Optionally confirms the mint tx later.
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
      walletAddress,
      network,
      mintAddress,
      mintTxHash
    } = req.body;

    if (!tokenName) throw new ApiError(400, 'Token name is required');
    if (!tokenSymbol) throw new ApiError(400, 'Token symbol is required');
    if (!totalSupply) throw new ApiError(400, 'Total supply is required');
    if (!walletAddress) throw new ApiError(400, 'Wallet address is required');

    const symbolCleaned = tokenSymbol.toUpperCase().trim();
    if (!/^[A-Z0-9]{1,15}$/.test(symbolCleaned)) {
      throw new ApiError(400, 'Token symbol must be 1-15 alphanumeric characters');
    }

    const supply = parseFloat(totalSupply);
    if (isNaN(supply) || supply <= 0) {
      throw new ApiError(400, 'Total supply must be a positive number');
    }

    const dec = parseInt(decimals);
    if (isNaN(dec) || dec < 0 || dec > 15) {
      throw new ApiError(400, 'Decimals must be between 0 and 15');
    }

    const resolvedNetwork = chainServiceFactory.normalizeNetwork(network);
    if (!chainServiceFactory.isSupportedNetwork(resolvedNetwork)) {
      throw new ApiError(400, `Unsupported network: ${network}`);
    }

    // Resolve linked wallet to primary user
    const primaryWallet = await resolvePrimaryWallet(walletAddress);
    const user = await User.findOne({ where: { walletAddress: primaryWallet } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // --- Solana meme coin ---
    if (resolvedNetwork === 'solana') {
      if (!mintAddress) {
        throw new ApiError(400, 'mintAddress is required for Solana meme coins');
      }
      if (!solanaService.isValidAddress(mintAddress)) {
        throw new ApiError(400, 'Invalid Solana mint address');
      }

      // Check duplicate
      const existing = await MemeCoin.findOne({
        where: { mintAddress, network: 'solana' }
      });
      if (existing) {
        return res.status(200).json(
          new ApiResponse(200, existing, 'Meme coin already registered')
        );
      }

      const memeCoin = await MemeCoin.create({
        tokenName,
        tokenSymbol: symbolCleaned,
        network: 'solana',
        mintAddress,
        currencyHex: null,
        issuerWalletAddress: null,
        totalSupply: supply,
        decimals: dec,
        logo: logo || null,
        description: description || null,
        website: website || null,
        socialLinks: socialLinks || null,
        creatorWalletAddress: walletAddress,
        status: mintTxHash ? 'minted' : 'pending',
        issuanceTxHash: mintTxHash || null,
        metadata: {
          createdVia: 'api',
          originalSymbol: tokenSymbol
        }
      });

      logger.info(`Solana MemeCoin registered: ${tokenName} (${symbolCleaned}) mint=${mintAddress} by ${walletAddress}`);

      return res.status(201).json(
        new ApiResponse(201, memeCoin, 'Solana meme coin registered successfully')
      );
    }

    // --- XRPL meme coin (frontend creates on-chain, backend stores metadata) ---
    const currencyHex = req.body.currencyHex || xrplService.currencyToHex(symbolCleaned);
    const issuerAddress = req.body.issuerWalletAddress || walletAddress;
    const issuanceTxHash = req.body.issuanceTxHash || req.body.txHash || null;

    // Check duplicate
    const existing = await MemeCoin.findOne({
      where: { currencyHex, issuerWalletAddress: issuerAddress }
    });
    if (existing) {
      return res.status(200).json(
        new ApiResponse(200, existing, 'Meme coin already registered')
      );
    }

    const memeCoin = await MemeCoin.create({
      tokenName,
      tokenSymbol: symbolCleaned,
      network: 'xrpl',
      currencyHex,
      totalSupply: supply,
      decimals: dec,
      logo: logo || null,
      description: description || null,
      website: website || null,
      socialLinks: socialLinks || null,
      issuerWalletAddress: issuerAddress,
      creatorWalletAddress: walletAddress,
      status: issuanceTxHash ? 'issued' : 'pending',
      issuanceTxHash,
      metadata: {
        createdVia: 'frontend',
        originalSymbol: tokenSymbol
      }
    });

    logger.info(`XRPL MemeCoin registered: ${tokenName} (${symbolCleaned}) by ${walletAddress}, id: ${memeCoin.id}`);

    res.status(201).json(
      new ApiResponse(201, memeCoin, 'XRPL meme coin registered successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * XRPL: Confirm TrustSet was signed, then issue tokens from admin wallet.
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

    if (memeCoin.network !== 'xrpl') {
      throw new ApiError(400, 'This endpoint is only for XRPL meme coins. Use /confirm-mint for Solana.');
    }

    if (memeCoin.status === 'issued') {
      throw new ApiError(400, 'Token has already been issued');
    }

    try {
      const client = xrplConfig.getClient();
      const txResponse = await client.request({
        command: 'tx',
        transaction: trustSetTxHash
      });

      const tx = txResponse.result;

      if (tx.TransactionType !== 'TrustSet') {
        throw new ApiError(400, 'Transaction is not a TrustSet');
      }
      if (tx.Account !== memeCoin.creatorWalletAddress) {
        throw new ApiError(400, 'TrustSet was not signed by the token creator');
      }

      const meta = tx.meta || tx.metaData;
      if (meta && meta.TransactionResult !== 'tesSUCCESS') {
        throw new ApiError(400, `TrustSet transaction failed: ${meta.TransactionResult}`);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error verifying TrustSet transaction:', error);
      throw new ApiError(400, 'Could not verify the TrustSet transaction on XRPL');
    }

    await memeCoin.update({ status: 'trust_set', trustSetTxHash });

    try {
      const issueResult = await xrplService.issueTokenFromAdmin({
        destinationAddress: memeCoin.creatorWalletAddress,
        currencyHex: memeCoin.currencyHex,
        totalSupply: memeCoin.totalSupply
      });

      const issuanceTxHash = issueResult.result.hash;
      await memeCoin.update({ status: 'issued', issuanceTxHash });

      logger.info(`Token issued: ${memeCoin.tokenName} (${memeCoin.tokenSymbol}), issuance tx: ${issuanceTxHash}`);

      res.status(200).json(
        new ApiResponse(200, {
          memeCoin,
          trustSetTxHash,
          issuanceTxHash
        }, 'Token issued successfully!')
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
 * Solana: Confirm the SPL token mint transaction.
 * Frontend has already minted the token via Metaplex/Raydium.
 * We verify the tx exists on-chain and update the status.
 */
const confirmMint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { mintTxHash } = req.body;

    if (!mintTxHash) {
      throw new ApiError(400, 'Mint transaction hash is required');
    }

    const memeCoin = await MemeCoin.findByPk(id);
    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    if (memeCoin.network !== 'solana') {
      throw new ApiError(400, 'This endpoint is only for Solana meme coins. Use /confirm-trustline for XRPL.');
    }

    const verification = await solanaService.verifyTransaction(mintTxHash);
    if (!verification.verified) {
      throw new ApiError(400, `Mint transaction verification failed: ${verification.error}`);
    }

    await memeCoin.update({ status: 'minted', issuanceTxHash: mintTxHash });

    logger.info(`Solana meme coin mint confirmed: ${memeCoin.tokenSymbol} mintAddress=${memeCoin.mintAddress} tx=${mintTxHash}`);

    res.status(200).json(
      new ApiResponse(200, memeCoin, 'Mint transaction verified and recorded')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single meme coin by ID (includes active pool if listed).
 */
const getMemeCoin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const memeCoin = await MemeCoin.findByPk(id, {
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        },
        {
          association: 'pools',
          where: { status: 'active' },
          required: false
        }
      ]
    });

    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    // Latest price from most recent trade
    const latestTrade = await MemeCoinTrade.findOne({
      where: { memeCoinId: id },
      order: [['tradedAt', 'DESC']]
    });

    res.status(200).json(
      new ApiResponse(200, {
        ...memeCoin.toJSON(),
        isListed: memeCoin.pools && memeCoin.pools.length > 0,
        currentPrice: latestTrade ? {
          pricePerToken: latestTrade.pricePerToken,
          priceUsd: latestTrade.priceUsd,
          pairToken: latestTrade.pairToken,
          tradedAt: latestTrade.tradedAt
        } : null
      }, 'Meme coin retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * List meme coins with filters (network, status, listed/unlisted, search).
 */
const getMemeCoins = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      network,
      listed,
      creatorWalletAddress,
      search,
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query;

    const where = {};

    if (status) where.status = status;
    if (network) where.network = network;
    if (creatorWalletAddress) where.creatorWalletAddress = creatorWalletAddress;
    if (search) {
      where[Op.or] = [
        { tokenName: { [Op.like]: `%${search}%` } },
        { tokenSymbol: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // If listed filter is set, join with active pools
    const include = [
      {
        association: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      },
      {
        association: 'pools',
        where: { status: 'active' },
        required: listed === 'true'
      }
    ];

    const { count, rows: memeCoins } = await MemeCoin.findAndCountAll({
      where,
      include,
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    // Enrich with latest price
    const coinIds = memeCoins.map(c => c.id);
    const latestTrades = coinIds.length > 0 ? await MemeCoinTrade.findAll({
      attributes: ['memeCoinId', 'pricePerToken', 'priceUsd', 'pairToken', 'tradedAt'],
      where: { memeCoinId: { [Op.in]: coinIds } },
      order: [['tradedAt', 'DESC']]
    }) : [];

    const latestByCoin = {};
    for (const t of latestTrades) {
      if (!latestByCoin[t.memeCoinId]) latestByCoin[t.memeCoinId] = t;
    }

    const enriched = memeCoins.map(c => {
      const json = c.toJSON();
      const lt = latestByCoin[c.id];
      return {
        ...json,
        isListed: json.pools && json.pools.length > 0,
        currentPrice: lt ? {
          pricePerToken: lt.pricePerToken,
          priceUsd: lt.priceUsd,
          pairToken: lt.pairToken,
          tradedAt: lt.tradedAt
        } : null
      };
    });

    res.status(200).json(
      new ApiResponse(200, {
        memeCoins: enriched,
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
 * Get meme coins for a user profile — fetched directly from blockchain.
 * Returns coins the user HOLDS on-chain across all linked wallets.
 * XRPL: trustlines with balance > 0. Solana: SPL fungible tokens via Helius DAS.
 */
const getMyMemeCoins = async (req, res, next) => {
  try {
    let { walletAddress } = req.params;

    const primaryWallet = await resolvePrimaryWallet(walletAddress);
    const user = await User.findOne({ where: { walletAddress: primaryWallet } });

    let allWallets = [{ address: primaryWallet, network: user?.network || 'xrpl' }];
    if (user) {
      const { UserWallet } = require('../models');
      const linked = await UserWallet.findAll({ where: { userId: user.id } });
      if (linked.length > 0) {
        allWallets = linked.map(l => ({ address: l.walletAddress, network: l.network }));
      }
    }

    const xrplWallets = allWallets.filter(w => w.network === 'xrpl');
    const solanaWallets = allWallets.filter(w => w.network === 'solana');

    const allCoins = [];

    // Fetch XRPL tokens from on-chain trustlines + enrich with metadata
    for (const w of xrplWallets) {
      try {
        const client = await xrplConfig.getClientAsync();
        const response = await client.request({
          command: 'account_lines',
          account: w.address,
          ledger_index: 'validated'
        });
        const lines = response.result.lines || [];
        // Include positive balance (holder) AND negative balance (issuer — you created the token)
        const activeLines = lines.filter(l => parseFloat(l.balance) !== 0);

        // Batch fetch metadata from DB for all held tokens
        const dbCoins = activeLines.length > 0 ? await MemeCoin.findAll({
          where: {
            network: 'xrpl',
            [Op.or]: activeLines.map(l => ({
              currencyHex: l.currency,
              issuerWalletAddress: l.account
            }))
          },
          raw: true
        }) : [];
        const dbMap = {};
        dbCoins.forEach(c => { dbMap[`${c.currencyHex}_${c.issuerWalletAddress}`] = c; });

        // Also fetch issuer's total supply via gateway_balances
        const issuerSupplyMap = {};
        const uniqueIssuers = [...new Set(activeLines.map(l => l.account))];
        await Promise.all(uniqueIssuers.map(async (issuer) => {
          try {
            const gwRes = await client.request({
              command: 'gateway_balances',
              account: issuer,
              ledger_index: 'validated'
            });
            const obligations = gwRes.result.obligations || {};
            for (const [cur, amount] of Object.entries(obligations)) {
              issuerSupplyMap[`${cur}_${issuer}`] = amount;
            }
          } catch (e) {}
        }));

        for (const line of activeLines) {
          let tokenSymbol = line.currency;
          if (line.currency.length > 3) {
            try {
              tokenSymbol = Buffer.from(line.currency, 'hex').toString('utf-8').replace(/\0/g, '');
            } catch (e) {}
          }

          const key = `${line.currency}_${line.account}`;
          const dbCoin = dbMap[key];
          const totalSupply = issuerSupplyMap[key] || dbCoin?.totalSupply || null;
          const rawBalance = parseFloat(line.balance);
          const isIssuer = rawBalance < 0;

          allCoins.push({
            network: 'xrpl',
            walletAddress: w.address,
            tokenName: dbCoin?.tokenName || tokenSymbol,
            tokenSymbol,
            description: dbCoin?.description || null,
            image: dbCoin?.logo || null,
            currencyHex: line.currency,
            issuer: line.account,
            balance: Math.abs(rawBalance).toString(),
            isIssuer,
            totalSupply,
            decimals: dbCoin?.decimals || null,
            limit: line.limit,
            website: dbCoin?.website || null,
            socialLinks: dbCoin?.socialLinks || null
          });
        }
      } catch (err) {
        logger.warn(`Error fetching XRPL trustlines for ${w.address}: ${err.message}`);
      }
    }

    // Fetch Solana tokens from on-chain via Helius DAS (full metadata included)
    for (const w of solanaWallets) {
      try {
        const result = await solanaService.getTokensByOwner(w.address, 1, 1000).catch(() => ({ items: [] }));
        for (const item of (result.items || [])) {
          if (item.interface !== 'FungibleToken' && item.interface !== 'FungibleAsset') continue;

          allCoins.push({
            network: 'solana',
            walletAddress: w.address,
            tokenName: item.content?.metadata?.name || null,
            tokenSymbol: item.content?.metadata?.symbol || null,
            description: item.content?.metadata?.description || null,
            image: item.content?.links?.image || item.content?.files?.[0]?.uri || null,
            mintAddress: item.id,
            balance: item.token_info?.balance || null,
            totalSupply: item.token_info?.supply || null,
            decimals: item.token_info?.decimals || null,
            priceUsd: item.token_info?.price_info?.price_per_token || null,
            totalPriceUsd: item.token_info?.price_info?.total_price || null,
            currency: item.token_info?.price_info?.currency || null,
            attributes: item.content?.metadata?.attributes || []
          });
        }
      } catch (err) {
        logger.warn(`Error fetching Solana tokens for ${w.address}: ${err.message}`);
      }
    }

    res.status(200).json(
      new ApiResponse(200, {
        wallets: allWallets,
        totalCoins: allCoins.length,
        memeCoins: allCoins
      }, 'User meme coins retrieved successfully')
    );
  } catch (error) {
    logger.error('Error fetching user meme coins:', error);
    next(error);
  }
};

// ==================== POOL MANAGEMENT ====================

/**
 * Register a liquidity pool for a meme coin.
 * Called by frontend after creating the pool on Raydium / XRPL AMM.
 */
const registerPool = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      poolAddress,
      poolId,
      pairToken,
      pairTokenAddress,
      initialBaseAmount,
      initialPairAmount,
      createTxHash,
      providerWalletAddress,
      metadata
    } = req.body;

    if (!poolAddress) throw new ApiError(400, 'poolAddress is required');
    if (!pairToken) throw new ApiError(400, 'pairToken is required');
    if (!providerWalletAddress) throw new ApiError(400, 'providerWalletAddress is required');

    const memeCoin = await MemeCoin.findByPk(id);
    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    // Check duplicate
    const existing = await MemeCoinPool.findOne({ where: { poolAddress, memeCoinId: id } });
    if (existing) {
      return res.status(200).json(
        new ApiResponse(200, existing, 'Pool already registered for this meme coin')
      );
    }

    // Calculate initial price
    let initialPrice = null;
    if (initialBaseAmount && initialPairAmount && parseFloat(initialBaseAmount) > 0) {
      initialPrice = parseFloat(initialPairAmount) / parseFloat(initialBaseAmount);
    }

    const pool = await MemeCoinPool.create({
      memeCoinId: id,
      network: memeCoin.network,
      poolAddress,
      poolId: poolId || null,
      pairToken,
      pairTokenAddress: pairTokenAddress || null,
      initialBaseAmount: initialBaseAmount || null,
      initialPairAmount: initialPairAmount || null,
      initialPrice,
      createTxHash: createTxHash || null,
      providerWalletAddress,
      status: 'active',
      metadata: metadata || null
    });

    logger.info(`Pool registered for ${memeCoin.tokenSymbol} (${memeCoin.network}): pool=${poolAddress} pair=${pairToken}`);

    res.status(201).json(
      new ApiResponse(201, pool, 'Pool registered successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get pools for a meme coin.
 */
const getMemeCoinPools = async (req, res, next) => {
  try {
    const { id } = req.params;

    const pools = await MemeCoinPool.findAll({
      where: { memeCoinId: id },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(
      new ApiResponse(200, { pools }, 'Pools retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all listed meme coins (have an active pool).
 */
const getListedMemeCoins = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      network,
      search,
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query;

    const where = {};
    if (network) where.network = network;
    if (search) {
      where[Op.or] = [
        { tokenName: { [Op.like]: `%${search}%` } },
        { tokenSymbol: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: memeCoins } = await MemeCoin.findAndCountAll({
      where,
      include: [
        {
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        },
        {
          association: 'pools',
          where: { status: 'active' },
          required: true
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    // Enrich with latest price + 24h stats
    const coinIds = memeCoins.map(c => c.id);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [latestTrades, recentTrades] = coinIds.length > 0 ? await Promise.all([
      MemeCoinTrade.findAll({
        attributes: ['memeCoinId', 'pricePerToken', 'priceUsd', 'pairToken', 'tradedAt'],
        where: { memeCoinId: { [Op.in]: coinIds } },
        order: [['tradedAt', 'DESC']]
      }),
      MemeCoinTrade.findAll({
        attributes: [
          'memeCoinId',
          [sequelize.fn('SUM', sequelize.col('volumeUsd')), 'volume24h'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'trades24h']
        ],
        where: {
          memeCoinId: { [Op.in]: coinIds },
          tradedAt: { [Op.gte]: yesterday }
        },
        group: ['memeCoinId'],
        raw: true
      })
    ]) : [[], []];

    const latestByCoin = {};
    for (const t of latestTrades) {
      if (!latestByCoin[t.memeCoinId]) latestByCoin[t.memeCoinId] = t;
    }
    const statsByCoin = {};
    for (const s of recentTrades) {
      statsByCoin[s.memeCoinId] = s;
    }

    const enriched = memeCoins.map(c => {
      const json = c.toJSON();
      const lt = latestByCoin[c.id];
      const st = statsByCoin[c.id];
      return {
        ...json,
        currentPrice: lt ? {
          pricePerToken: lt.pricePerToken,
          priceUsd: lt.priceUsd,
          pairToken: lt.pairToken,
          tradedAt: lt.tradedAt
        } : null,
        stats24h: {
          volumeUsd: st ? parseFloat(st.volume24h) || 0 : 0,
          trades: st ? parseInt(st.trades24h) || 0 : 0
        }
      };
    });

    res.status(200).json(
      new ApiResponse(200, {
        memeCoins: enriched,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      }, 'Listed meme coins retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ==================== TRADES & PRICE HISTORY ====================

/**
 * Record a trade. Frontend calls this after a swap completes on Raydium / XRPL AMM.
 */
const recordTrade = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      poolAddress,
      txHash,
      traderWalletAddress,
      type,
      tokenAmount,
      pairAmount,
      pairToken,
      tradedAt,
      metadata
    } = req.body;

    if (!txHash) throw new ApiError(400, 'txHash is required');
    if (!traderWalletAddress) throw new ApiError(400, 'traderWalletAddress is required');
    if (!type || !['buy', 'sell'].includes(type)) throw new ApiError(400, 'type must be "buy" or "sell"');
    if (!tokenAmount || parseFloat(tokenAmount) <= 0) throw new ApiError(400, 'tokenAmount is required');
    if (!pairAmount || parseFloat(pairAmount) <= 0) throw new ApiError(400, 'pairAmount is required');
    if (!pairToken) throw new ApiError(400, 'pairToken is required');

    const memeCoin = await MemeCoin.findByPk(id);
    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    // Idempotency: skip if this tx is already recorded
    const existing = await MemeCoinTrade.findOne({ where: { txHash } });
    if (existing) {
      return res.status(200).json(
        new ApiResponse(200, existing, 'Trade already recorded')
      );
    }

    // Find the pool if provided
    let pool = null;
    if (poolAddress) {
      pool = await MemeCoinPool.findOne({ where: { poolAddress, memeCoinId: id } });
    }

    const pricePerToken = parseFloat(pairAmount) / parseFloat(tokenAmount);

    // Convert pair amount to USD for cross-chain volume metric
    let priceUsd = null;
    let volumeUsd = null;
    try {
      const prices = await priceService.getPrices();
      const pairUpper = pairToken.toUpperCase();
      let pairUsdRate = null;
      if (pairUpper === 'SOL') pairUsdRate = prices.sol;
      else if (pairUpper === 'XRP') pairUsdRate = prices.xrp;
      else if (pairUpper === 'USDC' || pairUpper === 'USDT' || pairUpper === 'USD') pairUsdRate = 1;

      if (pairUsdRate) {
        priceUsd = pricePerToken * pairUsdRate;
        volumeUsd = parseFloat(pairAmount) * pairUsdRate;
      }
    } catch (error) {
      logger.warn(`Could not compute USD price for trade: ${error.message}`);
    }

    const trade = await MemeCoinTrade.create({
      memeCoinId: id,
      poolId: pool ? pool.id : null,
      network: memeCoin.network,
      txHash,
      traderWalletAddress,
      type,
      tokenAmount,
      pairAmount,
      pairToken,
      pricePerToken,
      priceUsd,
      volumeUsd,
      tradedAt: tradedAt ? new Date(tradedAt) : new Date(),
      metadata: metadata || null
    });

    logger.info(`Trade recorded: ${memeCoin.tokenSymbol} ${type} ${tokenAmount} for ${pairAmount} ${pairToken} (tx: ${txHash})`);

    res.status(201).json(
      new ApiResponse(201, trade, 'Trade recorded successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get trade history for a meme coin (paginated, most recent first).
 */
const getTrades = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, type } = req.query;

    const memeCoin = await MemeCoin.findByPk(id);
    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    const where = { memeCoinId: id };
    if (type) where.type = type;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: trades } = await MemeCoinTrade.findAndCountAll({
      where,
      order: [['tradedAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json(
      new ApiResponse(200, {
        trades,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      }, 'Trades retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get price history for a meme coin (for graph rendering).
 * Returns OHLC candles bucketed by the specified interval.
 *
 * Query params:
 * - interval: '5m' | '15m' | '1h' | '4h' | '1d' (default '1h')
 * - from: ISO date string (default 7 days ago)
 * - to: ISO date string (default now)
 */
const getPriceHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { interval = '1h', from, to } = req.query;

    const memeCoin = await MemeCoin.findByPk(id);
    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    // Parse interval to seconds
    const intervalSeconds = {
      '5m': 5 * 60,
      '15m': 15 * 60,
      '30m': 30 * 60,
      '1h': 60 * 60,
      '4h': 4 * 60 * 60,
      '1d': 24 * 60 * 60
    }[interval] || 60 * 60;

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Group trades by time bucket using FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(tradedAt)/interval)*interval)
    const trades = await sequelize.query(`
      SELECT
        FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(tradedAt) / :intervalSeconds) * :intervalSeconds) AS bucket,
        MIN(pricePerToken) AS low,
        MAX(pricePerToken) AS high,
        SUM(tokenAmount) AS volume,
        SUM(volumeUsd) AS volumeUsd,
        COUNT(id) AS trades,
        SUBSTRING_INDEX(GROUP_CONCAT(pricePerToken ORDER BY tradedAt ASC), ',', 1) AS open,
        SUBSTRING_INDEX(GROUP_CONCAT(pricePerToken ORDER BY tradedAt DESC), ',', 1) AS close
      FROM MemeCoinTrades
      WHERE memeCoinId = :coinId
        AND tradedAt BETWEEN :fromDate AND :toDate
      GROUP BY bucket
      ORDER BY bucket ASC
    `, {
      replacements: {
        coinId: id,
        intervalSeconds,
        fromDate,
        toDate
      },
      type: sequelize.QueryTypes.SELECT
    });

    const candles = trades.map(t => ({
      time: t.bucket,
      open: parseFloat(t.open),
      high: parseFloat(t.high),
      low: parseFloat(t.low),
      close: parseFloat(t.close),
      volume: parseFloat(t.volume),
      volumeUsd: parseFloat(t.volumeUsd) || 0,
      trades: parseInt(t.trades)
    }));

    res.status(200).json(
      new ApiResponse(200, {
        memeCoinId: id,
        interval,
        from: fromDate,
        to: toDate,
        candles
      }, 'Price history retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMemeCoin,
  confirmTrustline,
  confirmMint,
  getMemeCoin,
  getMemeCoins,
  getMyMemeCoins,
  registerPool,
  getMemeCoinPools,
  getListedMemeCoins,
  recordTrade,
  getTrades,
  getPriceHistory
};
