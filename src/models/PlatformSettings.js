module.exports = (sequelize, DataTypes) => {
  const PlatformSettings = sequelize.define('PlatformSettings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    key: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: 'Setting key/identifier'
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Setting value (stored as string, parsed based on type)'
    },
    type: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
      defaultValue: 'string',
      allowNull: false,
      comment: 'Data type for parsing the value'
    },
    category: {
      type: DataTypes.ENUM('fees', 'marketplace', 'drops', 'social', 'notifications', 'general'),
      defaultValue: 'general',
      allowNull: false,
      comment: 'Category for grouping settings'
    },
    label: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Human-readable label for the setting'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of what this setting does'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this setting is visible to non-admin users'
    },
    isEditable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this setting can be edited via admin panel'
    },
    lastUpdatedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of admin who last updated this setting'
    }
  }, {
    tableName: 'PlatformSettings',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['key'] },
      { fields: ['category'] },
      { fields: ['isPublic'] }
    ]
  });

  // Instance methods
  PlatformSettings.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  /**
   * Get parsed value based on type
   */
  PlatformSettings.prototype.getParsedValue = function() {
    if (this.value === null || this.value === undefined) {
      return null;
    }

    switch (this.type) {
      case 'number':
        return parseFloat(this.value);
      case 'boolean':
        return this.value === 'true' || this.value === '1';
      case 'json':
        try {
          return JSON.parse(this.value);
        } catch (e) {
          return null;
        }
      default:
        return this.value;
    }
  };

  return PlatformSettings;
};
