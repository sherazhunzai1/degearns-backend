module.exports = (sequelize, DataTypes) => {
  const SolanaWithdrawal = sequelize.define('SolanaWithdrawal', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    chain: {
      type: DataTypes.ENUM('solana'),
      allowNull: false,
      defaultValue: 'solana',
      comment: 'Blockchain network'
    },
    totalAmount: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Total withdrawal amount in lamports (string to avoid precision loss)'
    },
    perOwnerAmount: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Amount per owner in lamports (string to avoid precision loss)'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for the withdrawal'
    },
    initiatedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK to SolanaWithdrawalOwner who initiated this withdrawal',
      references: {
        model: 'SolanaWithdrawalOwners',
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
      comment: 'FK to SolanaWithdrawalOwner who rejected this withdrawal',
      references: {
        model: 'SolanaWithdrawalOwners',
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
      comment: 'Solana transaction signatures after execution'
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
    tableName: 'SolanaWithdrawals',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['initiatedBy'] },
      { fields: ['createdAt'] }
    ]
  });

  SolanaWithdrawal.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return SolanaWithdrawal;
};
