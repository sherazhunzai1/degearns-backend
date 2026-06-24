module.exports = (sequelize, DataTypes) => {
  const OwnerChangeRequest = sequelize.define('OwnerChangeRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    network: { type: DataTypes.ENUM('xrpl', 'solana'), allowNull: false },
    // The owner being removed
    targetOwnerId: { type: DataTypes.UUID, allowNull: false },
    targetOwnerName: { type: DataTypes.STRING, allowNull: false },
    targetOwnerWallet: { type: DataTypes.STRING(100), allowNull: false },
    // The replacement
    newOwnerName: { type: DataTypes.STRING, allowNull: false },
    newOwnerWallet: { type: DataTypes.STRING(100), allowNull: false },
    // Who initiated
    initiatedBy: { type: DataTypes.UUID, allowNull: false },
    initiatorName: { type: DataTypes.STRING, allowNull: false },
    // Status
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
    requiredSignatures: { type: DataTypes.INTEGER, defaultValue: 2 },
    // Rejection
    rejectedBy: { type: DataTypes.UUID, allowNull: true },
    rejectorName: { type: DataTypes.STRING, allowNull: true },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true },
    rejectedAt: { type: DataTypes.DATE, allowNull: true },
    // Completion
    completedAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'OwnerChangeRequests',
    timestamps: true,
    indexes: [
      { fields: ['network', 'status'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ]
  });
  return OwnerChangeRequest;
};
