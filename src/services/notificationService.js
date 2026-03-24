const logger = require('../utils/logger');
const {
  getActiveSubscriptionsForWallets
} = require('../utils/userHelpers');

/**
 * Notification Service
 * Handles creation and management of notifications
 */
class NotificationService {
  constructor() {
    this.Notification = null;
    this.User = null;
    this.Follow = null;
  }

  /**
   * Initialize models (called after models are loaded)
   */
  init(models) {
    this.Notification = models.Notification;
    this.User = models.User;
    this.Follow = models.Follow;
  }

  /**
   * Create a notification for post like
   * @param {Object} params - Parameters for the notification
   * @param {string} params.postId - ID of the liked post
   * @param {string} params.postAuthorWalletAddress - Wallet address of the post author
   * @param {string} params.likerWalletAddress - Wallet address of the user who liked
   * @param {string} params.likerUsername - Username of the user who liked
   * @param {string} params.postPreview - Preview of the post content
   * @param {string} params.postType - Type of the post (text, image, video, mixed)
   * @param {Array} params.postMedia - Media attachments of the post
   */
  async createLikeNotification({ postId, postAuthorWalletAddress, likerWalletAddress, likerUsername, postPreview, postType, postMedia }) {
    try {
      // Don't create notification if user likes their own post
      if (postAuthorWalletAddress === likerWalletAddress) {
        return null;
      }

      // Get first media item for preview
      const firstMedia = postMedia && postMedia.length > 0 ? postMedia[0] : null;

      const notification = await this.Notification.create({
        recipientWalletAddress: postAuthorWalletAddress,
        senderWalletAddress: likerWalletAddress,
        type: 'like',
        title: 'New Like',
        message: `${likerUsername || likerWalletAddress.slice(0, 8) + '...'} liked your post`,
        relatedEntityId: postId,
        relatedEntityType: 'post',
        metadata: {
          postId: postId,
          postPreview: postPreview ? postPreview.substring(0, 100) : null,
          postType: postType || 'text',
          postImage: firstMedia ? (firstMedia.thumbnailUrl || firstMedia.mediaUrl) : null,
          postAuthorWalletAddress: postAuthorWalletAddress,
          likerUsername: likerUsername
        }
      });

      logger.info(`Like notification created for ${postAuthorWalletAddress} from ${likerWalletAddress}`);
      return notification;
    } catch (error) {
      logger.error('Error creating like notification:', error);
      return null;
    }
  }

  /**
   * Create a notification for post comment
   * @param {Object} params - Parameters for the notification
   * @param {string} params.postId - ID of the commented post
   * @param {string} params.commentId - ID of the new comment
   * @param {string} params.postAuthorWalletAddress - Wallet address of the post author
   * @param {string} params.commenterWalletAddress - Wallet address of the commenter
   * @param {string} params.commenterUsername - Username of the commenter
   * @param {string} params.commentPreview - Preview of the comment content
   * @param {string} params.postPreview - Preview of the post content
   * @param {string} params.postType - Type of the post (text, image, video, mixed)
   * @param {Array} params.postMedia - Media attachments of the post
   */
  async createCommentNotification({ postId, commentId, postAuthorWalletAddress, commenterWalletAddress, commenterUsername, commentPreview, postPreview, postType, postMedia }) {
    try {
      // Don't create notification if user comments on their own post
      if (postAuthorWalletAddress === commenterWalletAddress) {
        return null;
      }

      // Get first media item for preview
      const firstMedia = postMedia && postMedia.length > 0 ? postMedia[0] : null;

      const notification = await this.Notification.create({
        recipientWalletAddress: postAuthorWalletAddress,
        senderWalletAddress: commenterWalletAddress,
        type: 'comment',
        title: 'New Comment',
        message: `${commenterUsername || commenterWalletAddress.slice(0, 8) + '...'} commented on your post`,
        relatedEntityId: postId,
        relatedEntityType: 'post',
        metadata: {
          postId: postId,
          commentId: commentId,
          commentPreview: commentPreview ? commentPreview.substring(0, 100) : null,
          postPreview: postPreview ? postPreview.substring(0, 100) : null,
          postType: postType || 'text',
          postImage: firstMedia ? (firstMedia.thumbnailUrl || firstMedia.mediaUrl) : null,
          postAuthorWalletAddress: postAuthorWalletAddress,
          commenterUsername: commenterUsername
        }
      });

      logger.info(`Comment notification created for ${postAuthorWalletAddress} from ${commenterWalletAddress}`);
      return notification;
    } catch (error) {
      logger.error('Error creating comment notification:', error);
      return null;
    }
  }

