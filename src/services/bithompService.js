const axios = require('axios');
const logger = require('../utils/logger');

class BithompService {
  constructor() {
    this.apiKey = process.env.BITHOMP_API_KEY;
    this.baseUrl = process.env.BITHOMP_API_URL || 'https://bithomp.com/api/v2';
  }

  /**
   * Check if using testnet (free, API key optional)
   */
  isTestnet() {
    return this.baseUrl.includes('test.') || this.baseUrl.includes('dev.');
  }

  /**
   * Get headers with API key (optional for testnet)
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    // Only add API key header if provided
    if (this.apiKey) {
      headers['x-bithomp-token'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Create a clean error object without circular references
   */
  createCleanError(error) {
    const cleanError = new Error(error.message);
    cleanError.status = error.response?.status;
    cleanError.statusText = error.response?.statusText;
    cleanError.data = error.response?.data;
    return cleanError;
  }

  /**
   * Get NFT transaction history
   * @param {string} nftTokenId - The NFT token ID
   * @returns {Promise<Object>} - NFT data with history
   */
  async getNFTHistory(nftTokenId) {
    try {
      // API key required for mainnet, optional for testnet/devnet
      if (!this.apiKey && !this.isTestnet()) {
        throw new Error('Bithomp API key is not configured (required for mainnet)');
      }

      // Bithomp API endpoint: GET https://bithomp.com/api/v2/nft/<nftID>
      const url = `${this.baseUrl}/nft/${nftTokenId}?history=true&sellOffers=true&buyOffers=true&uri=true&metadata=true`;

      logger.info(`Fetching NFT history from Bithomp: ${url} (testnet: ${this.isTestnet()})`);

      const response = await axios.get(url, { headers: this.getHeaders() });

      logger.info(`Bithomp response received for NFT: ${nftTokenId}`);

      const nftData = response.data;

      // Format history based on Bithomp's actual response structure
      let formattedHistory = [];
      if (nftData.history && Array.isArray(nftData.history)) {
        formattedHistory = nftData.history.map(h => ({
          owner: h.owner,
          changedAt: h.changedAt,
          date: h.changedAt ? new Date(h.changedAt * 1000).toISOString() : null,
          ledgerIndex: h.ledgerIndex,
          txHash: h.txHash,
          marketplace: h.marketplace || null
        }));
      }

      // Format sell offers
      let formattedSellOffers = [];
      if (nftData.sellOffers && Array.isArray(nftData.sellOffers)) {
        formattedSellOffers = nftData.sellOffers.map(offer => ({
          amount: offer.amount,
          amountXRP: typeof offer.amount === 'string' ? (parseInt(offer.amount) / 1000000).toFixed(6) : null,
          offerIndex: offer.offerIndex || offer.index,
          owner: offer.owner,
          destination: offer.destination,
          expiration: offer.expiration,
          createdAt: offer.createdAt,
          createdLedgerIndex: offer.createdLedgerIndex,
          createdTxHash: offer.createdTxHash
        }));
      }

      // Format buy offers
      let formattedBuyOffers = [];
      if (nftData.buyOffers && Array.isArray(nftData.buyOffers)) {
        formattedBuyOffers = nftData.buyOffers.map(offer => ({
          amount: offer.amount,
          amountXRP: typeof offer.amount === 'string' ? (parseInt(offer.amount) / 1000000).toFixed(6) : null,
          offerIndex: offer.offerIndex || offer.index,
          owner: offer.owner,
          destination: offer.destination,
          expiration: offer.expiration,
          createdAt: offer.createdAt,
          createdLedgerIndex: offer.createdLedgerIndex,
          createdTxHash: offer.createdTxHash
        }));
      }

      return {
        nftTokenId: nftData.nftokenID,
        issuer: nftData.issuer,
        issuerDetails: nftData.issuerDetails || null,
        owner: nftData.owner,
        ownerDetails: nftData.ownerDetails || null,
        taxon: nftData.nftokenTaxon,
        transferFee: nftData.transferFee,
        sequence: nftData.sequence,
        flags: nftData.flags,
        uri: nftData.uri,
        metadata: nftData.metadata || null,
        issuedAt: nftData.issuedAt,
        ownerChangedAt: nftData.ownerChangedAt,
        deletedAt: nftData.deletedAt,
        history: formattedHistory,
        sellOffers: formattedSellOffers,
        buyOffers: formattedBuyOffers
      };
    } catch (error) {
      logger.error('Error fetching NFT history from Bithomp:', error.message);

      if (error.response) {
        logger.error('Bithomp API response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }

      throw this.createCleanError(error);
    }
  }

  /**
   * Get NFT details from Bithomp
   * @param {string} nftTokenId - The NFT token ID
   * @returns {Promise<Object>} - NFT details
   */
  async getNFTDetails(nftTokenId) {
    try {
      if (!this.apiKey) {
        throw new Error('Bithomp API key is not configured');
      }

      const response = await axios.get(
        `${this.baseUrl}/nft/${nftTokenId}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      logger.error('Error fetching NFT details from Bithomp:', error.message);
      throw this.createCleanError(error);
    }
  }

  /**
   * Get NFT offers from Bithomp
   * @param {string} nftTokenId - The NFT token ID
   * @returns {Promise<Object>} - NFT offers (buy and sell)
   */
  async getNFTOffers(nftTokenId) {
    try {
      if (!this.apiKey) {
        throw new Error('Bithomp API key is not configured');
      }

      const response = await axios.get(
        `${this.baseUrl}/nft/${nftTokenId}/offers`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      logger.error('Error fetching NFT offers from Bithomp:', error.message);
      throw this.createCleanError(error);
    }
  }

  /**
   * Get all NFTs for an account
   * @param {string} address - Wallet address
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of NFTs
   */
  async getAccountNFTs(address, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Bithomp API key is not configured');
      }

      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.marker) params.append('marker', options.marker);

      const url = `${this.baseUrl}/account/${address}/nfts${params.toString() ? '?' + params.toString() : ''}`;

      const response = await axios.get(url, { headers: this.getHeaders() });

      return response.data;
    } catch (error) {
      logger.error('Error fetching account NFTs from Bithomp:', error.message);
      throw this.createCleanError(error);
    }
  }
}

module.exports = new BithompService();
