module.exports = (sequelize, DataTypes) => {
  const Drop = sequelize.define('Drop', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    collectionId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to Collection'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Drop name/title'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Drop description'
    },
    price: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Minting price in XRP'
    },
    totalSupply: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Total number of NFTs in this drop',
      validate: {
        min: 1
      }
    },
    mintedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of NFTs already minted',
      validate: {
        min: 0
      }
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When minting starts'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When minting ends'
    },
    status: {
      type: DataTypes.ENUM('upcoming', 'active', 'ended', 'soldout'),
      defaultValue: 'upcoming',
      allowNull: false,
      comment: 'Drop status'
    },
    creatorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of drop creator'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether drop is public or allowlist-only'
    },
    allowlist: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of wallet addresses allowed to mint (null if public)',
      get() {
        const rawValue = this.getDataValue('allowlist');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    },
    transferFee: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Transfer fee in basis points (0-50000, where 50000 = 50%)',
      validate: {
        min: 0,
        max: 50000
      }
    },
    flags: {
      type: DataTypes.INTEGER,
      defaultValue: 8,
      allowNull: false,
      comment: 'XRPL NFT flags (8 = Transferable, 9 = Burnable & Transferable)'
    },
    maxMintsPerWallet: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Maximum number of NFTs one wallet can mint from this drop (null = unlimited)',
      validate: {
        min: 1
      }
    }
  }, {
    tableName: 'Drops',
    timestamps: true,
    indexes: [
      { fields: ['collectionId'] },
      { fields: ['creatorWalletAddress'] },
      { fields: ['status'] },
      { fields: ['startDate', 'endDate'] },
      { fields: ['createdAt'] }
    ]
  });

  // Instance methods
  Drop.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  Drop.prototype.isMintable = function() {
    const now = new Date();
    return (
      this.status === 'active' &&
      this.mintedCount < this.totalSupply &&
      now >= this.startDate &&
      now <= this.endDate
    );
  };

  Drop.prototype.updateStatus = function() {
    const now = new Date();
    if (this.mintedCount >= this.totalSupply) {
      this.status = 'soldout';
    } else if (now < this.startDate) {
      this.status = 'upcoming';
    } else if (now > this.endDate) {
      this.status = 'ended';
    } else {
      this.status = 'active';
    }
  };

  Drop.prototype.isAllowed = function(walletAddress) {
    // If public, everyone is allowed
    if (this.isPublic) {
      return true;
    }

    // If not public, check allowlist
    if (!this.allowlist || !Array.isArray(this.allowlist)) {
      return false;
    }

    // Check if wallet is in allowlist (case-insensitive)
    return this.allowlist.some(
      addr => addr.toLowerCase() === walletAddress.toLowerCase()
    );
  };

  return Drop;
};
