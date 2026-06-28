module.exports = (sequelize, DataTypes) => {
  const PostComment = sequelize.define('PostComment', {
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
    authorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the comment author'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Comment content'
    },
    parentCommentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Thread root (top-level comment) for replies; null for top-level comments'
    },
    replyToCommentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'The specific comment a reply targets (for @mention); null for top-level comments'
    },
    replyToWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet of the user being replied to (for "replying to @username")'
    },
    likesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of likes on the comment'
    },
    repliesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of replies to this comment'
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether the comment has been edited'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Soft delete flag'
    }
  }, {
    tableName: 'PostComments',
    timestamps: true,
    indexes: [
      {
        fields: ['postId'],
        name: 'idx_postcomment_post'
      },
      {
        fields: ['authorWalletAddress'],
        name: 'idx_postcomment_author'
      },
      {
        fields: ['parentCommentId'],
        name: 'idx_postcomment_parent'
      },
      {
        fields: ['replyToCommentId'],
        name: 'idx_postcomment_replyto'
      },
      {
        fields: ['postId', 'createdAt'],
        name: 'idx_postcomment_post_created'
      },
      {
        fields: ['isActive'],
        name: 'idx_postcomment_active'
      }
    ]
  });

  // Instance methods
  PostComment.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return PostComment;
};
