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

    // --- XRPL meme coin ---
    // Step 1: Backend saves record + builds TrustSet tx for user to sign via Xaman
    // Step 2: User signs TrustSet (frontend → Xaman QR)
    // Step 3: Frontend calls /confirm-trustline → backend verifies + issues tokens
    const currencyHex = xrplService.currencyToHex(symbolCleaned);
    const issuerAddress = xrplConfig.getAdminWallet().address;

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
      status: 'pending',
      metadata: {
        createdVia: 'backend',
        originalSymbol: tokenSymbol
      }
    });

    // Build TrustSet transaction for the user to sign via Xaman
    // Do NOT autofill — Xaman handles Sequence, Fee, LastLedgerSequence
    const trustSetTransaction = xrplService.buildTrustSetPayload({
      creatorWallet: walletAddress,
      issuerAddress,
      currencyHex,
      totalSupply: supply
    });

    logger.info(`XRPL MemeCoin created: ${tokenName} (${symbolCleaned}) by ${walletAddress}, id: ${memeCoin.id}`);

    res.status(201).json(
      new ApiResponse(201, {
        id: memeCoin.id,
        tokenName: memeCoin.tokenName,
        tokenSymbol: memeCoin.tokenSymbol,
        network: 'xrpl',
        currencyHex,
        totalSupply: memeCoin.totalSupply,
        decimals: memeCoin.decimals,
        logo: memeCoin.logo,
        description: memeCoin.description,
        issuerWalletAddress: issuerAddress,
        creatorWalletAddress: walletAddress,
        status: 'pending',
        trustSetTransaction,
        instructions: {
          step: 1,
          action: 'Sign this TrustSet transaction with your XRPL wallet (Xaman QR code)',
          nextStep: 'After signing, call POST /api/v1/memecoins/:id/confirm-trustline with { trustSetTxHash }',
          nextEndpoint: `/api/v1/memecoins/${memeCoin.id}/confirm-trustline`
        }
      }, 'Meme coin created. Sign the TrustSet to proceed.')
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

    // Fetch XRPL tokens: account_lines (tokens you HOLD) + gateway_balances (tokens you ISSUED)
    for (const w of xrplWallets) {
      try {
        const client = await xrplConfig.getClientAsync();
        const seenKeys = new Set();

        // 1. Tokens you ISSUED — check gateway_balances for obligations
        try {
          const gwRes = await client.request({
            command: 'gateway_balances',
            account: w.address,
            ledger_index: 'validated'
          });
          const obligations = gwRes.result.obligations || {};

          // Fetch DB metadata for issued tokens
          const issuedCurrencies = Object.keys(obligations);
          const issuedDbCoins = issuedCurrencies.length > 0 ? await MemeCoin.findAll({
            where: {
              network: 'xrpl',
              issuerWalletAddress: w.address,
              currencyHex: { [Op.in]: issuedCurrencies }
            },
            raw: true
          }) : [];
          const issuedDbMap = {};
          issuedDbCoins.forEach(c => { issuedDbMap[c.currencyHex] = c; });

          for (const [currency, amount] of Object.entries(obligations)) {
            let tokenSymbol = currency;
            if (currency.length > 3) {
              try {
                tokenSymbol = Buffer.from(currency, 'hex').toString('utf-8').replace(/\0/g, '');
              } catch (e) {}
            }

            const key = `${currency}_${w.address}`;
            seenKeys.add(key);
            const dbCoin = issuedDbMap[currency];

            allCoins.push({
              network: 'xrpl',
              walletAddress: w.address,
              tokenName: dbCoin?.tokenName || tokenSymbol,
              tokenSymbol,
              description: dbCoin?.description || null,
              image: dbCoin?.logo || null,
              currencyHex: currency,
              issuer: w.address,
              balance: amount,
              isIssuer: true,
              totalSupply: amount,
              decimals: dbCoin?.decimals || null,
              limit: null,
              website: dbCoin?.website || null,
              socialLinks: dbCoin?.socialLinks || null
            });
          }
        } catch (e) {
          logger.warn(`Error fetching gateway_balances for ${w.address}: ${e.message}`);
        }

        // 2. Tokens you HOLD — check account_lines
        const response = await client.request({
          command: 'account_lines',
          account: w.address,
          ledger_index: 'validated'
        });
        const lines = response.result.lines || [];
        const activeLines = lines.filter(l => parseFloat(l.balance) !== 0);

        // Batch fetch metadata from DB
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

        // Fetch total supply for issuers
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
            for (const [cur, amt] of Object.entries(obligations)) {
              issuerSupplyMap[`${cur}_${issuer}`] = amt;
            }
          } catch (e) {}
        }));

        for (const line of activeLines) {
          const key = `${line.currency}_${line.account}`;
          if (seenKeys.has(key)) continue; // Skip if already added as issued token
          seenKeys.add(key);

          let tokenSymbol = line.currency;
          if (line.currency.length > 3) {
            try {
              tokenSymbol = Buffer.from(line.currency, 'hex').toString('utf-8').replace(/\0/g, '');
            } catch (e) {}
          }

          const dbCoin = dbMap[key];
          const totalSupply = issuerSupplyMap[key] || dbCoin?.totalSupply || null;
          const rawBalance = parseFloat(line.balance);

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
            isIssuer: false,
            totalSupply,
            decimals: dbCoin?.decimals || null,
            limit: line.limit,
            website: dbCoin?.website || null,
            socialLinks: dbCoin?.socialLinks || null
          });
        }
      } catch (err) {
        logger.warn(`Error fetching XRPL tokens for ${w.address}: ${err.message}`);
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

    // Check AMM pool status for all XRPL coins
    const xrplCoins = allCoins.filter(c => c.network === 'xrpl');
    await Promise.all(xrplCoins.map(async (coin) => {
      try {
        const ammInfo = await xrplService.getAMMInfo(coin.currencyHex, coin.issuer);
        if (ammInfo) {
          const amm = ammInfo.amm;
          let tokenBalance = '0';
          let xrpBalance = '0';
          if (typeof amm.amount === 'string') xrpBalance = amm.amount;
          else if (amm.amount?.value) tokenBalance = amm.amount.value;
          if (typeof amm.amount2 === 'string') xrpBalance = amm.amount2;
          else if (amm.amount2?.value) tokenBalance = amm.amount2.value;

          coin.hasPool = true;
          coin.poolAddress = amm.account;
          coin.tradingFee = amm.trading_fee;
          coin.poolTokenBalance = tokenBalance;
          coin.poolXrpBalance = (parseFloat(xrpBalance) / 1000000).toFixed(6);
          coin.currentPrice = parseFloat(tokenBalance) > 0
            ? (parseFloat(xrpBalance) / 1000000) / parseFloat(tokenBalance)
            : null;
        } else {
          coin.hasPool = false;
        }
      } catch (e) {
        coin.hasPool = false;
      }
    }));

    // For Solana coins, hasPool = false for now (Raydium pools checked separately)
    allCoins.filter(c => c.network === 'solana').forEach(c => { c.hasPool = false; });

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

    // Enrich XRPL coins with live AMM pool data from on-chain
    await Promise.all(enriched.filter(c => c.network === 'xrpl' && c.currencyHex && c.issuerWalletAddress).map(async (coin) => {
      try {
        const ammInfo = await xrplService.getAMMInfo(coin.currencyHex, coin.issuerWalletAddress);
        if (ammInfo) {
          const amm = ammInfo.amm;
          let tokenBalance = '0';
          let xrpBalance = '0';
          if (typeof amm.amount === 'string') xrpBalance = amm.amount;
          else if (amm.amount?.value) tokenBalance = amm.amount.value;
          if (typeof amm.amount2 === 'string') xrpBalance = amm.amount2;
          else if (amm.amount2?.value) tokenBalance = amm.amount2.value;

          coin.livePool = {
            poolAddress: amm.account,
            tradingFee: amm.trading_fee,
            tokenBalance,
            xrpBalance: (parseFloat(xrpBalance) / 1000000).toFixed(6),
            currentPrice: parseFloat(tokenBalance) > 0
              ? (parseFloat(xrpBalance) / 1000000) / parseFloat(tokenBalance)
              : null,
            lpToken: amm.lp_token
          };
        }
      } catch (e) {}
    }));

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
 * Helper: find a meme coin by on-chain identifiers or DB ID.
 * Accepts id, or currencyHex+issuerWalletAddress (XRPL), or mintAddress (Solana).
 */
const findMemeCoinByIdentifier = async (query) => {
  const { id, currencyHex, issuerWalletAddress, mintAddress, tokenSymbol } = query;

  // By DB ID
  if (id && id.length === 36) {
    return MemeCoin.findByPk(id);
  }

  // By Solana mint address
  if (mintAddress) {
    return MemeCoin.findOne({ where: { mintAddress, network: 'solana' } });
  }

  // By XRPL currency + issuer
  const resolvedHex = currencyHex || (tokenSymbol ? xrplService.currencyToHex(tokenSymbol) : null);
  if (resolvedHex && issuerWalletAddress) {
    return MemeCoin.findOne({ where: { currencyHex: resolvedHex, issuerWalletAddress, network: 'xrpl' } });
  }

  return null;
};

/**
 * Get trade history for a meme coin (paginated, most recent first).
 * Accepts DB id, or query params: currencyHex+issuerWalletAddress, or mintAddress
 */
const getTrades = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, type, currencyHex, issuerWalletAddress, mintAddress, tokenSymbol } = req.query;

    const memeCoin = await findMemeCoinByIdentifier({ id, currencyHex, issuerWalletAddress, mintAddress, tokenSymbol });
    if (!memeCoin) {
      throw new ApiError(404, 'Meme coin not found');
    }

    const where = { memeCoinId: memeCoin.id };
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
    const { interval = '1h', from, to, currencyHex, issuerWalletAddress, mintAddress, tokenSymbol } = req.query;

    const memeCoin = await findMemeCoinByIdentifier({ id, currencyHex, issuerWalletAddress, mintAddress, tokenSymbol });
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
        coinId: memeCoin.id,
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
        memeCoinId: memeCoin.id,
        tokenName: memeCoin.tokenName,
        tokenSymbol: memeCoin.tokenSymbol,
        network: memeCoin.network,
        interval,
        from: fromDate,
        to: toDate,
        totalCandles: candles.length,
        candles
      }, 'Price history retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ==================== XRPL AMM (Liquidity Pool) ====================

