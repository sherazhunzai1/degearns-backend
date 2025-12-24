module.exports = (sequelize, DataTypes) => {
  const GroupMessage = sequelize.define('GroupMessage', {
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
    senderWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Sender wallet address'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Message content'
    },
    messageType: {
      type: DataTypes.ENUM('text', 'image', 'nft_share', 'system'),
      defaultValue: 'text',
      comment: 'Type of message (system messages for joins/leaves)'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional data like NFT details, image URL, etc.',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    },
    replyToMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to the message being replied to'
    }
  }, {
    tableName: 'GroupMessages',
    timestamps: true,
    indexes: [
      {
        fields: ['groupId'],
        name: 'idx_group_message_group'
      },
      {
        fields: ['senderWalletAddress'],
        name: 'idx_group_message_sender'
      },
      {
        fields: ['createdAt'],
        name: 'idx_group_message_created'
      },
      {
        fields: ['groupId', 'createdAt'],
        name: 'idx_group_message_group_created'
      },
      {
        fields: ['replyToMessageId'],
        name: 'idx_group_message_reply'
      }
    ]
  });

  // Instance methods
  GroupMessage.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return GroupMessage;
};
