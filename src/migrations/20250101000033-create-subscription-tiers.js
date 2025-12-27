'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SubscriptionTiers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Tier name: free, basic, pro, premium'
      },
      displayName: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Display name for UI'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Tier description'
      },
      boostMultiplier: {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 1.0,
        comment: 'Score boost multiplier (e.g., 1.30 for 30% boost)'
      },
      boostPercentage: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Boost percentage for display (e.g., 30 for 30%)'
      },
      monthlyPriceXrp: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Monthly price in XRP'
      },
      yearlyPriceXrp: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Yearly price in XRP (discounted)'
      },
      features: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of feature strings for this tier'
      },
      limits: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Tier-specific limits (e.g., analytics depth, support priority)'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether this tier is currently available for purchase'
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Display order (0=free, 1=basic, 2=pro, 3=premium)'
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Theme color for UI display (e.g., #FFD700 for premium)'
      },
      icon: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Icon name for UI display'
      },
      badge: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Badge text for UI (e.g., "Most Popular", "Best Value")'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('SubscriptionTiers', ['name'], {
      name: 'idx_tier_name',
      unique: true
    });

    await queryInterface.addIndex('SubscriptionTiers', ['isActive'], {
      name: 'idx_tier_active'
    });

    await queryInterface.addIndex('SubscriptionTiers', ['sortOrder'], {
      name: 'idx_tier_sort_order'
    });

    // Insert default tiers
    await queryInterface.bulkInsert('SubscriptionTiers', [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'free',
        displayName: 'Free',
        description: 'Get started with basic features',
        boostMultiplier: 1.00,
        boostPercentage: 0,
        monthlyPriceXrp: null,
        yearlyPriceXrp: null,
        features: JSON.stringify([
          'Basic leaderboard visibility',
          'Standard scoring algorithm',
          'Community access',
          'Basic profile customization'
        ]),
        limits: JSON.stringify({
          analyticsDepth: 'basic',
          supportPriority: 'standard',
          apiRateLimit: 100
        }),
        isActive: true,
        sortOrder: 0,
        color: '#6B7280',
        icon: 'user',
        badge: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'basic',
        displayName: 'Basic',
        description: 'Enhanced visibility and analytics',
        boostMultiplier: 1.10,
        boostPercentage: 10,
        monthlyPriceXrp: 10.00,
        yearlyPriceXrp: 100.00,
        features: JSON.stringify([
          '10% score boost',
          'Priority leaderboard visibility',
          'Basic analytics dashboard',
          'Enhanced profile customization',
          'Email support'
        ]),
        limits: JSON.stringify({
          analyticsDepth: 'basic',
          supportPriority: 'email',
          apiRateLimit: 500
        }),
        isActive: true,
        sortOrder: 1,
        color: '#3B82F6',
        icon: 'star',
        badge: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'pro',
        displayName: 'Pro',
        description: 'Professional tools for serious creators',
        boostMultiplier: 1.20,
        boostPercentage: 20,
        monthlyPriceXrp: 25.00,
        yearlyPriceXrp: 250.00,
        features: JSON.stringify([
          '20% score boost',
          'Enhanced leaderboard visibility',
          'Advanced analytics dashboard',
          'Performance insights',
          'Priority email support',
          'Custom profile badge',
          'Early access to new features'
        ]),
        limits: JSON.stringify({
          analyticsDepth: 'advanced',
          supportPriority: 'priority',
          apiRateLimit: 1000
        }),
        isActive: true,
        sortOrder: 2,
        color: '#8B5CF6',
        icon: 'zap',
        badge: 'Most Popular',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        name: 'premium',
        displayName: 'Premium',
        description: 'Maximum visibility and exclusive benefits',
        boostMultiplier: 1.30,
        boostPercentage: 30,
        monthlyPriceXrp: 50.00,
        yearlyPriceXrp: 500.00,
        features: JSON.stringify([
          '30% score boost',
          'Maximum leaderboard visibility',
          'Full analytics suite',
          'Real-time performance tracking',
          'Dedicated priority support',
          'Exclusive premium badge',
          'Early access to all features',
          'Featured creator spotlight',
          'API access for integrations'
        ]),
        limits: JSON.stringify({
          analyticsDepth: 'full',
          supportPriority: 'dedicated',
          apiRateLimit: 5000
        }),
        isActive: true,
        sortOrder: 3,
        color: '#F59E0B',
        icon: 'crown',
        badge: 'Best Value',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('SubscriptionTiers');
  }
};
