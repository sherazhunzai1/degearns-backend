'use strict';

/**
 * Migration: Change Subscription planType from ENUM to STRING
 *
 * This migration changes the planType column from a hardcoded ENUM
 * to a STRING that references values from the SubscriptionTiers table.
 * This allows dynamic tier management without schema changes.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Add new temporary column with STRING type
    await queryInterface.addColumn('Subscriptions', 'planTypeName', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Subscription tier name from SubscriptionTiers table'
    });

    // Step 2: Copy existing ENUM values to new column
    await queryInterface.sequelize.query(`
      UPDATE Subscriptions
      SET planTypeName = planType
    `);

    // Step 3: Remove the old ENUM column
    await queryInterface.removeColumn('Subscriptions', 'planType');

    // Step 4: Rename the new column to planType
    await queryInterface.renameColumn('Subscriptions', 'planTypeName', 'planType');

    // Step 5: Make the column NOT NULL and set default
    await queryInterface.changeColumn('Subscriptions', 'planType', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'free',
      comment: 'Subscription tier name from SubscriptionTiers table'
    });

    // Step 6: Re-add the index on planType
    await queryInterface.addIndex('Subscriptions', ['planType'], {
      name: 'idx_subscription_plan_type'
    });

    // Step 7: Add foreign key constraint to SubscriptionTiers.name
    // Note: This ensures data integrity - planType must match a tier name
    await queryInterface.addConstraint('Subscriptions', {
      fields: ['planType'],
      type: 'foreign key',
      name: 'fk_subscription_plan_type_tier',
      references: {
        table: 'SubscriptionTiers',
        field: 'name'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Step 1: Remove foreign key constraint
    await queryInterface.removeConstraint('Subscriptions', 'fk_subscription_plan_type_tier');

    // Step 2: Remove index
    await queryInterface.removeIndex('Subscriptions', 'idx_subscription_plan_type');

    // Step 3: Add temporary column with ENUM type
    await queryInterface.addColumn('Subscriptions', 'planTypeEnum', {
      type: Sequelize.ENUM('free', 'basic', 'pro', 'premium'),
      allowNull: true
    });

    // Step 4: Copy data back (only valid ENUM values)
    await queryInterface.sequelize.query(`
      UPDATE Subscriptions
      SET planTypeEnum = CASE
        WHEN planType IN ('free', 'basic', 'pro', 'premium') THEN planType
        ELSE 'free'
      END
    `);

    // Step 5: Remove the STRING column
    await queryInterface.removeColumn('Subscriptions', 'planType');

    // Step 6: Rename ENUM column back
    await queryInterface.renameColumn('Subscriptions', 'planTypeEnum', 'planType');

    // Step 7: Make NOT NULL and set default
    await queryInterface.changeColumn('Subscriptions', 'planType', {
      type: Sequelize.ENUM('free', 'basic', 'pro', 'premium'),
      allowNull: false,
      defaultValue: 'free',
      comment: 'Subscription tier: free (1.0x), basic (1.10x), pro (1.20x), premium (1.30x)'
    });

    // Step 8: Re-add original index
    await queryInterface.addIndex('Subscriptions', ['planType'], {
      name: 'idx_subscription_plan'
    });
  }
};