  /**
   * Create a notification for comment reply
   * @param {Object} params - Parameters for the notification
   * @param {string} params.postId - ID of the post
   * @param {string} params.commentId - ID of the reply comment
   * @param {string} params.parentCommentId - ID of the parent comment
   * @param {string} params.parentCommentAuthorWalletAddress - Wallet address of the parent comment author
   * @param {string} params.replierWalletAddress - Wallet address of the replier
   * @param {string} params.replierUsername - Username of the replier
   * @param {string} params.replyPreview - Preview of the reply content
   * @param {string} params.postType - Type of the post (text, image, video, mixed)
   * @param {Array} params.postMedia - Media attachments of the post
   */
  async createCommentReplyNotification({ postId, commentId, parentCommentId, parentCommentAuthorWalletAddress, replierWalletAddress, replierUsername, replyPreview, postType, postMedia }) {
    try {
      // Don't create notification if user replies to their own comment
      if (parentCommentAuthorWalletAddress === replierWalletAddress) {
        return null;
      }

      // Get first media item for preview
      const firstMedia = postMedia && postMedia.length > 0 ? postMedia[0] : null;

      const notification = await this.Notification.create({
        recipientWalletAddress: parentCommentAuthorWalletAddress,
        senderWalletAddress: replierWalletAddress,
        type: 'comment_reply',
        title: 'New Reply',
        message: `${replierUsername || replierWalletAddress.slice(0, 8) + '...'} replied to your comment`,
        relatedEntityId: postId,
        relatedEntityType: 'comment',
        metadata: {
          postId: postId,
          commentId: commentId,
          parentCommentId: parentCommentId,
          replyPreview: replyPreview ? replyPreview.substring(0, 100) : null,
          postType: postType || 'text',
          postImage: firstMedia ? (firstMedia.thumbnailUrl || firstMedia.mediaUrl) : null,
          replierUsername: replierUsername
        }
      });

      logger.info(`Comment reply notification created for ${parentCommentAuthorWalletAddress} from ${replierWalletAddress}`);
      return notification;
    } catch (error) {
      logger.error('Error creating comment reply notification:', error);
      return null;
    }
  }

  /**
   * Create a notification for new follower
   * @param {Object} params - Parameters for the notification
   * @param {string} params.followId - ID of the follow relationship
   * @param {string} params.followedWalletAddress - Wallet address of the user being followed
   * @param {string} params.followerWalletAddress - Wallet address of the follower
   * @param {string} params.followerUsername - Username of the follower
   */
  async createFollowNotification({ followId, followedWalletAddress, followerWalletAddress, followerUsername }) {
    try {
      const notification = await this.Notification.create({
        recipientWalletAddress: followedWalletAddress,
        senderWalletAddress: followerWalletAddress,
        type: 'follow',
        title: 'New Follower',
        message: `${followerUsername || followerWalletAddress.slice(0, 8) + '...'} started following you`,
        relatedEntityId: followId,
        relatedEntityType: 'follow',
        metadata: {
          followerUsername: followerUsername
        }
      });

      logger.info(`Follow notification created for ${followedWalletAddress} from ${followerWalletAddress}`);
      return notification;
    } catch (error) {
      logger.error('Error creating follow notification:', error);
      return null;
    }
  }

