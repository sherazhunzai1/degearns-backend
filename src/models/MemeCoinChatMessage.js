module.exports = (sequelize, DataTypes) => {
  const MemeCoinChatMessage = sequelize.define('MemeCoinChatMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    memeCoinId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'The listed meme coin this open chatroom belongs to (MemeCoins.id)'
    },
    senderWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Sender wallet address (primary wallet)'
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
      comment: 'Additional data (image URL, shared token/NFT details, etc.)'
    },
    replyToMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of the message being replied to'
    }
  }, {
    tableName: 'MemeCoinChatMessages',
    timestamps: true,
    indexes: [
      { fields: ['memeCoinId', 'createdAt'], name: 'idx_mcchat_coin_time' },
      { fields: ['senderWalletAddress'], name: 'idx_mcchat_sender' },
      { fields: ['createdAt'], name: 'idx_mcchat_created' }
    ]
  });

  return MemeCoinChatMessage;
};
