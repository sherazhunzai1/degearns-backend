/**
 * Crypto Price Service
 *
 * Fetches and caches XRP/USD and SOL/USD prices for converting
 * trade volumes to a common USD value for cross-chain scoring.
 */

const axios = require('axios');
const logger = require('../utils/logger');

let priceCache = {
  xrp: 0,
  sol: 0,
  updatedAt: 0
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch current prices. Tries multiple free APIs in order.
 */
async function fetchPrices() {
  const sources = [
    {
      name: 'CoinGecko',
      url: 'https://api.coingecko.com/api/v3/simple/price?ids=ripple,solana&vs_currencies=usd',
      parse: (data) => ({ xrp: data.ripple?.usd, sol: data.solana?.usd })
    },
    {
      name: 'Binance',
      url: 'https://api.binance.com/api/v3/ticker/price?symbols=["XRPUSDT","SOLUSDT"]',
      parse: (data) => {
        const map = {};
        data.forEach(t => { map[t.symbol] = parseFloat(t.price); });
        return { xrp: map.XRPUSDT, sol: map.SOLUSDT };
      }
    }
  ];

  for (const source of sources) {
    try {
      const { data } = await axios.get(source.url, { timeout: 10000 });
      const prices = source.parse(data);

      if (prices.xrp && prices.sol) {
        priceCache = {
          xrp: prices.xrp,
          sol: prices.sol,
          updatedAt: Date.now()
        };
        logger.info(`Prices from ${source.name}: XRP=$${priceCache.xrp}, SOL=$${priceCache.sol}`);
        return priceCache;
      }
    } catch (error) {
      logger.warn(`Price fetch from ${source.name} failed: ${error.message}`);
    }
  }

  // All sources failed — use fallback prices if cache is empty
  if (!priceCache.xrp || !priceCache.sol) {
    priceCache = {
      xrp: priceCache.xrp || 2.5,
      sol: priceCache.sol || 170,
      updatedAt: Date.now()
    };
    logger.warn(`All price sources failed. Using fallback: XRP=$${priceCache.xrp}, SOL=$${priceCache.sol}`);
  }

  return priceCache;
}

/**
 * Get cached prices, refresh if stale.
 */
async function getPrices() {
  if (Date.now() - priceCache.updatedAt > CACHE_TTL_MS) {
    await fetchPrices();
  }
  return priceCache;
}

/**
 * Convert XRP drops to USD.
 * @param {number} drops - Amount in XRP drops (1 XRP = 1,000,000 drops)
 */
async function dropsToUsd(drops) {
  const prices = await getPrices();
  const xrp = Number(drops) / 1e6;
  return xrp * prices.xrp;
}

/**
 * Convert SOL lamports to USD.
 * @param {number} lamports - Amount in lamports (1 SOL = 1,000,000,000 lamports)
 */
async function lamportsToUsd(lamports) {
  const prices = await getPrices();
  const sol = Number(lamports) / 1e9;
  return sol * prices.sol;
}

/**
 * Convert a raw amount to USD based on the network.
 * @param {number} amount - Raw amount (drops or lamports)
 * @param {string} network - 'xrpl' or 'solana'
 */
async function toUsd(amount, network) {
  if (network === 'solana') return lamportsToUsd(amount);
  return dropsToUsd(amount);
}

module.exports = {
  fetchPrices,
  getPrices,
  dropsToUsd,
  lamportsToUsd,
  toUsd
};