  /**
   * Create notifications for NFT listing to all followers
   * @param {Object} params - Parameters for the notification
   * @param {string} params.collectionId - ID of the collection (can be null for XRPL-only)
   * @param {string} params.sellerWalletAddress - Wallet address of the seller (also the current owner)
   * @param {string} params.sellerUsername - Username of the seller
   * @param {string} params.nftName - Name of the NFT
   * @param {string} params.nftImage - Image URL of the NFT
   * @param {string} params.nftTokenId - NFT token ID on XRPL
   * @param {string} params.price - Listing price
   * @param {string} params.collectionName - Name of the collection
   * @param {string} params.nftDescription - Description of the NFT
   */
  async createNFTListingNotifications({ collectionId, sellerWalletAddress, sellerUsername, nftName, nftImage, nftTokenId, price, collectionName, nftDescription }) {
    try {
      // Get all followers of the seller
      const followers = await this.Follow.findAll({
        where: { followingWalletAddress: sellerWalletAddress },
        attributes: ['followerWalletAddress']
      });

      if (followers.length === 0) {
        logger.info(`No followers to notify for NFT listing by ${sellerWalletAddress}`);
        return [];
      }

      // Create notifications for all followers
      const notifications = await Promise.all(
        followers.map(async (follow) => {
          try {
            return await this.Notification.create({
              recipientWalletAddress: follow.followerWalletAddress,
              senderWalletAddress: sellerWalletAddress,
              type: 'nft_listing',
              title: 'New NFT Listed',
              message: `${sellerUsername || sellerWalletAddress.slice(0, 8) + '...'} listed ${nftName || 'an NFT'} for sale`,
              relatedEntityId: collectionId,
              relatedEntityType: 'nft',
              metadata: {
                nftTokenId: nftTokenId,
                nftName: nftName,
                nftDescription: nftDescription ? nftDescription.substring(0, 200) : null,
                nftImage: nftImage,
                ownerWalletAddress: sellerWalletAddress,
                price: price,
                collectionId: collectionId,
                collectionName: collectionName,
                sellerUsername: sellerUsername
              }
            });
          } catch (err) {
            logger.error(`Error creating NFT listing notification for ${follow.followerWalletAddress}:`, err);
            return null;
          }
        })
      );

      const successfulNotifications = notifications.filter(n => n !== null);
      logger.info(`Created ${successfulNotifications.length} NFT listing notifications for ${sellerWalletAddress}`);
      return successfulNotifications;
    } catch (error) {
      logger.error('Error creating NFT listing notifications:', error);
      return [];
    }
  }

  /**
   * Create a notification for NFT purchase (notifies the seller)
   * @param {Object} params - Parameters for the notification
   * @param {string} params.sellerWalletAddress - Wallet address of the seller (receives notification)
   * @param {string} params.buyerWalletAddress - Wallet address of the buyer
   * @param {string} params.buyerUsername - Username of the buyer
   * @param {string} params.nftTokenId - NFT token ID on XRPL
   * @param {string} params.nftName - Name of the NFT
   * @param {string} params.nftDescription - Description of the NFT
   * @param {string} params.nftImage - Image URL of the NFT
   * @param {string} params.price - Sale price in drops
   * @param {string} params.collectionId - Collection ID in database
   * @param {string} params.collectionName - Name of the collection
   * @param {string} params.transactionHash - Transaction hash on XRPL
   */
  async createNFTPurchaseNotification({ sellerWalletAddress, buyerWalletAddress, buyerUsername, nftTokenId, nftName, nftDescription, nftImage, price, collectionId, collectionName, transactionHash }) {
    try {
      // Don't create notification if buyer and seller are same (shouldn't happen but safety check)
      if (sellerWalletAddress === buyerWalletAddress) {
        return null;
      }

      const notification = await this.Notification.create({
        recipientWalletAddress: sellerWalletAddress,
        senderWalletAddress: buyerWalletAddress,
        type: 'nft_purchase',
        title: 'NFT Sold',
        message: `${buyerUsername || buyerWalletAddress.slice(0, 8) + '...'} purchased your ${nftName || 'NFT'}`,
        relatedEntityId: collectionId,
        relatedEntityType: 'nft',
        metadata: {
          nftTokenId: nftTokenId,
          nftName: nftName,
          nftDescription: nftDescription ? nftDescription.substring(0, 200) : null,
          nftImage: nftImage,
          price: price,
          collectionId: collectionId,
          collectionName: collectionName,
          buyerWalletAddress: buyerWalletAddress,
          buyerUsername: buyerUsername,
          transactionHash: transactionHash
        }
      });

      logger.info(`NFT purchase notification created for seller ${sellerWalletAddress} from buyer ${buyerWalletAddress}`);
      return notification;
    } catch (error) {
      logger.error('Error creating NFT purchase notification:', error);
      return null;
    }
  }

