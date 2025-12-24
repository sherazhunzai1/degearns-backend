module.exports = (sequelize, DataTypes) => {
  const GroupMember = sequelize.define('GroupMember', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    groupId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the group'
    },
    walletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Member wallet address'
    },
    role: {
      type: DataTypes.ENUM('admin', 'member'),
      defaultValue: 'member',
      comment: 'Member role in the group (admin or member)'
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When the member joined the group'
    },
    addedByWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of the user who added this member'
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of when the member last read messages'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether the member is currently active in the group'
    }
  }, {
    tableName: 'GroupMembers',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['groupId', 'walletAddress'],
        name: 'unique_group_member'
      },
      {
        fields: ['groupId'],
        name: 'idx_group_member_group'
      },
      {
        fields: ['walletAddress'],
        name: 'idx_group_member_wallet'
      },
      {
        fields: ['role'],
        name: 'idx_group_member_role'
      },
      {
        fields: ['isActive'],
        name: 'idx_group_member_active'
      }
    ]
  });

  // Instance methods
  GroupMember.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return GroupMember;
};
