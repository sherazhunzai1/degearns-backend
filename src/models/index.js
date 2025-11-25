const { sequelize } = require('../config/sequelize');
const { DataTypes } = require('sequelize');

// Import models
const User = require('./User')(sequelize, DataTypes);
const Collection = require('./Collection')(sequelize, DataTypes);
const NFT = require('./NFT')(sequelize, DataTypes);
const Transaction = require('./Transaction')(sequelize, DataTypes);

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

// Collection and NFT
Collection.hasMany(NFT, {
  foreignKey: 'collectionId',
  as: 'nfts'
});
NFT.belongsTo(Collection, {
  foreignKey: 'collectionId',
  as: 'collection'
});

// User and NFT (creator)
User.hasMany(NFT, {
  foreignKey: 'creatorWalletAddress',
  sourceKey: 'walletAddress',
  as: 'createdNFTs'
});
NFT.belongsTo(User, {
  foreignKey: 'creatorWalletAddress',
  targetKey: 'walletAddress',
  as: 'creator'
});

// User and NFT (owner)
User.hasMany(NFT, {
  foreignKey: 'ownerWalletAddress',
  sourceKey: 'walletAddress',
  as: 'ownedNFTs'
});
NFT.belongsTo(User, {
  foreignKey: 'ownerWalletAddress',
  targetKey: 'walletAddress',
  as: 'owner'
});

// NFT and Transaction
NFT.hasMany(Transaction, {
  foreignKey: 'nftId',
  as: 'transactions'
});
Transaction.belongsTo(NFT, {
  foreignKey: 'nftId',
  as: 'nft'
});

module.exports = {
  sequelize,
  User,
  Collection,
  NFT,
  Transaction
};
