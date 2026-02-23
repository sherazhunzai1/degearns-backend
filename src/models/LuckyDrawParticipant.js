module.exports = (sequelize, DataTypes) => {
  const LuckyDrawParticipant = sequelize.define('LuckyDrawParticipant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    luckyDrawId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the lucky draw'
    },
    userWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Wallet address of the participant'
    },
    nftTokenId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'NFT token ID that was purchased'
    },
    purchasePrice: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Purchase price in drops'
    },
    purchaseCurrency: {
      type: DataTypes.STRING(10),
      defaultValue: 'XRP',
      comment: 'Currency used for purchase'
    },
    transactionHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'XRPL transaction hash of the purchase'
    },
    purchasedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the NFT was purchased'
    },
    isWinner: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this participant won the draw'
    },
    winnerPosition: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Winner position (1-10), null if not a winner'
    }
  }, {
    tableName: 'LuckyDrawParticipants',
    timestamps: true,
    indexes: [
      {
        fields: ['luckyDrawId'],
        name: 'idx_participant_lucky_draw'
      },
      {
        fields: ['userWalletAddress'],
        name: 'idx_participant_wallet'
      },
      {
        fields: ['luckyDrawId', 'userWalletAddress'],
        name: 'idx_participant_draw_wallet'
      },
      {
        fields: ['nftTokenId'],
        name: 'idx_participant_nft'
      }
    ]
  });

  return LuckyDrawParticipant;
};
