const { Client, Wallet } = require('xrpl');
const logger = require('../utils/logger');

class XRPLConfig {
  constructor() {
    this.client = null;
    this.adminWallet = null;
    this.network = process.env.XRPL_NETWORK || 'mainnet';
    this.wssUrl = process.env.XRPL_WSS_URL || 'wss://xrplcluster.com';
  }

  async connect() {
    try {
      if (this.client && this.client.isConnected()) {
        return this.client;
      }

      this.client = new Client(this.wssUrl);
      await this.client.connect();

      logger.info(`Connected to XRPL ${this.network} network`);

      // Initialize admin wallet if seed is provided
      if (process.env.ADMIN_WALLET_SEED) {
        this.adminWallet = Wallet.fromSeed(process.env.ADMIN_WALLET_SEED);
        logger.info(`Admin wallet initialized: ${this.adminWallet.address}`);
      }

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
      throw new Error('Admin wallet is not configured');
    }
    return this.adminWallet;
  }

  getNetwork() {
    return this.network;
  }
}

// Singleton instance
const xrplConfig = new XRPLConfig();

module.exports = xrplConfig;
