module.exports = (sequelize, DataTypes) => {
  const Nft = sequelize.define('Nft', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      allowNull: false,
      comment: 'Blockchain network this NFT was minted on'
    },
    nftTokenId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Universal NFT identifier — XRPL NFTokenID or Solana mint address'
    },
    mintAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Solana SPL mint address (mirrors nftTokenId for Solana; null for XRPL)'
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'NFT name/title'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Image URL (IPFS / Arweave / HTTP)'
    },
    metadataUri: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Token metadata JSON URI'
    },
    attributes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Traits / attributes array'
    },
    collectionId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'On-chain collection identifier — XRPL taxon or Solana collection mint (no FK)'
    },
    taxon: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'XRPL NFToken taxon (null for Solana)'
    },
    issuerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Issuer / creator / update-authority wallet'
    },
    ownerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Current owner wallet'
    },
    minterWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet that minted the NFT'
    },
    mintTransactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Transaction hash/signature of the mint'
    },
    royaltyPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Creator royalty percentage'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Full raw metadata blob / any extra data'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Soft-delete flag'
    }
  }, {
    tableName: 'Nfts',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['nftTokenId', 'network'], name: 'unique_nft_token_network' },
      { fields: ['ownerWalletAddress'], name: 'idx_nft_owner' },
      { fields: ['minterWalletAddress'], name: 'idx_nft_minter' },
      { fields: ['collectionId'], name: 'idx_nft_collection' },
      { fields: ['network'], name: 'idx_nft_network' },
      { fields: ['createdAt'], name: 'idx_nft_created' }
    ]
  });

  return Nft;
};
