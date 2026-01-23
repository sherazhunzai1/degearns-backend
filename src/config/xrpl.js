const { Client, Wallet } = require('xrpl');
const { secretToEntropy } = require('@xrplf/secret-numbers');
const logger = require('../utils/logger');

// Network configurations
const NETWORK_CONFIGS = {
  testnet: {
    wssUrl: 'wss://s.altnet.rippletest.net:51233',
    faucetUrl: 'https://faucet.altnet.rippletest.net/accounts',
    explorerUrl: 'https://testnet.xrpl.org'
  },
  devnet: {
    wssUrl: 'wss://s.devnet.rippletest.net:51233',
    faucetUrl: 'https://faucet.devnet.rippletest.net/accounts',
    explorerUrl: 'https://devnet.xrpl.org'
  },
  mainnet: {
    wssUrl: 'wss://xrplcluster.com',
    faucetUrl: null,
    explorerUrl: 'https://livenet.xrpl.org'
  }
};

class XRPLConfig {
  constructor() {
    this.client = null;
    this.adminWallet = null;
    this.treasuryWallet = null;
    this.network = process.env.XRPL_NETWORK || 'testnet';

    // Reconnection settings
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000; // 1 second
    this.maxReconnectDelay = 60000; // 60 seconds

    // Get network config based on XRPL_NETWORK environment variable
    const networkConfig = NETWORK_CONFIGS[this.network] || NETWORK_CONFIGS.testnet;

    // Allow override via XRPL_WSS_URL, otherwise use network default
    this.wssUrl = process.env.XRPL_WSS_URL || networkConfig.wssUrl;
    this.explorerUrl = networkConfig.explorerUrl;
    this.faucetUrl = networkConfig.faucetUrl;

    logger.info(`XRPL Config: Network=${this.network}, WSS=${this.wssUrl}`);
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

      // Reset reconnection state on successful connect
      this.reconnectAttempts = 0;
      this.isReconnecting = false;

      logger.info(`Connected to XRPL ${this.network} network`);

      // Initialize admin wallet
      this.initializeAdminWallet();

      // Initialize treasury wallet
      this.initializeTreasuryWallet();

      // Handle connection events
      this.client.on('disconnected', (code) => {
        logger.warn(`XRPL disconnected with code: ${code}`);
        this.handleDisconnect();
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

  /**
   * Handle disconnection with automatic reconnection
   */
  async handleDisconnect() {
    if (this.isReconnecting) {
      return; // Already trying to reconnect
    }

    this.isReconnecting = true;

    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay
      );

      logger.info(`XRPL reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);

      await this.sleep(delay);

      try {
        // Create new client for reconnection
        this.client = new Client(this.wssUrl);
        await this.client.connect();

        // Re-attach event handlers
        this.client.on('disconnected', (code) => {
          logger.warn(`XRPL disconnected with code: ${code}`);
          this.handleDisconnect();
        });

        this.client.on('error', (errorCode, errorMessage) => {
          logger.error(`XRPL error ${errorCode}: ${errorMessage}`);
        });

        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        logger.info(`XRPL reconnected successfully to ${this.network} network`);
        return;
      } catch (error) {
        logger.error(`XRPL reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
      }
    }

    this.isReconnecting = false;
    logger.error(`XRPL failed to reconnect after ${this.maxReconnectAttempts} attempts. Manual intervention required.`);
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure client is connected, attempt reconnect if not
   */
  async ensureConnected() {
    if (this.client && this.client.isConnected()) {
      return true;
    }

    if (this.isReconnecting) {
      // Wait for ongoing reconnection
      let waitCount = 0;
      while (this.isReconnecting && waitCount < 30) {
        await this.sleep(1000);
        waitCount++;
      }
      return this.client && this.client.isConnected();
    }

    // Try to connect
    try {
      await this.connect();
      return true;
    } catch (error) {
      return false;
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
      // Trigger reconnection in background
      if (!this.isReconnecting) {
        this.handleDisconnect();
      }
      throw new Error('XRPL client is not connected. Reconnection in progress...');
    }
    return this.client;
  }

  /**
   * Get client with automatic reconnection (async version)
   * Waits for reconnection if needed
   */
  async getClientAsync() {
    const connected = await this.ensureConnected();
    if (!connected) {
      throw new Error('XRPL client could not connect');
    }
    return this.client;
  }

  /**
   * Check if XRPL is currently connected
   */
  isConnected() {
    return this.client && this.client.isConnected();
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected(),
      reconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      network: this.network,
      wssUrl: this.wssUrl
    };
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

  /**
   * Get full network configuration info
   */
  getNetworkInfo() {
    return {
      network: this.network,
      wssUrl: this.wssUrl,
      explorerUrl: this.explorerUrl,
      faucetUrl: this.faucetUrl,
      isTestnet: this.network === 'testnet' || this.network === 'devnet',
      isMainnet: this.network === 'mainnet'
    };
  }

  /**
   * Get transaction explorer URL
   */
  getTransactionUrl(txHash) {
    return `${this.explorerUrl}/transactions/${txHash}`;
  }

  /**
   * Get account explorer URL
   */
  getAccountUrl(address) {
    return `${this.explorerUrl}/accounts/${address}`;
  }
}

// Singleton instance
const xrplConfig = new XRPLConfig();

module.exports = xrplConfig;
