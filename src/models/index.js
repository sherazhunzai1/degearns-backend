const { sequelize } = require('../config/sequelize');
const { DataTypes } = require('sequelize');

// Import models
const User = require('./User')(sequelize, DataTypes);
const Collection = require('./Collection')(sequelize, DataTypes);
const Conversation = require('./Conversation')(sequelize, DataTypes);
const Message = require('./Message')(sequelize, DataTypes);
const Post = require('./Post')(sequelize, DataTypes);
const PostMedia = require('./PostMedia')(sequelize, DataTypes);
const PostLike = require('./PostLike')(sequelize, DataTypes);
const PostComment = require('./PostComment')(sequelize, DataTypes);
const Follow = require('./Follow')(sequelize, DataTypes);
const Notification = require('./Notification')(sequelize, DataTypes);
const Drop = require('./Drop')(sequelize, DataTypes);
const DropNft = require('./DropNft')(sequelize, DataTypes);
const DropAllowedWallet = require('./DropAllowedWallet')(sequelize, DataTypes);
const DropMint = require('./DropMint')(sequelize, DataTypes);
const AdminWallet = require('./AdminWallet')(sequelize, DataTypes);
const PlatformSettings = require('./PlatformSettings')(sequelize, DataTypes);
const AdminActivity = require('./AdminActivity')(sequelize, DataTypes);
const RewardDistribution = require('./RewardDistribution')(sequelize, DataTypes);
const Banner = require('./Banner')(sequelize, DataTypes);

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

// Post and PostLike associations
Post.hasMany(PostLike, {
  foreignKey: 'postId',
  as: 'likes'
});
PostLike.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// User and PostLike associations
User.hasMany(PostLike, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'postLikes'
});
PostLike.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// Post and PostComment associations
Post.hasMany(PostComment, {
  foreignKey: 'postId',
  as: 'comments'
});
PostComment.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// User and PostComment associations
User.hasMany(PostComment, {
  foreignKey: 'authorWalletAddress',
  sourceKey: 'walletAddress',
  as: 'comments'
});
PostComment.belongsTo(User, {
  foreignKey: 'authorWalletAddress',
  targetKey: 'walletAddress',
  as: 'author'
});

// PostComment self-referencing for replies
PostComment.hasMany(PostComment, {
  foreignKey: 'parentCommentId',
  as: 'replies'
});
PostComment.belongsTo(PostComment, {
  foreignKey: 'parentCommentId',
  as: 'parentComment'
});

// User and Follow associations (followers)
User.hasMany(Follow, {
  foreignKey: 'followingWalletAddress',
  sourceKey: 'walletAddress',
  as: 'followers'
});
Follow.belongsTo(User, {
  foreignKey: 'followingWalletAddress',
  targetKey: 'walletAddress',
  as: 'followingUser'
});

// User and Follow associations (following)
User.hasMany(Follow, {
  foreignKey: 'followerWalletAddress',
  sourceKey: 'walletAddress',
  as: 'following'
});
Follow.belongsTo(User, {
  foreignKey: 'followerWalletAddress',
  targetKey: 'walletAddress',
  as: 'followerUser'
});

// User and Notification associations (recipient)
User.hasMany(Notification, {
  foreignKey: 'recipientWalletAddress',
  sourceKey: 'walletAddress',
  as: 'receivedNotifications'
});
Notification.belongsTo(User, {
  foreignKey: 'recipientWalletAddress',
  targetKey: 'walletAddress',
  as: 'recipient'
});

// User and Notification associations (sender)
User.hasMany(Notification, {
  foreignKey: 'senderWalletAddress',
  sourceKey: 'walletAddress',
  as: 'sentNotifications'
});
Notification.belongsTo(User, {
  foreignKey: 'senderWalletAddress',
  targetKey: 'walletAddress',
  as: 'sender'
});

// Collection and Drop associations
Collection.hasMany(Drop, {
  foreignKey: 'collectionId',
  as: 'drops'
});
Drop.belongsTo(Collection, {
  foreignKey: 'collectionId',
  as: 'collection'
});

// User and Drop associations
User.hasMany(Drop, {
  foreignKey: 'creatorWalletAddress',
  sourceKey: 'walletAddress',
  as: 'drops'
});
Drop.belongsTo(User, {
  foreignKey: 'creatorWalletAddress',
  targetKey: 'walletAddress',
  as: 'creator'
});

// Drop and DropNft associations
Drop.hasMany(DropNft, {
  foreignKey: 'dropId',
  as: 'nfts'
});
DropNft.belongsTo(Drop, {
  foreignKey: 'dropId',
  as: 'drop'
});

// Drop and DropAllowedWallet associations
Drop.hasMany(DropAllowedWallet, {
  foreignKey: 'dropId',
  as: 'allowedWallets'
});
DropAllowedWallet.belongsTo(Drop, {
  foreignKey: 'dropId',
  as: 'drop'
});

// Drop and DropMint associations
Drop.hasMany(DropMint, {
  foreignKey: 'dropId',
  as: 'mints'
});
DropMint.belongsTo(Drop, {
  foreignKey: 'dropId',
  as: 'drop'
});

// User and DropMint associations (minter)
User.hasMany(DropMint, {
  foreignKey: 'minterWalletAddress',
  sourceKey: 'walletAddress',
  as: 'dropMints'
});
DropMint.belongsTo(User, {
  foreignKey: 'minterWalletAddress',
  targetKey: 'walletAddress',
  as: 'minter'
});

// User and AdminActivity associations
User.hasMany(AdminActivity, {
  foreignKey: 'adminWalletAddress',
  sourceKey: 'walletAddress',
  as: 'adminActivities'
});
AdminActivity.belongsTo(User, {
  foreignKey: 'adminWalletAddress',
  targetKey: 'walletAddress',
  as: 'admin'
});

// User and RewardDistribution associations
User.hasMany(RewardDistribution, {
  foreignKey: 'recipientWalletAddress',
  sourceKey: 'walletAddress',
  as: 'rewards'
});
RewardDistribution.belongsTo(User, {
  foreignKey: 'recipientWalletAddress',
  targetKey: 'walletAddress',
  as: 'recipient'
});

// Initialize notification service with models
const notificationService = require('../services/notificationService');
notificationService.init({ Notification, User, Follow });

module.exports = {
  sequelize,
  User,
  Collection,
  Conversation,
  Message,
  Post,
  PostMedia,
  PostLike,
  PostComment,
  Follow,
  Notification,
  Drop,
  DropNft,
  DropAllowedWallet,
  DropMint,
  AdminWallet,
  PlatformSettings,
  AdminActivity,
  RewardDistribution,
  Banner
};
