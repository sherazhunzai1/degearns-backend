module.exports = (sequelize, DataTypes) => {
  const CollectionChatMessage = sequelize.define('CollectionChatMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    collectionId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the collection this chatroom belongs to'
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
      defaultValue: 'text'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional data (image URL, NFT details, etc.)'
    },
    replyToMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of the message being replied to'
    }
  }, {
    tableName: 'CollectionChatMessages',
    timestamps: true,
    indexes: [
      { fields: ['collectionId', 'createdAt'], name: 'idx_colchat_collection_time' },
      { fields: ['senderWalletAddress'], name: 'idx_colchat_sender' },
      { fields: ['createdAt'], name: 'idx_colchat_created' }
    ]
  });

  return CollectionChatMessage;
};
