module.exports = (sequelize, DataTypes) => {
  const AdminActivity = sequelize.define('AdminActivity', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    adminWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of admin who performed the action'
    },
    action: {
      type: DataTypes.ENUM(
        // User actions
        'user_ban',
        'user_unban',
        'user_verify',
        'user_unverify',
        'user_role_change',
        'user_delete',
        // Collection actions
        'collection_verify',
        'collection_unverify',
        'collection_delete',
        'collection_update',
        // Drop actions
        'drop_approve',
        'drop_reject',
        'drop_pause',
        'drop_resume',
        'drop_delete',
        'drop_update',
        'drop_refund',
        // Post actions
        'post_delete',
        'post_hide',
        'comment_delete',
        // Settings actions
        'setting_update',
        'fee_update',
        // Wallet actions
        'admin_wallet_create',
        'admin_wallet_update',
        'admin_wallet_delete',
        // Other actions
        'other'
      ),
      allowNull: false,
      comment: 'Type of admin action performed'
    },
    targetType: {
      type: DataTypes.ENUM('user', 'collection', 'drop', 'post', 'comment', 'setting', 'wallet', 'fee', 'other'),
      allowNull: false,
      comment: 'Type of entity the action was performed on'
    },
    targetId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID of the target entity'
    },
    targetIdentifier: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Human-readable identifier (wallet address, name, etc.)'
    },
    previousValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Previous value before the change (JSON string)'
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'New value after the change (JSON string)'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for the action (if provided)'
    },
    ipAddress: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'IP address of the admin (optional)'
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'User agent of the admin browser/client'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the action',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'AdminActivities',
    timestamps: true,
    updatedAt: false, // Only need createdAt for audit log
    indexes: [
      { fields: ['adminWalletAddress'] },
      { fields: ['action'] },
      { fields: ['targetType'] },
      { fields: ['targetId'] },
      { fields: ['createdAt'] }
    ]
  });

  // Instance methods
  AdminActivity.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return AdminActivity;
};
