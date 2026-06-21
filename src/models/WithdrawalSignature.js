module.exports = (sequelize, DataTypes) => {
  const WithdrawalSignature = sequelize.define('WithdrawalSignature', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    withdrawalId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK to Withdrawal',
      references: {
        model: 'Withdrawals',
        key: 'id'
      }
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK to WithdrawalOwner who signed',
      references: {
        model: 'WithdrawalOwners',
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
    tableName: 'WithdrawalSignatures',
    timestamps: true,
    indexes: [
      { fields: ['withdrawalId'] },
      { fields: ['ownerId'] },
      {
        fields: ['withdrawalId', 'ownerId'],
        unique: true,
        name: 'idx_withdrawal_owner_unique'
      }
    ]
  });

  WithdrawalSignature.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return WithdrawalSignature;
};
