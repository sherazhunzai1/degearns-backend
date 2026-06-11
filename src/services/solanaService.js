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
 * Get the current price of a token from a Raydium pool by reading
 * the pool's on-chain vault balances.
 *
 * Raydium CPMM pools store vault addresses inside the pool account data.
 * We parse the data to extract vault pubkeys, then read their balances.
 *
 * @param {string} poolAddress - Raydium pool address
 * @param {string} mintAddress - The meme coin's mint address
 * @returns {Promise<{price: number, baseBalance: number, quoteBalance: number} | null>}
 */
async function getRaydiumPoolPrice(poolAddress, mintAddress) {
  try {
    const connection = solanaConfig.getConnection();
    const poolPubkey = new PublicKey(poolAddress);

    // Fetch the pool account data
    const accountInfo = await connection.getAccountInfo(poolPubkey);
    if (!accountInfo || !accountInfo.data) return null;

    const data = accountInfo.data;

    // Raydium CPMM pool layout:
    // offset 72: token_0_vault (32 bytes)
    // offset 104: token_1_vault (32 bytes)
    // offset 168: token_0_mint (32 bytes)
    // offset 200: token_1_mint (32 bytes)
    if (data.length < 232) return null;

    const vault0 = new PublicKey(data.slice(72, 104));
    const vault1 = new PublicKey(data.slice(104, 136));
    const mint0 = new PublicKey(data.slice(168, 200));
    const mint1 = new PublicKey(data.slice(200, 232));

    // Read vault balances
    const [vault0Info, vault1Info] = await Promise.all([
      connection.getParsedAccountInfo(vault0),
      connection.getParsedAccountInfo(vault1)
    ]);

    const balance0 = parseFloat(vault0Info.value?.data?.parsed?.info?.tokenAmount?.uiAmountString || '0');
    const balance1 = parseFloat(vault1Info.value?.data?.parsed?.info?.tokenAmount?.uiAmountString || '0');

    // Determine which is base (meme coin) and which is quote (SOL/USDC)
    const mint0Str = mint0.toBase58();
    const mint1Str = mint1.toBase58();

    let baseBalance, quoteBalance;
    if (mint0Str === mintAddress) {
      baseBalance = balance0;
      quoteBalance = balance1;
    } else if (mint1Str === mintAddress) {
      baseBalance = balance1;
      quoteBalance = balance0;
    } else {
      logger.warn(`Token ${mintAddress} not found in pool ${poolAddress} (mint0=${mint0Str}, mint1=${mint1Str})`);
      return null;
    }

    if (baseBalance === 0) return null;

    const price = quoteBalance / baseBalance;

    logger.info(`Raydium pool price: ${poolAddress} | base=${baseBalance} quote=${quoteBalance} price=${price}`);

    return { price, baseBalance, quoteBalance, mint0: mint0Str, mint1: mint1Str };
  } catch (error) {
    logger.error(`Error fetching Raydium pool price for ${poolAddress}:`, error.message);
    return null;
  }
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

/**
 * Get parsed transaction history for a token mint address.
 * Uses Helius enhanced transactions API for rich swap data.
 * Returns swap details including token amounts, SOL amounts, and prices.
 */
async function getTokenTransactions(mintAddress, limit = 100) {
  // Helius enhanced API: parse transactions for an address
  // Extract API key from RPC URL
  const apiKeyMatch = solanaConfig.rpcUrl.match(/api-key=([^&]+)/);
  if (!apiKeyMatch) {
    throw new Error('Helius API key not found in RPC URL');
  }
  const apiKey = apiKeyMatch[1];

  const { data } = await axios.get(
    `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${apiKey}&limit=${limit}&type=SWAP`
  );

  return data || [];
}

/**
 * Parse Helius enhanced transaction into a trade record.
 * Extracts swap amounts from tokenTransfers and nativeTransfers.
 */
function parseHeliusSwap(tx, mintAddress) {
  if (!tx || tx.type !== 'SWAP') return null;

  const tokenTransfers = tx.tokenTransfers || [];
  const nativeTransfers = tx.nativeTransfers || [];

  // Find the transfer involving our mint
  const tokenTransfer = tokenTransfers.find(t => t.mint === mintAddress);
  if (!tokenTransfer) return null;

  const tokenAmount = Math.abs(tokenTransfer.tokenAmount || 0);
  if (tokenAmount === 0) return null;

  // Determine trade direction from the fee payer's perspective
  const feePayer = tx.feePayer;
  const isBuy = tokenTransfer.toUserAccount === feePayer;

  // Find SOL transfer (native) for the swap
  let solAmount = 0;
  for (const nt of nativeTransfers) {
    if (nt.fromUserAccount === feePayer || nt.toUserAccount === feePayer) {
      solAmount += Math.abs(nt.amount || 0);
    }
  }
  // Convert lamports to SOL
  solAmount = solAmount / 1e9;

  // If no native transfer, check other token transfers (might be USDC pair)
  let pairToken = 'SOL';
  let pairAmount = solAmount;
  if (solAmount === 0) {
    const otherTransfer = tokenTransfers.find(t => t.mint !== mintAddress);
    if (otherTransfer) {
      pairAmount = Math.abs(otherTransfer.tokenAmount || 0);
      pairToken = otherTransfer.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' : otherTransfer.mint?.slice(0, 6);
    }
  }

  if (pairAmount === 0) return null;

  const pricePerToken = tokenAmount > 0 ? pairAmount / tokenAmount : 0;

  return {
    txHash: tx.signature,
    trader: feePayer,
    type: isBuy ? 'buy' : 'sell',
    tokenAmount,
    pairAmount,
    pairToken,
    pricePerToken,
    timestamp: tx.timestamp ? new Date(tx.timestamp * 1000) : null,
    description: tx.description
  };
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
  getTokenTransactions,
  parseHeliusSwap,
  getRaydiumPoolPrice,
  getNetworkInfo
};
