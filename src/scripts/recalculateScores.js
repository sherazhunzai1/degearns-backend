#!/usr/bin/env node
/**
 * Manual Score Recalculation Script
 *
 * Usage:
 *   npm run scores:recalculate           - Recalculate all users for current month
 *   npm run scores:recalculate -- --user rWalletAddress  - Recalculate single user
 *   npm run scores:recalculate -- --rebuild              - Full rebuild from activity logs
 *   npm run scores:recalculate -- --month 12 --year 2025 - Recalculate for specific month
 */

require('dotenv').config();
const db = require('../models');
const ScoringEngine = require('../services/scoringEngine');
const logger = require('../utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return null;
  return args[index + 1] || true;
};

const options = {
  user: getArg('user'),
  rebuild: args.includes('--rebuild'),
  month: getArg('month') ? parseInt(getArg('month')) : null,
  year: getArg('year') ? parseInt(getArg('year')) : null
};

async function main() {
  console.log('\n========================================');
  console.log('  Score Recalculation Script');
  console.log('========================================\n');

  try {
    // Connect to database
    console.log('Connecting to database...');
    await db.sequelize.authenticate();
    console.log('Database connected successfully.\n');

    const scoringEngine = new ScoringEngine(db);

    if (options.user) {
      // Single user recalculation
      console.log(`Recalculating scores for user: ${options.user}`);
      console.log('---');

      const result = await scoringEngine.calculateUserScores(options.user, {
        month: options.month,
        year: options.year
      });

      console.log('\nResults:');
      console.log(`  Period: ${result.period.month}/${result.period.year}`);
      console.log(`  Trader Score: ${result.scores.trader.toFixed(2)} (boosted: ${result.scores.boostedTrader.toFixed(2)})`);
      console.log(`  Creator Score: ${result.scores.creator.toFixed(2)} (boosted: ${result.scores.boostedCreator.toFixed(2)})`);
      console.log(`  Influencer Score: ${result.scores.influencer.toFixed(2)} (boosted: ${result.scores.boostedInfluencer.toFixed(2)})`);
      console.log(`  Boost Multiplier: ${result.boostMultiplier}x`);

    } else if (options.rebuild) {
      // Full rebuild
      console.log('Starting FULL REBUILD of all user scores...');
      console.log('This will recalculate scores from scratch using activity logs.\n');

      const { User } = db;
      const users = await User.findAll({
        where: { isBanned: false },
        attributes: ['walletAddress']
      });

      console.log(`Found ${users.length} users to process.\n`);

      let processed = 0;
      let errors = 0;
      const startTime = Date.now();

      for (const user of users) {
        try {
          await scoringEngine.calculateUserScores(user.walletAddress, {
            month: options.month,
            year: options.year
          });
          processed++;

          if (processed % 10 === 0 || processed === users.length) {
            const percent = ((processed / users.length) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${processed}/${users.length} (${percent}%)`);
          }
        } catch (error) {
          errors++;
          logger.error(`Error rebuilding ${user.walletAddress}:`, error);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n\nFull rebuild completed!`);
      console.log(`  Processed: ${processed} users`);
      console.log(`  Errors: ${errors}`);
      console.log(`  Duration: ${duration}s`);

    } else {
      // Recalculate all users
      console.log('Recalculating scores for ALL users...\n');

      const result = await scoringEngine.recalculateAllScores({
        month: options.month,
        year: options.year,
        onProgress: (progress) => {
          if (progress.processed % 10 === 0 || progress.processed === progress.total) {
            const percent = ((progress.processed / progress.total) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${progress.processed}/${progress.total} (${percent}%)`);
          }
        }
      });

      console.log(`\n\nRecalculation completed!`);
      console.log(`  Period: ${result.period.month}/${result.period.year}`);
      console.log(`  Processed: ${result.processed} users`);
      console.log(`  Errors: ${result.errors}`);
      console.log(`  Duration: ${(result.durationMs / 1000).toFixed(2)}s`);
    }

    console.log('\n========================================\n');
    process.exit(0);

  } catch (error) {
    console.error('\nError:', error.message);
    logger.error('Script error:', error);
    process.exit(1);
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Score Recalculation Script

Usage:
  npm run scores:recalculate                              Recalculate all users for current month
  npm run scores:recalculate -- --user <wallet>           Recalculate single user
  npm run scores:recalculate -- --rebuild                 Full rebuild from activity logs
  npm run scores:recalculate -- --month <1-12> --year <YYYY>  Recalculate for specific month

Options:
  --user <wallet>   Recalculate scores for a specific user
  --rebuild         Full rebuild of all scores from activity logs
  --month <1-12>    Specify month (default: current month)
  --year <YYYY>     Specify year (default: current year)
  --help, -h        Show this help message

Examples:
  npm run scores:recalculate
  npm run scores:recalculate -- --user rXXXXXXXXXXXXXXXXXXXX
  npm run scores:recalculate -- --rebuild
  npm run scores:recalculate -- --month 12 --year 2025
`);
  process.exit(0);
}

main();
