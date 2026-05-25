module.exports = (sequelize, DataTypes) => {
  const Collection = sequelize.define('Collection', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Collection name'
    },
    slug: {
      type: DataTypes.STRING(120),
      unique: true,
      allowNull: false,
      comment: 'URL-friendly slug for the collection'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Collection description'
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Collection cover image URL'
    },
    bannerImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Collection banner image URL'
    },
    creatorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of collection creator'
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      defaultValue: 'xrpl',
      allowNull: false,
      comment: 'Blockchain network for this collection'
    },
    mintAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Solana collection mint address (null for XRPL collections)'
    },
    taxon: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'XRPL NFToken Taxon (null for Solana collections)'
    },
    category: {
      type: DataTypes.ENUM('art', 'music', 'photography', 'sports', 'gaming', 'collectibles', 'other'),
      defaultValue: 'other',
      allowNull: false
    },
    royaltyPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      allowNull: false,
      comment: 'Creator royalty percentage (0-100)',
      validate: {
        min: 0,
        max: 100
      }
    },
    totalSupply: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Total number of NFTs in collection'
    },
    floorPrice: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Floor price in drops'
    },
    totalVolume: {
      type: DataTypes.STRING(50),
      defaultValue: '0',
      comment: 'Total trading volume in drops'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Verified collection status'
    },
    socialLinks: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'JSON object for social media links',
      get() {
        const rawValue = this.getDataValue('socialLinks');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'Collections',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['slug'] },
      { unique: true, fields: ['taxon', 'creatorWalletAddress'], name: 'unique_taxon_creator' },
      { fields: ['creatorWalletAddress'] },
      { fields: ['network'] },
      { fields: ['mintAddress'] },
      { fields: ['category'] },
      { fields: ['createdAt'] }
    ]
  });

  // Instance methods
  Collection.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return Collection;
};
