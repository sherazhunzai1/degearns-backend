module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    recipientWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the user receiving the notification'
    },
    senderWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the user who triggered the notification'
    },
    type: {
      type: DataTypes.ENUM(
        'like',
        'comment',
        'comment_reply',
        'follow',
        'nft_listing',
        'nft_purchase',
        'drop_launch',
        'drop_mint',
        'drop_allowlist',
        'subscription_created',
        'subscription_upgraded',
        'subscription_cancelled',
        'subscription_expiring',
        'subscription_expired'
      ),
      allowNull: false,
      comment: 'Type of notification'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Short notification title'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed notification message'
    },
    relatedEntityId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of the related entity (postId, commentId, followId, collectionId)'
    },
    relatedEntityType: {
      type: DataTypes.ENUM('post', 'comment', 'follow', 'collection', 'nft', 'drop', 'subscription'),
      allowNull: true,
      comment: 'Type of the related entity'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the notification (post preview, NFT info, etc.)'
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether the notification has been read'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when the notification was read'
    }
  }, {
    tableName: 'Notifications',
    timestamps: true,
    indexes: [
      {
        fields: ['recipientWalletAddress', 'isRead'],
        name: 'idx_notification_recipient_read'
      },
      {
        fields: ['recipientWalletAddress', 'createdAt'],
        name: 'idx_notification_recipient_created'
      },
      {
        fields: ['type'],
        name: 'idx_notification_type'
      },
      {
        fields: ['senderWalletAddress'],
        name: 'idx_notification_sender'
      },
      {
        fields: ['relatedEntityId', 'relatedEntityType'],
        name: 'idx_notification_related_entity'
      }
    ]
  });

  // Instance methods
  Notification.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return Notification;
};
