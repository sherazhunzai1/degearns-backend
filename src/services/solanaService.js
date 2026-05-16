/**
 * Solana Chain Service
 *
 * Provides Solana network operations: wallet signature verification,
 * balance lookups, and on-chain NFT discovery. Mirrors the role of
 * xrplService.js for the Solana network.
 */

const nacl = require('tweetnacl');
const bs58 = require('bs58');
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

function getNetworkInfo() {
  return solanaConfig.getNetworkInfo();
}

module.exports = {
  NETWORK,
  verifySignature,
  isValidAddress,
  getBalance,
  getNftMints,
  getNetworkInfo
};
