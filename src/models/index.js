const { sequelize } = require('../config/sequelize');
const { DataTypes } = require('sequelize');

// Import models
const User = require('./User')(sequelize, DataTypes);
const Collection = require('./Collection')(sequelize, DataTypes);
const Drop = require('./Drop')(sequelize, DataTypes);
const DropMint = require('./DropMint')(sequelize, DataTypes);
const DropNFT = require('./DropNFT')(sequelize, DataTypes);

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

// Collection and Drop
Collection.hasMany(Drop, {
  foreignKey: 'collectionId',
  as: 'drops'
});
Drop.belongsTo(Collection, {
  foreignKey: 'collectionId',
  as: 'collection'
});

// User and Drop
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

// Drop and DropMint
Drop.hasMany(DropMint, {
  foreignKey: 'dropId',
  as: 'mints'
});
DropMint.belongsTo(Drop, {
  foreignKey: 'dropId',
  as: 'drop'
});

// User and DropMint
User.hasMany(DropMint, {
  foreignKey: 'minterWalletAddress',
  sourceKey: 'walletAddress',
  as: 'mints'
});
DropMint.belongsTo(User, {
  foreignKey: 'minterWalletAddress',
  targetKey: 'walletAddress',
  as: 'minter'
});

// Collection and DropNFT
Collection.hasMany(DropNFT, {
  foreignKey: 'collectionId',
  as: 'dropNFTs'
});
DropNFT.belongsTo(Collection, {
  foreignKey: 'collectionId',
  as: 'collection'
});

// Drop and DropNFT
Drop.hasMany(DropNFT, {
  foreignKey: 'dropId',
  as: 'nfts'
});
DropNFT.belongsTo(Drop, {
  foreignKey: 'dropId',
  as: 'drop'
});

// User and DropNFT (for minted NFTs)
User.hasMany(DropNFT, {
  foreignKey: 'mintedBy',
  sourceKey: 'walletAddress',
  as: 'mintedNFTs'
});
DropNFT.belongsTo(User, {
  foreignKey: 'mintedBy',
  targetKey: 'walletAddress',
  as: 'minter'
});

module.exports = {
  sequelize,
  User,
  Collection,
  Drop,
  DropMint,
  DropNFT
};
