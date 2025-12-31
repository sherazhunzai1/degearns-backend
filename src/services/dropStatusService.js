/**
 * Drop Status Service
 *
 * Handles automatic status synchronization for drops based on dates:
 * - Scheduled drops become 'active' when startDate arrives
 * - Active drops become 'ended' when endDate passes
 * - Active drops become 'sold_out' when fully minted
 */

const logger = require('../utils/logger');

class DropStatusService {
  constructor() {
    this.Drop = null;
  }

  /**
   * Initialize with models (called after models are loaded)
   */
  init(models) {
    this.Drop = models.Drop;
  }

  /**
   * Sync status for a single drop
   * @param {Object} drop - Drop instance
   * @returns {Object} - { changed: boolean, oldStatus: string, newStatus: string }
   */
  async syncDropStatus(drop) {
    if (!drop) return { changed: false };

    const oldStatus = drop.status;
    const changed = await drop.syncStatusWithDates();

    if (changed) {
      logger.info(`Drop ${drop.id} status changed: ${oldStatus} -> ${drop.status}`);
    }

    return {
      changed,
      oldStatus,
      newStatus: drop.status
    };
  }

  /**
   * Sync status for all drops that need updating
   * Called periodically by cron job or on-demand
   * @returns {Object} - { updatedCount: number, details: Array }
   */
  async syncAllDropStatuses() {
    if (!this.Drop) {
      logger.error('DropStatusService not initialized');
      return { updatedCount: 0, details: [] };
    }

    try {
      const updatedCount = await this.Drop.syncAllDropStatuses();
      logger.info(`Drop status sync completed: ${updatedCount} drops updated`);
      return { updatedCount };
    } catch (error) {
      logger.error('Error syncing drop statuses:', error);
      throw error;
    }
  }

  /**
   * Sync status before returning drop data
   * Used in controllers to ensure fresh status
   * @param {Object|Array} drops - Single drop or array of drops
   * @returns {Object|Array} - Same drops with synced status
   */
  async syncBeforeReturn(drops) {
    if (!drops) return drops;

    const isArray = Array.isArray(drops);
    const dropList = isArray ? drops : [drops];

    for (const drop of dropList) {
      if (drop && typeof drop.syncStatusWithDates === 'function') {
        await drop.syncStatusWithDates();
      }
    }

    return drops;
  }

  /**
   * Get computed live status for a drop without modifying it
   * Used for display purposes
   * @param {Object} drop - Drop instance
   * @returns {string} - 'live', 'coming_soon', 'ended', 'paused', 'sold_out', 'draft'
   */
  getComputedStatus(drop) {
    if (!drop) return 'unknown';

    const now = new Date();
    const startDate = drop.startDate ? new Date(drop.startDate) : null;
    const endDate = drop.endDate ? new Date(drop.endDate) : null;

    // Check if sold out
    if (drop.mintedCount >= drop.totalSupply && drop.totalSupply > 0) {
      return 'sold_out';
    }

    // Check if ended
    if (endDate && endDate < now) {
      return 'ended';
    }

    // Check if draft
    if (drop.status === 'draft') {
      return 'draft';
    }

    // Check if paused
    if (drop.status === 'paused') {
      return 'paused';
    }

    // Check if coming soon (scheduled but not started)
    if (startDate && startDate > now) {
      return 'coming_soon';
    }

    // Check if live
    const isPaid = drop.platformFeesStatus === 'paid' || drop.paymentStatus === 'paid';
    const hasStarted = !startDate || startDate <= now;
    const hasNotEnded = !endDate || endDate >= now;

    if ((drop.status === 'active' || drop.status === 'scheduled') && isPaid && hasStarted && hasNotEnded) {
      return 'live';
    }

    // Default to the stored status
    return drop.status;
  }

  /**
   * Add computed fields to drop data for API response
   * @param {Object} drop - Drop instance or plain object
   * @returns {Object} - Drop data with computed fields
   */
  addComputedFields(drop) {
    if (!drop) return drop;

    const dropData = drop.toJSON ? drop.toJSON() : drop;
    const now = new Date();
    const startDate = dropData.startDate ? new Date(dropData.startDate) : null;
    const endDate = dropData.endDate ? new Date(dropData.endDate) : null;

    return {
      ...dropData,
      computedStatus: this.getComputedStatus(drop),
      isLive: this.getComputedStatus(drop) === 'live',
      hasStarted: !startDate || startDate <= now,
      hasEnded: endDate && endDate < now,
      isSoldOut: dropData.mintedCount >= dropData.totalSupply && dropData.totalSupply > 0,
      remainingSupply: Math.max(0, dropData.totalSupply - dropData.mintedCount),
      daysUntilStart: startDate && startDate > now
        ? Math.ceil((startDate - now) / (1000 * 60 * 60 * 24))
        : null,
      daysUntilEnd: endDate && endDate > now
        ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
        : null
    };
  }
}

// Export singleton instance
const dropStatusService = new DropStatusService();
module.exports = dropStatusService;
