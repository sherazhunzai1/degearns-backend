module.exports = (sequelize, DataTypes) => {
  const LuckyDraw = sequelize.define('LuckyDraw', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    month: {
      type: DataTypes.STRING(7), // Format: YYYY-MM
      allowNull: false,
      unique: true,
      comment: 'Month of the lucky draw in YYYY-MM format'
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'cancelled'),
      defaultValue: 'active',
      comment: 'Status of the lucky draw'
    },
    winnerWalletAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Wallet address of the winner'
    },
    winningParticipantId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of the winning participant entry'
    },
    prizeDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of the prize'
    },
    prizeAmount: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
      comment: 'Prize amount (if applicable)'
    },
    prizeCurrency: {
      type: DataTypes.STRING(10),
      defaultValue: 'XRP',
      comment: 'Currency of the prize'
    },
    totalParticipants: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total number of participants'
    },
    drawnAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the winner was drawn'
    },
    drawnBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Admin wallet who drew the winner (or "system" for auto-draw)'
    }
  }, {
    tableName: 'LuckyDraws',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['month'],
        name: 'idx_lucky_draw_month'
      },
      {
        fields: ['status'],
        name: 'idx_lucky_draw_status'
      }
    ]
  });

  return LuckyDraw;
};
