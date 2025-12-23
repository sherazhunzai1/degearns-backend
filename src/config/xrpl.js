const { Client, Wallet } = require('xrpl');
const { secretToEntropy } = require('@xrplf/secret-numbers');
const logger = require('../utils/logger');

class XRPLConfig {
  constructor() {
    this.client = null;
    this.adminWallet = null;
    this.treasuryWallet = null;
    this.network = process.env.XRPL_NETWORK || 'mainnet';
    this.wssUrl = process.env.XRPL_WSS_URL || 'wss://xrplcluster.com';
  }

  /**
   * Initialize admin wallet from environment variables
   * Supports two formats:
   * 1. ADMIN_WALLET_SEED - Family seed (starts with 's')
   * 2. ADMIN_WALLET_SECRET_NUMBERS - Comma-separated 8 groups of 6 digits
   *
   * Optional: ADMIN_WALLET_ALGORITHM - 'ed25519' or 'secp256k1' (default: 'secp256k1' for secret numbers)
   */
  initializeAdminWallet() {
    try {
      // Option 1: Family Seed (e.g., sEdV...)
      if (process.env.ADMIN_WALLET_SEED) {
        const algorithm = process.env.ADMIN_WALLET_ALGORITHM || undefined;
        this.adminWallet = Wallet.fromSeed(process.env.ADMIN_WALLET_SEED, { algorithm });
        logger.info(`Admin wallet initialized from seed: ${this.adminWallet.address}`);
        return;
      }

      // Option 2: Secret Numbers (8 groups of 6 digits, comma-separated)
      // Format: 123456,234567,345678,456789,567890,678901,789012,890123
      if (process.env.ADMIN_WALLET_SECRET_NUMBERS) {
        const secretNumbers = process.env.ADMIN_WALLET_SECRET_NUMBERS
          .split(',')
          .map(num => num.trim());

        if (secretNumbers.length !== 8) {
          throw new Error('Secret numbers must have exactly 8 groups');
        }

        // Validate each group is 6 digits
        for (const num of secretNumbers) {
          if (!/^\d{6}$/.test(num)) {
            throw new Error(`Invalid secret number group: ${num}. Each group must be 6 digits.`);
          }
        }

        const entropy = secretToEntropy(secretNumbers);

        // Default to secp256k1 for secret numbers
        const algorithm = process.env.ADMIN_WALLET_ALGORITHM || 'secp256k1';
        this.adminWallet = Wallet.fromEntropy(entropy, { algorithm });
        logger.info(`Admin wallet initialized from secret numbers (${algorithm}): ${this.adminWallet.address}`);
        return;
      }

      logger.warn('No admin wallet configured. Set ADMIN_WALLET_SEED or ADMIN_WALLET_SECRET_NUMBERS in environment.');
    } catch (error) {
      logger.error('Failed to initialize admin wallet:', error.message);
      throw error;
    }
  }

  /**
   * Initialize treasury wallet from environment variables
   * Used for reward distribution
   * Supports:
   * 1. TREASURY_WALLET_SEED - Family seed (starts with 's')
   * 2. TREASURY_WALLET_SECRET_NUMBERS - Comma-separated 8 groups of 6 digits
   */
  initializeTreasuryWallet() {
    try {
      // Option 1: Family Seed (e.g., sEdV...)
      if (process.env.TREASURY_WALLET_SEED) {
        const algorithm = process.env.TREASURY_WALLET_ALGORITHM || undefined;
        this.treasuryWallet = Wallet.fromSeed(process.env.TREASURY_WALLET_SEED, { algorithm });
        logger.info(`Treasury wallet initialized from seed: ${this.treasuryWallet.address}`);
        return;
      }

      // Option 2: Secret Numbers (8 groups of 6 digits, comma-separated)
      if (process.env.TREASURY_WALLET_SECRET_NUMBERS) {
        const secretNumbers = process.env.TREASURY_WALLET_SECRET_NUMBERS
          .split(',')
          .map(num => num.trim());

        if (secretNumbers.length !== 8) {
          throw new Error('Treasury secret numbers must have exactly 8 groups');
        }

        // Validate each group is 6 digits
        for (const num of secretNumbers) {
          if (!/^\d{6}$/.test(num)) {
            throw new Error(`Invalid treasury secret number group: ${num}. Each group must be 6 digits.`);
          }
        }

        const entropy = secretToEntropy(secretNumbers);

        // Default to secp256k1 for secret numbers
        const algorithm = process.env.TREASURY_WALLET_ALGORITHM || 'secp256k1';
        this.treasuryWallet = Wallet.fromEntropy(entropy, { algorithm });
        logger.info(`Treasury wallet initialized from secret numbers (${algorithm}): ${this.treasuryWallet.address}`);
        return;
      }

      logger.warn('No treasury wallet configured. Set TREASURY_WALLET_SEED or TREASURY_WALLET_SECRET_NUMBERS in environment.');
    } catch (error) {
      logger.error('Failed to initialize treasury wallet:', error.message);
      // Don't throw - treasury wallet is optional
    }
  }

