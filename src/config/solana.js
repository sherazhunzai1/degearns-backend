const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const logger = require('../utils/logger');

// Network configurations
const NETWORK_CONFIGS = {
  'mainnet-beta': { explorerCluster: '' },
  devnet: { explorerCluster: '?cluster=devnet' },
  testnet: { explorerCluster: '?cluster=testnet' }
};

class SolanaConfig {
  constructor() {
    this.network = process.env.SOLANA_NETWORK || 'devnet';

    const networkConfig = NETWORK_CONFIGS[this.network] || NETWORK_CONFIGS.devnet;
    this.explorerCluster = networkConfig.explorerCluster;

    // Allow override via SOLANA_RPC_URL, otherwise use the public cluster endpoint
    this.rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(this.network);

    // Connection is created lazily on first use
    this.connection = null;

    logger.info(`Solana Config: Network=${this.network}, RPC=${this.rpcUrl}`);
  }

  /**
   * Get the Solana RPC connection (created lazily)
   */
  getConnection() {
    if (!this.connection) {
      this.connection = new Connection(this.rpcUrl, 'confirmed');
      logger.info(`Solana connection established to ${this.network}`);
    }
    return this.connection;
  }

  /**
   * Validate that a string is a well-formed Solana address
   */
  isValidAddress(address) {
    try {
      // eslint-disable-next-line no-new
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  getNetwork() {
    return this.network;
  }

  getNetworkInfo() {
    return {
      network: this.network,
      rpcUrl: this.rpcUrl,
      isMainnet: this.network === 'mainnet-beta',
      isTestnet: this.network !== 'mainnet-beta'
    };
  }

  getTransactionUrl(signature) {
    return `https://explorer.solana.com/tx/${signature}${this.explorerCluster}`;
  }

  getAccountUrl(address) {
    return `https://explorer.solana.com/address/${address}${this.explorerCluster}`;
  }
}

// Singleton instance
const solanaConfig = new SolanaConfig();

module.exports = solanaConfig;
