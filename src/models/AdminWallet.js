module.exports = (sequelize, DataTypes) => {
  const AdminWallet = sequelize.define('AdminWallet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    walletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Admin wallet address'
    },
    type: {
      type: DataTypes.ENUM('platformFees', 'royalties', 'marketplace', 'treasury', 'subscriptions', 'rewards', 'other'),
      allowNull: false,
      comment: 'Purpose of this admin wallet'
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      allowNull: true,
      comment: 'Blockchain network for this wallet'
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Human-readable label for the wallet'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of what this wallet is used for'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this wallet is currently active'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the wallet'
    }
  }, {
    tableName: 'AdminWallets',
    timestamps: true,
    indexes: [
      { fields: ['type'] },
      { fields: ['isActive'] },
      { fields: ['network'] },
      { fields: ['type', 'network', 'isActive'], name: 'idx_admin_wallet_type_network_active' }
    ]
  });

  // Instance methods
  AdminWallet.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  // Static method to get active wallet by type and network
  AdminWallet.getActiveByType = async function(type, network = null) {
    const where = { type, isActive: true };
    if (network) where.network = network;
    return await this.findOne({ where });
  };

  return AdminWallet;
};
