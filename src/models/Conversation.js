module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    participant1WalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'First participant wallet address'
    },
    participant2WalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Second participant wallet address'
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of the last message'
    },
    lastMessagePreview: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Preview of the last message'
    }
  }, {
    tableName: 'Conversations',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['participant1WalletAddress', 'participant2WalletAddress'],
        name: 'unique_conversation_participants'
      },
      {
        fields: ['participant1WalletAddress'],
        name: 'idx_conversation_participant1'
      },
      {
        fields: ['participant2WalletAddress'],
        name: 'idx_conversation_participant2'
      },
      {
        fields: ['lastMessageAt'],
        name: 'idx_conversation_last_message'
      }
    ]
  });

  // Instance methods
  Conversation.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return Conversation;
};
