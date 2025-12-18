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
   * Get NFT info including owner (uses nft_info command)
   * Note: This requires Clio server or rippled with nft_info support
   */
  async getNFTInfo(nftokenID) {
    try {
      const client = xrplConfig.getClient();
      const response = await client.request({
        command: 'nft_info',
        nft_id: nftokenID
      });
      return response.result;
    } catch (error) {
      // If nft_info is not supported, return null
      if (error.data && (error.data.error === 'unknownCmd' || error.data.error === 'objectNotFound')) {
        return null;
      }
      logger.error('Error getting NFT info:', error);
      return null;
    }
  }

  /**
   * Get NFT details with owner and sell offers
   */
  async getNFTDetailsWithOffers(nftokenID) {
    try {
      const [nftInfo, sellOffers] = await Promise.all([
        this.getNFTInfo(nftokenID),
        this.getNFTSellOffers(nftokenID)
      ]);

      // Find the lowest sell offer (floor price)
      let lowestOffer = null;
      if (sellOffers && sellOffers.length > 0) {
        lowestOffer = sellOffers.reduce((lowest, offer) => {
          const amount = typeof offer.amount === 'string' ? parseInt(offer.amount) : offer.amount;
          const lowestAmount = lowest ? (typeof lowest.amount === 'string' ? parseInt(lowest.amount) : lowest.amount) : Infinity;
          return amount < lowestAmount ? offer : lowest;
        }, null);
      }

      return {
        nftokenID,
        owner: nftInfo?.owner || null,
        issuer: nftInfo?.issuer || null,
        uri: nftInfo?.uri || null,
        flags: nftInfo?.flags || null,
        transferFee: nftInfo?.transfer_fee || null,
        isListed: sellOffers.length > 0,
        sellOffers: sellOffers,
        sellOffersCount: sellOffers.length,
        lowestSellOffer: lowestOffer ? {
          offerID: lowestOffer.nft_offer_index,
          owner: lowestOffer.owner,
          amount: lowestOffer.amount,
          amountXrp: (parseInt(lowestOffer.amount) / 1000000).toFixed(6),
          destination: lowestOffer.destination || null,
          expiration: lowestOffer.expiration || null
        } : null
      };
    } catch (error) {
      logger.error('Error getting NFT details with offers:', error);
      return {
        nftokenID,
        owner: null,
        isListed: false,
        sellOffers: [],
        sellOffersCount: 0,
        lowestSellOffer: null,
        error: error.message
      };
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

  /**
   * Convert hex-encoded URI to string
   */
  convertHexToString(hex) {
    try {
      if (!hex) return null;
      // Remove '0x' prefix if present
      const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
      // Convert hex to string
      let str = '';
      for (let i = 0; i < cleanHex.length; i += 2) {
        str += String.fromCharCode(parseInt(cleanHex.substr(i, 2), 16));
      }
      return str;
    } catch (error) {
      logger.error('Error converting hex to string:', error);
      return null;
    }
  }

  /**
   * Fetch NFT metadata from URI
   */
  async fetchNFTMetadata(uri) {
    try {
      if (!uri) return null;

      // Convert hex URI to string
      const metadataUrl = this.convertHexToString(uri);
      if (!metadataUrl) return null;

      // Handle IPFS URLs
      let fetchUrl = metadataUrl;
      if (metadataUrl.startsWith('ipfs://')) {
        fetchUrl = metadataUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }

      // Fetch metadata with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`Failed to fetch metadata from ${fetchUrl}: ${response.status}`);
        return null;
      }

      const metadata = await response.json();
      return metadata;
    } catch (error) {
      logger.warn(`Error fetching NFT metadata:`, error.message);
      return null;
    }
  }

  /**
   * Get NFT image URL from metadata
   */
  async getNFTImage(uri) {
    try {
      const metadata = await this.fetchNFTMetadata(uri);
      if (!metadata) return null;

      // Try common image field names
      let imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;

      // Handle IPFS image URLs
      if (imageUrl && imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }

      return imageUrl || null;
    } catch (error) {
      logger.warn('Error getting NFT image:', error.message);
      return null;
    }
  }

  /**
   * Extract taxon from NFTokenID
   * NFTokenID format: (4 bits flags)(16 bits transfer fee)(160 bits issuer)(32 bits taxon)(32 bits sequence)
   * The taxon is stored XORed with the sequence at bits 32-63
   */
  extractTaxonFromNFTokenID(nftokenID) {
    try {
      if (!nftokenID || nftokenID.length !== 64) return null;

      // NFTokenID is 64 hex characters = 256 bits
      // Taxon is at positions 40-48 (32 bits = 8 hex chars) from the left
      // But it's scrambled with sequence, so we need to unscramble

      // Get the scrambled taxon (positions 40-48)
      const scrambledTaxon = parseInt(nftokenID.substring(48, 56), 16);
      // Get the sequence (positions 48-56, which is last 8 chars)
      const sequence = parseInt(nftokenID.substring(56, 64), 16);

      // The taxon is XORed with sequence
      const taxon = scrambledTaxon ^ sequence;

      return taxon;
    } catch (error) {
      logger.warn('Error extracting taxon from NFTokenID:', error.message);
      return null;
    }
  }

  /**
   * Get collection history (all NFT activities for a specific taxon)
   * Includes: mints, listings, offers, transfers, burns
   */
  async getCollectionHistory(issuerAddress, taxon, limit = 100) {
    try {
      const client = xrplConfig.getClient();

      // Get account transactions
      const response = await client.request({
        command: 'account_tx',
        account: issuerAddress,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: Math.min(limit * 3, 400) // Fetch more to filter
      });

      const history = [];
      const processedHashes = new Set();

      if (response.result.transactions) {
        for (const txData of response.result.transactions) {
          const tx = txData.tx || txData.transaction;
          const meta = txData.meta;

          // Skip if already processed or failed
          if (processedHashes.has(tx.hash)) continue;
          if (meta.TransactionResult !== 'tesSUCCESS') continue;

          const transactionType = tx.TransactionType;
          const timestamp = tx.date ? (tx.date + 946684800) * 1000 : null; // Convert Ripple epoch to JS timestamp

          // Process NFTokenMint transactions
          if (transactionType === 'NFTokenMint') {
            // Check if taxon matches
            if (tx.NFTokenTaxon === taxon) {
              const nftokenID = this.extractNFTokenID(meta);
              history.push({
                type: 'mint',
                hash: tx.hash,
                nftokenID: nftokenID,
                issuer: tx.Account,
                taxon: tx.NFTokenTaxon,
                uri: tx.URI ? this.convertHexToString(tx.URI) : null,
                transferFee: tx.TransferFee || 0,
                timestamp: timestamp,
                ledgerIndex: tx.ledger_index
              });
              processedHashes.add(tx.hash);
            }
          }

          // Process NFTokenCreateOffer transactions (listings/offers)
          if (transactionType === 'NFTokenCreateOffer') {
            const nftokenID = tx.NFTokenID;
            const nftTaxon = this.extractTaxonFromNFTokenID(nftokenID);

            if (nftTaxon === taxon) {
              const isSellOffer = (tx.Flags & 1) === 1;
              const offerID = this.extractOfferID(meta);

              history.push({
                type: isSellOffer ? 'listing' : 'offer',
                hash: tx.hash,
                offerID: offerID,
                nftokenID: nftokenID,
                offerer: tx.Account,
                owner: tx.Owner || null,
                amount: tx.Amount,
                destination: tx.Destination || null,
                expiration: tx.Expiration || null,
                timestamp: timestamp,
                ledgerIndex: tx.ledger_index
              });
              processedHashes.add(tx.hash);
            }
          }

          // Process NFTokenAcceptOffer transactions (sales/transfers)
          if (transactionType === 'NFTokenAcceptOffer') {
            // Extract NFT info from affected nodes
            if (meta.AffectedNodes) {
              for (const node of meta.AffectedNodes) {
                if (node.DeletedNode && node.DeletedNode.LedgerEntryType === 'NFTokenOffer') {
                  const offer = node.DeletedNode.FinalFields;
                  const nftokenID = offer.NFTokenID;
                  const nftTaxon = this.extractTaxonFromNFTokenID(nftokenID);

                  if (nftTaxon === taxon) {
                    const isSellOffer = (offer.Flags & 1) === 1;

                    history.push({
                      type: 'sale',
                      hash: tx.hash,
                      nftokenID: nftokenID,
                      seller: isSellOffer ? offer.Owner : tx.Account,
                      buyer: isSellOffer ? tx.Account : offer.Owner,
                      amount: offer.Amount,
                      timestamp: timestamp,
                      ledgerIndex: tx.ledger_index
                    });
                    processedHashes.add(tx.hash);
                  }
                }
              }
            }
          }

          // Process NFTokenCancelOffer transactions
          if (transactionType === 'NFTokenCancelOffer') {
            if (meta.AffectedNodes) {
              for (const node of meta.AffectedNodes) {
                if (node.DeletedNode && node.DeletedNode.LedgerEntryType === 'NFTokenOffer') {
                  const offer = node.DeletedNode.FinalFields;
                  const nftokenID = offer.NFTokenID;
                  const nftTaxon = this.extractTaxonFromNFTokenID(nftokenID);

                  if (nftTaxon === taxon) {
                    history.push({
                      type: 'offer_cancelled',
                      hash: tx.hash,
                      nftokenID: nftokenID,
                      offerer: offer.Owner,
                      amount: offer.Amount,
                      timestamp: timestamp,
                      ledgerIndex: tx.ledger_index
                    });
                    processedHashes.add(tx.hash);
                  }
                }
              }
            }
          }

          // Process NFTokenBurn transactions
          if (transactionType === 'NFTokenBurn') {
            const nftokenID = tx.NFTokenID;
            const nftTaxon = this.extractTaxonFromNFTokenID(nftokenID);

            if (nftTaxon === taxon) {
              history.push({
                type: 'burn',
                hash: tx.hash,
                nftokenID: nftokenID,
                burner: tx.Account,
                timestamp: timestamp,
                ledgerIndex: tx.ledger_index
              });
              processedHashes.add(tx.hash);
            }
          }
        }
      }

      // Sort by timestamp (newest first)
      history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      // Limit results
      return history.slice(0, limit);
    } catch (error) {
      logger.error('Error getting collection history:', error);
      throw error;
    }
  }

  /**
   * Get all NFTs in a collection by taxon
   */
  async getCollectionNFTs(issuerAddress, taxon) {
    try {
      const allNFTs = await this.getAccountNFTs(issuerAddress);

      // Filter by taxon
      const collectionNFTs = allNFTs.filter(nft => {
        const nftTaxon = this.extractTaxonFromNFTokenID(nft.NFTokenID);
        return nftTaxon === taxon;
      });

      return collectionNFTs;
    } catch (error) {
      logger.error('Error getting collection NFTs:', error);
      throw error;
    }
  }
}

module.exports = new XRPLService();