  /**
   * Create notifications for drop launch to all followers of the creator
   * @param {Object} params - Parameters for the notification
   * @param {string} params.dropId - ID of the drop
   * @param {string} params.creatorWalletAddress - Wallet address of the drop creator
   * @param {string} params.creatorUsername - Username of the creator
   * @param {string} params.dropName - Name of the drop
   * @param {string} params.dropImage - Image URL of the drop
   * @param {string} params.collectionName - Name of the collection
   * @param {string} params.pricePerNft - Price per NFT
   * @param {number} params.totalSupply - Total NFTs in the drop
   * @param {Date} params.startDate - Start date of the drop
   */
  async createDropLaunchNotifications({ dropId, creatorWalletAddress, creatorUsername, dropName, dropImage, collectionName, pricePerNft, totalSupply, startDate }) {
    try {
      // Get all followers of the creator
      const followers = await this.Follow.findAll({
        where: { followingWalletAddress: creatorWalletAddress },
        attributes: ['followerWalletAddress']
      });

      if (followers.length === 0) {
        logger.info(`No followers to notify for drop launch by ${creatorWalletAddress}`);
        return [];
      }

      // Create notifications for all followers
      const notifications = await Promise.all(
        followers.map(async (follow) => {
          try {
            return await this.Notification.create({
              recipientWalletAddress: follow.followerWalletAddress,
              senderWalletAddress: creatorWalletAddress,
              type: 'drop_launch',
              title: 'New Drop Launched',
              message: `${creatorUsername || creatorWalletAddress.slice(0, 8) + '...'} launched a new drop: ${dropName}`,
              relatedEntityId: dropId,
              relatedEntityType: 'drop',
              metadata: {
                dropId: dropId,
                dropName: dropName,
                dropImage: dropImage,
                collectionName: collectionName,
                pricePerNft: pricePerNft,
                totalSupply: totalSupply,
                startDate: startDate,
                creatorUsername: creatorUsername
              }
            });
          } catch (err) {
            logger.error(`Error creating drop launch notification for ${follow.followerWalletAddress}:`, err);
            return null;
          }
        })
      );

      const successfulNotifications = notifications.filter(n => n !== null);
      logger.info(`Created ${successfulNotifications.length} drop launch notifications for ${creatorWalletAddress}`);
      return successfulNotifications;
    } catch (error) {
      logger.error('Error creating drop launch notifications:', error);
      return [];
    }
  }

