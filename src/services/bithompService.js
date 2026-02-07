const axios = require('axios');
const logger = require('../utils/logger');

class BithompService {
  constructor() {
    this.apiKey = process.env.BITHOMP_API_KEY;
    this.baseUrl = process.env.BITHOMP_API_URL || 'https://bithomp.com/api/v2';
  }

  /**
   * Get headers with API key
   */
  getHeaders() {
    return {
      'x-bithomp-token': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get NFT transaction history
   * @param {string} nftTokenId - The NFT token ID
   * @returns {Promise<Array>} - Array of transactions
   */
  async getNFTHistory(nftTokenId) {
    try {
      if (!this.apiKey) {
        throw new Error('Bithomp API key is not configured');
      }

      const response = await axios.get(
        `${this.baseUrl}/nft/${nftTokenId}/transactions`,
        { headers: this.getHeaders() }
      );

      if (response.data && response.data.transactions) {
        return response.data.transactions.map(tx => ({
          hash: tx.hash,
          type: tx.type,
          timestamp: tx.timestamp,
          date: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : null,
          account: tx.account,
          destination: tx.destination,
          amount: tx.amount,
          amountXRP: tx.amount ? (parseInt(tx.amount) / 1000000).toFixed(6) : null,
          currency: tx.currency || 'XRP',
          result: tx.result || 'tesSUCCESS',
          ledgerIndex: tx.ledger_index,
          offerIndex: tx.offer_index,
          flags: tx.flags
        }));
      }

      return response.data || [];
    } catch (error) {
      logger.error('Error fetching NFT history from Bithomp:', error.message);

      if (error.response) {
        logger.error('Bithomp API response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }

      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
    }
  }
}

module.exports = new BithompService();