/**
 * Step 1: Build an AMMCreate transaction for the user to sign via Xaman.
 * Uses on-chain token identifiers directly — no DB lookup needed.
 */
// ==================== SWAP (Buy / Sell) ====================

/**
 * Build a buy transaction: spend XRP to get meme coins.
 * Returns unsigned tx for Xaman signing.
 */
const buildBuyToken = async (req, res, next) => {
  try {
    const {
      walletAddress,
      currencyHex,
      issuerWalletAddress,
      tokenSymbol,
      tokenAmount,
      maxXrpDrops,
      slippagePercent = 5
    } = req.body;

    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');
    if (!tokenAmount) throw new ApiError(400, 'tokenAmount is required (meme coins to buy)');
    if (!issuerWalletAddress) throw new ApiError(400, 'issuerWalletAddress is required');

    const resolvedHex = currencyHex || (tokenSymbol ? xrplService.currencyToHex(tokenSymbol) : null);
    if (!resolvedHex) throw new ApiError(400, 'currencyHex or tokenSymbol is required');

    // Check if buyer has a TrustLine for this token
    let needsTrustLine = true;
    try {
      const client = await xrplConfig.getClientAsync();
      const response = await client.request({
        command: 'account_lines',
        account: walletAddress,
        peer: issuerWalletAddress,
        ledger_index: 'validated'
      });
      const lines = response.result.lines || [];
      needsTrustLine = !lines.some(l => l.currency === resolvedHex);
    } catch (e) {
      // If account not found or error, they definitely need a trustline
      needsTrustLine = true;
    }

    // Build TrustSet transaction if needed
    let trustSetTransaction = null;
    if (needsTrustLine) {
      trustSetTransaction = xrplService.buildTrustSetPayload({
        creatorWallet: walletAddress,
        issuerAddress: issuerWalletAddress,
        currencyHex: resolvedHex,
        totalSupply: '1000000000000000' // large limit
      });
    }

    // If maxXrpDrops not provided, estimate from AMM and add slippage
    let resolvedMaxXrp = maxXrpDrops;
    if (!resolvedMaxXrp) {
      const ammInfo = await xrplService.getAMMInfo(resolvedHex, issuerWalletAddress);
      if (!ammInfo) throw new ApiError(400, 'No AMM pool found for this token');

      const amm = ammInfo.amm;
      let tokenBalance = '0';
      let xrpBalance = '0';
      if (typeof amm.amount === 'string') xrpBalance = amm.amount;
      else if (amm.amount?.value) tokenBalance = amm.amount.value;
      if (typeof amm.amount2 === 'string') xrpBalance = amm.amount2;
      else if (amm.amount2?.value) tokenBalance = amm.amount2.value;

      const pricePerToken = parseFloat(tokenBalance) > 0
        ? parseFloat(xrpBalance) / parseFloat(tokenBalance)
        : 0;
      const estimatedXrp = pricePerToken * parseFloat(tokenAmount);
      const slippage = 1 + (parseFloat(slippagePercent) / 100);
      resolvedMaxXrp = Math.ceil(estimatedXrp * slippage).toString();
    }

    const buyTx = xrplService.buildBuyTokenPayload({
      account: walletAddress,
      currencyHex: resolvedHex,
      issuerAddress: issuerWalletAddress,
      tokenAmount,
      maxXrpDrops: resolvedMaxXrp
    });

    const estimatedPriceXrp = (parseInt(resolvedMaxXrp) / 1000000).toFixed(6);

    res.status(200).json(
      new ApiResponse(200, {
        needsTrustLine,
        trustSetTransaction,
        transaction: buyTx,
        estimate: {
          tokenAmount,
          maxXrpDrops: resolvedMaxXrp,
          maxXrp: estimatedPriceXrp,
          slippagePercent: parseFloat(slippagePercent)
        },
        instructions: needsTrustLine ? {
          step: 1,
          action: 'Sign the TrustSet transaction first to allow receiving this token',
          step2: 'Then sign the buy transaction',
          nextStep: 'After both are signed, call POST /api/v1/memecoins/confirm-swap with the buy tx hash',
          nextEndpoint: '/api/v1/memecoins/confirm-swap'
        } : {
          action: 'Sign this transaction with Xaman to buy tokens',
          nextStep: 'After signing, call POST /api/v1/memecoins/confirm-swap with the tx hash',
          nextEndpoint: '/api/v1/memecoins/confirm-swap'
        }
      }, needsTrustLine
        ? 'TrustLine required. Sign the TrustSet first, then the buy transaction.'
        : 'Buy transaction ready. Sign with Xaman.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Build a sell transaction: sell meme coins for XRP.
 * Returns unsigned tx for Xaman signing.
 */
const buildSellToken = async (req, res, next) => {
  try {
    const {
      walletAddress,
      currencyHex,
      issuerWalletAddress,
      tokenSymbol,
      tokenAmount,
      minXrpDrops,
      slippagePercent = 5
    } = req.body;

    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');
    if (!tokenAmount) throw new ApiError(400, 'tokenAmount is required (meme coins to sell)');
    if (!issuerWalletAddress) throw new ApiError(400, 'issuerWalletAddress is required');

    const resolvedHex = currencyHex || (tokenSymbol ? xrplService.currencyToHex(tokenSymbol) : null);
    if (!resolvedHex) throw new ApiError(400, 'currencyHex or tokenSymbol is required');

    // If minXrpDrops not provided, estimate from AMM and subtract slippage
    let resolvedMinXrp = minXrpDrops;
    if (!resolvedMinXrp) {
      const ammInfo = await xrplService.getAMMInfo(resolvedHex, issuerWalletAddress);
      if (!ammInfo) throw new ApiError(400, 'No AMM pool found for this token');

      const amm = ammInfo.amm;
      let tokenBalance = '0';
      let xrpBalance = '0';
      if (typeof amm.amount === 'string') xrpBalance = amm.amount;
      else if (amm.amount?.value) tokenBalance = amm.amount.value;
      if (typeof amm.amount2 === 'string') xrpBalance = amm.amount2;
      else if (amm.amount2?.value) tokenBalance = amm.amount2.value;

      const pricePerToken = parseFloat(tokenBalance) > 0
        ? parseFloat(xrpBalance) / parseFloat(tokenBalance)
        : 0;
      const estimatedXrp = pricePerToken * parseFloat(tokenAmount);
      const slippage = 1 - (parseFloat(slippagePercent) / 100);
      resolvedMinXrp = Math.floor(estimatedXrp * slippage).toString();
    }

    const sellTx = xrplService.buildSellTokenPayload({
      account: walletAddress,
      currencyHex: resolvedHex,
      issuerAddress: issuerWalletAddress,
      tokenAmount,
      minXrpDrops: resolvedMinXrp
    });

    const estimatedPriceXrp = (parseInt(resolvedMinXrp) / 1000000).toFixed(6);

    res.status(200).json(
      new ApiResponse(200, {
        transaction: sellTx,
        estimate: {
          tokenAmount,
          minXrpDrops: resolvedMinXrp,
          minXrp: estimatedPriceXrp,
          slippagePercent: parseFloat(slippagePercent)
        },
        instructions: {
          action: 'Sign this transaction with Xaman to sell tokens',
          nextStep: 'After signing, call POST /api/v1/memecoins/confirm-swap with the tx hash',
          nextEndpoint: '/api/v1/memecoins/confirm-swap'
        }
      }, 'Sell transaction ready. Sign with Xaman.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm a swap (buy or sell). Verifies on-chain, records as a trade for price history.
 */
const confirmSwap = async (req, res, next) => {
  try {
    const {
      txHash,
      walletAddress,
      currencyHex,
      issuerWalletAddress,
      tokenSymbol,
      type
    } = req.body;

    if (!txHash) throw new ApiError(400, 'txHash is required');
    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');
    if (!issuerWalletAddress) throw new ApiError(400, 'issuerWalletAddress is required');
    if (!type || !['buy', 'sell'].includes(type)) throw new ApiError(400, 'type must be "buy" or "sell"');

    const resolvedHex = currencyHex || (tokenSymbol ? xrplService.currencyToHex(tokenSymbol) : null);
    if (!resolvedHex) throw new ApiError(400, 'currencyHex or tokenSymbol is required');

    // Verify on-chain
    const client = xrplConfig.getClient();
    const txResponse = await client.request({ command: 'tx', transaction: txHash });
    const tx = txResponse.result;

    const meta = tx.meta || tx.metaData;
    if (meta && meta.TransactionResult !== 'tesSUCCESS') {
      throw new ApiError(400, `Transaction failed: ${meta.TransactionResult}`);
    }

    // Parse the actual delivered amounts from metadata
    let tokenAmount = '0';
    let xrpAmount = '0';

    // Method 1: delivered_amount (most reliable for partial payments)
    if (meta?.delivered_amount) {
      if (typeof meta.delivered_amount === 'string') {
        xrpAmount = meta.delivered_amount;
      } else if (meta.delivered_amount?.value) {
        tokenAmount = meta.delivered_amount.value;
      }
    }

    // Method 2: Parse balance changes from AffectedNodes (for AMM swaps)
    if (meta?.AffectedNodes) {
      for (const node of meta.AffectedNodes) {
        const modified = node.ModifiedNode;
        if (!modified || modified.LedgerEntryType !== 'RippleState') continue;

        const prev = modified.PreviousFields;
        const final = modified.FinalFields;
        if (!prev?.Balance || !final?.Balance) continue;

        // Check if this is our token's trustline
        if (final.Balance.currency === resolvedHex) {
          // Check if this line involves our trader's wallet
          const lowLimit = final.LowLimit?.issuer;
          const highLimit = final.HighLimit?.issuer;
          if (lowLimit === walletAddress || highLimit === walletAddress) {
            const prevBal = parseFloat(prev.Balance.value || '0');
            const finalBal = parseFloat(final.Balance.value || '0');
            const change = Math.abs(finalBal - prevBal);
            if (change > 0) {
              tokenAmount = change.toString();
            }
          }
        }
      }

      // Parse XRP changes from AccountRoot modifications
      if (xrpAmount === '0') {
        for (const node of meta.AffectedNodes) {
          const modified = node.ModifiedNode;
          if (!modified || modified.LedgerEntryType !== 'AccountRoot') continue;

          const final = modified.FinalFields;
          const prev = modified.PreviousFields;
          if (final?.Account !== walletAddress) continue;
          if (!prev?.Balance || !final?.Balance) continue;

          const prevBal = parseInt(prev.Balance) || 0;
          const finalBal = parseInt(final.Balance) || 0;
          const change = Math.abs(finalBal - prevBal);
          // Subtract the fee to get net XRP moved
          const fee = parseInt(tx.Fee || '0');
          if (change > fee) {
            xrpAmount = (change - fee).toString();
          }
        }
      }
    }

    const parsedTokenAmount = parseFloat(tokenAmount) || 0;
    const parsedXrpAmount = parseFloat(xrpAmount) || 0;
    const pricePerToken = parsedTokenAmount > 0
      ? parsedXrpAmount / parsedTokenAmount
      : 0;

    // Find or create meme coin record for trade association
    let memeCoin = await MemeCoin.findOne({
      where: { currencyHex: resolvedHex, issuerWalletAddress, network: 'xrpl' }
    });

    if (!memeCoin) {
      let sym = resolvedHex;
      try { sym = Buffer.from(resolvedHex, 'hex').toString('utf-8').replace(/\0/g, ''); } catch (e) {}

      memeCoin = await MemeCoin.create({
        tokenName: tokenSymbol || sym,
        tokenSymbol: tokenSymbol || sym,
        network: 'xrpl',
        currencyHex: resolvedHex,
        issuerWalletAddress,
        creatorWalletAddress: walletAddress,
        status: 'issued',
        metadata: { createdVia: 'swap-confirm' }
      });
    }

    // Record the trade (idempotent)
    const existingTrade = await MemeCoinTrade.findOne({ where: { txHash } });
    if (existingTrade) {
      return res.status(200).json(
        new ApiResponse(200, existingTrade, 'Trade already recorded')
      );
    }

    // Get USD price
    let priceUsd = null;
    let volumeUsd = null;
    try {
      const prices = await priceService.getPrices();
      const xrpInNormalUnits = parsedXrpAmount / 1000000;
      priceUsd = parsedTokenAmount > 0 ? (xrpInNormalUnits / parsedTokenAmount) * prices.xrp : null;
      volumeUsd = xrpInNormalUnits * prices.xrp;
    } catch (e) {}

    // Find pool
    const pool = await MemeCoinPool.findOne({ where: { memeCoinId: memeCoin.id, status: 'active' } });

    const trade = await MemeCoinTrade.create({
      memeCoinId: memeCoin.id,
      poolId: pool?.id || null,
      network: 'xrpl',
      txHash,
      traderWalletAddress: walletAddress,
      type,
      tokenAmount: parsedTokenAmount.toString(),
      pairAmount: (parsedXrpAmount / 1000000).toString(),
      pairToken: 'XRP',
      pricePerToken: pricePerToken / 1000000,
      priceUsd,
      volumeUsd,
      tradedAt: new Date()
    });

    logger.info(`Swap confirmed: ${type} ${parsedTokenAmount} ${memeCoin.tokenSymbol} for ${(parsedXrpAmount / 1000000).toFixed(6)} XRP (tx: ${txHash})`);

    res.status(201).json(
      new ApiResponse(201, {
        trade,
        summary: {
          type,
          tokenAmount: parsedTokenAmount.toString(),
          xrpAmount: (parsedXrpAmount / 1000000).toFixed(6) + ' XRP',
          pricePerToken: (pricePerToken / 1000000).toFixed(12),
          priceUsd,
          volumeUsd
        }
      }, `${type === 'buy' ? 'Buy' : 'Sell'} confirmed and recorded`)
    );
  } catch (error) {
    next(error);
  }
};

const buildAMMCreate = async (req, res, next) => {
  try {
    const {
      walletAddress,
      tokenSymbol,
      currencyHex,
      issuerWalletAddress,
      tokenAmount,
      xrpAmount,
      tradingFee = 500
    } = req.body;

    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');
    if (!tokenAmount) throw new ApiError(400, 'tokenAmount is required (meme coins to deposit)');
    if (!xrpAmount) throw new ApiError(400, 'xrpAmount is required (XRP in drops to deposit)');
    if (!issuerWalletAddress) throw new ApiError(400, 'issuerWalletAddress is required');

    // Resolve currency hex from symbol if not provided
    const resolvedCurrencyHex = currencyHex || (tokenSymbol ? xrplService.currencyToHex(tokenSymbol) : null);
    if (!resolvedCurrencyHex) throw new ApiError(400, 'currencyHex or tokenSymbol is required');

    const fee = parseInt(tradingFee);
    if (isNaN(fee) || fee < 0 || fee > 1000) {
      throw new ApiError(400, 'tradingFee must be 0-1000 (basis points, e.g. 500 = 0.5%)');
    }

    const ammCreateTx = xrplService.buildAMMCreatePayload({
      account: walletAddress,
      currencyHex: resolvedCurrencyHex,
      issuerAddress: issuerWalletAddress,
      tokenAmount,
      xrpAmount,
      tradingFee: fee
    });

    logger.info(`AMMCreate tx built for ${resolvedCurrencyHex}: ${tokenAmount} tokens + ${xrpAmount} drops XRP by ${walletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        currencyHex: resolvedCurrencyHex,
        issuerWalletAddress,
        ammCreateTransaction: ammCreateTx,
        instructions: {
          step: 1,
          action: 'Sign this AMMCreate transaction with your XRPL wallet (Xaman QR code)',
          nextStep: 'After signing, call POST /api/v1/memecoins/confirm-amm with { ammCreateTxHash, currencyHex, issuerWalletAddress, walletAddress }',
          nextEndpoint: '/api/v1/memecoins/confirm-amm',
          note: `This will create a liquidity pool with ${tokenAmount} tokens and ${(parseInt(xrpAmount) / 1000000).toFixed(6)} XRP`
        }
      }, 'AMMCreate transaction ready. Sign with Xaman to create the liquidity pool.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Step 2: Confirm AMMCreate was signed. Verify on-chain + register the pool in DB.
 */
const confirmAMMCreate = async (req, res, next) => {
  try {
    const {
      ammCreateTxHash,
      walletAddress,
      currencyHex,
      issuerWalletAddress,
      tokenSymbol
    } = req.body;

    if (!ammCreateTxHash) throw new ApiError(400, 'ammCreateTxHash is required');
    if (!walletAddress) throw new ApiError(400, 'walletAddress is required');
    if (!issuerWalletAddress) throw new ApiError(400, 'issuerWalletAddress is required');

    const resolvedCurrencyHex = currencyHex || (tokenSymbol ? xrplService.currencyToHex(tokenSymbol) : null);
    if (!resolvedCurrencyHex) throw new ApiError(400, 'currencyHex or tokenSymbol is required');

    // Verify the AMMCreate transaction on-chain
    let ammInfo = null;
    try {
      const client = xrplConfig.getClient();
      const txResponse = await client.request({
        command: 'tx',
        transaction: ammCreateTxHash
      });

      const tx = txResponse.result;
      if (tx.TransactionType !== 'AMMCreate') {
        throw new ApiError(400, 'Transaction is not an AMMCreate');
      }

      const meta = tx.meta || tx.metaData;
      if (meta && meta.TransactionResult !== 'tesSUCCESS') {
        throw new ApiError(400, `AMMCreate failed: ${meta.TransactionResult}`);
      }

      ammInfo = await xrplService.getAMMInfo(resolvedCurrencyHex, issuerWalletAddress);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error verifying AMMCreate:', error);
      throw new ApiError(400, 'Could not verify the AMMCreate transaction on XRPL');
    }

    if (!ammInfo) {
      throw new ApiError(400, 'AMM pool not found on-chain after creation');
    }

    const amm = ammInfo.amm;
    const poolAddress = amm.account;
    const tradingFee = amm.trading_fee;

    let tokenBalance = '0';
    let xrpBalance = '0';
    if (typeof amm.amount === 'string') {
      xrpBalance = amm.amount;
    } else if (amm.amount?.value) {
      tokenBalance = amm.amount.value;
    }
    if (typeof amm.amount2 === 'string') {
      xrpBalance = amm.amount2;
    } else if (amm.amount2?.value) {
      tokenBalance = amm.amount2.value;
    }

    const initialPrice = parseFloat(tokenBalance) > 0
      ? (parseFloat(xrpBalance) / 1000000) / parseFloat(tokenBalance)
      : null;

    // Find or create the meme coin in DB for pool association
    let memeCoin = await MemeCoin.findOne({
      where: { currencyHex: resolvedCurrencyHex, issuerWalletAddress, network: 'xrpl' }
    });

    if (!memeCoin) {
      let sym = resolvedCurrencyHex;
      try {
        sym = Buffer.from(resolvedCurrencyHex, 'hex').toString('utf-8').replace(/\0/g, '');
      } catch (e) {}

      memeCoin = await MemeCoin.create({
        tokenName: tokenSymbol || sym,
        tokenSymbol: tokenSymbol || sym,
        network: 'xrpl',
        currencyHex: resolvedCurrencyHex,
        issuerWalletAddress,
        creatorWalletAddress: walletAddress,
        totalSupply: tokenBalance,
        status: 'issued',
        metadata: { createdVia: 'amm-confirm' }
      });
    }

    // Check duplicate pool
    const existingPool = await MemeCoinPool.findOne({ where: { poolAddress, memeCoinId: memeCoin.id } });
    if (existingPool) {
      return res.status(200).json(
        new ApiResponse(200, { pool: existingPool, ammInfo: { poolAddress, tradingFee, tokenBalance, xrpBalance: (parseFloat(xrpBalance) / 1000000).toFixed(6) + ' XRP', initialPrice } }, 'Pool already registered')
      );
    }

    const pool = await MemeCoinPool.create({
      memeCoinId: memeCoin.id,
      network: 'xrpl',
      poolAddress,
      pairToken: 'XRP',
      initialBaseAmount: tokenBalance,
      initialPairAmount: parseFloat(xrpBalance) / 1000000,
      initialPrice,
      createTxHash: ammCreateTxHash,
      providerWalletAddress: walletAddress,
      status: 'active',
      metadata: { tradingFee, lpToken: amm.lp_token }
    });

    logger.info(`AMM pool registered: ${resolvedCurrencyHex}/XRP pool=${poolAddress} by ${walletAddress}`);

    res.status(201).json(
      new ApiResponse(201, {
        pool,
        ammInfo: {
          poolAddress,
          tradingFee,
          tokenBalance,
          xrpBalance: (parseFloat(xrpBalance) / 1000000).toFixed(6) + ' XRP',
          initialPrice: initialPrice ? initialPrice.toFixed(12) : null,
          lpToken: amm.lp_token
        }
      }, 'Liquidity pool created and registered successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get on-chain AMM pool info for a token pair (live data from XRPL).
 * Uses query params instead of DB ID.
 */
const getAMMInfo = async (req, res, next) => {
  try {
    const { currencyHex, issuerWalletAddress, tokenSymbol } = req.query;

    if (!issuerWalletAddress) throw new ApiError(400, 'issuerWalletAddress query param is required');

    const resolvedCurrencyHex = currencyHex || (tokenSymbol ? xrplService.currencyToHex(tokenSymbol) : null);
    if (!resolvedCurrencyHex) throw new ApiError(400, 'currencyHex or tokenSymbol query param is required');

    const ammInfo = await xrplService.getAMMInfo(resolvedCurrencyHex, issuerWalletAddress);

    if (!ammInfo) {
      return res.status(200).json(
        new ApiResponse(200, { hasPool: false }, 'No AMM pool exists for this token')
      );
    }

    const amm = ammInfo.amm;
    let tokenBalance = '0';
    let xrpBalance = '0';
    if (typeof amm.amount === 'string') {
      xrpBalance = amm.amount;
    } else if (amm.amount?.value) {
      tokenBalance = amm.amount.value;
    }
    if (typeof amm.amount2 === 'string') {
      xrpBalance = amm.amount2;
    } else if (amm.amount2?.value) {
      tokenBalance = amm.amount2.value;
    }

    const currentPrice = parseFloat(tokenBalance) > 0
      ? (parseFloat(xrpBalance) / 1000000) / parseFloat(tokenBalance)
      : null;

    res.status(200).json(
      new ApiResponse(200, {
        hasPool: true,
        poolAddress: amm.account,
        tradingFee: amm.trading_fee,
        tokenBalance,
        xrpBalance: (parseFloat(xrpBalance) / 1000000).toFixed(6),
        currentPrice,
        lpToken: amm.lp_token
      }, 'AMM pool info retrieved successfully')
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
  getPriceHistory,
  buildBuyToken,
  buildSellToken,
  confirmSwap,
  buildAMMCreate,
  confirmAMMCreate,
  getAMMInfo
};
