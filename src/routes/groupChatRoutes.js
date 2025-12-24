const express = require('express');
const router = express.Router();
const {
  createGroup,
  getGroups,
  getGroupDetails,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMember,
  leaveGroup,
  makeAdmin,
  removeAdmin,
  sendMessage,
  getMessages,
  getGroupMembers,
  markMessagesAsRead,
  getUnreadCount,
  getTotalUnreadCount
} = require('../controllers/groupChatController');

/**
 * @route   POST /api/v1/group-chat
 * @desc    Create a new group chat
 * @access  Public
 */
router.post('/', createGroup);

/**
 * @route   GET /api/v1/group-chat/groups/:walletAddress
 * @desc    Get all groups for a user
 * @access  Public
 */
router.get('/groups/:walletAddress', getGroups);

/**
 * @route   GET /api/v1/group-chat/:groupId/details/:walletAddress
 * @desc    Get group details
 * @access  Public
 */
router.get('/:groupId/details/:walletAddress', getGroupDetails);

/**
 * @route   PUT /api/v1/group-chat/:groupId
 * @desc    Update group details (admin only)
 * @access  Public
 */
router.put('/:groupId', updateGroup);

/**
 * @route   DELETE /api/v1/group-chat/:groupId
 * @desc    Delete/deactivate group (creator only)
 * @access  Public
 */
router.delete('/:groupId', deleteGroup);

/**
 * @route   POST /api/v1/group-chat/:groupId/members
 * @desc    Add members to group (admin only)
 * @access  Public
 */
router.post('/:groupId/members', addMembers);

/**
 * @route   DELETE /api/v1/group-chat/:groupId/members
 * @desc    Remove a member from group (admin only)
 * @access  Public
 */
router.delete('/:groupId/members', removeMember);

/**
 * @route   POST /api/v1/group-chat/:groupId/leave
 * @desc    Leave a group
 * @access  Public
 */
router.post('/:groupId/leave', leaveGroup);

/**
 * @route   POST /api/v1/group-chat/:groupId/make-admin
 * @desc    Make a member an admin (admin only)
 * @access  Public
 */
router.post('/:groupId/make-admin', makeAdmin);

/**
 * @route   POST /api/v1/group-chat/:groupId/remove-admin
 * @desc    Remove admin privileges (creator only)
 * @access  Public
 */
router.post('/:groupId/remove-admin', removeAdmin);

/**
 * @route   POST /api/v1/group-chat/:groupId/messages
 * @desc    Send a message in the group
 * @access  Public
 */
router.post('/:groupId/messages', sendMessage);

/**
 * @route   GET /api/v1/group-chat/:groupId/messages/:walletAddress
 * @desc    Get messages in a group (paginated)
 * @access  Public
 */
router.get('/:groupId/messages/:walletAddress', getMessages);

/**
 * @route   GET /api/v1/group-chat/:groupId/members/:walletAddress
 * @desc    Get group members
 * @access  Public
 */
router.get('/:groupId/members/:walletAddress', getGroupMembers);

/**
 * @route   PUT /api/v1/group-chat/:groupId/read
 * @desc    Mark group messages as read
 * @access  Public
 */
router.put('/:groupId/read', markMessagesAsRead);

/**
 * @route   GET /api/v1/group-chat/unread/:walletAddress
 * @desc    Get unread messages count for all groups (detailed)
 * @access  Public
 */
router.get('/unread/:walletAddress', getUnreadCount);

/**
 * @route   GET /api/v1/group-chat/unread-count/:walletAddress
 * @desc    Get total unread messages count only (for notification badge)
 * @access  Public
 */
router.get('/unread-count/:walletAddress', getTotalUnreadCount);

module.exports = router;
