/**
 * NFT persistence service.
 *
 * Single source of truth for saving minted NFTs into the generic `Nfts` table.
 * Used by the HTTP endpoint (POST /api/v1/nfts/minted) and by server-side XRPL
 * minting (the drop mint flow), so both networks are stored the same way.
 */

const { Nft } = require('../models');

/**
 * Upsert an NFT by (nftTokenId, network). On an existing record, only the fields
 * that were actually provided are overwritten (existing data isn't nulled out).
 *
 * @param {Object} input
 * @returns {Promise<{ nft: Object, created: boolean }>}
 */
async function saveNft(input = {}) {
  const network = String(input.network || '').toLowerCase();
  if (network !== 'xrpl' && network !== 'solana') {
    throw new Error('network must be "xrpl" or "solana"');
  }

  const tokenId = input.nftTokenId || input.mintAddress;
  if (!tokenId) {
    throw new Error('nftTokenId (or mintAddress) is required');
  }

  const fields = {
    network,
    nftTokenId: tokenId,
    mintAddress: network === 'solana' ? (input.mintAddress || tokenId) : (input.mintAddress || null),
    name: input.name ?? null,
    description: input.description ?? null,
    image: input.image ?? null,
    metadataUri: input.metadataUri ?? null,
    attributes: input.attributes ?? null,
    collectionId: input.collectionId != null && input.collectionId !== '' ? String(input.collectionId) : null,
    taxon: (input.taxon !== undefined && input.taxon !== null && input.taxon !== '') ? parseInt(input.taxon, 10) : null,
    issuerWalletAddress: input.issuerWalletAddress ?? null,
    ownerWalletAddress: input.ownerWalletAddress ?? input.minterWalletAddress ?? null,
    minterWalletAddress: input.minterWalletAddress ?? input.ownerWalletAddress ?? null,
    mintTransactionHash: input.mintTransactionHash ?? null,
    royaltyPercentage: (input.royaltyPercentage !== undefined && input.royaltyPercentage !== null && input.royaltyPercentage !== '') ? input.royaltyPercentage : null,
    metadata: input.metadata ?? null,
    isActive: true
  };

  const existing = await Nft.findOne({ where: { nftTokenId: tokenId, network } });
  if (existing) {
    const updateFields = {};
    Object.entries(fields).forEach(([k, v]) => {
      if (k === 'network' || k === 'nftTokenId') return;
      if (v !== null && v !== undefined) updateFields[k] = v;
    });
    await existing.update(updateFields);
    return { nft: existing, created: false };
  }

  const nft = await Nft.create(fields);
  return { nft, created: true };
}

module.exports = { saveNft };
