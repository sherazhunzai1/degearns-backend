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

// Well-known Solana mints used for pricing/quoting
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Jupiter aggregator API. Keyless "lite" endpoint by default; override with
// JUPITER_API_URL (e.g. https://api.jup.ag) + optional JUPITER_API_KEY.
const JUPITER_API_URL = (process.env.JUPITER_API_URL || 'https://lite-api.jup.ag').replace(/\/$/, '');
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || null;

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

// ==================== Jupiter Aggregator (Swaps & Pricing) ====================
// Jupiter is the primary Solana liquidity/routing layer (replaces direct Raydium
// SDK usage). It routes each swap through the best available pool(s) across every
// Solana DEX. Docs: https://dev.jup.ag/docs/

function jupiterHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (JUPITER_API_KEY) headers['x-api-key'] = JUPITER_API_KEY;
  return headers;
}

/**
 * Resolve a pair-token symbol (SOL/USDC/USDT) to its mint address.
 * If an actual mint address is passed, it is returned unchanged.
 */
function resolvePairMint(pairToken) {
  if (!pairToken) return SOL_MINT;
  const upper = String(pairToken).toUpperCase();
  if (upper === 'SOL' || upper === 'WSOL') return SOL_MINT;
  if (upper === 'USDC') return USDC_MINT;
  if (upper === 'USDT') return USDT_MINT;
  return pairToken; // assume already a mint address
}

/**
 * Get a Jupiter swap quote (best route across all Solana DEXs).
 *
 * @param {Object} p
 * @param {string} p.inputMint - mint being sold
 * @param {string} p.outputMint - mint being bought
 * @param {string|number} p.amount - amount of inputMint in BASE units (lamports / token raw units)
 * @param {number} [p.slippageBps=100] - slippage tolerance in basis points (100 = 1%)
 * @param {string} [p.swapMode='ExactIn'] - 'ExactIn' or 'ExactOut'
 * @returns {Promise<Object>} Jupiter quote object — pass it as-is to buildJupiterSwapTransaction
 */
async function getJupiterQuote({ inputMint, outputMint, amount, slippageBps = 100, swapMode = 'ExactIn' }) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps),
    swapMode
  });
  const url = `${JUPITER_API_URL}/swap/v1/quote?${params.toString()}`;
  const { data } = await axios.get(url, { headers: jupiterHeaders(), timeout: 15000 });
  return data;
}

/**
 * Build an unsigned Jupiter swap transaction (base64-serialized) for the user to
 * sign and send from the frontend wallet (Phantom/Solflare).
 *
 * @param {Object} p
 * @param {Object} p.quoteResponse - the object returned by getJupiterQuote
 * @param {string} p.userPublicKey - the swapping wallet
 * @param {boolean} [p.wrapAndUnwrapSol=true] - auto-wrap/unwrap native SOL
 * @param {string|number} [p.prioritizationFeeLamports='auto']
 * @returns {Promise<Object>} { swapTransaction, lastValidBlockHeight, ... }
 */
async function buildJupiterSwapTransaction({ quoteResponse, userPublicKey, wrapAndUnwrapSol = true, prioritizationFeeLamports = 'auto' }) {
  const body = {
    quoteResponse,
    userPublicKey,
    wrapAndUnwrapSol,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports
  };
  const url = `${JUPITER_API_URL}/swap/v1/swap`;
  const { data } = await axios.post(url, body, { headers: jupiterHeaders(), timeout: 20000 });
  return data;
}

/**
 * Get the current price of a token from Jupiter's price API.
 *
 * @param {string} mintAddress - token mint
 * @param {string} [vsToken=USDC] - mint to price against. Pass SOL_MINT for a SOL-denominated price.
 * @returns {Promise<number>} price in vsToken units per 1 token, or 0 if unavailable
 */
async function getJupiterPrice(mintAddress, vsToken = USDC_MINT) {
  try {
    const params = new URLSearchParams({ ids: mintAddress });
    if (vsToken && vsToken !== USDC_MINT) params.set('vsToken', vsToken);
    const url = `${JUPITER_API_URL}/price/v2?${params.toString()}`;
    const { data } = await axios.get(url, { headers: jupiterHeaders(), timeout: 12000 });
    // Tolerate both Price API shapes — V2: { data: { <mint>: { price } } }
    // and V3: { <mint>: { usdPrice } } — in case the endpoint version changes.
    const entry = data?.data?.[mintAddress] || data?.[mintAddress];
    const raw = entry ? (entry.price ?? entry.usdPrice) : null;
    const price = raw != null ? parseFloat(raw) : 0;
    return isNaN(price) ? 0 : price;
  } catch (error) {
    logger.warn(`Jupiter price fetch failed for ${mintAddress}: ${error.message}`);
    return 0;
  }
}

/**
 * Read the current token price directly from a liquidity pool's on-chain vault
 * balances (SOL/quote per token). Used as a fallback when Jupiter hasn't indexed a
 * brand-new token yet but the frontend knows the pool address. Assumes a Raydium
 * CPMM-style layout (token_0_vault @72, token_1_vault @104, mint_0 @168, mint_1 @200).
 *
 * @returns {Promise<{price:number, baseBalance:number, quoteBalance:number}|null>}
 */
async function getOnChainPoolPrice(poolAddress, mintAddress) {
  try {
    if (!poolAddress || !mintAddress) return null;
    const connection = solanaConfig.getConnection();
    const accountInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
    if (!accountInfo || !accountInfo.data || accountInfo.data.length < 232) return null;

    const data = accountInfo.data;
    const vault0 = new PublicKey(data.slice(72, 104));
    const vault1 = new PublicKey(data.slice(104, 136));
    const mint0 = new PublicKey(data.slice(168, 200)).toBase58();
    const mint1 = new PublicKey(data.slice(200, 232)).toBase58();

    const [vault0Info, vault1Info] = await Promise.all([
      connection.getParsedAccountInfo(vault0),
      connection.getParsedAccountInfo(vault1)
    ]);
    const balance0 = parseFloat(vault0Info.value?.data?.parsed?.info?.tokenAmount?.uiAmountString || '0');
    const balance1 = parseFloat(vault1Info.value?.data?.parsed?.info?.tokenAmount?.uiAmountString || '0');

    let baseBalance, quoteBalance;
    if (mint0 === mintAddress) { baseBalance = balance0; quoteBalance = balance1; }
    else if (mint1 === mintAddress) { baseBalance = balance1; quoteBalance = balance0; }
    else return null;

    if (!baseBalance || baseBalance === 0) return null;
    return { price: quoteBalance / baseBalance, baseBalance, quoteBalance };
  } catch (error) {
    logger.warn(`On-chain pool price read failed for ${poolAddress}: ${error.message}`);
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
  SOL_MINT,
  USDC_MINT,
  USDT_MINT,
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
  resolvePairMint,
  getJupiterQuote,
  buildJupiterSwapTransaction,
  getJupiterPrice,
  getOnChainPoolPrice,
  getNetworkInfo
};