  /**
   * Get wallet addresses for both algorithms (for debugging)
   */
  getWalletAddressesForBothAlgorithms() {
    if (!process.env.ADMIN_WALLET_SECRET_NUMBERS) {
      return null;
    }

    try {
      const secretNumbers = process.env.ADMIN_WALLET_SECRET_NUMBERS
        .split(',')
        .map(num => num.trim());

      if (secretNumbers.length !== 8) {
        return null;
      }

      const entropy = secretToEntropy(secretNumbers);

      const secp256k1Wallet = Wallet.fromEntropy(entropy, { algorithm: 'secp256k1' });
      const ed25519Wallet = Wallet.fromEntropy(entropy, { algorithm: 'ed25519' });

      return {
        secp256k1: secp256k1Wallet.address,
        ed25519: ed25519Wallet.address
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async connect() {
    try {
      if (this.client && this.client.isConnected()) {
        return this.client;
      }

      this.client = new Client(this.wssUrl);
      await this.client.connect();

      logger.info(`Connected to XRPL ${this.network} network`);

      // Initialize admin wallet
      this.initializeAdminWallet();

      // Initialize treasury wallet
      this.initializeTreasuryWallet();

      // Handle connection events
      this.client.on('disconnected', (code) => {
        logger.warn(`XRPL disconnected with code: ${code}`);
      });

      this.client.on('error', (errorCode, errorMessage) => {
        logger.error(`XRPL error ${errorCode}: ${errorMessage}`);
      });

      return this.client;
    } catch (error) {
      logger.error('Failed to connect to XRPL:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
      logger.info('Disconnected from XRPL network');
    }
  }

  getClient() {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('XRPL client is not connected');
    }
    return this.client;
  }

  getAdminWallet() {
    if (!this.adminWallet) {
      throw new Error('Admin wallet is not configured. Set ADMIN_WALLET_SEED or ADMIN_WALLET_SECRET_NUMBERS in environment.');
    }
    return this.adminWallet;
  }

  /**
   * Get admin wallet address (safe method that doesn't throw)
   * Returns null if admin wallet is not configured
   */
  getAdminWalletAddress() {
    if (this.adminWallet) {
      return this.adminWallet.address;
    }
    return null;
  }

  /**
   * Get treasury wallet for signing reward distribution transactions
   */
  getTreasuryWallet() {
    if (!this.treasuryWallet) {
      throw new Error('Treasury wallet is not configured. Set TREASURY_WALLET_SEED or TREASURY_WALLET_SECRET_NUMBERS in environment.');
    }
    return this.treasuryWallet;
  }

  /**
   * Get treasury wallet address (safe method that doesn't throw)
   * Returns null if treasury wallet is not configured
   */
  getTreasuryWalletAddress() {
    if (this.treasuryWallet) {
      return this.treasuryWallet.address;
    }
    return null;
  }

  /**
   * Check if treasury wallet is configured
   */
  hasTreasuryWallet() {
    return !!this.treasuryWallet;
  }

  /**
   * Get treasury wallet configuration status
   */
  getTreasuryWalletConfig() {
    const hasSeed = !!process.env.TREASURY_WALLET_SEED;
    const hasSecretNumbers = !!process.env.TREASURY_WALLET_SECRET_NUMBERS;
    const algorithm = process.env.TREASURY_WALLET_ALGORITHM || (hasSecretNumbers ? 'secp256k1' : 'auto');

    return {
      configured: hasSeed || hasSecretNumbers,
      method: hasSeed ? 'SEED' : (hasSecretNumbers ? 'SECRET_NUMBERS' : 'NONE'),
      algorithm,
      address: this.getTreasuryWalletAddress()
    };
  }

  getNetwork() {
    return this.network;
  }
}

// Singleton instance
const xrplConfig = new XRPLConfig();

module.exports = xrplConfig;
