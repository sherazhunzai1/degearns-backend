module.exports = (sequelize, DataTypes) => {
  const DropAllowedWallet = sequelize.define('DropAllowedWallet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    dropId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the drop'
    },
    walletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Allowed wallet address'
    },
    mintLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Maximum NFTs this wallet can mint (null = uses drop default limit)'
    },
    mintedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of NFTs already minted by this wallet'
    },
    notes: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Optional notes about this allowed wallet'
    }
  }, {
    tableName: 'DropAllowedWallets',
    timestamps: true,
    indexes: [
      { fields: ['dropId'] },
      { fields: ['walletAddress'] },
      {
        unique: true,
        fields: ['dropId', 'walletAddress'],
        name: 'idx_drop_allowed_wallet_unique'
      }
    ]
  });

  // Instance methods
  DropAllowedWallet.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  // Helper method to check if wallet can still mint
  DropAllowedWallet.prototype.canMint = function(requestedAmount = 1) {
    if (this.mintLimit === null) {
      return true; // No limit for this wallet
    }
    return (this.mintedCount + requestedAmount) <= this.mintLimit;
  };

  // Helper method to get remaining mint allowance
  DropAllowedWallet.prototype.getRemainingAllowance = function() {
    if (this.mintLimit === null) {
      return null; // Unlimited
    }
    return Math.max(0, this.mintLimit - this.mintedCount);
  };

  return DropAllowedWallet;
};
