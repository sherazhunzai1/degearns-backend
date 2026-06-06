module.exports = (sequelize, DataTypes) => {
  const MemeCoinTrade = sequelize.define('MemeCoinTrade', {
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
    poolId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      allowNull: false
    },
    txHash: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    traderWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false
    },
    tokenAmount: {
      type: DataTypes.DECIMAL(30, 9),
      allowNull: false
    },
    pairAmount: {
      type: DataTypes.DECIMAL(30, 9),
      allowNull: false
    },
    pairToken: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    pricePerToken: {
      type: DataTypes.DECIMAL(30, 12),
      allowNull: false
    },
    priceUsd: {
      type: DataTypes.DECIMAL(30, 12),
      allowNull: true
    },
    volumeUsd: {
      type: DataTypes.DECIMAL(30, 6),
      allowNull: true
    },
    tradedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'MemeCoinTrades',
    timestamps: true,
    indexes: [
      { fields: ['memeCoinId', 'tradedAt'], name: 'idx_trade_coin_time' },
      { fields: ['poolId'], name: 'idx_trade_pool' },
      { fields: ['traderWalletAddress'], name: 'idx_trade_trader' },
      { fields: ['txHash'], name: 'idx_trade_tx', unique: true },
      { fields: ['tradedAt'], name: 'idx_trade_time' }
    ]
  });

  return MemeCoinTrade;
};
