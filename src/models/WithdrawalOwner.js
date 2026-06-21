module.exports = (sequelize, DataTypes) => {
  const WithdrawalOwner = sequelize.define('WithdrawalOwner', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Display name of the withdrawal owner'
    },
    walletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'XRPL wallet address of the owner',
      validate: {
        is: {
          args: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
          msg: 'Invalid XRPL wallet address format'
        }
      }
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Display order position'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this owner is currently active'
    }
  }, {
    tableName: 'WithdrawalOwners',
    timestamps: true,
    indexes: [
      { fields: ['walletAddress'], unique: true },
      { fields: ['isActive'] },
      { fields: ['position'] }
    ]
  });

  WithdrawalOwner.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return WithdrawalOwner;
};
