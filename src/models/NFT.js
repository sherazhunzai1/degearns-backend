module.exports = (sequelize, DataTypes) => {
  const NFT = sequelize.define('NFT', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    tokenId: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: 'XRPL NFToken ID'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'NFT name/title'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'NFT description'
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Main image URL'
    },
    uri: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Metadata URI (IPFS or HTTP)'
    },
    collectionId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Collection this NFT belongs to'
    },
    creatorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Original creator wallet address'
    },
    ownerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Current owner wallet address'
    },
    taxon: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'XRPL taxon value'
    },
    transferFee: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Transfer fee in basis points (0-50000)',
      validate: {
        min: 0,
        max: 50000
      }
    },
    attributes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'NFT attributes/traits as JSON',
      get() {
        const rawValue = this.getDataValue('attributes');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    },
    isListed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether NFT is currently listed for sale'
    },
    currentPrice: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Current listing price in drops'
    },
    offerID: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL offer ID if listed'
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of views'
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of likes'
    },
    transactionHash: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'XRPL transaction hash for minting'
    },
    mintedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the NFT was minted'
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
    tableName: 'NFTs',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['tokenId'] },
      { fields: ['collectionId'] },
      { fields: ['creatorWalletAddress'] },
      { fields: ['ownerWalletAddress'] },
      { fields: ['isListed'] },
      { fields: ['mintedAt'] },
      { fields: ['createdAt'] }
    ]
  });

  // Instance methods
  NFT.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return NFT;
};
