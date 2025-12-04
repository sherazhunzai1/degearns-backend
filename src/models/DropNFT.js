module.exports = (sequelize, DataTypes) => {
  const DropNFT = sequelize.define('DropNFT', {
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
    metadataUri: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'IPFS URI for NFT metadata'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'Cached NFT metadata (name, description, image, attributes)',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    },
    nftokenId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      comment: 'XRPL NFToken ID after minting (null if not minted yet)'
    },
    mintedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of minter (null if not minted yet)'
    },
    mintedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this NFT was minted'
    },
    transactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'XRPL transaction hash (null if not minted yet)'
    },
    isMinted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this NFT has been minted'
    },
    mintNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Sequential mint number (assigned when minted)'
    }
  }, {
    tableName: 'DropNFTs',
    timestamps: true,
    indexes: [
      { fields: ['dropId'] },
      { fields: ['isMinted'] },
      { fields: ['dropId', 'isMinted'] },
      { unique: true, fields: ['nftokenId'], where: { nftokenId: { [DataTypes.Op.ne]: null } } },
      { fields: ['mintedBy'] },
      { fields: ['mintedAt'] }
    ]
  });

  // Instance methods
  DropNFT.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  return DropNFT;
};
