module.exports = (sequelize, DataTypes) => {
  const DropMint = sequelize.define('DropMint', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    dropId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to Drop'
    },
    minterWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the minter'
    },
    nftokenId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'XRPL NFToken ID of minted NFT'
    },
    transactionHash: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'XRPL transaction hash'
    },
    mintNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Sequential mint number for this drop (e.g., #1, #2, #3)',
      validate: {
        min: 1
      }
    }
  }, {
    tableName: 'DropMints',
    timestamps: true,
    indexes: [
      { fields: ['dropId'] },
      { fields: ['minterWalletAddress'] },
      { unique: true, fields: ['nftokenId'] },
      { fields: ['dropId', 'minterWalletAddress'] },
      { fields: ['createdAt'] }
    ]
  });

  // Instance methods
  DropMint.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return DropMint;
};
