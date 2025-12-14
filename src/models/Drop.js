module.exports = (sequelize, DataTypes) => {
  const Drop = sequelize.define('Drop', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    collectionId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the collection this drop belongs to'
    },
    creatorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of drop creator'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Drop name/title'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Drop description'
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Drop cover image URL'
    },
    bannerImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Drop banner image URL'
    },
    // Pricing and limits
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
    pricePerNft: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '0',
      comment: 'Price per NFT in drops (XRP drops)'
    },
    limitPerWallet: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Maximum NFTs per wallet (null = unlimited)'
    },
    totalSupply: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total NFTs available in this drop'
    },
    mintedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of NFTs minted from this drop'
    },
    // NFT Flags
    isBurnable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether NFTs can be burned'
    },
    isTransferable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether NFTs can be transferred'
    },
    isOnlyXrp: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether NFTs can only be traded for XRP'
    },
    isMutable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether NFT metadata can be changed'
    },
    // Schedule
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Drop start date and time'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Drop end date and time'
    },
    // Launch fees
    launchFee: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Fee paid to launch the drop'
    },
    launchFeeTransactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Transaction hash for launch fee payment'
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
      comment: 'Status of launch fee payment'
    },
    // Dashboard toggles
    isMintingEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether minting is currently enabled'
    },
    isAllowlistEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether allowlist restriction is enabled'
    },
    isFreeMint: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether minting is free (ignores pricePerNft)'
    },
    // Status
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'active', 'paused', 'ended', 'sold_out'),
      defaultValue: 'draft',
      comment: 'Current status of the drop'
    },
    // Additional metadata
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the drop',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'Drops',
    timestamps: true,
    indexes: [
      { fields: ['collectionId'] },
      { fields: ['creatorWalletAddress'] },
      { fields: ['status'] },
      { fields: ['startDate'] },
      { fields: ['endDate'] },
      { fields: ['paymentStatus'] },
      { fields: ['createdAt'] }
    ]
  });

  // Instance methods
  Drop.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  // Helper method to check if drop is currently active
  Drop.prototype.isCurrentlyActive = function() {
    const now = new Date();
    const hasStarted = !this.startDate || new Date(this.startDate) <= now;
    const hasNotEnded = !this.endDate || new Date(this.endDate) >= now;
    return this.status === 'active' && hasStarted && hasNotEnded && this.isMintingEnabled;
  };

  // Helper method to check if drop is sold out
  Drop.prototype.isSoldOut = function() {
    return this.mintedCount >= this.totalSupply;
  };

  // Helper method to get remaining supply
  Drop.prototype.getRemainingSupply = function() {
    return Math.max(0, this.totalSupply - this.mintedCount);
  };

  return Drop;
};