  /**
   * Create a notification for successful mint (notifies the creator)
   * @param {Object} params - Parameters for the notification
   * @param {string} params.dropId - ID of the drop
   * @param {string} params.creatorWalletAddress - Wallet address of the drop creator (receives notification)
   * @param {string} params.minterWalletAddress - Wallet address of the minter
   * @param {string} params.minterUsername - Username of the minter
   * @param {string} params.dropName - Name of the drop
   * @param {string} params.nftTokenId - NFT Token ID
   * @param {string} params.mintPrice - Price paid for the mint
   * @param {number} params.mintIndex - The mint number/index
   * @param {number} params.totalMinted - Total minted so far
   * @param {number} params.totalSupply - Total supply of the drop
   */
  async createDropMintNotification({ dropId, creatorWalletAddress, minterWalletAddress, minterUsername, dropName, nftTokenId, mintPrice, mintIndex, totalMinted, totalSupply }) {
    try {
      // Don't create notification if creator mints from their own drop
      if (creatorWalletAddress === minterWalletAddress) {
        return null;
      }

      const notification = await this.Notification.create({
        recipientWalletAddress: creatorWalletAddress,
        senderWalletAddress: minterWalletAddress,
        type: 'drop_mint',
        title: 'NFT Minted from Drop',
        message: `${minterUsername || minterWalletAddress.slice(0, 8) + '...'} minted NFT #${mintIndex} from ${dropName}`,
        relatedEntityId: dropId,
        relatedEntityType: 'drop',
        metadata: {
          dropId: dropId,
          dropName: dropName,
          nftTokenId: nftTokenId,
          mintPrice: mintPrice,
          mintIndex: mintIndex,
          totalMinted: totalMinted,
          totalSupply: totalSupply,
          minterUsername: minterUsername,
          minterWalletAddress: minterWalletAddress
        }
      });

      logger.info(`Drop mint notification created for creator ${creatorWalletAddress} from minter ${minterWalletAddress}`);
      return notification;
    } catch (error) {
      logger.error('Error creating drop mint notification:', error);
      return null;
    }
  }

  /**
   * Create a notification when wallet is added to allowlist
   * @param {Object} params - Parameters for the notification
   * @param {string} params.dropId - ID of the drop
   * @param {string} params.walletAddress - Wallet address being added to allowlist
   * @param {string} params.creatorWalletAddress - Wallet address of the drop creator
   * @param {string} params.creatorUsername - Username of the creator
   * @param {string} params.dropName - Name of the drop
   * @param {string} params.dropImage - Image URL of the drop
   * @param {number} params.mintLimit - Mint limit for this wallet
   */
  async createAllowlistNotification({ dropId, walletAddress, creatorWalletAddress, creatorUsername, dropName, dropImage, mintLimit }) {
    try {
      // Don't create notification if creator adds themselves
      if (creatorWalletAddress === walletAddress) {
        return null;
      }

      const notification = await this.Notification.create({
        recipientWalletAddress: walletAddress,
        senderWalletAddress: creatorWalletAddress,
        type: 'drop_allowlist',
        title: 'Added to Drop Allowlist',
        message: `You've been added to the allowlist for ${dropName}`,
        relatedEntityId: dropId,
        relatedEntityType: 'drop',
        metadata: {
          dropId: dropId,
          dropName: dropName,
          dropImage: dropImage,
          mintLimit: mintLimit,
          creatorUsername: creatorUsername
        }
      });

      logger.info(`Allowlist notification created for ${walletAddress} for drop ${dropId}`);
      return notification;
    } catch (error) {
      logger.error('Error creating allowlist notification:', error);
      return null;
    }
  }

  // ==================== SUBSCRIPTION NOTIFICATIONS ====================

  /**
   * Create a notification when user subscribes to a plan
   * @param {Object} params - Parameters for the notification
   * @param {string} params.subscriptionId - ID of the subscription
   * @param {string} params.walletAddress - Wallet address of the subscriber
   * @param {string} params.planType - Type of plan subscribed to (basic, pro, premium)
   * @param {string} params.planDisplayName - Display name of the plan
   * @param {number} params.boostPercentage - Boost percentage of the plan
   * @param {string} params.billingCycle - Billing cycle (monthly, yearly)
   * @param {Date} params.endDate - Subscription end date
   */
  async createSubscriptionCreatedNotification({ subscriptionId, walletAddress, planType, planDisplayName, boostPercentage, billingCycle, endDate }) {
    try {
      const notification = await this.Notification.create({
        recipientWalletAddress: walletAddress,
        senderWalletAddress: walletAddress, // System notification, sender is self
        type: 'subscription_created',
        title: 'Subscription Activated',
        message: `Welcome to ${planDisplayName}! You now have a ${boostPercentage}% score boost.`,
        relatedEntityId: subscriptionId,
        relatedEntityType: 'subscription',
        metadata: {
          subscriptionId,
          planType,
          planDisplayName,
          boostPercentage,
          billingCycle,
          endDate: endDate ? endDate.toISOString() : null
        }
      });

      logger.info(`Subscription created notification sent to ${walletAddress} for ${planType} plan`);
      return notification;
    } catch (error) {
      logger.error('Error creating subscription created notification:', error);
      return null;
    }
  }

