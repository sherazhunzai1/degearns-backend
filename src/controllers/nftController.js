const xrplService = require('../services/xrplService');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Get single NFT detail with sale info and transaction history
 * @route GET /api/v1/nfts/:nftTokenId
 */
exports.getNFTDetail = async (req, res) => {
  try {
    const { nftTokenId } = req.params;

    // Step 1: Get NFT sell offers to find current owner and sale info
    const sellOffers = await xrplService.getNFTSellOffers(nftTokenId);
    const buyOffers = await xrplService.getNFTBuyOffers(nftTokenId);

    // Find the owner address from sell offers or buy offers
    let ownerAddress = null;
    let currentSellOffer = null;

    if (sellOffers.length > 0) {
      // If there are sell offers, the owner is in the offer
      currentSellOffer = sellOffers[0]; // Get the first/best offer
      ownerAddress = currentSellOffer.owner;
    } else if (buyOffers.length > 0) {
      // If only buy offers exist, we need to get the owner from the offer
      ownerAddress = buyOffers[0].owner;
    }

    // If we still don't have owner, we need to search for the NFT in accounts
    // For now, return error if we can't find the owner
    if (!ownerAddress) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found or owner could not be determined'
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
            imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
          }
          nftImage = imageUrl;
        }

        logger.info(`NFT metadata fetched - Title: ${nftTitle}, Image: ${nftImage ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      logger.warn(`Could not fetch metadata for NFT ${nftTokenId}:`, error.message);
    }

    // Step 4: Get owner and issuer information from database
    const [ownerUser, issuerUser] = await Promise.all([
      User.findOne({
        where: { walletAddress: ownerAddress },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified', 'bio']
      }),
      User.findOne({
        where: { walletAddress: nftData.Issuer },
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
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
