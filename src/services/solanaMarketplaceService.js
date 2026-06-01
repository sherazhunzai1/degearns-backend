/**
 * Solana Marketplace Service
 *
 * Handles NFT transfers using the marketplace authority keypair as a delegate.
 * When a seller delegates sale authority to the marketplace, this service can
 * execute the transfer to the buyer after verifying SOL payment.
 */

const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { keypairIdentity, publicKey } = require('@metaplex-foundation/umi');
const { transferV1, TokenStandard, mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
const { Keypair } = require('@solana/web3.js');
const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');
const solanaConfig = require('../config/solana');
const solanaService = require('./solanaService');
const logger = require('../utils/logger');

let umi = null;
let marketplaceKeypair = null;

/**
 * Load the marketplace authority keypair from env config.
 * Supports:
 * - SOLANA_MARKETPLACE_KEYPAIR_PATH: path to JSON file (Solana CLI format)
 * - SOLANA_MARKETPLACE_SECRET_KEY: base58-encoded secret key
 */
function loadMarketplaceKeypair() {
  if (marketplaceKeypair) return marketplaceKeypair;

  // Option 1: JSON file path
  const keypairPath = process.env.SOLANA_MARKETPLACE_KEYPAIR_PATH;
  if (keypairPath) {
    try {
      const resolvedPath = path.resolve(keypairPath);
      const keypairData = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
      marketplaceKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
      logger.info(`Marketplace authority loaded from file: ${marketplaceKeypair.publicKey.toBase58()}`);
      return marketplaceKeypair;
    } catch (error) {
      logger.error('Failed to load marketplace keypair from file:', error.message);
    }
  }

  // Option 2: Base58 secret key
  const secretKey = process.env.SOLANA_MARKETPLACE_SECRET_KEY;
  if (secretKey) {
    try {
      marketplaceKeypair = Keypair.fromSecretKey(bs58.decode(secretKey));
      logger.info(`Marketplace authority loaded from secret key: ${marketplaceKeypair.publicKey.toBase58()}`);
      return marketplaceKeypair;
    } catch (error) {
      logger.error('Failed to load marketplace keypair from secret key:', error.message);
    }
  }

  logger.warn('No marketplace authority keypair configured. Set SOLANA_MARKETPLACE_KEYPAIR_PATH or SOLANA_MARKETPLACE_SECRET_KEY');
  return null;
}

/**
 * Get or create the UMI instance configured with the marketplace keypair.
 */
function getUmi() {
  if (umi) return umi;

  const kp = loadMarketplaceKeypair();
  if (!kp) {
    throw new Error('Marketplace authority keypair is not configured');
  }

  umi = createUmi(solanaConfig.rpcUrl)
    .use(mplTokenMetadata());

  // Convert @solana/web3.js Keypair to UMI format
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(kp.secretKey);
  umi.use(keypairIdentity(umiKeypair));

  logger.info(`UMI initialized with marketplace authority: ${kp.publicKey.toBase58()}`);
  return umi;
}

/**
 * Get the marketplace authority public key.
 */
function getMarketplaceAddress() {
  const kp = loadMarketplaceKeypair();
  return kp ? kp.publicKey.toBase58() : null;
}

/**
 * Verify a SOL payment transaction on-chain.
 * Checks that:
 * 1. Transaction exists and succeeded
 * 2. The buyer sent SOL to the seller
 * 3. The amount matches the expected price
 *
 * @param {string} signature - Transaction signature
 * @param {string} buyerAddress - Expected buyer (sender of SOL)
 * @param {string} sellerAddress - Expected seller (receiver of SOL)
 * @param {number|string} expectedLamports - Expected payment amount in lamports
 * @returns {Promise<{verified: boolean, error?: string}>}
 */
async function verifyPayment(signature, buyerAddress, sellerAddress, expectedLamports) {
  try {
    const connection = solanaConfig.getConnection();
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return { verified: false, error: 'Transaction not found' };
    }

    if (tx.meta && tx.meta.err) {
      return { verified: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
    }

    // Check SOL transfer by comparing pre/post balances
    const accountKeys = tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys;
    const buyerIndex = accountKeys.findIndex(k => k.toBase58() === buyerAddress);
    const sellerIndex = accountKeys.findIndex(k => k.toBase58() === sellerAddress);

    if (buyerIndex === -1) {
      return { verified: false, error: 'Buyer address not found in transaction' };
    }
    if (sellerIndex === -1) {
      return { verified: false, error: 'Seller address not found in transaction' };
    }

    const sellerPreBalance = tx.meta.preBalances[sellerIndex];
    const sellerPostBalance = tx.meta.postBalances[sellerIndex];
    const received = sellerPostBalance - sellerPreBalance;

    const expected = BigInt(expectedLamports);
    if (BigInt(received) < expected) {
      return { verified: false, error: `Insufficient payment. Expected ${expected} lamports, received ${received}` };
    }

    return { verified: true };
  } catch (error) {
    logger.error('Payment verification error:', error.message);
    return { verified: false, error: error.message };
  }
}

/**
 * Transfer an NFT from seller to buyer using the marketplace delegate authority.
 * The seller must have previously called delegateSaleV1 to grant the marketplace permission.
 *
 * @param {string} nftMintAddress - The NFT's mint address
 * @param {string} sellerAddress - Current owner (seller) wallet
 * @param {string} buyerAddress - Destination (buyer) wallet
 * @returns {Promise<{success: boolean, signature?: string, error?: string}>}
 */
async function transferNft(nftMintAddress, sellerAddress, buyerAddress) {
  try {
    const umiInstance = getUmi();

    const result = await transferV1(umiInstance, {
      mint: publicKey(nftMintAddress),
      authority: umiInstance.identity,
      tokenOwner: publicKey(sellerAddress),
      destinationOwner: publicKey(buyerAddress),
      tokenStandard: TokenStandard.NonFungible
    }).sendAndConfirm(umiInstance);

    const signature = bs58.encode(result.signature);
    logger.info(`NFT transferred: ${nftMintAddress} from ${sellerAddress} to ${buyerAddress} (tx: ${signature})`);

    return { success: true, signature };
  } catch (error) {
    logger.error(`NFT transfer failed: ${nftMintAddress}`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  loadMarketplaceKeypair,
  getMarketplaceAddress,
  getUmi,
  verifyPayment,
  transferNft
};
