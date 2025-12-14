module.exports = (sequelize, DataTypes) => {
  const DropNft = sequelize.define('DropNft', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    dropId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the drop this NFT belongs to'
    },
    index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Index/order of this NFT in the drop (1, 2, 3, etc.)'
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
      comment: 'NFT image URL (IPFS or HTTP)'
    },
    animationUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Animation/video URL for animated NFTs'
    },
    externalUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'External URL for more info about the NFT'
    },
    attributes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'NFT attributes/traits array [{trait_type, value}]',
      get() {
        const rawValue = this.getDataValue('attributes');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    },
    metadataUri: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'IPFS URI for the complete metadata JSON'
    },
    // Minting status
    status: {
      type: DataTypes.ENUM('available', 'reserved', 'minted'),
      defaultValue: 'available',
      comment: 'Current status of this NFT item'
    },
    mintedTo: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address that minted this NFT'
    },
    mintedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this NFT was minted'
    },
    nftTokenId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL NFToken ID after minting'
    },
    transactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL transaction hash of the mint'
    },
    // Additional metadata
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the NFT',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'DropNfts',
    timestamps: true,
    indexes: [
      // Note: dropId index is auto-created by foreign key
      { fields: ['status'] },
      { fields: ['mintedTo'] },
      { fields: ['nftTokenId'], unique: true },
      {
        unique: true,
        fields: ['dropId', 'index'],
        name: 'idx_drop_nft_unique_index'
      }
    ]
  });

  // Instance methods
  DropNft.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  // Helper method to check if NFT is available for minting
  DropNft.prototype.isAvailable = function() {
    return this.status === 'available';
  };

  return DropNft;
};
