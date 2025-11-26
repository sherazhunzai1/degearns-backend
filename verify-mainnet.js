#!/usr/bin/env node
/**
 * Verify Mainnet Connection and Wallet NFTs
 *
 * This script checks:
 * 1. Which XRPL network the app is configured to use
 * 2. If the wallet has NFTs on mainnet
 * 3. Collection information (taxons)
 */

require('dotenv').config();
const { Client } = require('xrpl');

const walletAddress = 'r9kmwcKEVo3iQtPxASzZbZ8MFr3ConVBtb';

async function verifyMainnet() {
  console.log('=== XRPL Mainnet Verification ===\n');

  // Check environment configuration
  console.log('1. Environment Configuration:');
  console.log(`   XRPL_NETWORK: ${process.env.XRPL_NETWORK || 'mainnet (default)'}`);
  console.log(`   XRPL_WSS_URL: ${process.env.XRPL_WSS_URL || 'wss://xrplcluster.com (default)'}\n`);

  // Connect to configured network
  const wssUrl = process.env.XRPL_WSS_URL || 'wss://xrplcluster.com';
  const client = new Client(wssUrl);

  try {
    console.log('2. Connecting to XRPL...');
    await client.connect();
    console.log(`   ✓ Connected to: ${client.connection.getUrl()}\n`);

    // Get account NFTs
    console.log(`3. Fetching NFTs for wallet: ${walletAddress}`);
    const response = await client.request({
      command: 'account_nfts',
      account: walletAddress,
      ledger_index: 'validated'
    });

    const nfts = response.result.account_nfts || [];
    console.log(`   ✓ Total NFTs found: ${nfts.length}\n`);

    if (nfts.length === 0) {
      console.log('   ⚠ No NFTs found on this wallet on mainnet!');
      console.log('   This could mean:');
      console.log('   - NFTs are on testnet, not mainnet');
      console.log('   - Wrong wallet address');
      console.log('   - NFTs were transferred to another wallet\n');
    } else {
      // Group by taxon (collection)
      const taxonGroups = {};
      nfts.forEach(nft => {
        const taxon = nft.NFTokenTaxon || 0;
        if (!taxonGroups[taxon]) {
          taxonGroups[taxon] = [];
        }
        taxonGroups[taxon].push(nft);
      });

      console.log('4. Collections (grouped by Taxon):');
      Object.entries(taxonGroups).forEach(([taxon, nftList]) => {
        console.log(`   Collection Taxon ${taxon}:`);
        console.log(`   - NFTs: ${nftList.length}`);
        console.log(`   - Sample NFTokenID: ${nftList[0].NFTokenID}`);
        if (nftList[0].URI) {
          console.log(`   - Has metadata URI: Yes`);
        }
      });
      console.log('');

      console.log('5. First NFT Details:');
      console.log(JSON.stringify(nfts[0], null, 2));
    }

  } catch (error) {
    console.error('   ✗ Error:', error.message);
    if (error.data) {
      console.error('   Error details:', error.data);
    }
  } finally {
    await client.disconnect();
    console.log('\n=== Verification Complete ===');
  }
}

verifyMainnet().catch(console.error);
