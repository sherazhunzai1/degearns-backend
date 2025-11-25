const { sequelize } = require('../config/sequelize');
const { DataTypes } = require('sequelize');

// Import models
const User = require('./User')(sequelize, DataTypes);
const Collection = require('./Collection')(sequelize, DataTypes);

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

module.exports = {
  sequelize,
  User,
  Collection
};
