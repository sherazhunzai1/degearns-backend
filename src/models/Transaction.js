module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    txHash: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
      comment: 'XRPL transaction hash'
    },
    type: {
      type: DataTypes.ENUM('mint', 'sale', 'transfer', 'list', 'delist', 'offer', 'burn'),
      allowNull: false,
      comment: 'Transaction type'
    },
    nftId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'NFT involved in transaction'
    },
    nftTokenId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'XRPL NFToken ID'
    },
    fromWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Sender wallet address'
    },
    toWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Receiver wallet address'
    },
    amount: {
      type: DataTypes.STRING(50),
      defaultValue: '0',
      comment: 'Transaction amount in drops'
    },
    marketplaceFee: {
      type: DataTypes.STRING(50),
      defaultValue: '0',
      comment: 'Marketplace fee in drops'
    },
    royaltyFee: {
      type: DataTypes.STRING(50),
      defaultValue: '0',
      comment: 'Creator royalty in drops'
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Transaction status'
    },
    offerID: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL offer ID if applicable'
    },
    blockNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'XRPL ledger index'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional transaction metadata',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'Transactions',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['txHash'] },
      { fields: ['nftId'] },
      { fields: ['fromWalletAddress'] },
      { fields: ['toWalletAddress'] },
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ]
  });

  // Instance methods
  Transaction.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return Transaction;
};
