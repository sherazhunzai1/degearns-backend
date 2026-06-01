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
const MonthlyRanking = require('./MonthlyRanking')(sequelize, DataTypes);
const Group = require('./Group')(sequelize, DataTypes);
const GroupMember = require('./GroupMember')(sequelize, DataTypes);
const GroupMessage = require('./GroupMessage')(sequelize, DataTypes);
const Subscription = require('./Subscription')(sequelize, DataTypes);
const SubscriptionTier = require('./SubscriptionTier')(sequelize, DataTypes);
const UserStats = require('./UserStats')(sequelize, DataTypes);
const ActivityLog = require('./ActivityLog')(sequelize, DataTypes);
const PostView = require('./PostView')(sequelize, DataTypes);
const PostBoost = require('./PostBoost')(sequelize, DataTypes);
const NftBoost = require('./NftBoost')(sequelize, DataTypes);
const CollectionBoost = require('./CollectionBoost')(sequelize, DataTypes);
const Repost = require('./Repost')(sequelize, DataTypes);
const LuckyDraw = require('./LuckyDraw')(sequelize, DataTypes);
const LuckyDrawParticipant = require('./LuckyDrawParticipant')(sequelize, DataTypes);
const ReferralReward = require('./ReferralReward')(sequelize, DataTypes);
const ReferralClaim = require('./ReferralClaim')(sequelize, DataTypes);
const ReferralAuditLog = require('./ReferralAuditLog')(sequelize, DataTypes);
const MemeCoin = require('./MemeCoin')(sequelize, DataTypes);
const UserWallet = require('./UserWallet')(sequelize, DataTypes);
const SolanaNftListing = require('./SolanaNftListing')(sequelize, DataTypes);

// Define associations
// User and UserWallet
User.hasMany(UserWallet, {
  foreignKey: 'userId',
  as: 'wallets'
});
UserWallet.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

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

// Post and PostView associations
Post.hasMany(PostView, {
  foreignKey: 'postId',
  as: 'views'
});
PostView.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// User and PostView associations
User.hasMany(PostView, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'postViews'
});
PostView.belongsTo(User, {
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

// User and Group associations (creator)
User.hasMany(Group, {
  foreignKey: 'creatorWalletAddress',
  sourceKey: 'walletAddress',
  as: 'createdGroups'
});
Group.belongsTo(User, {
  foreignKey: 'creatorWalletAddress',
  targetKey: 'walletAddress',
  as: 'creator'
});

// Group and GroupMember associations
Group.hasMany(GroupMember, {
  foreignKey: 'groupId',
  as: 'members'
});
GroupMember.belongsTo(Group, {
  foreignKey: 'groupId',
  as: 'group'
});

// User and GroupMember associations
User.hasMany(GroupMember, {
  foreignKey: 'walletAddress',
  sourceKey: 'walletAddress',
  as: 'groupMemberships'
});
GroupMember.belongsTo(User, {
  foreignKey: 'walletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// Group and GroupMessage associations
Group.hasMany(GroupMessage, {
  foreignKey: 'groupId',
  as: 'messages'
});
GroupMessage.belongsTo(Group, {
  foreignKey: 'groupId',
  as: 'group'
});

// User and GroupMessage associations
User.hasMany(GroupMessage, {
  foreignKey: 'senderWalletAddress',
  sourceKey: 'walletAddress',
  as: 'groupMessages'
});
GroupMessage.belongsTo(User, {
  foreignKey: 'senderWalletAddress',
  targetKey: 'walletAddress',
  as: 'sender'
});

// GroupMessage self-referencing for replies
GroupMessage.hasMany(GroupMessage, {
  foreignKey: 'replyToMessageId',
  as: 'replies'
});
GroupMessage.belongsTo(GroupMessage, {
  foreignKey: 'replyToMessageId',
  as: 'replyToMessage'
});

// User referral associations (self-referencing)
User.belongsTo(User, {
  foreignKey: 'referredBy',
  targetKey: 'walletAddress',
  as: 'referrer'
});
User.hasMany(User, {
  foreignKey: 'referredBy',
  sourceKey: 'walletAddress',
  as: 'referrals'
});

// User and Subscription associations
User.hasMany(Subscription, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'subscriptions'
});
Subscription.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// User and UserStats associations
User.hasOne(UserStats, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'stats'
});
UserStats.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// User and ActivityLog associations
User.hasMany(ActivityLog, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'activities'
});
ActivityLog.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// ActivityLog and Collection associations
Collection.hasMany(ActivityLog, {
  foreignKey: 'collectionId',
  as: 'activities'
});
ActivityLog.belongsTo(Collection, {
  foreignKey: 'collectionId',
  as: 'collection'
});

// Post and PostBoost associations
Post.hasMany(PostBoost, {
  foreignKey: 'postId',
  as: 'boosts'
});
PostBoost.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// User and PostBoost associations
User.hasMany(PostBoost, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'postBoosts'
});
PostBoost.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// User and NftBoost associations
User.hasMany(NftBoost, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'nftBoosts'
});
NftBoost.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// User and CollectionBoost associations (CollectionBoost is independent, no Collection association)
User.hasMany(CollectionBoost, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'collectionBoosts'
});
CollectionBoost.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// Post and Repost associations
Post.hasMany(Repost, {
  foreignKey: 'postId',
  as: 'reposts'
});
Repost.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// User and Repost associations
User.hasMany(Repost, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'reposts'
});
Repost.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// LuckyDraw and LuckyDrawParticipant associations
LuckyDraw.hasMany(LuckyDrawParticipant, {
  foreignKey: 'luckyDrawId',
  as: 'participants'
});
LuckyDrawParticipant.belongsTo(LuckyDraw, {
  foreignKey: 'luckyDrawId',
  as: 'luckyDraw'
});

