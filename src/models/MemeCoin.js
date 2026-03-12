module.exports = (sequelize, DataTypes) => {
  const MemeCoin = sequelize.define('MemeCoin', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    tokenName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Full name of the token (e.g., DogeCoin)'
    },
    tokenSymbol: {
      type: DataTypes.STRING(15),
      allowNull: false,
      comment: 'Currency code on XRPL (3 chars for standard, up to 15 hex-encoded for non-standard)'
    },
    currencyHex: {
      type: DataTypes.STRING(40),
      allowNull: false,
      comment: 'Hex-encoded currency code used on XRPL ledger'
    },
    totalSupply: {
      type: DataTypes.DECIMAL(30, 6),
      allowNull: false,
      comment: 'Total supply of the token'
    },
    decimals: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 6,
      validate: {
        min: 0,
        max: 15
      },
      comment: 'Number of decimal places'
    },
    logo: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL to the token logo image (IPFS or HTTP)'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of the token'
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    socialLinks: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Social media links (twitter, telegram, discord, etc.)'
    },
    issuerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'XRPL wallet address of the token issuer'
    },
    creatorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the user who created the token'
    },
    status: {
      type: DataTypes.ENUM('pending', 'trust_set', 'issued', 'failed'),
      defaultValue: 'pending',
      comment: 'Token creation status'
    },
    trustSetTxHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'TrustLine setup transaction hash'
    },
    issuanceTxHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Token issuance (Payment) transaction hash'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the token'
    }
  }, {
    tableName: 'MemeCoins',
    timestamps: true,
    indexes: [
      { fields: ['creatorWalletAddress'], name: 'idx_memecoin_creator' },
      { fields: ['issuerWalletAddress'], name: 'idx_memecoin_issuer' },
      { fields: ['tokenSymbol'], name: 'idx_memecoin_symbol' },
      { fields: ['status'], name: 'idx_memecoin_status' },
      {
        unique: true,
        fields: ['currencyHex', 'issuerWalletAddress'],
        name: 'idx_memecoin_unique_currency'
      }
    ]
  });

  return MemeCoin;
};