  /**
   * Create a notification when user upgrades their subscription
   * @param {Object} params - Parameters for the notification
   * @param {string} params.subscriptionId - ID of the new subscription
   * @param {string} params.walletAddress - Wallet address of the subscriber
   * @param {string} params.previousPlan - Previous plan type
   * @param {string} params.newPlan - New plan type
   * @param {string} params.newPlanDisplayName - Display name of the new plan
   * @param {number} params.previousBoost - Previous boost percentage
   * @param {number} params.newBoost - New boost percentage
   * @param {Date} params.endDate - Subscription end date
   */
  async createSubscriptionUpgradedNotification({ subscriptionId, walletAddress, previousPlan, newPlan, newPlanDisplayName, previousBoost, newBoost, endDate }) {
    try {
      const boostIncrease = newBoost - previousBoost;

      const notification = await this.Notification.create({
        recipientWalletAddress: walletAddress,
        senderWalletAddress: walletAddress,
        type: 'subscription_upgraded',
        title: 'Subscription Upgraded',
        message: `Congratulations! You've upgraded to ${newPlanDisplayName}. Your score boost increased by ${boostIncrease}%.`,
        relatedEntityId: subscriptionId,
        relatedEntityType: 'subscription',
        metadata: {
          subscriptionId,
          previousPlan,
          newPlan,
          newPlanDisplayName,
          previousBoost,
          newBoost,
          boostIncrease,
          endDate: endDate ? endDate.toISOString() : null
        }
      });

      logger.info(`Subscription upgraded notification sent to ${walletAddress}: ${previousPlan} -> ${newPlan}`);
      return notification;
    } catch (error) {
      logger.error('Error creating subscription upgraded notification:', error);
      return null;
    }
  }

  /**
   * Create a notification when user cancels their subscription
   * @param {Object} params - Parameters for the notification
   * @param {string} params.subscriptionId - ID of the cancelled subscription
   * @param {string} params.walletAddress - Wallet address of the subscriber
   * @param {string} params.planType - Type of plan that was cancelled
   * @param {string} params.planDisplayName - Display name of the plan
   * @param {Date} params.accessUntil - Date until which access is retained
   */
  async createSubscriptionCancelledNotification({ subscriptionId, walletAddress, planType, planDisplayName, accessUntil }) {
    try {
      const formattedDate = accessUntil ? new Date(accessUntil).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'the end of your billing period';

      const notification = await this.Notification.create({
        recipientWalletAddress: walletAddress,
        senderWalletAddress: walletAddress,
        type: 'subscription_cancelled',
        title: 'Subscription Cancelled',
        message: `Your ${planDisplayName} subscription has been cancelled. You'll retain access until ${formattedDate}.`,
        relatedEntityId: subscriptionId,
        relatedEntityType: 'subscription',
        metadata: {
          subscriptionId,
          planType,
          planDisplayName,
          accessUntil: accessUntil ? accessUntil.toISOString() : null
        }
      });

      logger.info(`Subscription cancelled notification sent to ${walletAddress} for ${planType} plan`);
      return notification;
    } catch (error) {
      logger.error('Error creating subscription cancelled notification:', error);
      return null;
    }
  }

