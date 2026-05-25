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
      allowNull: true,
      comment: 'Optional reference to existing collection (Drop can be standalone)'
    },
    creatorWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of drop creator'
    },
    network: {
      type: DataTypes.ENUM('xrpl', 'solana'),
      defaultValue: 'xrpl',
      allowNull: false,
      comment: 'Blockchain network for this drop'
    },
    collectionMintAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Solana collection mint address for this drop'
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
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Drop cover image URL'
    },
    bannerImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Drop banner image URL'
    },
    // Taxon ID for NFT minting
    taxonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Taxon ID for NFT minting on XRPL'
    },
    // Social links
    websiteUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Project website URL'
    },
    twitterUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Twitter/X profile URL'
    },
    discordUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Discord server URL'
    },
    telegramUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Telegram group URL'
    },
    // Pricing and limits
    royaltyPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      allowNull: false,
      comment: 'Creator royalty percentage (0-50)',
      validate: {
        min: 0,
        max: 50
      }
    },
    pricePerNft: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '0',
      comment: 'Price per NFT in smallest unit (XRP drops or SOL lamports)'
    },
    priceCurrency: {
      type: DataTypes.ENUM('XRP', 'SOL'),
      defaultValue: 'XRP',
      allowNull: false,
      comment: 'Currency for pricing (XRP drops or SOL lamports)'
    },
    limitPerWallet: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Maximum NFTs per wallet (null = unlimited)'
    },
    totalSupply: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total NFTs available in this drop'
    },
    mintedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of NFTs minted from this drop'
    },
    // NFT Flags
    isBurnable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether NFTs can be burned'
    },
    isTransferable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether NFTs can be transferred'
    },
    isOnlyXrp: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether NFTs can only be traded for XRP'
    },
    isMutable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether NFT metadata can be changed'
    },
    // Schedule
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Drop start date and time'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Drop end date and time'
    },
    // Authorized minter
    authorizedMinterWallet: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address authorized to perform minting operations'
    },
    minterAuthorizationTxHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Transaction hash for minter authorization on XRPL'
    },
    // Platform fees
    platformFeePerNft: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '30000', // 0.03 XRP in drops (1 XRP = 1,000,000 drops)
      comment: 'Platform fee per NFT in drops (0.03 XRP = 30000 drops)'
    },
    setupFee: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '3000000', // 3 XRP in drops
      comment: 'Setup fee for launching the drop (3 XRP = 3000000 drops)'
    },
    totalPlatformFees: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Total calculated platform fees (platformFeePerNft * totalSupply + setupFee)'
    },
    platformFeesTransactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Transaction hash for platform fees payment'
    },
    platformFeesStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
      comment: 'Status of platform fees payment'
    },
    // Revenue tracking
    totalRevenue: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '0',
      comment: 'Total revenue from mints in drops'
    },
    // Launch fees (legacy - keeping for backward compatibility)
    launchFee: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Fee paid to launch the drop (deprecated, use totalPlatformFees)'
    },
    launchFeeTransactionHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Transaction hash for launch fee payment (deprecated)'
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
      comment: 'Status of launch fee payment (deprecated, use platformFeesStatus)'
    },
    // Dashboard toggles
    isMintingEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether minting is currently enabled'
    },
    isAllowlistEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether allowlist restriction is enabled'
    },
    isFreeMint: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether minting is free (ignores pricePerNft)'
    },
    // Status
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'active', 'paused', 'ended', 'sold_out'),
      defaultValue: 'draft',
      comment: 'Current status of the drop'
    },
    // Additional metadata
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the drop',
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
      }
    }
  }, {
    tableName: 'Drops',
    timestamps: true,
    indexes: [
      // Note: collectionId and creatorWalletAddress indexes are auto-created by foreign keys
      { fields: ['status'] },
      { fields: ['network'] },
      { fields: ['startDate'] },
      { fields: ['endDate'] },
      { fields: ['paymentStatus'] },
      { fields: ['createdAt'] }
    ]
  });

  // Instance methods
  Drop.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  // Helper method to check if drop is currently active
  Drop.prototype.isCurrentlyActive = function() {
    const now = new Date();
    const hasStarted = !this.startDate || new Date(this.startDate) <= now;
    const hasNotEnded = !this.endDate || new Date(this.endDate) >= now;
    return this.status === 'active' && hasStarted && hasNotEnded && this.isMintingEnabled;
  };

  // Helper method to auto-sync status based on current date/time
  // Returns true if status was changed, false otherwise
  Drop.prototype.syncStatusWithDates = async function() {
    const now = new Date();
    const startDate = this.startDate ? new Date(this.startDate) : null;
    const endDate = this.endDate ? new Date(this.endDate) : null;
    let statusChanged = false;

    // If drop is scheduled and start date has passed, make it active
    if (this.status === 'scheduled' && startDate && startDate <= now) {
      // Only activate if payment is confirmed and minting is enabled
      if (this.platformFeesStatus === 'paid' || this.paymentStatus === 'paid') {
        this.status = 'active';
        this.isMintingEnabled = true;
        statusChanged = true;
      }
    }

    // If drop is active and end date has passed, mark it as ended
    if (this.status === 'active' && endDate && endDate < now) {
      this.status = 'ended';
      this.isMintingEnabled = false;
      statusChanged = true;
    }

    // If drop is sold out, mark it as sold_out
    if (this.status === 'active' && this.mintedCount >= this.totalSupply && this.totalSupply > 0) {
      this.status = 'sold_out';
      statusChanged = true;
    }

    // Save changes if any
    if (statusChanged) {
      await this.save();
    }

    return statusChanged;
  };

  // Static method to sync status for multiple drops
  Drop.syncAllDropStatuses = async function() {
    const now = new Date();
    const { Op } = sequelize.Sequelize;

    // Find drops that need status update
    // 1. Scheduled drops where startDate has passed
    const scheduledToActivate = await this.findAll({
      where: {
        status: 'scheduled',
        startDate: { [Op.lte]: now },
        [Op.or]: [
          { platformFeesStatus: 'paid' },
          { paymentStatus: 'paid' }
        ]
      }
    });

    // 2. Active drops where endDate has passed
    const activeToEnd = await this.findAll({
      where: {
        status: 'active',
        endDate: { [Op.lt]: now }
      }
    });

    // 3. Active drops that are sold out
    const activeToSoldOut = await this.findAll({
      where: {
        status: 'active',
        totalSupply: { [Op.gt]: 0 },
        [Op.and]: sequelize.literal('mintedCount >= totalSupply')
      }
    });

    let updatedCount = 0;

    // Activate scheduled drops
    for (const drop of scheduledToActivate) {
      drop.status = 'active';
      drop.isMintingEnabled = true;
      await drop.save();
      updatedCount++;
    }

    // End active drops that have passed end date
    for (const drop of activeToEnd) {
      drop.status = 'ended';
      drop.isMintingEnabled = false;
      await drop.save();
      updatedCount++;
    }

    // Mark sold out drops
    for (const drop of activeToSoldOut) {
      drop.status = 'sold_out';
      await drop.save();
      updatedCount++;
    }

    return updatedCount;
  };

  // Helper method to check if drop is sold out
  Drop.prototype.isSoldOut = function() {
    return this.mintedCount >= this.totalSupply;
  };

  // Helper method to get remaining supply
  Drop.prototype.getRemainingSupply = function() {
    return Math.max(0, this.totalSupply - this.mintedCount);
  };

  // Helper method to calculate total platform fees
  Drop.prototype.calculatePlatformFees = function() {
    const platformFeePerNft = BigInt(this.platformFeePerNft || '30000');
    const setupFee = BigInt(this.setupFee || '3000000');
    const totalSupply = BigInt(this.totalSupply || 0);
    return (platformFeePerNft * totalSupply + setupFee).toString();
  };

  // Helper method to get fees breakdown
  Drop.prototype.getFeesBreakdown = function() {
    const platformFeePerNft = BigInt(this.platformFeePerNft || '30000');
    const setupFee = BigInt(this.setupFee || '3000000');
    const totalSupply = BigInt(this.totalSupply || 0);
    const nftFees = platformFeePerNft * totalSupply;
    const totalFees = nftFees + setupFee;

    return {
      platformFeePerNft: this.platformFeePerNft || '30000',
      platformFeePerNftXrp: (Number(platformFeePerNft) / 1000000).toFixed(6),
      setupFee: this.setupFee || '3000000',
      setupFeeXrp: (Number(setupFee) / 1000000).toFixed(6),
      totalSupply: this.totalSupply,
      nftFeesTotal: nftFees.toString(),
      nftFeesTotalXrp: (Number(nftFees) / 1000000).toFixed(6),
      totalPlatformFees: totalFees.toString(),
      totalPlatformFeesXrp: (Number(totalFees) / 1000000).toFixed(6)
    };
  };

  return Drop;
};
