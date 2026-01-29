module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define('Post', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    authorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Author wallet address'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Post text content (optional if media is provided)'
    },
    postType: {
      type: DataTypes.ENUM('text', 'image', 'video', 'mixed'),
      defaultValue: 'text',
      comment: 'Type of post: text only, image(s), video(s), or mixed media'
    },
    visibility: {
      type: DataTypes.ENUM('public', 'private'),
      defaultValue: 'public',
      comment: 'Post visibility setting'
    },
    likesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of likes on the post'
    },
    commentsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of comments on the post'
    },
    sharesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of shares of the post'
    },
    viewsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of unique views on the post'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata like location, tags, etc.',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Soft delete flag'
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether the post is pinned to the top of user timeline'
    },
    pinnedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when the post was pinned'
    }
  }, {
    tableName: 'Posts',
    timestamps: true,
    indexes: [
      {
        fields: ['authorWalletAddress'],
        name: 'idx_post_author'
      },
      {
        fields: ['postType'],
        name: 'idx_post_type'
      },
      {
        fields: ['visibility'],
        name: 'idx_post_visibility'
      },
      {
        fields: ['createdAt'],
        name: 'idx_post_created'
      },
      {
        fields: ['isActive'],
        name: 'idx_post_active'
      },
      {
        fields: ['authorWalletAddress', 'createdAt'],
        name: 'idx_post_author_created'
      },
      {
        fields: ['authorWalletAddress', 'isPinned', 'pinnedAt'],
        name: 'idx_post_author_pinned'
      }
    ]
  });

  // Instance methods
  Post.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return Post;
};
