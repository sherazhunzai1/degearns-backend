module.exports = (sequelize, DataTypes) => {
  const ReferralClaim = sequelize.define('ReferralClaim', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    referrerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the referrer claiming rewards'
    },
    totalAmount: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Total amount being claimed (in drops/XRP)'
    },
    rewardCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Number of individual rewards included in this claim'
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Status of the claim'
    },
    transactionHash: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'XRPL transaction hash of the payout'
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date when the claim was processed'
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for failure if claim failed'
    }
  }, {
    tableName: 'ReferralClaims',
    timestamps: true,
    indexes: [
      { fields: ['referrerWalletAddress'] },
      { fields: ['status'] }
    ]
  });

  return ReferralClaim;
};
