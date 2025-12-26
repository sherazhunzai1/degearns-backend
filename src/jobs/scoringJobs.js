/**
 * Scoring Cron Jobs
 *
 * Handles scheduled tasks for the scoring engine:
 * - Hourly score recalculation
 * - Daily full stats rebuild
 * - Subscription expiry checks
 */

const cron = require('node-cron');
const scoringConfig = require('../config/scoring');
const ScoringEngine = require('../services/scoringEngine');
const logger = require('../utils/logger');

class ScoringJobs {
  constructor(models) {
    this.models = models;
    this.scoringEngine = new ScoringEngine(models);
    this.jobs = [];
    this.isRunning = {
      recalculate: false,
      fullRebuild: false,
      checkSubscriptions: false
    };
  }

  /**
   * Initialize and start all scoring jobs
   */
  start() {
    logger.info('Starting scoring cron jobs...');

    // Hourly score recalculation
    const recalculateJob = cron.schedule(
      scoringConfig.cronSchedules.recalculateScores,
      () => this.runRecalculateScores(),
      { scheduled: true }
    );
    this.jobs.push(recalculateJob);

    // Daily full rebuild
    const fullRebuildJob = cron.schedule(
      scoringConfig.cronSchedules.fullRebuild,
      () => this.runFullRebuild(),
      { scheduled: true }
    );
    this.jobs.push(fullRebuildJob);

    // Subscription expiry check
    const subscriptionCheckJob = cron.schedule(
      scoringConfig.cronSchedules.checkSubscriptions,
      () => this.runSubscriptionCheck(),
      { scheduled: true }
    );
    this.jobs.push(subscriptionCheckJob);

    logger.info('Scoring cron jobs started successfully');
    logger.info(`- Score recalculation: ${scoringConfig.cronSchedules.recalculateScores}`);
    logger.info(`- Full rebuild: ${scoringConfig.cronSchedules.fullRebuild}`);
    logger.info(`- Subscription check: ${scoringConfig.cronSchedules.checkSubscriptions}`);
  }

  /**
   * Stop all scoring jobs
   */
  stop() {
    logger.info('Stopping scoring cron jobs...');
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logger.info('Scoring cron jobs stopped');
  }

  /**
   * Recalculate scores for all users
   */
  async runRecalculateScores() {
    if (this.isRunning.recalculate) {
      logger.warn('Score recalculation already in progress, skipping...');
      return;
    }

    this.isRunning.recalculate = true;
    logger.info('Starting scheduled score recalculation...');

    try {
      const result = await this.scoringEngine.recalculateAllScores({
        onProgress: (progress) => {
          if (progress.processed % 100 === 0) {
            logger.info(`Score recalculation progress: ${progress.processed}/${progress.total}`);
          }
        }
      });

      logger.info(`Score recalculation completed: ${result.processed} users in ${result.durationMs}ms`);

      // Log any errors
      if (result.errors > 0) {
        logger.warn(`Score recalculation had ${result.errors} errors`);
      }
    } catch (error) {
      logger.error('Score recalculation failed:', error);
    } finally {
      this.isRunning.recalculate = false;
    }
  }

  /**
   * Full rebuild of all user stats
   * This recalculates everything from scratch using activity logs
   */
  async runFullRebuild() {
    if (this.isRunning.fullRebuild) {
      logger.warn('Full rebuild already in progress, skipping...');
      return;
    }

    this.isRunning.fullRebuild = true;
    logger.info('Starting full stats rebuild...');

    try {
      const { User, UserStats } = this.models;

      // Get all users
      const users = await User.findAll({
        where: { isBanned: false },
        attributes: ['walletAddress']
      });

      let processed = 0;
      let errors = 0;

      for (const user of users) {
        try {
          await this.scoringEngine.calculateUserScores(user.walletAddress);
          processed++;

          if (processed % 50 === 0) {
            logger.info(`Full rebuild progress: ${processed}/${users.length}`);
          }
        } catch (error) {
          errors++;
          logger.error(`Error rebuilding stats for ${user.walletAddress}:`, error);
        }
      }

      logger.info(`Full rebuild completed: ${processed} processed, ${errors} errors`);
    } catch (error) {
      logger.error('Full rebuild failed:', error);
    } finally {
      this.isRunning.fullRebuild = false;
    }
  }

  /**
   * Check for expired subscriptions and update boost multipliers
   */
  async runSubscriptionCheck() {
    if (this.isRunning.checkSubscriptions) {
      logger.warn('Subscription check already in progress, skipping...');
      return;
    }

    this.isRunning.checkSubscriptions = true;
    logger.info('Starting subscription expiry check...');

    try {
      const { Subscription, UserStats } = this.models;
      const { Op } = require('sequelize');

      // Find subscriptions that expired since last check
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const expiredSubscriptions = await Subscription.findAll({
        where: {
          isActive: true,
          endDate: {
            [Op.between]: [fifteenMinutesAgo, new Date()]
          }
        }
      });

      if (expiredSubscriptions.length === 0) {
        logger.info('No expired subscriptions found');
        this.isRunning.checkSubscriptions = false;
        return;
      }

      logger.info(`Found ${expiredSubscriptions.length} expired subscriptions`);

      for (const subscription of expiredSubscriptions) {
        try {
          // Mark subscription as inactive
          await subscription.update({ isActive: false });

          // Recalculate user scores with new (free) multiplier
          await this.scoringEngine.calculateUserScores(subscription.userWalletAddress);

          logger.info(`Processed expired subscription for ${subscription.userWalletAddress}`);
        } catch (error) {
          logger.error(`Error processing expired subscription for ${subscription.userWalletAddress}:`, error);
        }
      }

      logger.info('Subscription expiry check completed');
    } catch (error) {
      logger.error('Subscription check failed:', error);
    } finally {
      this.isRunning.checkSubscriptions = false;
    }
  }

  /**
   * Manually trigger score recalculation for a single user
   */
  async recalculateUserScores(walletAddress) {
    logger.info(`Manual score recalculation for ${walletAddress}`);
    return await this.scoringEngine.calculateUserScores(walletAddress);
  }

  /**
   * Get the current status of jobs
   */
  getStatus() {
    return {
      jobs: this.jobs.length,
      running: this.isRunning,
      schedules: scoringConfig.cronSchedules
    };
  }
}

// Singleton instance
let scoringJobsInstance = null;

/**
 * Initialize scoring jobs with models
 */
const initScoringJobs = (models) => {
  if (!scoringJobsInstance) {
    scoringJobsInstance = new ScoringJobs(models);
  }
  return scoringJobsInstance;
};

/**
 * Get the scoring jobs instance
 */
const getScoringJobs = () => {
  return scoringJobsInstance;
};

module.exports = {
  ScoringJobs,
  initScoringJobs,
  getScoringJobs
};
