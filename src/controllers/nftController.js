const xrplService = require('../services/xrplService');
const { User, Collection } = require('../models');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get single NFT detail with sale info and transaction history
 * @route GET /api/v1/nfts/:nftTokenId
 */
exports.getNFTDetail = async (req, res) => {
  try {
    const { nftTokenId } = req.params;
    const { wallet } = req.query; // Optional wallet parameter

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

        // Extract and format image URL
        let imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;
        if (imageUrl) {
          // Handle IPFS URLs
          if (imageUrl.startsWith('ipfs://')) {
            imageUrl = imageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
          }
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

    // Step 4: Get transaction history for this NFT
    const transactionHistory = await xrplService.getNFTTransactionHistory(
      ownerAddress,
      nftTokenId,
      50 // Get last 50 transactions
    );

    // Step 5: Calculate stats from transaction history
    const sales = transactionHistory.filter(tx => tx.type === 'NFTokenSale');
    const totalVolume = sales.reduce((sum, sale) => {
      const amount = typeof sale.amount === 'string'
        ? parseInt(sale.amount)
        : sale.amount;
      return sum + (amount || 0);
    }, 0);

    const lastSale = sales.length > 0 ? sales[0] : null;

    // Step 6: Format the response
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
        isVerified: issuerUser.isVerified
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
          isVerified: collection.creator.isVerified
        } : null
      } : null,
      owner: ownerAddress,
      ownerInfo: ownerUser ? {
        walletAddress: ownerUser.walletAddress,
        username: ownerUser.username,
        profileImage: ownerUser.profileImage,
        isVerified: ownerUser.isVerified,
        bio: ownerUser.bio
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

      // Transaction history
      history: transactionHistory.map(tx => ({
        hash: tx.hash,
        type: tx.type,
        date: tx.date,
        account: tx.account || tx.buyer,
        seller: tx.seller,
        buyer: tx.buyer,
        amount: tx.amount,
        result: tx.result,
        ledgerIndex: tx.ledgerIndex
      }))
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
 * Get NFT transaction history
 * @route GET /api/v1/nfts/:nftTokenId/history
 */
exports.getNFTHistory = async (req, res) => {
  try {
    const { nftTokenId } = req.params;
    const { ownerAddress } = req.query;
    const limit = parseInt(req.query.limit) || 20;

    if (!ownerAddress) {
      return res.status(400).json({
        success: false,
        message: 'Owner address is required as query parameter'
      });
    }

    const history = await xrplService.getNFTTransactionHistory(
      ownerAddress,
      nftTokenId,
      limit
    );

    res.json({
      success: true,
      data: {
        nftTokenId,
        ownerAddress,
        transactions: history
      }
    });

  } catch (error) {
    logger.error('Error fetching NFT history:', error);
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
              isVerified: offerer.isVerified
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