  /**
   * Create a notification when subscription is about to expire (for cron job use)
   * @param {Object} params - Parameters for the notification
   * @param {string} params.subscriptionId - ID of the subscription
   * @param {string} params.walletAddress - Wallet address of the subscriber
   * @param {string} params.planType - Type of plan
   * @param {string} params.planDisplayName - Display name of the plan
   * @param {number} params.daysRemaining - Days until expiration
   * @param {Date} params.endDate - Subscription end date
   */
  async createSubscriptionExpiringNotification({ subscriptionId, walletAddress, planType, planDisplayName, daysRemaining, endDate }) {
    try {
      const notification = await this.Notification.create({
        recipientWalletAddress: walletAddress,
        senderWalletAddress: walletAddress,
        type: 'subscription_expiring',
        title: 'Subscription Expiring Soon',
        message: `Your ${planDisplayName} subscription expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Renew now to keep your benefits!`,
        relatedEntityId: subscriptionId,
        relatedEntityType: 'subscription',
        metadata: {
          subscriptionId,
          planType,
          planDisplayName,
          daysRemaining,
          endDate: endDate ? endDate.toISOString() : null
        }
      });

      logger.info(`Subscription expiring notification sent to ${walletAddress} - ${daysRemaining} days remaining`);
      return notification;
    } catch (error) {
      logger.error('Error creating subscription expiring notification:', error);
      return null;
    }
  }

  /**
   * Create a notification when subscription has expired (for cron job use)
   * @param {Object} params - Parameters for the notification
   * @param {string} params.subscriptionId - ID of the expired subscription
   * @param {string} params.walletAddress - Wallet address of the subscriber
   * @param {string} params.planType - Type of plan that expired
   * @param {string} params.planDisplayName - Display name of the plan
   */
  async createSubscriptionExpiredNotification({ subscriptionId, walletAddress, planType, planDisplayName }) {
    try {
      const notification = await this.Notification.create({
        recipientWalletAddress: walletAddress,
        senderWalletAddress: walletAddress,
        type: 'subscription_expired',
        title: 'Subscription Expired',
        message: `Your ${planDisplayName} subscription has expired. Subscribe again to restore your benefits!`,
        relatedEntityId: subscriptionId,
        relatedEntityType: 'subscription',
        metadata: {
          subscriptionId,
          planType,
          planDisplayName,
          expiredAt: new Date().toISOString()
        }
      });

      logger.info(`Subscription expired notification sent to ${walletAddress} for ${planType} plan`);
      return notification;
    } catch (error) {
      logger.error('Error creating subscription expired notification:', error);
      return null;
    }
  }

  // ==================== REFERRAL NOTIFICATIONS ====================

  /**
   * Create a notification for referrer when a new user signs up with their referral code
   * @param {Object} params - Parameters for the notification
   * @param {string} params.referrerWalletAddress - Wallet address of the referrer (receives notification)
   * @param {string} params.newUserWalletAddress - Wallet address of the new user who signed up
   * @param {string} params.newUserUsername - Username of the new user
   */
  async createReferralSignupNotification({ referrerWalletAddress, newUserWalletAddress, newUserUsername }) {
    try {
      const notification = await this.Notification.create({
        recipientWalletAddress: referrerWalletAddress,
        senderWalletAddress: newUserWalletAddress,
        type: 'referral_signup',
        title: 'New Referral Signup',
        message: `${newUserUsername || newUserWalletAddress.slice(0, 8) + '...'} signed up using your referral code`,
        relatedEntityType: 'referral',
        metadata: {
          newUserWalletAddress,
          newUserUsername
        }
      });

      logger.info(`Referral signup notification created for ${referrerWalletAddress} from ${newUserWalletAddress}`);
      return notification;
    } catch (error) {
      logger.error('Error creating referral signup notification:', error);
      return null;
    }
  }

  // ==================== NOTIFICATION RETRIEVAL & MANAGEMENT ====================

