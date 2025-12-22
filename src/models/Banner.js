module.exports = (sequelize, DataTypes) => {
  const Banner = sequelize.define('Banner', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Banner title/headline'
    },
    subtitle: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Optional subtitle or description'
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Banner image URL'
    },
    link: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Optional link URL when banner is clicked'
    },
    linkText: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Text for the CTA button (e.g., "Learn More", "Shop Now")'
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Display order (lower numbers appear first)'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether the banner is currently active/visible'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Optional start date for scheduled banners'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Optional end date for scheduled banners'
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of admin who created this banner'
    },
    updatedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of admin who last updated this banner'
    }
  }, {
    tableName: 'Banners',
    timestamps: true,
    indexes: [
      { fields: ['isActive'] },
      { fields: ['position'] },
      { fields: ['startDate'] },
      { fields: ['endDate'] }
    ]
  });

  // Instance method to check if banner is currently visible
  Banner.prototype.isCurrentlyVisible = function() {
    if (!this.isActive) return false;

    const now = new Date();

    if (this.startDate && new Date(this.startDate) > now) {
      return false; // Not started yet
    }

    if (this.endDate && new Date(this.endDate) < now) {
      return false; // Already ended
    }

    return true;
  };

  return Banner;
};
