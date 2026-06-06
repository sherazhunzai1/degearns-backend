module.exports = (sequelize, DataTypes) => {
  const MemeCoinPool = sequelize.define('MemeCoinPool', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    memeCoinId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      allowNull: false
    },
    poolAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Raydium pool ID (Solana) or XRPL AMM account address'
    },
    poolId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Optional pool identifier (Raydium AMM ID, etc.)'
    },
    pairToken: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'The pair token symbol (SOL, USDC, XRP, etc.)'
    },
    pairTokenAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Pair token mint/issuer address'
    },
    initialBaseAmount: {
      type: DataTypes.DECIMAL(30, 9),
      allowNull: true
    },
    initialPairAmount: {
      type: DataTypes.DECIMAL(30, 9),
      allowNull: true
    },
    initialPrice: {
      type: DataTypes.DECIMAL(30, 12),
      allowNull: true
    },
    createTxHash: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'closed'),
      defaultValue: 'active',
      allowNull: false
    },
    providerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'MemeCoinPools',
    timestamps: true,
    indexes: [
      { fields: ['memeCoinId'], name: 'idx_pool_memecoin' },
      { fields: ['poolAddress'], name: 'idx_pool_address' },
      { fields: ['network'], name: 'idx_pool_network' },
      { fields: ['status'], name: 'idx_pool_status' }
    ]
  });

  return MemeCoinPool;
};
