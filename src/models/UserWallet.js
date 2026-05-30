module.exports = (sequelize, DataTypes) => {
  const UserWallet = sequelize.define('UserWallet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the user account'
    },
    walletAddress: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: 'Linked wallet address'
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      allowNull: false,
      comment: 'Blockchain network of this wallet'
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this is the primary wallet (matches Users.walletAddress)'
    },
    label: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'User-defined label for this wallet (e.g. My Phantom, Trading wallet)'
    }
  }, {
    tableName: 'UserWallets',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['walletAddress'], name: 'idx_user_wallet_address' },
      { fields: ['userId'], name: 'idx_user_wallet_user_id' },
      { fields: ['network'], name: 'idx_user_wallet_network' }
    ]
  });

  UserWallet.prototype.toJSON = function() {
    return Object.assign({}, this.get());
  };

  return UserWallet;
};
