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
      comment: 'Token symbol (3-15 chars)'
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      defaultValue: 'xrpl',
      allowNull: false,
      comment: 'Blockchain network for this meme coin'
    },
    mintAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Solana SPL token mint address (null for XRPL coins)'
    },
    currencyHex: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment: 'Hex-encoded currency code on XRPL (null for Solana coins)'
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
      allowNull: true,
      comment: 'XRPL token issuer address (null for Solana coins)'
    },
    creatorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the user who created the token'
    },
    status: {
      type: DataTypes.ENUM('pending', 'trust_set', 'issued', 'failed', 'minted'),
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
      { fields: ['network'], name: 'idx_memecoin_network' },
      { fields: ['mintAddress'], name: 'idx_memecoin_mint' },
      {
        unique: true,
        fields: ['currencyHex', 'issuerWalletAddress'],
        name: 'idx_memecoin_unique_currency'
      }
    ]
  });

  return MemeCoin;
};
