module.exports = (sequelize, DataTypes) => {
  const OwnerChangeSignature = sequelize.define('OwnerChangeSignature', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    changeRequestId: { type: DataTypes.UUID, allowNull: false },
    ownerId: { type: DataTypes.UUID, allowNull: false },
    ownerName: { type: DataTypes.STRING, allowNull: false },
    signedAt: { type: DataTypes.DATE, allowNull: false }
  }, {
    tableName: 'OwnerChangeSignatures',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['changeRequestId', 'ownerId'], name: 'idx_change_sig_unique' }
    ]
  });
  return OwnerChangeSignature;
};
