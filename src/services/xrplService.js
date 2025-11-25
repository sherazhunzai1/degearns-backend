const {
  NFTokenMint,
  NFTokenCreateOffer,
  NFTokenAcceptOffer,
  NFTokenBurn,
  NFTokenCancelOffer,
  convertStringToHex
} = require('xrpl');
const xrplConfig = require('../config/xrpl');
const logger = require('../utils/logger');

class XRPLService {
  /**
   * Get account information
   */
  async getAccountInfo(address) {
    try {
      const client = xrplConfig.getClient();
      const response = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });
      return response.result;
    } catch (error) {
      logger.error('Error getting account info:', error);
      throw error;
    }
  }

  /**
   * Get account NFTs
   */
  async getAccountNFTs(address) {
    try {
      const client = xrplConfig.getClient();
      const response = await client.request({
        command: 'account_nfts',
        account: address,
        ledger_index: 'validated'
      });
      return response.result.account_nfts || [];
    } catch (error) {
      logger.error('Error getting account NFTs:', error);
      throw error;
    }
  }

  /**
   * Mint a new NFT
   */
  async mintNFT({ wallet, uri, taxon = 0, transferFee = 0, flags = 8 }) {
    try {
      const client = xrplConfig.getClient();

      const mintTx = {
        TransactionType: 'NFTokenMint',
        Account: wallet.address,
        URI: convertStringToHex(uri),
        Flags: flags, // 8 = tfTransferable
        TransferFee: transferFee, // 0-50000 (0-50%)
        NFTokenTaxon: taxon
      };

      const prepared = await client.autofill(mintTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        // Extract NFTokenID from metadata
        const nftokenID = this.extractNFTokenID(result.result.meta);
        logger.info(`NFT minted successfully: ${nftokenID}`);
        return {
          success: true,
          nftokenID,
          hash: result.result.hash,
          account: wallet.address
        };
      } else {
        throw new Error(`Mint failed: ${result.result.meta.TransactionResult}`);
      }
    } catch (error) {
      logger.error('Error minting NFT:', error);
      throw error;
    }
  }

  /**
   * Create a sell offer for an NFT
   */
  async createSellOffer({ wallet, nftokenID, amount, destination = null, expiration = null }) {
    try {
      const client = xrplConfig.getClient();

      const offerTx = {
        TransactionType: 'NFTokenCreateOffer',
        Account: wallet.address,
        NFTokenID: nftokenID,
        Amount: amount.toString(),
        Flags: 1 // tfSellNFToken
      };

      if (destination) {
        offerTx.Destination = destination;
      }

      if (expiration) {
        offerTx.Expiration = expiration;
      }

      const prepared = await client.autofill(offerTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const offerID = this.extractOfferID(result.result.meta);
        logger.info(`Sell offer created: ${offerID}`);
        return {
          success: true,
          offerID,
          hash: result.result.hash
        };
      } else {
        throw new Error(`Create sell offer failed: ${result.result.meta.TransactionResult}`);
      }
    } catch (error) {
      logger.error('Error creating sell offer:', error);
      throw error;
    }
  }

  /**
   * Create a buy offer for an NFT
   */
  async createBuyOffer({ wallet, nftokenID, amount, owner }) {
    try {
      const client = xrplConfig.getClient();

      const offerTx = {
        TransactionType: 'NFTokenCreateOffer',
        Account: wallet.address,
        NFTokenID: nftokenID,
        Amount: amount.toString(),
        Owner: owner,
        Flags: 0
      };

      const prepared = await client.autofill(offerTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const offerID = this.extractOfferID(result.result.meta);
        logger.info(`Buy offer created: ${offerID}`);
        return {
          success: true,
          offerID,
          hash: result.result.hash
        };
      } else {
        throw new Error(`Create buy offer failed: ${result.result.meta.TransactionResult}`);
      }
    } catch (error) {
      logger.error('Error creating buy offer:', error);
      throw error;
    }
  }

  /**
   * Accept an NFT offer
   */
  async acceptOffer({ wallet, offerID }) {
    try {
      const client = xrplConfig.getClient();

      const acceptTx = {
        TransactionType: 'NFTokenAcceptOffer',
        Account: wallet.address,
        NFTokenSellOffer: offerID
      };

      const prepared = await client.autofill(acceptTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        logger.info(`Offer accepted: ${offerID}`);
        return {
          success: true,
          hash: result.result.hash
        };
      } else {
        throw new Error(`Accept offer failed: ${result.result.meta.TransactionResult}`);
      }
    } catch (error) {
      logger.error('Error accepting offer:', error);
      throw error;
    }
  }

  /**
   * Cancel an NFT offer
   */
  async cancelOffer({ wallet, offerIDs }) {
    try {
      const client = xrplConfig.getClient();

      const cancelTx = {
        TransactionType: 'NFTokenCancelOffer',
        Account: wallet.address,
        NFTokenOffers: Array.isArray(offerIDs) ? offerIDs : [offerIDs]
      };

      const prepared = await client.autofill(cancelTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        logger.info(`Offers cancelled: ${offerIDs}`);
        return {
          success: true,
          hash: result.result.hash
        };
      } else {
        throw new Error(`Cancel offer failed: ${result.result.meta.TransactionResult}`);
      }
    } catch (error) {
      logger.error('Error cancelling offer:', error);
      throw error;
    }
  }

  /**
   * Burn an NFT
   */
  async burnNFT({ wallet, nftokenID }) {
    try {
      const client = xrplConfig.getClient();

      const burnTx = {
        TransactionType: 'NFTokenBurn',
        Account: wallet.address,
        NFTokenID: nftokenID
      };

      const prepared = await client.autofill(burnTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        logger.info(`NFT burned: ${nftokenID}`);
        return {
          success: true,
          hash: result.result.hash
        };
      } else {
        throw new Error(`Burn NFT failed: ${result.result.meta.TransactionResult}`);
      }
    } catch (error) {
      logger.error('Error burning NFT:', error);
      throw error;
    }
  }

  /**
   * Get NFT sell offers
   */
  async getNFTSellOffers(nftokenID) {
    try {
      const client = xrplConfig.getClient();
      const response = await client.request({
        command: 'nft_sell_offers',
        nft_id: nftokenID
      });
      return response.result.offers || [];
    } catch (error) {
      if (error.data && error.data.error === 'objectNotFound') {
        return [];
      }
      logger.error('Error getting NFT sell offers:', error);
      throw error;
    }
  }

  /**
   * Get NFT buy offers
   */
  async getNFTBuyOffers(nftokenID) {
    try {
      const client = xrplConfig.getClient();
      const response = await client.request({
        command: 'nft_buy_offers',
        nft_id: nftokenID
      });
      return response.result.offers || [];
    } catch (error) {
      if (error.data && error.data.error === 'objectNotFound') {
        return [];
      }
      logger.error('Error getting NFT buy offers:', error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash) {
    try {
      const client = xrplConfig.getClient();
      const response = await client.request({
        command: 'tx',
        transaction: txHash
      });
      return response.result;
    } catch (error) {
      logger.error('Error getting transaction:', error);
      throw error;
    }
  }

  /**
   * Get account transactions related to a specific NFT
   */
  async getNFTTransactionHistory(ownerAddress, nftokenID, limit = 20) {
    try {
      const client = xrplConfig.getClient();
      const response = await client.request({
        command: 'account_tx',
        account: ownerAddress,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: limit
      });

      // Filter transactions related to the specific NFT
      const nftTransactions = [];
      if (response.result.transactions) {
        for (const txData of response.result.transactions) {
          const tx = txData.tx;
          const meta = txData.meta;

          // Check if transaction involves our NFT
          if (tx.NFTokenID === nftokenID) {
            nftTransactions.push({
              hash: tx.hash,
              type: tx.TransactionType,
              date: tx.date,
              account: tx.Account,
              amount: tx.Amount,
              destination: tx.Destination,
              result: meta.TransactionResult,
              ledgerIndex: txData.tx.ledger_index
            });
          }

          // Also check for NFTokenAcceptOffer transactions
          if (tx.TransactionType === 'NFTokenAcceptOffer' && meta.AffectedNodes) {
            for (const node of meta.AffectedNodes) {
              if (node.DeletedNode && node.DeletedNode.LedgerEntryType === 'NFTokenOffer') {
                const offer = node.DeletedNode.FinalFields;
                if (offer.NFTokenID === nftokenID) {
                  nftTransactions.push({
                    hash: tx.hash,
                    type: 'NFTokenSale',
                    date: tx.date,
                    buyer: tx.Account,
                    seller: offer.Owner,
                    amount: offer.Amount,
                    result: meta.TransactionResult,
                    ledgerIndex: txData.tx.ledger_index
                  });
                }
              }
            }
          }
        }
      }

      return nftTransactions;
    } catch (error) {
      logger.error('Error getting NFT transaction history:', error);
      throw error;
    }
  }

  /**
   * Extract NFTokenID from transaction metadata
   */
  extractNFTokenID(meta) {
    if (meta.AffectedNodes) {
      for (const node of meta.AffectedNodes) {
        if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'NFTokenPage') {
          const nftokens = node.CreatedNode.NewFields.NFTokens;
          if (nftokens && nftokens.length > 0) {
            return nftokens[0].NFToken.NFTokenID;
          }
        }
        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === 'NFTokenPage') {
          const finalFields = node.ModifiedNode.FinalFields;
          const previousFields = node.ModifiedNode.PreviousFields;

          if (finalFields && finalFields.NFTokens && previousFields && previousFields.NFTokens) {
            // Find the new token by comparing arrays
            const newTokens = finalFields.NFTokens.filter(
              token => !previousFields.NFTokens.some(
                prevToken => prevToken.NFToken.NFTokenID === token.NFToken.NFTokenID
              )
            );
            if (newTokens.length > 0) {
              return newTokens[0].NFToken.NFTokenID;
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Extract offer ID from transaction metadata
   */
  extractOfferID(meta) {
    if (meta.AffectedNodes) {
      for (const node of meta.AffectedNodes) {
        if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'NFTokenOffer') {
          return node.CreatedNode.LedgerIndex;
        }
      }
    }
    return null;
  }
}

module.exports = new XRPLService();
