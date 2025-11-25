const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

/**
 * Get user profile by ID
 */
const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .populate('nftsCreated', 'tokenId name image currentPrice isListed')
      .populate('nftsOwned', 'tokenId name image currentPrice isListed')
      .populate('followers', 'username profileImage')
      .populate('following', 'username profileImage');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json(
      new ApiResponse(200, user, 'User profile retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { username, bio, profileImage } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        throw new ApiError(400, 'Username already taken');
      }
      user.username = username;
    }

    if (bio !== undefined) user.bio = bio;
    if (profileImage !== undefined) user.profileImage = profileImage;

    await user.save();

    logger.info(`User profile updated: ${user.username}`);

    res.status(200).json(
      new ApiResponse(200, user, 'Profile updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Follow/Unfollow user
 */
const toggleFollow = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id: targetUserId } = req.params;

    if (userId.toString() === targetUserId) {
      throw new ApiError(400, 'You cannot follow yourself');
    }

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      throw new ApiError(404, 'User not found');
    }

    const currentUser = await User.findById(userId);

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== targetUserId
      );
      targetUser.followers = targetUser.followers.filter(
        id => id.toString() !== userId.toString()
      );
    } else {
      // Follow
      currentUser.following.push(targetUserId);
      targetUser.followers.push(userId);
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json(
      new ApiResponse(200, {
        following: !isFollowing,
        followersCount: targetUser.followers.length
      }, isFollowing ? 'Unfollowed successfully' : 'Followed successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's favorites
 */
const getFavorites = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .populate({
        path: 'favorites',
        populate: {
          path: 'creator owner',
          select: 'username profileImage'
        }
      });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json(
      new ApiResponse(200, user.favorites, 'Favorites retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Add/Remove NFT from favorites
 */
const toggleFavorite = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { nftId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const isFavorited = user.favorites.includes(nftId);

    if (isFavorited) {
      user.favorites = user.favorites.filter(
        id => id.toString() !== nftId
      );
    } else {
      user.favorites.push(nftId);
    }

    await user.save();

    res.status(200).json(
      new ApiResponse(200, {
        favorited: !isFavorited
      }, isFavorited ? 'Removed from favorites' : 'Added to favorites')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Search users
 */
const searchUsers = async (req, res, next) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;

    if (!query) {
      throw new ApiError(400, 'Search query is required');
    }

    const searchQuery = {
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { walletAddress: { $regex: query, $options: 'i' } }
      ]
    };

    const skip = (page - 1) * limit;

    const users = await User.find(searchQuery)
      .select('username profileImage walletAddress bio')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(searchQuery);

    res.status(200).json(
      new ApiResponse(200, {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Users retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  updateProfile,
  toggleFollow,
  getFavorites,
  toggleFavorite,
  searchUsers
};
