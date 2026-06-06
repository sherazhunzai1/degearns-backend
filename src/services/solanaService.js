/**
 * Solana Chain Service
 *
 * Provides Solana network operations: wallet signature verification,
 * balance lookups, and on-chain NFT discovery. Mirrors the role of
 * xrplService.js for the Solana network.
 */

const nacl = require('tweetnacl');
const bs58 = require('bs58');
const axios = require('axios');
const { PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const solanaConfig = require('../config/solana');
const logger = require('../utils/logger');

const NETWORK = 'solana';

// SPL Token program - owner of all token accounts
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/**
 * Verify an Ed25519 signature produced by a Solana wallet (Phantom/Solflare).
 * @param {string} walletAddress - Signer's base58 public key
 * @param {string} message - The plaintext message that was signed
 * @param {string} signature - base58-encoded signature
 * @returns {boolean} Whether the signature is valid
 */
function verifySignature(walletAddress, message, signature) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(walletAddress);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    logger.error('Solana signature verification failed:', error.message);
    return false;
  }
}

/**
 * Check whether a string is a valid Solana address.
 */
function isValidAddress(address) {
  return solanaConfig.isValidAddress(address);
}

/**
 * Get the SOL balance for a wallet.
 * @returns {Promise<{lamports: number, sol: number}>}
 */
async function getBalance(walletAddress) {
  const connection = solanaConfig.getConnection();
  const lamports = await connection.getBalance(new PublicKey(walletAddress));
  return { lamports, sol: lamports / LAMPORTS_PER_SOL };
}

/**
 * Discover NFT mint addresses held by a wallet.
 * An SPL token is treated as an NFT when it has 0 decimals and a balance of 1.
 * @returns {Promise<string[]>} Array of NFT mint addresses
 */
async function getNftMints(walletAddress) {
  const connection = solanaConfig.getConnection();
  const { value } = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(walletAddress),
    { programId: TOKEN_PROGRAM_ID }
  );

  return value
    .map((account) => account.account.data.parsed.info)
    .filter((info) => info.tokenAmount.decimals === 0 && info.tokenAmount.uiAmount === 1)
    .map((info) => info.mint);
}

// ==================== Helius DAS API (Digital Asset Standard) ====================
// These methods require a DAS-capable RPC (e.g., Helius). They return rich NFT
// metadata including name, image, attributes, collection info, and ownership data.

/**
 * Helper: send a DAS JSON-RPC request to the Helius RPC endpoint.
 */
async function dasRequest(method, params) {
  const { data } = await axios.post(solanaConfig.rpcUrl, {
    jsonrpc: '2.0',
    id: `das-${method}`,
    method,
    params
  });
  if (data.error) {
    throw new Error(`DAS ${method} error: ${data.error.message}`);
  }
  return data.result;
}

/**
 * Get full metadata for a single NFT by its mint address.
 * Returns name, image, attributes, collection, ownership, royalty info, etc.
 */
async function getAsset(mintAddress) {
  return dasRequest('getAsset', { id: mintAddress });
}

/**
 * Get all NFTs owned by a wallet with full metadata.
 * @param {number} page - 1-indexed page number
 * @param {number} limit - Max items per page (max 1000)
 */
async function getAssetsByOwner(walletAddress, page = 1, limit = 100) {
  return dasRequest('getAssetsByOwner', {
    ownerAddress: walletAddress,
    page,
    limit,
    displayOptions: { showFungible: false }
  });
}

/**
 * Get all fungible tokens (meme coins, SPL tokens) owned by a wallet.
 */
async function getTokensByOwner(walletAddress, page = 1, limit = 100) {
  return dasRequest('getAssetsByOwner', {
    ownerAddress: walletAddress,
    page,
    limit,
    displayOptions: { showFungible: true, showNativeBalance: true }
  });
}

/**
 * Get all NFTs in a collection by the collection's mint address.
 */
async function getAssetsByCollection(collectionMintAddress, page = 1, limit = 100) {
  return dasRequest('getAssetsByGroup', {
    groupKey: 'collection',
    groupValue: collectionMintAddress,
    page,
    limit
  });
}

/**
 * Search assets with flexible filters.
 * @param {Object} filters - DAS searchAssets params (ownerAddress, grouping, burnt, etc.)
 */
async function searchAssets(filters) {
  return dasRequest('searchAssets', filters);
}

// ==================== Transaction verification ====================

/**
 * Verify that a Solana transaction succeeded on-chain.
 * @param {string} signature - Transaction signature (base58)
 * @returns {Promise<{verified: boolean, transaction?: Object, error?: string}>}
 */
async function verifyTransaction(signature) {
  try {
    const connection = solanaConfig.getConnection();
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });
    if (!tx) {
      return { verified: false, error: 'Transaction not found' };
    }
    if (tx.meta && tx.meta.err) {
      return { verified: false, error: JSON.stringify(tx.meta.err) };
    }
    return { verified: true, transaction: tx };
  } catch (error) {
    logger.error('Solana transaction verification failed:', error.message);
    return { verified: false, error: error.message };
  }
}

function getNetworkInfo() {
  return solanaConfig.getNetworkInfo();
}

module.exports = {
  NETWORK,
  verifySignature,
  isValidAddress,
  getBalance,
  getNftMints,
  getAsset,
  getAssetsByOwner,
  getTokensByOwner,
  getAssetsByCollection,
  searchAssets,
  verifyTransaction,
  getNetworkInfo
};
