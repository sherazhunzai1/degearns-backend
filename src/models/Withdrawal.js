module.exports = (sequelize, DataTypes) => {
  const Withdrawal = sequelize.define('Withdrawal', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    totalAmount: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Total withdrawal amount in drops (string to avoid precision loss)'
    },
    perOwnerAmount: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Amount per owner in drops (string to avoid precision loss)'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for the withdrawal'
    },
    initiatedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK to WithdrawalOwner who initiated this withdrawal',
      references: {
        model: 'WithdrawalOwners',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending_signatures', 'completed', 'rejected'),
      allowNull: false,
      defaultValue: 'pending_signatures',
      comment: 'Current status of the withdrawal'
    },
    requiredSignatures: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: 'Number of signatures required to execute'
    },
    rejectedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to WithdrawalOwner who rejected this withdrawal',
      references: {
        model: 'WithdrawalOwners',
        key: 'id'
      }
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for rejection'
    },
    splits: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Snapshot of owner splits at time of creation'
    },
    sourceBreakdown: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Snapshot of source wallet breakdown at time of creation'
    },
    transactionHashes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'XRPL transaction hashes after execution'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when withdrawal was completed'
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when withdrawal was rejected'
    }
  }, {
    tableName: 'Withdrawals',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['initiatedBy'] },
      { fields: ['createdAt'] }
    ]
  });

  Withdrawal.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return Withdrawal;
};
