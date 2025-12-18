const { Client, Wallet } = require('xrpl');
const { secretToEntropy } = require('@xrplf/secret-numbers');
const logger = require('../utils/logger');

class XRPLConfig {
  constructor() {
    this.client = null;
    this.adminWallet = null;
    this.network = process.env.XRPL_NETWORK || 'mainnet';
    this.wssUrl = process.env.XRPL_WSS_URL || 'wss://xrplcluster.com';
  }

  /**
   * Initialize admin wallet from environment variables
   * Supports two formats:
   * 1. ADMIN_WALLET_SEED - Family seed (starts with 's')
   * 2. ADMIN_WALLET_SECRET_NUMBERS - Comma-separated 8 groups of 6 digits
   */
  initializeAdminWallet() {
    try {
      // Option 1: Family Seed (e.g., sEdV...)
      if (process.env.ADMIN_WALLET_SEED) {
        this.adminWallet = Wallet.fromSeed(process.env.ADMIN_WALLET_SEED);
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
        this.adminWallet = Wallet.fromEntropy(entropy);
        logger.info(`Admin wallet initialized from secret numbers: ${this.adminWallet.address}`);
        return;
      }

      logger.warn('No admin wallet configured. Set ADMIN_WALLET_SEED or ADMIN_WALLET_SECRET_NUMBERS in environment.');
    } catch (error) {
      logger.error('Failed to initialize admin wallet:', error.message);
      throw error;
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

  getNetwork() {
    return this.network;
  }
}

// Singleton instance
const xrplConfig = new XRPLConfig();

module.exports = xrplConfig;
