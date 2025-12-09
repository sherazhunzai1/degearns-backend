module.exports = (sequelize, DataTypes) => {
  const PostMedia = sequelize.define('PostMedia', {
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
    mediaType: {
      type: DataTypes.ENUM('image', 'video'),
      allowNull: false,
      comment: 'Type of media: image or video'
    },
    mediaUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'URL of the media file'
    },
    thumbnailUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Thumbnail URL for videos'
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'MIME type of the media (e.g., image/jpeg, video/mp4)'
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'File size in bytes'
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Width in pixels'
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Height in pixels'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in seconds (for videos)'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Order of media display in the post'
    },
    altText: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Alternative text for accessibility'
    }
  }, {
    tableName: 'PostMedia',
    timestamps: true,
    indexes: [
      {
        fields: ['postId'],
        name: 'idx_postmedia_post'
      },
      {
        fields: ['mediaType'],
        name: 'idx_postmedia_type'
      },
      {
        fields: ['postId', 'displayOrder'],
        name: 'idx_postmedia_order'
      }
    ]
  });

  // Instance methods
  PostMedia.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return PostMedia;
};
