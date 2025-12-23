'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MonthlyRankings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      periodMonth: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Month of the ranking period (1-12)'
      },
      periodYear: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Year of the ranking period'
      },
      category: {
        type: Sequelize.ENUM('trader', 'creator', 'influencer'),
        allowNull: false,
        comment: 'Category of the ranking'
      },
      rankings: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Array of 10 ranked wallet addresses'
      },
      status: {
        type: Sequelize.ENUM('draft', 'finalized', 'distributed'),
        defaultValue: 'draft',
        comment: 'Status of the ranking'
      },
      distributionBatchId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference to the distribution batch when distributed'
      },
      distributedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when rewards were distributed'
      },
      setBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Admin wallet who set/updated the rankings'
      },
      finalizedBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Admin wallet who finalized the rankings'
      },
      finalizedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when rankings were finalized'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin notes about this ranking'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata about the ranking'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('MonthlyRankings', ['periodMonth', 'periodYear']);
    await queryInterface.addIndex('MonthlyRankings', ['category']);
    await queryInterface.addIndex('MonthlyRankings', ['status']);
    await queryInterface.addIndex('MonthlyRankings', ['periodMonth', 'periodYear', 'category'], {
      unique: true,
      name: 'unique_ranking_per_period_category'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('MonthlyRankings');
  }
};
