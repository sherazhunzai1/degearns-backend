module.exports = (sequelize, DataTypes) => {
  const MemeCoinLock = sequelize.define('MemeCoinLock', {
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
    lockType: {
      type: DataTypes.ENUM('liquidity', 'token'),
      allowNull: false,
      defaultValue: 'liquidity',
      comment: 'liquidity = LP tokens locked, token = raw token supply locked'
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'jupiter_lock (Solana), xrpl_custodial (XRPL), burn, streamflow, etc.'
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'released', 'unlocked', 'failed'),
      allowNull: false,
      defaultValue: 'active',
      comment: 'active = locked, released/unlocked = liquidity returned, failed = lock could not be verified'
    },
    lockAddress: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'Jupiter Lock escrow account (Solana) or custodial locker wallet (XRPL)'
    },
    assetMint: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'Solana: locked LP/token mint address'
    },
    assetCurrency: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment: 'XRPL: locked LP token currency code (hex)'
    },
    assetIssuer: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'XRPL: LP token issuer (the AMM account address)'
    },
    amount: {
      type: DataTypes.DECIMAL(40, 15),
      allowNull: false,
      defaultValue: 0,
      comment: 'Amount of LP/token locked'
    },
    ownerWalletAddress: {
      type: DataTypes.STRING(120),
      allowNull: false,
      comment: 'Wallet that owns the locked liquidity (the creator/LP provider)'
    },
    recipientWalletAddress: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'Wallet entitled to claim/receive the liquidity on unlock (defaults to owner)'
    },
    lockTxHash: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'On-chain transaction hash that created/funded the lock'
    },
    unlockTxHash: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'On-chain transaction hash that released the lock'
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    unlockAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the lock can be released. NULL = permanent (e.g. burned liquidity)'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'MemeCoinLocks',
    timestamps: true,
    indexes: [
      { fields: ['memeCoinId'], name: 'idx_lock_memecoin' },
      { fields: ['network'], name: 'idx_lock_network' },
      { fields: ['status'], name: 'idx_lock_status' },
      { fields: ['ownerWalletAddress'], name: 'idx_lock_owner' },
      { fields: ['lockTxHash'], name: 'idx_lock_tx', unique: true }
    ]
  });

  return MemeCoinLock;
};