  /**
   * Get notifications for a user
   * @param {string} walletAddress - Wallet address of the user
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Number of items per page
   * @param {boolean} options.unreadOnly - Only return unread notifications
   * @param {string} options.type - Filter by notification type
   */
  async getUserNotifications(walletAddress, { page = 1, limit = 20, unreadOnly = false, type = null } = {}) {
    try {
      const whereClause = {
        recipientWalletAddress: walletAddress
      };

      if (unreadOnly) {
        whereClause.isRead = false;
      }

      if (type) {
        whereClause.type = type;
      }

      const offset = (page - 1) * limit;

      const { count, rows: notifications } = await this.Notification.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      // Get sender info for all notifications
      const senderAddresses = [...new Set(notifications.map(n => n.senderWalletAddress).filter(Boolean))];

      const [senders, subscriptionMap] = await Promise.all([
        this.User.findAll({
          where: { walletAddress: senderAddresses },
          attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
        }),
        getActiveSubscriptionsForWallets(senderAddresses)
      ]);

      // Create sender map with subscription plans
      const senderMap = {};
      senders.forEach(sender => {
        senderMap[sender.walletAddress] = {
          walletAddress: sender.walletAddress,
          username: sender.username,
          profileImage: sender.profileImage,
          isVerified: sender.isVerified,
          subscriptionPlan: subscriptionMap[sender.walletAddress] || 'free'
        };
      });

      // Format notifications with sender info
      const formattedNotifications = notifications.map(notification => {
        const sender = senderMap[notification.senderWalletAddress];
        return {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          sender: sender ? sender : (notification.senderWalletAddress ? {
            walletAddress: notification.senderWalletAddress,
            username: null,
            profileImage: null,
            isVerified: false,
            subscriptionPlan: subscriptionMap[notification.senderWalletAddress] || 'free'
          } : null),
          relatedEntityId: notification.relatedEntityId,
          relatedEntityType: notification.relatedEntityType,
          metadata: notification.metadata,
          isRead: notification.isRead,
          readAt: notification.readAt,
          createdAt: notification.createdAt
        };
      });

      return {
        notifications: formattedNotifications,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   * @param {string} walletAddress - Wallet address of the user
   */
  async getUnreadCount(walletAddress) {
    try {
      const count = await this.Notification.count({
        where: {
          recipientWalletAddress: walletAddress,
          isRead: false
        }
      });
      return count;
    } catch (error) {
      logger.error('Error getting unread notification count:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   * @param {string} notificationId - ID of the notification
   * @param {string} walletAddress - Wallet address of the user (for verification)
   */
  async markAsRead(notificationId, walletAddress) {
    try {
      const notification = await this.Notification.findOne({
        where: {
          id: notificationId,
          recipientWalletAddress: walletAddress
        }
      });

      if (!notification) {
        return null;
      }

      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} walletAddress - Wallet address of the user
   */
  async markAllAsRead(walletAddress) {
    try {
      const [updatedCount] = await this.Notification.update(
        {
          isRead: true,
          readAt: new Date()
        },
        {
          where: {
            recipientWalletAddress: walletAddress,
            isRead: false
          }
        }
      );

      logger.info(`Marked ${updatedCount} notifications as read for ${walletAddress}`);
      return updatedCount;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - ID of the notification
   * @param {string} walletAddress - Wallet address of the user (for verification)
   */
  async deleteNotification(notificationId, walletAddress) {
    try {
      const notification = await this.Notification.findOne({
        where: {
          id: notificationId,
          recipientWalletAddress: walletAddress
        }
      });

      if (!notification) {
        return false;
      }

      await notification.destroy();
      logger.info(`Notification ${notificationId} deleted for ${walletAddress}`);
      return true;
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   * @param {string} walletAddress - Wallet address of the user
   */
  async deleteAllNotifications(walletAddress) {
    try {
      const deletedCount = await this.Notification.destroy({
        where: {
          recipientWalletAddress: walletAddress
        }
      });

      logger.info(`Deleted ${deletedCount} notifications for ${walletAddress}`);
      return deletedCount;
    } catch (error) {
      logger.error('Error deleting all notifications:', error);
      throw error;
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;
