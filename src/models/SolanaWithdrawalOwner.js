module.exports = (sequelize, DataTypes) => {
  const SolanaWithdrawalOwner = sequelize.define('SolanaWithdrawalOwner', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    walletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Solana wallet address of the owner'
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'SolanaWithdrawalOwners',
    timestamps: true,
    indexes: [
      { fields: ['walletAddress'], unique: true },
      { fields: ['isActive'] },
      { fields: ['position'] }
    ]
  });

  return SolanaWithdrawalOwner;
};
