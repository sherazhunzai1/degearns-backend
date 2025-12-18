const { Op } = require('sequelize');
const { Collection, User, Drop, AdminActivity, sequelize } = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

// Helper to get admin wallet (fallback for dev mode)
const getAdminWallet = (req) => req.user?.walletAddress || 'dev-admin';

/**
 * Log admin activity
 */
const logActivity = async (adminWallet, action, targetType, targetId, targetIdentifier, data = {}) => {
  try {
    await AdminActivity.create({
      adminWalletAddress: adminWallet,
      action,
      targetType,
      targetId,
      targetIdentifier,
      previousValue: data.previousValue ? JSON.stringify(data.previousValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      reason: data.reason || null,
      metadata: data.metadata || null
    });
  } catch (error) {
    console.error('Failed to log admin activity:', error);
  }
};

/**
 * Get all collections with filters and pagination
 */
const getCollections = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    isVerified,
    creatorWallet,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { slug: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { creatorWalletAddress: { [Op.like]: `%${search}%` } }
    ];
  }

  if (category) {
    where.category = category;
  }

  if (isVerified !== undefined) {
    where.isVerified = isVerified === 'true';
  }

  if (creatorWallet) {
    where.creatorWalletAddress = creatorWallet;
  }

  // Valid sort fields
  const validSortFields = ['createdAt', 'name', 'category', 'totalSupply', 'floorPrice', 'totalVolume', 'isVerified'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows: collections } = await Collection.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }
    ],
    order: [[sortField, order]],
    limit: parseInt(limit),
    offset
  });

  // Add drop count for each collection
  const collectionsWithStats = await Promise.all(collections.map(async (collection) => {
    const dropCount = await Drop.count({ where: { collectionId: collection.id } });
    return {
      ...collection.toJSON(),
      dropCount
    };
  }));

  res.status(200).json(new ApiResponse(200, {
    collections: collectionsWithStats,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Collections retrieved successfully'));
};

/**
 * Get collection by ID with full details
 */
const getCollectionById = async (req, res) => {
  const { collectionId } = req.params;

  const collection = await Collection.findByPk(collectionId, {
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }
    ]
  });

  if (!collection) {
    throw new ApiError(404, 'Collection not found');
  }

  // Get drops associated with this collection
  const drops = await Drop.findAll({
    where: { collectionId: collection.id },
    attributes: ['id', 'name', 'status', 'totalSupply', 'mintedCount', 'createdAt'],
    order: [['createdAt', 'DESC']]
  });

  res.status(200).json(new ApiResponse(200, {
    collection: collection.toJSON(),
    drops
  }, 'Collection details retrieved successfully'));
};

/**
 * Verify/Unverify collection
 */
const updateCollectionVerification = async (req, res) => {
  const { collectionId } = req.params;
  const { isVerified, reason } = req.body;

  const collection = await Collection.findByPk(collectionId);

  if (!collection) {
    throw new ApiError(404, 'Collection not found');
  }

  const wasVerified = collection.isVerified;

  await collection.update({ isVerified });

  // Log activity
  await logActivity(
    getAdminWallet(req),
    isVerified ? 'collection_verify' : 'collection_unverify',
    'collection',
    collection.id,
    collection.name,
    {
      previousValue: { isVerified: wasVerified },
      newValue: { isVerified },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    collection: collection.toJSON()
  }, isVerified ? 'Collection verified successfully' : 'Collection unverified successfully'));
};

/**
 * Update collection details (admin override)
 */
const updateCollection = async (req, res) => {
  const { collectionId } = req.params;
  const {
    name,
    description,
    image,
    bannerImage,
    category,
    royaltyPercentage,
    socialLinks,
    reason
  } = req.body;

  const collection = await Collection.findByPk(collectionId);

  if (!collection) {
    throw new ApiError(404, 'Collection not found');
  }

  const previousData = collection.toJSON();

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (image !== undefined) updateData.image = image;
  if (bannerImage !== undefined) updateData.bannerImage = bannerImage;
  if (category !== undefined) updateData.category = category;
  if (royaltyPercentage !== undefined) updateData.royaltyPercentage = royaltyPercentage;
  if (socialLinks !== undefined) updateData.socialLinks = socialLinks;

  // Update slug if name changed
  if (name && name !== collection.name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existingSlug = await Collection.findOne({
      where: { slug, id: { [Op.ne]: collectionId } }
    });
    if (!existingSlug) {
      updateData.slug = slug;
    } else {
      updateData.slug = `${slug}-${Date.now()}`;
    }
  }

  await collection.update(updateData);

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'collection_update',
    'collection',
    collection.id,
    collection.name,
    {
      previousValue: previousData,
      newValue: updateData,
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    collection: collection.toJSON()
  }, 'Collection updated successfully'));
};

