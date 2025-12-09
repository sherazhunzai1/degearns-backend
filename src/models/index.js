const { sequelize } = require('../config/sequelize');
const { DataTypes } = require('sequelize');

// Import models
const User = require('./User')(sequelize, DataTypes);
const Collection = require('./Collection')(sequelize, DataTypes);
const Conversation = require('./Conversation')(sequelize, DataTypes);
const Message = require('./Message')(sequelize, DataTypes);
const Post = require('./Post')(sequelize, DataTypes);
const PostMedia = require('./PostMedia')(sequelize, DataTypes);

// Define associations
// User and Collection
User.hasMany(Collection, {
  foreignKey: 'creatorWalletAddress',
  sourceKey: 'walletAddress',
  as: 'collections'
});
Collection.belongsTo(User, {
  foreignKey: 'creatorWalletAddress',
  targetKey: 'walletAddress',
  as: 'creator'
});

// User and Conversation associations
User.hasMany(Conversation, {
  foreignKey: 'participant1WalletAddress',
  sourceKey: 'walletAddress',
  as: 'conversationsAsParticipant1'
});
User.hasMany(Conversation, {
  foreignKey: 'participant2WalletAddress',
  sourceKey: 'walletAddress',
  as: 'conversationsAsParticipant2'
});
Conversation.belongsTo(User, {
  foreignKey: 'participant1WalletAddress',
  targetKey: 'walletAddress',
  as: 'participant1'
});
Conversation.belongsTo(User, {
  foreignKey: 'participant2WalletAddress',
  targetKey: 'walletAddress',
  as: 'participant2'
});

// Conversation and Message associations
Conversation.hasMany(Message, {
  foreignKey: 'conversationId',
  as: 'messages'
});
Message.belongsTo(Conversation, {
  foreignKey: 'conversationId',
  as: 'conversation'
});

// User and Message associations
User.hasMany(Message, {
  foreignKey: 'senderWalletAddress',
  sourceKey: 'walletAddress',
  as: 'sentMessages'
});
User.hasMany(Message, {
  foreignKey: 'receiverWalletAddress',
  sourceKey: 'walletAddress',
  as: 'receivedMessages'
});
Message.belongsTo(User, {
  foreignKey: 'senderWalletAddress',
  targetKey: 'walletAddress',
  as: 'sender'
});
Message.belongsTo(User, {
  foreignKey: 'receiverWalletAddress',
  targetKey: 'walletAddress',
  as: 'receiver'
});

// User and Post associations
User.hasMany(Post, {
  foreignKey: 'authorWalletAddress',
  sourceKey: 'walletAddress',
  as: 'posts'
});
Post.belongsTo(User, {
  foreignKey: 'authorWalletAddress',
  targetKey: 'walletAddress',
  as: 'author'
});

// Post and PostMedia associations
Post.hasMany(PostMedia, {
  foreignKey: 'postId',
  as: 'media'
});
PostMedia.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

module.exports = {
  sequelize,
  User,
  Collection,
  Conversation,
  Message,
  Post,
  PostMedia
};