// User and LuckyDrawParticipant associations
User.hasMany(LuckyDrawParticipant, {
  foreignKey: 'userWalletAddress',
  sourceKey: 'walletAddress',
  as: 'luckyDrawParticipations'
});
LuckyDrawParticipant.belongsTo(User, {
  foreignKey: 'userWalletAddress',
  targetKey: 'walletAddress',
  as: 'user'
});

// User and LuckyDraw associations (winner)
User.hasMany(LuckyDraw, {
  foreignKey: 'winnerWalletAddress',
  sourceKey: 'walletAddress',
  as: 'luckyDrawWins'
});
LuckyDraw.belongsTo(User, {
  foreignKey: 'winnerWalletAddress',
  targetKey: 'walletAddress',
  as: 'winner'
});

// User and ReferralReward associations (as referrer)
User.hasMany(ReferralReward, {
  foreignKey: 'referrerWalletAddress',
  sourceKey: 'walletAddress',
  as: 'referralRewardsEarned'
});
ReferralReward.belongsTo(User, {
  foreignKey: 'referrerWalletAddress',
  targetKey: 'walletAddress',
  as: 'referrer'
});

// User and ReferralReward associations (as referred)
User.hasMany(ReferralReward, {
  foreignKey: 'referredWalletAddress',
  sourceKey: 'walletAddress',
  as: 'referralRewardsGenerated'
});
ReferralReward.belongsTo(User, {
  foreignKey: 'referredWalletAddress',
  targetKey: 'walletAddress',
  as: 'referredUser'
});

// ReferralReward and ReferralClaim associations
ReferralClaim.hasMany(ReferralReward, {
  foreignKey: 'claimId',
  as: 'rewards'
});
ReferralReward.belongsTo(ReferralClaim, {
  foreignKey: 'claimId',
  as: 'claim'
});

// User and ReferralClaim associations
User.hasMany(ReferralClaim, {
  foreignKey: 'referrerWalletAddress',
  sourceKey: 'walletAddress',
  as: 'referralClaims'
});
ReferralClaim.belongsTo(User, {
  foreignKey: 'referrerWalletAddress',
  targetKey: 'walletAddress',
  as: 'referrer'
});

// User and MemeCoin associations
User.hasMany(MemeCoin, {
  foreignKey: 'creatorWalletAddress',
  sourceKey: 'walletAddress',
  as: 'memeCoins'
});
MemeCoin.belongsTo(User, {
  foreignKey: 'creatorWalletAddress',
  targetKey: 'walletAddress',
  as: 'creator'
});

// Initialize notification service with models
const notificationService = require('../services/notificationService');
notificationService.init({ Notification, User, Follow });

// Initialize drop status service with models
const dropStatusService = require('../services/dropStatusService');
dropStatusService.init({ Drop });

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
  PostView,
  PostBoost,
  NftBoost,
  CollectionBoost,
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
  Banner,
  MonthlyRanking,
  Group,
  GroupMember,
  GroupMessage,
  Subscription,
  SubscriptionTier,
  UserStats,
  ActivityLog,
  Repost,
  LuckyDraw,
  LuckyDrawParticipant,
  ReferralReward,
  ReferralClaim,
  ReferralAuditLog,
  MemeCoin,
  UserWallet,
  SolanaNftListing
};
