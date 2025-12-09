module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the conversation'
    },
    senderWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Sender wallet address'
    },
    receiverWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Receiver wallet address'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Message content'
    },
    messageType: {
      type: DataTypes.ENUM('text', 'image', 'nft_share'),
      defaultValue: 'text',
      comment: 'Type of message'
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
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether message has been read'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when message was read'
    }
  }, {
    tableName: 'Messages',
    timestamps: true,
    indexes: [
      {
        fields: ['conversationId'],
        name: 'idx_message_conversation'
      },
      {
        fields: ['senderWalletAddress'],
        name: 'idx_message_sender'
      },
      {
        fields: ['receiverWalletAddress'],
        name: 'idx_message_receiver'
      },
      {
        fields: ['isRead'],
        name: 'idx_message_read_status'
      },
      {
        fields: ['createdAt'],
        name: 'idx_message_created'
      },
      {
        fields: ['receiverWalletAddress', 'isRead'],
        name: 'idx_message_unread_by_receiver'
      }
    ]
  });

  // Instance methods
  Message.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return Message;
};
