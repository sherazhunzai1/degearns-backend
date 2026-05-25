/**
 * Chain Service Factory
 *
 * Resolves a network identifier to its chain service implementation.
 * Controllers use this to stay network-agnostic instead of importing
 * xrplService or solanaService directly.
 */

const SUPPORTED_NETWORKS = ['xrpl', 'solana'];
const DEFAULT_NETWORK = 'xrpl';

/**
 * Normalize a network value: trims, lowercases, defaults to xrpl.
 */
function normalizeNetwork(network) {
  if (!network) return DEFAULT_NETWORK;
  return String(network).trim().toLowerCase();
}

/**
 * Whether the given network is supported by the platform.
 */
function isSupportedNetwork(network) {
  return SUPPORTED_NETWORKS.includes(normalizeNetwork(network));
}

/**
 * Get the chain service module for a network.
 * Services are required lazily to avoid load-order coupling.
 */
function getService(network) {
  const normalized = normalizeNetwork(network);
  switch (normalized) {
    case 'solana':
      return require('./solanaService');
    case 'xrpl':
      return require('./xrplService');
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

module.exports = {
  SUPPORTED_NETWORKS,
  DEFAULT_NETWORK,
  normalizeNetwork,
  isSupportedNetwork,
  getService
};
