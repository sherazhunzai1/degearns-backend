module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    walletAddress: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: 'XRPL wallet address - primary identifier'
    },
    username: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: true,
      comment: 'User display name'
    },
    email: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: true,
      comment: 'User email (optional)'
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User biography'
    },
    profileImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Profile image URL'
    },
    coverImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Cover/banner image URL'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Verified badge status'
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
      allowNull: false
    },
    socialLinks: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'JSON object for social media links',
      get() {
        const rawValue = this.getDataValue('socialLinks');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'Users',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['walletAddress'] },
      { fields: ['username'] },
      { fields: ['email'] }
    ]
  });

  // Instance methods
  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return User;
};
