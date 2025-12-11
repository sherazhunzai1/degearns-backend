const express = require('express');
const router = express.Router();
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus,
  getFollowCounts
} = require('../controllers/followController');

/**
 * @route   POST /api/v1/follow
 * @desc    Follow a user
 * @access  Public
 */
router.post('/', followUser);

/**
 * @route   DELETE /api/v1/follow
 * @desc    Unfollow a user
 * @access  Public
 */
router.delete('/', unfollowUser);

/**
 * @route   GET /api/v1/follow/status
 * @desc    Check if user A follows user B
 * @access  Public
 */
router.get('/status', checkFollowStatus);

/**
 * @route   GET /api/v1/follow/followers/:walletAddress
 * @desc    Get followers of a user
 * @access  Public
 */
router.get('/followers/:walletAddress', getFollowers);

/**
 * @route   GET /api/v1/follow/following/:walletAddress
 * @desc    Get users that a user is following
 * @access  Public
 */
router.get('/following/:walletAddress', getFollowing);

/**
 * @route   GET /api/v1/follow/counts/:walletAddress
 * @desc    Get follow counts (followers and following) for a user
 * @access  Public
 */
router.get('/counts/:walletAddress', getFollowCounts);

module.exports = router;
