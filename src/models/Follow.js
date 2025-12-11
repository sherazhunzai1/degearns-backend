module.exports = (sequelize, DataTypes) => {
  const Follow = sequelize.define('Follow', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    followerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'The user who is following'
    },
    followingWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'The user being followed'
    }
  }, {
    tableName: 'Follows',
    timestamps: true,
    updatedAt: false, // Only need createdAt for follows
    indexes: [
      {
        unique: true,
        fields: ['followerWalletAddress', 'followingWalletAddress'],
        name: 'unique_follow'
      },
      {
        fields: ['followerWalletAddress'],
        name: 'idx_follow_follower'
      },
      {
        fields: ['followingWalletAddress'],
        name: 'idx_follow_following'
      }
    ]
  });

  return Follow;
};
