module.exports = (sequelize, DataTypes) => {
  const SolanaNftListing = sequelize.define('SolanaNftListing', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    mintAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Solana NFT mint address'
    },
    sellerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the seller'
    },
    price: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Listing price in lamports'
    },
    collectionMintAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Collection mint address'
    },
    nftName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'NFT name from metadata'
    },
    nftImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'NFT image URL from metadata'
    },
    nftDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'NFT description from metadata'
    },
    nftAttributes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'NFT attributes from metadata'
    },
    delegateTxHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Transaction hash of the delegateSaleV1 call'
    },
    status: {
      type: DataTypes.ENUM('active', 'sold', 'cancelled'),
      defaultValue: 'active',
      allowNull: false,
      comment: 'Current listing status'
    },
    buyerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of the buyer (set when sold)'
    },
    saleTxHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Transaction hash of the NFT transfer (set when sold)'
    },
    soldAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when the NFT was sold'
    }
  }, {
    tableName: 'SolanaNftListings',
    timestamps: true,
    indexes: [
      { fields: ['mintAddress', 'status'], name: 'idx_listing_mint_status' },
      { fields: ['sellerWalletAddress'], name: 'idx_listing_seller' },
      { fields: ['collectionMintAddress'], name: 'idx_listing_collection' },
      { fields: ['status'], name: 'idx_listing_status' },
      { fields: ['buyerWalletAddress'], name: 'idx_listing_buyer' },
      { fields: ['createdAt'], name: 'idx_listing_created' }
    ]
  });

  SolanaNftListing.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    const priceLamports = BigInt(values.price || '0');
    values.priceSol = (Number(priceLamports) / 1e9).toFixed(9);
    return values;
  };

  return SolanaNftListing;
};