/**
 * Delete collection (admin override)
 */
const deleteCollection = async (req, res) => {
  const { collectionId } = req.params;
  const { reason } = req.body;

  const collection = await Collection.findByPk(collectionId);

  if (!collection) {
    throw new ApiError(404, 'Collection not found');
  }

  // Check if collection has drops
  const dropCount = await Drop.count({ where: { collectionId } });

  if (dropCount > 0) {
    throw new ApiError(400, `Cannot delete collection with ${dropCount} associated drops. Remove or reassign drops first.`);
  }

  // Log activity before deletion
  await logActivity(
    getAdminWallet(req),
    'collection_delete',
    'collection',
    collection.id,
    collection.name,
    {
      previousValue: collection.toJSON(),
      reason
    }
  );

  // Delete the collection
  await collection.destroy();

  res.status(200).json(new ApiResponse(200, null, 'Collection deleted successfully'));
};

/**
 * Get collection statistics overview
 */
const getCollectionStatistics = async (req, res) => {
  const [
    totalCollections,
    verifiedCollections,
    unverifiedCollections,
    collectionsToday,
    collectionsThisWeek,
    collectionsThisMonth
  ] = await Promise.all([
    Collection.count(),
    Collection.count({ where: { isVerified: true } }),
    Collection.count({ where: { isVerified: false } }),
    Collection.count({
      where: {
        createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    }),
    Collection.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    }),
    Collection.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  // Get category breakdown
  const categoryBreakdown = await Collection.findAll({
    attributes: [
      'category',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['category']
  });

  // Calculate total volume
  const totalVolume = await Collection.sum('totalVolume') || '0';

  res.status(200).json(new ApiResponse(200, {
    totalCollections,
    verifiedCollections,
    unverifiedCollections,
    totalVolume,
    totalVolumeXrp: (parseFloat(totalVolume) / 1000000).toFixed(6),
    categoryBreakdown: categoryBreakdown.reduce((acc, item) => {
      acc[item.category] = parseInt(item.get('count'));
      return acc;
    }, {}),
    newCollections: {
      today: collectionsToday,
      thisWeek: collectionsThisWeek,
      thisMonth: collectionsThisMonth
    }
  }, 'Collection statistics retrieved successfully'));
};

/**
 * Bulk verify collections
 */
const bulkVerifyCollections = async (req, res) => {
  const { collectionIds, isVerified, reason } = req.body;

  if (!Array.isArray(collectionIds) || collectionIds.length === 0) {
    throw new ApiError(400, 'collectionIds must be a non-empty array');
  }

  const result = await Collection.update(
    { isVerified },
    { where: { id: collectionIds } }
  );

  // Log activity
  await logActivity(
    getAdminWallet(req),
    isVerified ? 'collection_verify' : 'collection_unverify',
    'collection',
    null,
    `Bulk: ${collectionIds.length} collections`,
    {
      newValue: { isVerified, collectionIds },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    updatedCount: result[0]
  }, `${result[0]} collections updated successfully`));
};

/**
 * Get collections pending verification (unverified collections)
 */
const getPendingVerificationCollections = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: collections } = await Collection.findAndCountAll({
    where: { isVerified: false },
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['walletAddress', 'username', 'profileImage', 'isVerified']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.status(200).json(new ApiResponse(200, {
    collections,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Pending verification collections retrieved successfully'));
};

module.exports = {
  getCollections,
  getCollectionById,
  updateCollectionVerification,
  updateCollection,
  deleteCollection,
  getCollectionStatistics,
  bulkVerifyCollections,
  getPendingVerificationCollections
};
