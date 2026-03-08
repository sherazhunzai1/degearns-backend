module.exports = (sequelize, DataTypes) => {
  const ReferralAuditLog = sequelize.define('ReferralAuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    action: {
      type: DataTypes.ENUM(
        'reward_created',
        'reward_claimable',
        'reward_claimed',
        'reward_paid',
        'reward_frozen',
        'claim_initiated',
        'claim_completed',
        'claim_failed',
        'abuse_detected',
        'rewards_unfrozen'
      ),
      allowNull: false,
      comment: 'Type of action logged'
    },
    referrerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the referrer'
    },
    referredWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of the referred user (if applicable)'
    },
    rewardId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to the specific reward'
    },
    claimId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to the claim batch'
    },
    serviceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Type of service (subscription/boost)'
    },
    amount: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Amount involved (in drops/XRP)'
    },
    transactionHash: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'XRPL transaction hash'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional metadata for the log entry'
    }
  }, {
    tableName: 'ReferralAuditLogs',
    timestamps: true,
    updatedAt: false, // Audit logs are immutable - no updates
    indexes: [
      { fields: ['referrerWalletAddress'] },
      { fields: ['referredWalletAddress'] },
      { fields: ['action'] },
      { fields: ['rewardId'] },
      { fields: ['createdAt'] }
    ]
  });

  return ReferralAuditLog;
};
