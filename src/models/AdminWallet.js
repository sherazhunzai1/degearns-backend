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
      type: DataTypes.ENUM('platformFees', 'royalties', 'marketplace', 'treasury', 'other'),
      allowNull: false,
      comment: 'Purpose of this admin wallet'
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
      {
        unique: true,
        fields: ['type', 'isActive'],
        where: { isActive: true },
        name: 'idx_admin_wallet_active_type'
      }
    ]
  });

  // Instance methods
  AdminWallet.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  // Static method to get active wallet by type
  AdminWallet.getActiveByType = async function(type) {
    return await this.findOne({
      where: {
        type,
        isActive: true
      }
    });
  };

  return AdminWallet;
};
