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
   * Fetch NFT metadata from URI using Pinata premium gateway
   */
  async fetchNFTMetadata(uri) {
    try {
      if (!uri) return null;

      // Convert hex URI to string
      const metadataUrl = this.convertHexToString(uri);
      if (!metadataUrl) return null;

      // Get Pinata gateway config from environment variables
      const pinataGatewayUrl = process.env.PINATA_GATEWAY_URL;
      const pinataGatewayToken = process.env.PINATA_GATEWAY_TOKEN;

      // Extract IPFS hash if it's an IPFS URL
      let ipfsHash = null;
      if (metadataUrl.startsWith('ipfs://')) {
        ipfsHash = metadataUrl.replace('ipfs://', '');
      }

      // If it's an IPFS URL, use Pinata premium gateway
      if (ipfsHash) {
        // Build fetch URL with Pinata gateway and token
        const fetchUrl = `${pinataGatewayUrl}/${ipfsHash}?pinataGatewayToken=${pinataGatewayToken}`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          logger.info(`Fetching NFT metadata from Pinata gateway: ${pinataGatewayUrl}/${ipfsHash}`);

          const response = await fetch(fetchUrl, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const metadata = await response.json();
            logger.info(`Successfully fetched metadata for hash: ${ipfsHash}`);
            return metadata;
          } else {
            logger.warn(`Failed to fetch metadata from Pinata: ${response.status}`);
            return null;
          }
        } catch (error) {
          logger.warn(`Error fetching from Pinata gateway: ${error.message}`);
          return null;
        }
      }

      // Not an IPFS URL, try direct fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(metadataUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`Failed to fetch metadata from ${metadataUrl}: ${response.status}`);
        return null;
      }

      const metadata = await response.json();
      logger.info(`Successfully fetched metadata from: ${metadataUrl}`);
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
      const imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;

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
   *
   * This function properly handles the case where the wallet is not the issuer:
   * 1. First finds the issuer of NFTs with this taxon from the wallet's NFTs
   * 2. Queries both issuer's transactions (for mints) and wallet's transactions (for their activity)
   */
  async getCollectionHistory(walletAddress, taxon, limit = 100) {
    try {
      const client = xrplConfig.getClient();
      const history = [];
      const processedHashes = new Set();

      // Step 1: Get NFTs owned by this wallet to find the issuer
      const walletNFTs = await this.getAccountNFTs(walletAddress);
      const collectionNFTs = walletNFTs.filter(nft => {
        const nftTaxon = nft.NFTokenTaxon || 0;
        return nftTaxon === taxon;
      });

      logger.info(`Found ${collectionNFTs.length} NFTs with taxon ${taxon} in wallet ${walletAddress}`);

      // Step 2: Determine the issuer (from the NFT's Issuer field)
      let issuerAddress = null;
      if (collectionNFTs.length > 0) {
        issuerAddress = collectionNFTs[0].Issuer;
        logger.info(`Found issuer for taxon ${taxon}: ${issuerAddress}`);
      }

      // Step 3: Collect unique addresses to query
      const addressesToQuery = new Set([walletAddress]);
      if (issuerAddress && issuerAddress !== walletAddress) {
        addressesToQuery.add(issuerAddress);
      }

      // Helper function to process transactions from an address with pagination
      const processTransactions = async (address) => {
        try {
          let marker = undefined;
          let totalFetched = 0;
          const maxTransactions = 1000; // Fetch up to 1000 transactions per address

          do {
            const requestParams = {
              command: 'account_tx',
              account: address,
              ledger_index_min: -1,
              ledger_index_max: -1,
              limit: 200
            };

            if (marker) {
              requestParams.marker = marker;
            }

            const response = await client.request(requestParams);

            if (!response.result.transactions || response.result.transactions.length === 0) {
              break;
            }

            totalFetched += response.result.transactions.length;
            logger.info(`Fetched ${response.result.transactions.length} transactions for ${address} (total: ${totalFetched})`);

            // Process the transactions
            for (const txData of response.result.transactions) {
              const tx = txData.tx || txData.transaction;
              const meta = txData.meta;

              // Skip if already processed or failed
              if (processedHashes.has(tx.hash)) continue;
              if (meta.TransactionResult !== 'tesSUCCESS') continue;

              const transactionType = tx.TransactionType;
              const timestamp = tx.date ? (tx.date + 946684800) * 1000 : null;

              // Process NFTokenMint transactions
              if (transactionType === 'NFTokenMint') {
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
                if (meta.AffectedNodes) {
                  for (const node of meta.AffectedNodes) {
                    if (node.DeletedNode && node.DeletedNode.LedgerEntryType === 'NFTokenOffer') {
                      const offer = node.DeletedNode.FinalFields;
                      const nftokenID = offer.NFTokenID;
                      const nftTaxon = this.extractTaxonFromNFTokenID(nftokenID);

                      if (nftTaxon === taxon && !processedHashes.has(tx.hash)) {
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

                      if (nftTaxon === taxon && !processedHashes.has(tx.hash)) {
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

            // Update marker for pagination
            marker = response.result.marker;

            // Stop if we've fetched enough or found enough history entries
            if (totalFetched >= maxTransactions || history.length >= limit) {
              break;
            }
          } while (marker);

        } catch (error) {
          logger.warn(`Error fetching transactions for ${address}:`, error.message);
        }
      };

      // Query all relevant addresses
      for (const address of addressesToQuery) {
        logger.info(`Querying transactions for address: ${address}`);
        await processTransactions(address);
      }

      logger.info(`Total history entries found: ${history.length}`);

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

  /**
   * Get incoming offers for a wallet
   * Returns:
   * 1. Buy offers on NFTs owned by the wallet (people wanting to buy from you)
   * 2. Sell offers with destination = wallet (offers made specifically for you to buy)
   */
  async getIncomingOffersForWallet(walletAddress) {
    try {
      const client = xrplConfig.getClient();
      const incomingOffers = [];

      // 1. Get all NFTs owned by this wallet
      const ownedNFTs = await this.getAccountNFTs(walletAddress);

      // 2. For each owned NFT, get buy offers (offers from others wanting to buy)
      const buyOfferPromises = ownedNFTs.map(async (nft) => {
        try {
          const buyOffers = await this.getNFTBuyOffers(nft.NFTokenID);
          return buyOffers.map(offer => ({
            ...offer,
            nftokenID: nft.NFTokenID,
            uri: nft.URI,
            taxon: nft.NFTokenTaxon,
            type: 'buy_offer' // Someone wants to buy your NFT
          }));
        } catch (error) {
          return [];
        }
      });

      const buyOfferResults = await Promise.all(buyOfferPromises);
      for (const offers of buyOfferResults) {
        incomingOffers.push(...offers);
      }

      // 3. Get account objects to find sell offers with destination = walletAddress
      // These are offers made by others specifically for this wallet to accept
      try {
        let marker = null;
        let hasMore = true;

        while (hasMore) {
          const request = {
            command: 'account_objects',
            account: walletAddress,
            type: 'nft_offer',
            ledger_index: 'validated',
            limit: 200
          };

          if (marker) {
            request.marker = marker;
          }

          const response = await client.request(request);
          const objects = response.result.account_objects || [];

          // Note: account_objects returns offers owned by the account
          // We need to search differently for offers with destination = wallet
          // Using nft_sell_offers doesn't support destination filter, so we need alternative approach

          marker = response.result.marker;
          hasMore = !!marker;
        }
      } catch (error) {
        logger.warn('Error getting account objects:', error.message);
      }

      // 4. Alternative: Get sell offers for known NFTs where destination matches
      // This requires knowing which NFTs have offers for this wallet
      // For now, we'll search recent transactions to find potential offers

      return incomingOffers;
    } catch (error) {
      logger.error('Error getting incoming offers for wallet:', error);
      throw error;
    }
  }

  /**
   * Get sell offers where destination is a specific wallet
   * Searches for sell offers on specific NFTs that are targeted to a wallet
   */
  async getSellOffersForDestination(nftokenID, destinationWallet) {
    try {
      const sellOffers = await this.getNFTSellOffers(nftokenID);
      // Filter offers that have this wallet as destination
      return sellOffers.filter(offer =>
        offer.destination && offer.destination.toLowerCase() === destinationWallet.toLowerCase()
      );
    } catch (error) {
      logger.warn('Error getting sell offers for destination:', error.message);
      return [];
    }
  }

  /**
   * Get detailed incoming offers with NFT metadata
   * Returns offers with full NFT details ready for display and QR code acceptance
   */
  async getDetailedIncomingOffers(walletAddress) {
    try {
      const result = {
        buyOffers: [], // Offers to buy NFTs you own
        sellOffersForYou: [], // Sell offers where you are the destination
        summary: {
          totalBuyOffers: 0,
          totalSellOffersForYou: 0,
          totalValueXrp: 0
        }
      };

      // 1. Get all NFTs owned by this wallet
      const ownedNFTs = await this.getAccountNFTs(walletAddress);

      // 2. For each owned NFT, get buy offers with NFT details
      const buyOfferPromises = ownedNFTs.map(async (nft) => {
        try {
          const buyOffers = await this.getNFTBuyOffers(nft.NFTokenID);

          if (buyOffers.length === 0) return [];

          // Fetch NFT metadata
          let metadata = null;
          try {
            metadata = await this.fetchNFTMetadata(nft.URI);
          } catch (e) {
            logger.warn(`Could not fetch metadata for ${nft.NFTokenID}`);
          }

          // Get image URL
          let imageUrl = null;
          if (metadata) {
            imageUrl = metadata.image || metadata.image_url || metadata.imageUrl;
          }

          return buyOffers.map(offer => {
            const amountDrops = typeof offer.amount === 'string' ? parseInt(offer.amount) : offer.amount;
            const amountXrp = (amountDrops / 1000000).toFixed(6);

            return {
              offerType: 'buy',
              offerIndex: offer.nft_offer_index,
              offerer: offer.owner,
              nft: {
                nftokenID: nft.NFTokenID,
                name: metadata?.name || null,
                description: metadata?.description || null,
                image: imageUrl,
                uri: nft.URI ? this.convertHexToString(nft.URI) : null,
                taxon: nft.NFTokenTaxon,
                issuer: nft.Issuer,
                transferFee: nft.TransferFee
              },
              price: {
                drops: amountDrops.toString(),
                xrp: amountXrp
              },
              expiration: offer.expiration || null,
              // Transaction data for accepting via QR code
              acceptTransaction: {
                TransactionType: 'NFTokenAcceptOffer',
                Account: walletAddress,
                NFTokenBuyOffer: offer.nft_offer_index
              }
            };
          });
        } catch (error) {
          return [];
        }
      });

      const buyOfferResults = await Promise.all(buyOfferPromises);
      for (const offers of buyOfferResults) {
        result.buyOffers.push(...offers);
      }

      // 3. Search for sell offers targeting this wallet
      // This is more complex as XRPL doesn't have a direct query for this
      // We need to check sell offers on NFTs we might be interested in
      // For now, we return what we can find from owned NFT relationships

      // Calculate summary
      result.summary.totalBuyOffers = result.buyOffers.length;
      result.summary.totalSellOffersForYou = result.sellOffersForYou.length;

      let totalValueDrops = 0;
      for (const offer of result.buyOffers) {
        totalValueDrops += parseInt(offer.price.drops);
      }
      for (const offer of result.sellOffersForYou) {
        totalValueDrops += parseInt(offer.price.drops);
      }
      result.summary.totalValueXrp = (totalValueDrops / 1000000).toFixed(6);

      return result;
    } catch (error) {
      logger.error('Error getting detailed incoming offers:', error);
      throw error;
    }
  }

  /**
   * Send XRP payment from a specific wallet
   * Used for reward distribution from treasury wallet
   */
  async sendPaymentFromWallet(wallet, destinationAddress, amountDrops) {
    try {
      const client = xrplConfig.getClient();

      const paymentTx = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: destinationAddress,
        Amount: amountDrops.toString()
      };

      const prepared = await client.autofill(paymentTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        logger.info(`Payment sent: ${amountDrops} drops to ${destinationAddress}, hash: ${result.result.hash}`);
        return {
          success: true,
          hash: result.result.hash,
          from: wallet.address,
          to: destinationAddress,
          amount: amountDrops.toString(),
          amountXrp: (parseInt(amountDrops) / 1000000).toFixed(6)
        };
      } else {
        throw new Error(`Payment failed: ${result.result.meta.TransactionResult}`);
      }
    } catch (error) {
      logger.error('Error sending payment:', error);
      throw error;
    }
  }

  /**
   * Send XRP payment using admin wallet
   * Used for fee collection and platform operations
   */
  async sendPayment(destinationAddress, amountDrops) {
    try {
      const wallet = xrplConfig.getAdminWallet();
      return await this.sendPaymentFromWallet(wallet, destinationAddress, amountDrops);
    } catch (error) {
      logger.error('Error sending payment from admin wallet:', error);
      throw error;
    }
  }

  /**
   * Convert a token symbol to XRPL currency hex format.
   * Standard currencies (3 chars) stay as-is.
   * Non-standard (4+ chars) are hex-encoded and right-padded to 40 chars.
   */
  currencyToHex(symbol) {
    const cleaned = symbol.toUpperCase().trim();
    // Always hex-encode for Xaman compatibility (Xaman rejects short currency codes)
    const hex = Buffer.from(cleaned, 'ascii').toString('hex').toUpperCase();
    return hex.padEnd(40, '0');
  }

  /**
   * Build a TrustSet transaction payload for the user to sign.
   * The user (creator) sets a trust line to the issuer for the new token.
   */
  buildTrustSetPayload({ creatorWallet, issuerAddress, currencyHex, totalSupply }) {
    return {
      TransactionType: 'TrustSet',
      Account: creatorWallet,
      Flags: 131072, // tfSetNoRipple — disables rippling on this trust line
      LimitAmount: {
        currency: currencyHex,
        issuer: issuerAddress,
        value: totalSupply.toString()
      }
    };
  }

  /**
   * Build the token issuance Payment transaction.
   * The issuer sends the full supply to the creator's wallet.
   */
  buildTokenIssuancePayload({ issuerAddress, creatorWallet, currencyHex, totalSupply }) {
    return {
      TransactionType: 'Payment',
      Account: issuerAddress,
      Destination: creatorWallet,
      Amount: {
        currency: currencyHex,
        issuer: issuerAddress,
        value: totalSupply.toString()
      }
    };
  }

  /**
   * Prepare and autofill a transaction (adds Fee, Sequence, LastLedgerSequence).
   * Returns the prepared transaction object ready for signing.
   */
  async prepareTransaction(tx) {
    try {
      const client = xrplConfig.getClient();
      const prepared = await client.autofill(tx);
      return prepared;
    } catch (error) {
      logger.error('Error preparing transaction:', error);
      throw error;
    }
  }

  /**
   * Submit a signed transaction blob to the XRPL network.
   */
  async submitTransaction(txBlob) {
    try {
      const client = xrplConfig.getClient();
      const result = await client.submitAndWait(txBlob);
      return result;
    } catch (error) {
      logger.error('Error submitting transaction:', error);
      throw error;
    }
  }

  /**
   * Issue tokens from the admin (issuer) wallet to a destination.
   * Signs and submits the Payment transaction server-side.
   */
  async issueTokenFromAdmin({ destinationAddress, currencyHex, totalSupply }) {
    try {
      const wallet = xrplConfig.getAdminWallet();
      const client = xrplConfig.getClient();

      const tx = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: destinationAddress,
        Amount: {
          currency: currencyHex,
          issuer: wallet.address,
          value: totalSupply.toString()
        }
      };

      const prepared = await client.autofill(tx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      logger.info(`Token issued: ${totalSupply} ${currencyHex} to ${destinationAddress}, tx: ${result.result.hash}`);
      return result;
    } catch (error) {
      logger.error('Error issuing token from admin:', error);
      throw error;
    }
  }

  // ==================== AMM (Liquidity Pool) Operations ====================

  /**
   * Build an AMMCreate transaction payload for the user to sign via Xaman.
   * Creates a liquidity pool pairing the meme coin with XRP.
   *
   * @param {string} account - User's wallet address (LP provider)
   * @param {string} currencyHex - Hex-encoded currency code
   * @param {string} issuerAddress - Token issuer address
   * @param {string} tokenAmount - Amount of meme coins to deposit
   * @param {string} xrpAmount - Amount of XRP to deposit (in drops)
   * @param {number} tradingFee - Trading fee in basis points (0-1000, e.g. 500 = 0.5%)
   */
  buildAMMCreatePayload({ account, currencyHex, issuerAddress, tokenAmount, xrpAmount, tradingFee = 500 }) {
    return {
      TransactionType: 'AMMCreate',
      Account: account,
      Amount: {
        currency: currencyHex,
        issuer: issuerAddress,
        value: tokenAmount.toString()
      },
      Amount2: xrpAmount.toString(), // XRP in drops
      TradingFee: tradingFee
    };
  }

  /**
   * Build an AMMDeposit transaction payload.
   * Adds more liquidity to an existing pool.
   */
  buildAMMDepositPayload({ account, currencyHex, issuerAddress, tokenAmount, xrpAmount }) {
    const tx = {
      TransactionType: 'AMMDeposit',
      Account: account,
      Asset: { currency: currencyHex, issuer: issuerAddress },
      Asset2: { currency: 'XRP' },
      Flags: 1048576 // tfTwoAsset
    };
    if (tokenAmount) {
      tx.Amount = { currency: currencyHex, issuer: issuerAddress, value: tokenAmount.toString() };
    }
    if (xrpAmount) {
      tx.Amount2 = xrpAmount.toString();
    }
    return tx;
  }

  /**
   * Build an AMMWithdraw transaction payload.
   * Removes liquidity from a pool.
   */
  buildAMMWithdrawPayload({ account, currencyHex, issuerAddress, tokenAmount, xrpAmount }) {
    const tx = {
      TransactionType: 'AMMWithdraw',
      Account: account,
      Asset: { currency: currencyHex, issuer: issuerAddress },
      Asset2: { currency: 'XRP' },
      Flags: 1048576 // tfTwoAsset
    };
    if (tokenAmount) {
      tx.Amount = { currency: currencyHex, issuer: issuerAddress, value: tokenAmount.toString() };
    }
    if (xrpAmount) {
      tx.Amount2 = xrpAmount.toString();
    }
    return tx;
  }

  /**
   * Build a swap transaction: Buy meme coins with XRP.
   * Uses Payment with tfPartialPayment through the AMM.
   *
   * @param {string} account - Buyer's wallet
   * @param {string} currencyHex - Token currency hex
   * @param {string} issuerAddress - Token issuer
   * @param {string} tokenAmount - Amount of meme coins to receive
   * @param {string} maxXrpDrops - Maximum XRP to spend (in drops) — slippage protection
   */
  buildBuyTokenPayload({ account, currencyHex, issuerAddress, tokenAmount, maxXrpDrops }) {
    return {
      TransactionType: 'Payment',
      Account: account,
      Destination: account,
      Amount: {
        currency: currencyHex,
        issuer: issuerAddress,
        value: tokenAmount.toString()
      },
      SendMax: maxXrpDrops.toString(),
      Flags: 131072 // tfPartialPayment
    };
  }

  /**
   * Build a swap transaction: Sell meme coins for XRP.
   * Uses Payment with tfPartialPayment through the AMM.
   *
   * @param {string} account - Seller's wallet
   * @param {string} currencyHex - Token currency hex
   * @param {string} issuerAddress - Token issuer
   * @param {string} tokenAmount - Amount of meme coins to sell
   * @param {string} minXrpDrops - Minimum XRP to receive (in drops) — slippage protection
   */
  buildSellTokenPayload({ account, currencyHex, issuerAddress, tokenAmount, minXrpDrops }) {
    return {
      TransactionType: 'Payment',
      Account: account,
      Destination: account,
      Amount: minXrpDrops.toString(),
      SendMax: {
        currency: currencyHex,
        issuer: issuerAddress,
        value: tokenAmount.toString()
      },
      Flags: 131072 // tfPartialPayment
    };
  }

  /**
   * Get AMM pool info for a token pair from on-chain.
   * Returns pool details including balances, trading fee, LP token info.
   */
  async getAMMInfo(currencyHex, issuerAddress) {
    try {
      const client = xrplConfig.getClient();
      const response = await client.request({
        command: 'amm_info',
        asset: { currency: currencyHex, issuer: issuerAddress },
        asset2: { currency: 'XRP' }
      });
      return response.result;
    } catch (error) {
      if (error.data?.error === 'actNotFound') {
        return null; // No AMM exists for this pair
      }
      logger.error('Error fetching AMM info:', error.message);
      throw error;
    }
  }
}

module.exports = new XRPLService();
