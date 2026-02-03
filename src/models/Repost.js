module.exports = (sequelize, DataTypes) => {
  const Repost = sequelize.define('Repost', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'The original post being reposted'
    },
    userWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the user who reposted'
    },
    quote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional quote/comment added to the repost'
    }
  }, {
    tableName: 'Reposts',
    timestamps: true,
    indexes: [
      {
        fields: ['postId'],
        name: 'idx_repost_post'
      },
      {
        fields: ['userWalletAddress'],
        name: 'idx_repost_user'
      },
      {
        fields: ['postId', 'userWalletAddress'],
        unique: true,
        name: 'idx_repost_unique'
      },
      {
        fields: ['createdAt'],
        name: 'idx_repost_created'
      }
    ]
  });

  return Repost;
};
