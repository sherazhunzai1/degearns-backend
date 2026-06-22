module.exports = (sequelize, DataTypes) => {
  const SolanaWithdrawalSignature = sequelize.define('SolanaWithdrawalSignature', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    withdrawalId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK to SolanaWithdrawal',
      references: {
        model: 'SolanaWithdrawals',
        key: 'id'
      }
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK to SolanaWithdrawalOwner who signed',
      references: {
        model: 'SolanaWithdrawalOwners',
        key: 'id'
      }
    },
    signedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp when this signature was added'
    }
  }, {
    tableName: 'SolanaWithdrawalSignatures',
    timestamps: true,
    indexes: [
      { fields: ['withdrawalId'] },
      { fields: ['ownerId'] },
      {
        fields: ['withdrawalId', 'ownerId'],
        unique: true,
        name: 'idx_solana_withdrawal_owner_unique'
      }
    ]
  });

  SolanaWithdrawalSignature.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return SolanaWithdrawalSignature;
};
