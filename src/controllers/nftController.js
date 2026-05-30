const xrplService = require('../services/xrplService');
const bithompService = require('../services/bithompService');
const solanaService = require('../services/solanaService');
const { User, Collection, NftBoost } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const {
  getActiveSubscriptionsForWallets,
  enrichItemsWithSubscriptions
} = require('../utils/userHelpers');

/**
 * Get single NFT detail with sale info and transaction history
 * @route GET /api/v1/nfts/:nftTokenId
 */
exports.getNFTDetail = async (req, res) => {
  try {
    const { nftTokenId } = req.params;
    const { wallet, network } = req.query;

    // --- Solana NFT: use Helius DAS API ---
    if (network === 'solana') {
      if (!solanaService.isValidAddress(nftTokenId)) {
        return res.status(400).json({ success: false, message: 'Invalid Solana mint address' });
      }

      const asset = await solanaService.getAsset(nftTokenId);
      if (!asset) {
        return res.status(404).json({ success: false, message: 'NFT not found' });
      }

      // Look up owner and collection in DB
      const ownerAddress = asset.ownership?.owner;
      const collectionAddress = asset.grouping?.find(g => g.group_key === 'collection')?.group_value;
      const [ownerUser, collection] = await Promise.all([
        ownerAddress ? User.findOne({ where: { walletAddress: ownerAddress }, attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'] }) : null,
        collectionAddress ? Collection.findOne({ where: { mintAddress: collectionAddress, network: 'solana' }, include: [{ association: 'creator', attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'] }] }) : null
      ]);

      return res.status(200).json(new ApiResponse(200, {
        nftTokenId,
        network: 'solana',
        title: asset.content?.metadata?.name || null,
        description: asset.content?.metadata?.description || null,
        image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
        attributes: asset.content?.metadata?.attributes || [],
        owner: ownerUser ? ownerUser.toJSON() : (ownerAddress ? { walletAddress: ownerAddress } : null),
        collection: collection ? collection.toJSON() : (collectionAddress ? { mintAddress: collectionAddress } : null),
        royalty: asset.royalty || null,
        compressed: asset.compression?.compressed || false,
        mintAddress: nftTokenId,
        raw: asset
      }, 'Solana NFT detail retrieved successfully'));
    }

    // --- XRPL NFT (existing logic) ---

    // Step 1: Get NFT sell offers to find current owner and sale info
    const sellOffers = await xrplService.getNFTSellOffers(nftTokenId);
    const buyOffers = await xrplService.getNFTBuyOffers(nftTokenId);

    // Find the owner address from sell offers, wallet parameter, or buy offers
    let ownerAddress = null;
    let currentSellOffer = null;

    if (sellOffers.length > 0) {
      // If there are sell offers, the owner is in the offer
      currentSellOffer = sellOffers[0]; // Get the first/best offer
      ownerAddress = currentSellOffer.owner;
    } else if (wallet) {
      // Use provided wallet parameter if no sell offers
      ownerAddress = wallet;
    } else if (buyOffers.length > 0) {
      // If only buy offers exist, we need to get the owner from the offer
      ownerAddress = buyOffers[0].owner;
    }

    // If we still don't have owner, return helpful error
    if (!ownerAddress) {
      return res.status(400).json({
        success: false,
        message: 'Could not determine NFT owner. Please provide wallet address as query parameter: ?wallet=YOUR_WALLET_ADDRESS'
      });
    }

    // Step 2: Get the actual NFT data from the owner's account
    const accountNFTs = await xrplService.getAccountNFTs(ownerAddress);
    const nftData = accountNFTs.find(nft => nft.NFTokenID === nftTokenId);

    if (!nftData) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found in owner account'
      });
    }

    // Step 3: Fetch NFT metadata for title, description, and image
    let nftTitle = null;
    let nftDescription = null;
    let nftImage = null;

    try {
      const metadata = await xrplService.fetchNFTMetadata(nftData.URI);
      if (metadata) {
        // Extract title from metadata
        nftTitle = metadata.name || null;

        // Extract description from metadata
        nftDescription = metadata.description || null;

        // Extract image URL
        const imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;
        if (imageUrl) {
          nftImage = imageUrl;
        }

        logger.info(`NFT metadata fetched - Title: ${nftTitle}, Image: ${nftImage ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      logger.warn(`Could not fetch metadata for NFT ${nftTokenId}:`, error.message);
    }

    // Step 4: Get owner, issuer, and collection information from database
    const [ownerUser, issuerUser, collection] = await Promise.all([
      User.findOne({
        where: { walletAddress: ownerAddress },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
      }),
      User.findOne({
        where: { walletAddress: nftData.Issuer },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }),
      Collection.findOne({
        where: {
          taxon: nftData.NFTokenTaxon,
          creatorWalletAddress: nftData.Issuer
        },
        attributes: ['id', 'name', 'slug', 'description', 'image', 'bannerImage', 'taxon', 'category', 'floorPrice', 'totalVolume', 'isVerified'],
        include: [{
          association: 'creator',
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }]
      })
    ]);

    // Fetch subscription plans for all relevant users
    const walletAddresses = [
      ownerAddress,
      nftData.Issuer,
      collection?.creator?.walletAddress
    ].filter(Boolean);
    const subscriptionMap = await getActiveSubscriptionsForWallets(walletAddresses);

    // Step 4: Get transaction history for this NFT using Bithomp API
    let transactionHistory = [];
    let bithompData = null;
    try {
      bithompData = await bithompService.getNFTHistory(nftTokenId);
      // Extract history array from Bithomp response
      transactionHistory = bithompData?.history || [];
    } catch (historyError) {
      logger.warn(`Could not fetch NFT history from Bithomp: ${historyError.message}`);
      // Continue without history if Bithomp fails
    }

    // Step 5: Calculate stats from transaction history (Bithomp uses ownership changes, not sales)
    const sales = Array.isArray(transactionHistory) ? transactionHistory : [];
    const totalVolume = sales.reduce((sum, sale) => {
      const amount = typeof sale.amount === 'string'
        ? parseInt(sale.amount)
        : sale.amount;
      return sum + (amount || 0);
    }, 0);

    const lastSale = sales.length > 0 ? sales[0] : null;

    // Step 6: Check if NFT has an active boost
    const activeBoost = await NftBoost.findOne({
      where: {
        nftTokenId: nftTokenId,
        isActive: true,
        endDate: { [Op.gt]: new Date() }
      }
    });
    const isBoosted = !!activeBoost;

    // Step 7: Format the response
    const nftDetail = {
      nftTokenId: nftData.NFTokenID,
      title: nftTitle,
      description: nftDescription,
      image: nftImage,
      uri: nftData.URI,
      taxon: nftData.NFTokenTaxon,
      flags: nftData.Flags,
      transferFee: nftData.TransferFee,
      issuer: nftData.Issuer,
      issuerInfo: issuerUser ? {
        walletAddress: issuerUser.walletAddress,
        username: issuerUser.username,
        profileImage: issuerUser.profileImage,
        isVerified: issuerUser.isVerified,
        subscriptionPlan: subscriptionMap[issuerUser.walletAddress] || 'free'
      } : null,
      collection: collection ? {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        image: collection.image,
        bannerImage: collection.bannerImage,
        taxon: collection.taxon,
        category: collection.category,
        floorPrice: collection.floorPrice,
        totalVolume: collection.totalVolume,
        isVerified: collection.isVerified,
        creator: collection.creator ? {
          walletAddress: collection.creator.walletAddress,
          username: collection.creator.username,
          profileImage: collection.creator.profileImage,
          isVerified: collection.creator.isVerified,
          subscriptionPlan: subscriptionMap[collection.creator.walletAddress] || 'free'
        } : null
      } : null,
      owner: ownerAddress,
      ownerInfo: ownerUser ? {
        walletAddress: ownerUser.walletAddress,
        username: ownerUser.username,
        profileImage: ownerUser.profileImage,
        isVerified: ownerUser.isVerified,
        bio: ownerUser.bio,
        subscriptionPlan: subscriptionMap[ownerUser.walletAddress] || 'free'
      } : null,

      // Sale information
      saleInfo: {
        isOnSale: sellOffers.length > 0,
        currentPrice: currentSellOffer ? currentSellOffer.amount : null,
        sellOffers: sellOffers.map(offer => ({
          offerId: offer.nft_offer_index,
          amount: offer.amount,
          owner: offer.owner,
          destination: offer.destination || null,
          expiration: offer.expiration || null
        })),
        buyOffers: buyOffers.map(offer => ({
          offerId: offer.nft_offer_index,
          amount: offer.amount,
          owner: offer.owner
        }))
      },

      // Statistics
      stats: {
        totalSales: sales.length,
        totalVolume: totalVolume,
        lastSalePrice: lastSale ? lastSale.amount : null,
        lastSaleDate: lastSale ? lastSale.date : null
      },

      // Transaction history (ownership changes from Bithomp)
      history: Array.isArray(transactionHistory) ? transactionHistory.map(h => ({
        owner: h.owner,
        changedAt: h.changedAt,
        date: h.date,
        ledgerIndex: h.ledgerIndex,
        txHash: h.txHash,
        marketplace: h.marketplace
      })) : [],

      // Boost status
      isBoosted: isBoosted
    };

    res.json({
      success: true,
      data: nftDetail
    });

  } catch (error) {
    logger.error('Error fetching NFT detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFT details',
      error: error.message
    });
  }
};

/**
 * Get NFT offers (both buy and sell)
 * @route GET /api/v1/nfts/:nftTokenId/offers
 */
exports.getNFTOffers = async (req, res) => {
  try {
    const { nftTokenId } = req.params;

    const [sellOffers, buyOffers] = await Promise.all([
      xrplService.getNFTSellOffers(nftTokenId),
      xrplService.getNFTBuyOffers(nftTokenId)
    ]);

    res.json({
      success: true,
      data: {
        sellOffers: sellOffers.map(offer => ({
          offerId: offer.nft_offer_index,
          amount: offer.amount,
          owner: offer.owner,
          destination: offer.destination || null,
          expiration: offer.expiration || null
        })),
        buyOffers: buyOffers.map(offer => ({
          offerId: offer.nft_offer_index,
          amount: offer.amount,
          owner: offer.owner
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching NFT offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFT offers',
      error: error.message
    });
  }
};

/**
 * Get NFT transaction history using Bithomp API
 * @route GET /api/v1/nfts/:nftTokenId/history
 */
exports.getNFTHistory = async (req, res) => {
  try {
    const { nftTokenId } = req.params;

    if (!nftTokenId) {
      return res.status(400).json({
        success: false,
        message: 'NFT token ID is required'
      });
    }

    // Use Bithomp API to get complete NFT data with transaction history
    const nftData = await bithompService.getNFTHistory(nftTokenId);

    logger.info(`NFT history fetched from Bithomp for: ${nftTokenId}, ${nftData.history?.length || 0} ownership changes`);

    res.json({
      success: true,
      data: {
        nftTokenId: nftData.nftTokenId,
        issuer: nftData.issuer,
        issuerDetails: nftData.issuerDetails,
        owner: nftData.owner,
        ownerDetails: nftData.ownerDetails,
        taxon: nftData.taxon,
        transferFee: nftData.transferFee,
        sequence: nftData.sequence,
        flags: nftData.flags,
        uri: nftData.uri,
        metadata: nftData.metadata,
        issuedAt: nftData.issuedAt,
        ownerChangedAt: nftData.ownerChangedAt,
        deletedAt: nftData.deletedAt,
        totalOwnershipChanges: nftData.history?.length || 0,
        history: nftData.history || [],
        sellOffers: nftData.sellOffers || [],
        buyOffers: nftData.buyOffers || []
      },
      message: 'NFT transaction history fetched successfully'
    });

  } catch (error) {
    logger.error('Error fetching NFT history:', error.message);

    // Check if it's a Bithomp API error
    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found or no transaction history available'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFT transaction history',
      error: error.message
    });
  }
};

/**
 * Notify followers about NFT listing
 * Called by frontend after successfully creating a sell offer on XRPL
 * @route POST /api/v1/nfts/notify-listing
 */
exports.notifyNFTListing = async (req, res, next) => {
  try {
    const {
      sellerWalletAddress,
      nftTokenId,
      nftName,
      nftDescription,
      nftImage,
      price,
      collectionId,
      collectionName
    } = req.body;

    if (!sellerWalletAddress) {
      throw new ApiError(400, 'Seller wallet address is required');
    }

    if (!nftTokenId) {
      throw new ApiError(400, 'NFT token ID is required');
    }

    // Verify seller exists
    const seller = await User.findOne({
      where: { walletAddress: sellerWalletAddress }
    });

    if (!seller) {
      throw new ApiError(404, 'Seller not found');
    }

    // Create notifications for all followers
    const notifications = await notificationService.createNFTListingNotifications({
      collectionId: collectionId || null,
      sellerWalletAddress,
      sellerUsername: seller.username,
      nftName: nftName || 'NFT',
      nftDescription: nftDescription || null,
      nftImage: nftImage || null,
      nftTokenId,
      price: price || null,
      collectionName: collectionName || null
    });

    logger.info(`NFT listing notifications sent for ${nftTokenId} by ${sellerWalletAddress} to ${notifications.length} followers`);

    res.status(200).json(
      new ApiResponse(200, {
        notificationsSent: notifications.length,
        nftTokenId
      }, 'NFT listing notifications sent successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Notify seller about NFT purchase
 * Called by frontend after successfully purchasing an NFT on XRPL
 * @route POST /api/v1/nfts/notify-purchase
 */
exports.notifyNFTPurchase = async (req, res, next) => {
  try {
    const {
      sellerWalletAddress,
      buyerWalletAddress,
      nftTokenId,
      nftName,
      nftDescription,
      nftImage,
      price,
      collectionId,
      collectionName,
      transactionHash
    } = req.body;

    if (!sellerWalletAddress) {
      throw new ApiError(400, 'Seller wallet address is required');
    }

    if (!buyerWalletAddress) {
      throw new ApiError(400, 'Buyer wallet address is required');
    }

    if (!nftTokenId) {
      throw new ApiError(400, 'NFT token ID is required');
    }

    // Verify buyer exists
    const buyer = await User.findOne({
      where: { walletAddress: buyerWalletAddress }
    });

    if (!buyer) {
      throw new ApiError(404, 'Buyer not found');
    }

    // Create notification for seller
    const notification = await notificationService.createNFTPurchaseNotification({
      sellerWalletAddress,
      buyerWalletAddress,
      buyerUsername: buyer.username,
      nftTokenId,
      nftName: nftName || 'NFT',
      nftDescription: nftDescription || null,
      nftImage: nftImage || null,
      price: price || null,
      collectionId: collectionId || null,
      collectionName: collectionName || null,
      transactionHash: transactionHash || null
    });

    logger.info(`NFT purchase notification sent for ${nftTokenId} - seller: ${sellerWalletAddress}, buyer: ${buyerWalletAddress}`);

    res.status(200).json(
      new ApiResponse(200, {
        notificationSent: notification !== null,
        nftTokenId,
        sellerWalletAddress,
        buyerWalletAddress
      }, 'NFT purchase notification sent successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get incoming offers for a wallet
 * Returns buy offers on NFTs owned by the wallet with NFT details and accept transaction data
 * @route GET /api/v1/nfts/incoming-offers/:walletAddress
 */
exports.getIncomingOffers = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      throw new ApiError(400, 'Wallet address is required');
    }

    // Validate wallet address format (basic XRPL address validation)
    if (!walletAddress.startsWith('r') || walletAddress.length < 25 || walletAddress.length > 35) {
      throw new ApiError(400, 'Invalid wallet address format');
    }

    // Get incoming offers from XRPL service
    const incomingOffers = await xrplService.getDetailedIncomingOffers(walletAddress);

    // Fetch subscription plans for all offerers
    const offererWalletAddresses = incomingOffers.buyOffers.map(offer => offer.offerer).filter(Boolean);
    const subscriptionMap = await getActiveSubscriptionsForWallets(offererWalletAddresses);

    // Enrich with user data from database
    const enrichedBuyOffers = await Promise.all(
      incomingOffers.buyOffers.map(async (offer) => {
        // Get offerer info
        let offererInfo = null;
        try {
          const offerer = await User.findOne({
            where: { walletAddress: offer.offerer },
            attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
          });
          if (offerer) {
            offererInfo = {
              walletAddress: offerer.walletAddress,
              username: offerer.username,
              profileImage: offerer.profileImage,
              isVerified: offerer.isVerified,
              subscriptionPlan: subscriptionMap[offerer.walletAddress] || 'free'
            };
          }
        } catch (e) {
          // Ignore error, offerer info is optional
        }

        // Get collection info
        let collectionInfo = null;
        try {
          const collection = await Collection.findOne({
            where: {
              taxon: offer.nft.taxon,
              creatorWalletAddress: offer.nft.issuer
            },
            attributes: ['id', 'name', 'slug', 'image', 'isVerified']
          });
          if (collection) {
            collectionInfo = {
              id: collection.id,
              name: collection.name,
              slug: collection.slug,
              image: collection.image,
              isVerified: collection.isVerified
            };
          }
        } catch (e) {
          // Ignore error, collection info is optional
        }

        return {
          ...offer,
          offererInfo,
          collection: collectionInfo
        };
      })
    );

    res.json({
      success: true,
      data: {
        walletAddress,
        buyOffers: enrichedBuyOffers,
        sellOffersForYou: incomingOffers.sellOffersForYou,
        summary: {
          totalBuyOffers: enrichedBuyOffers.length,
          totalSellOffersForYou: incomingOffers.sellOffersForYou.length,
          totalOffersCount: enrichedBuyOffers.length + incomingOffers.sellOffersForYou.length,
          totalValueXrp: incomingOffers.summary.totalValueXrp
        },
        hint: {
          buyOffers: 'These are offers from others wanting to buy NFTs you own. Use acceptTransaction data to accept via QR code.',
          sellOffersForYou: 'These are sell offers specifically made for you to accept (destination = your wallet).',
          acceptTransaction: 'The acceptTransaction object contains all fields needed for NFTokenAcceptOffer. Sign this with your wallet via QR code to accept the offer.'
        }
      }
    });

  } catch (error) {
    logger.error('Error getting incoming offers:', error);
    next(error);
  }
};

/**
 * Get all NFTs owned by a Solana wallet via Helius DAS API
 * @route GET /api/v1/nfts/solana/wallet/:walletAddress
 */
exports.getSolanaNFTsByOwner = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!solanaService.isValidAddress(walletAddress)) {
      throw new ApiError(400, 'Invalid Solana wallet address');
    }

    const result = await solanaService.getAssetsByOwner(
      walletAddress,
      parseInt(page),
      Math.min(parseInt(limit), 1000)
    );

    const nfts = (result.items || []).map(item => {
      const collectionGroup = item.grouping?.find(g => g.group_key === 'collection');
      return {
        mintAddress: item.id,
        name: item.content?.metadata?.name || null,
        description: item.content?.metadata?.description || null,
        image: item.content?.links?.image || item.content?.files?.[0]?.uri || null,
        attributes: item.content?.metadata?.attributes || [],
        collectionMintAddress: collectionGroup?.group_value || null,
        owner: item.ownership?.owner || null,
        compressed: item.compression?.compressed || false,
        royalty: item.royalty || null,
        raw: item
      };
    });

    res.status(200).json(new ApiResponse(200, {
      network: 'solana',
      walletAddress,
      total: result.total,
      items: nfts,
      page: parseInt(page),
      limit: parseInt(limit)
    }, 'Solana NFTs retrieved successfully'));
  } catch (error) {
    logger.error('Error getting Solana NFTs by owner:', error);
    next(error);
  }
};

/**
 * Get all NFTs in a Solana collection via Helius DAS API
 * @route GET /api/v1/nfts/solana/collection/:collectionMintAddress
 */
exports.getSolanaNFTsByCollection = async (req, res, next) => {
  try {
    const { collectionMintAddress } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!solanaService.isValidAddress(collectionMintAddress)) {
      throw new ApiError(400, 'Invalid Solana collection mint address');
    }

    // Fetch collection detail (DAS + DB) and NFTs in parallel
    const [collectionAsset, dbCollection, result] = await Promise.all([
      solanaService.getAsset(collectionMintAddress).catch(() => null),
      Collection.findOne({
        where: { mintAddress: collectionMintAddress, network: 'solana' },
        include: [{ association: 'creator', attributes: ['walletAddress', 'username', 'profileImage', 'isVerified'] }]
      }),
      solanaService.getAssetsByCollection(
        collectionMintAddress,
        parseInt(page),
        Math.min(parseInt(limit), 1000)
      )
    ]);

    const collection = {
      mintAddress: collectionMintAddress,
      name: dbCollection?.name || collectionAsset?.content?.metadata?.name || null,
      description: dbCollection?.description || collectionAsset?.content?.metadata?.description || null,
      image: dbCollection?.image || collectionAsset?.content?.links?.image || null,
      bannerImage: dbCollection?.bannerImage || null,
      category: dbCollection?.category || null,
      royaltyPercentage: dbCollection?.royaltyPercentage || null,
      floorPrice: dbCollection?.floorPrice || null,
      totalVolume: dbCollection?.totalVolume || null,
      totalSupply: result.total || dbCollection?.totalSupply || 0,
      isVerified: dbCollection?.isVerified || false,
      slug: dbCollection?.slug || null,
      creator: dbCollection?.creator || (collectionAsset?.ownership?.owner ? { walletAddress: collectionAsset.ownership.owner } : null),
      socialLinks: dbCollection?.socialLinks || null,
      royalty: collectionAsset?.royalty || null
    };

    const nfts = (result.items || []).map(item => {
      const collectionGroup = item.grouping?.find(g => g.group_key === 'collection');
      return {
        mintAddress: item.id,
        name: item.content?.metadata?.name || null,
        description: item.content?.metadata?.description || null,
        image: item.content?.links?.image || item.content?.files?.[0]?.uri || null,
        attributes: item.content?.metadata?.attributes || [],
        collectionMintAddress: collectionGroup?.group_value || null,
        owner: item.ownership?.owner || null,
        compressed: item.compression?.compressed || false,
        royalty: item.royalty || null,
        raw: item
      };
    });

    res.status(200).json(new ApiResponse(200, {
      network: 'solana',
      collection,
      total: result.total,
      items: nfts,
      page: parseInt(page),
      limit: parseInt(limit)
    }, 'Collection detail and NFTs retrieved successfully'));
  } catch (error) {
    logger.error('Error getting Solana collection NFTs:', error);
    next(error);
  }
};
