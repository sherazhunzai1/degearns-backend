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
      comment: 'Reference to the drop'
    },
    minterWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the minter'
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      defaultValue: 'xrpl',
      allowNull: false,
      comment: 'Blockchain network for this mint'
    },
    nftTokenId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'NFT identifier (XRPL NFToken ID or Solana mint address)'
    },
    nftUri: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URI of the NFT metadata'
    },
    transactionHash: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'XRPL transaction hash of the mint'
    },
    mintPrice: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '0',
      comment: 'Price paid for this mint in drops'
    },
    paymentTransactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Transaction hash for the payment to creator (if not free)'
    },
    mintIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'The index/order of this mint in the drop (1, 2, 3, etc.)'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata about the mint',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'DropMints',
    timestamps: true,
    indexes: [
      { fields: ['dropId'] },
      { fields: ['minterWalletAddress'] },
      { fields: ['nftTokenId'], unique: true },
      { fields: ['transactionHash'] },
      { fields: ['createdAt'] },
      {
        fields: ['dropId', 'mintIndex'],
        name: 'idx_drop_mint_index'
      }
    ]
  });

  // Instance methods
  DropMint.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return DropMint;
};
