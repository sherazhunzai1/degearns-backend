module.exports = (sequelize, DataTypes) => {
  const PostLike = sequelize.define('PostLike', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the post'
    },
    userWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the user who liked'
    }
  }, {
    tableName: 'PostLikes',
    timestamps: true,
    updatedAt: false, // Likes don't need updatedAt
    indexes: [
      {
        unique: true,
        fields: ['postId', 'userWalletAddress'],
        name: 'unique_post_like'
      },
      {
        fields: ['postId'],
        name: 'idx_postlike_post'
      },
      {
        fields: ['userWalletAddress'],
        name: 'idx_postlike_user'
      }
    ]
  });

  // Instance methods
  PostLike.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return PostLike;
};
