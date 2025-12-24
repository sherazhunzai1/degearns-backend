module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define('Group', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Group name'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Group description'
    },
    groupImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Group profile image URL'
    },
    creatorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the group creator'
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of the last message in the group'
    },
    lastMessagePreview: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Preview of the last message'
    },
    lastMessageSenderWallet: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of the last message sender'
    },
    memberCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'Total number of members in the group'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether the group is active'
    }
  }, {
    tableName: 'Groups',
    timestamps: true,
    indexes: [
      {
        fields: ['creatorWalletAddress'],
        name: 'idx_group_creator'
      },
      {
        fields: ['lastMessageAt'],
        name: 'idx_group_last_message'
      },
      {
        fields: ['isActive'],
        name: 'idx_group_active'
      },
      {
        fields: ['createdAt'],
        name: 'idx_group_created'
      }
    ]
  });

  // Instance methods
  Group.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return Group;
};
