module.exports = (sequelize, DataTypes) => {
  const PostView = sequelize.define('PostView', {
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
      comment: 'Wallet address of the user who viewed'
    }
  }, {
    tableName: 'PostViews',
    timestamps: true,
    updatedAt: false, // Views don't need updatedAt
    indexes: [
      {
        unique: true,
        fields: ['postId', 'userWalletAddress'],
        name: 'unique_post_view'
      },
      {
        fields: ['postId'],
        name: 'idx_postview_post'
      },
      {
        fields: ['userWalletAddress'],
        name: 'idx_postview_user'
      }
    ]
  });

  // Instance methods
  PostView.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return PostView;
};
