const { Op } = require('sequelize');
const { Banner, AdminActivity } = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

// Helper to get admin wallet (fallback for dev mode)
const getAdminWallet = (req) => req.user?.walletAddress || 'dev-admin';

/**
 * Log admin activity
 */
const logActivity = async (adminWallet, action, targetId, targetIdentifier, data = {}) => {
  try {
    await AdminActivity.create({
      adminWalletAddress: adminWallet,
      action: 'other',
      targetType: 'other',
      targetId,
      targetIdentifier: `Banner: ${targetIdentifier}`,
      previousValue: data.previousValue ? JSON.stringify(data.previousValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      reason: data.reason || `Banner ${action}`,
      metadata: { bannerAction: action }
    });
  } catch (error) {
    console.error('Failed to log admin activity:', error);
  }
};

/**
 * Get all banners with filters and pagination
 */
const getBanners = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    isActive,
    sortBy = 'position',
    sortOrder = 'ASC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};

  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { subtitle: { [Op.like]: `%${search}%` } }
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  // Valid sort fields
  const validSortFields = ['createdAt', 'title', 'position', 'isActive', 'startDate', 'endDate'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'position';
  const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const { count, rows: banners } = await Banner.findAndCountAll({
    where,
    order: [[sortField, order]],
    limit: parseInt(limit),
    offset
  });

  // Add visibility status to each banner
  const bannersWithStatus = banners.map(banner => ({
    ...banner.toJSON(),
    isCurrentlyVisible: banner.isCurrentlyVisible()
  }));

  res.status(200).json(new ApiResponse(200, {
    banners: bannersWithStatus,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    }
  }, 'Banners retrieved successfully'));
};

/**
 * Get banner by ID
 */
const getBannerById = async (req, res) => {
  const { bannerId } = req.params;

  const banner = await Banner.findByPk(bannerId);

  if (!banner) {
    throw new ApiError(404, 'Banner not found');
  }

  res.status(200).json(new ApiResponse(200, {
    banner: {
      ...banner.toJSON(),
      isCurrentlyVisible: banner.isCurrentlyVisible()
    }
  }, 'Banner retrieved successfully'));
};

/**
 * Create a new banner
 */
const createBanner = async (req, res) => {
  const {
    title,
    subtitle,
    image,
    link,
    linkText,
    position,
    isActive = true,
    startDate,
    endDate
  } = req.body;

  // Validate required fields
  if (!title) {
    throw new ApiError(400, 'Title is required');
  }

  if (!image) {
    throw new ApiError(400, 'Image URL is required');
  }

  // If no position provided, set to max + 1
  let bannerPosition = position;
  if (bannerPosition === undefined || bannerPosition === null) {
    const maxPosition = await Banner.max('position') || 0;
    bannerPosition = maxPosition + 1;
  }

  const banner = await Banner.create({
    title,
    subtitle,
    image,
    link,
    linkText,
    position: bannerPosition,
    isActive,
    startDate: startDate || null,
    endDate: endDate || null,
    createdBy: getAdminWallet(req)
  });

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'create',
    banner.id,
    title,
    { newValue: banner.toJSON() }
  );

  res.status(201).json(new ApiResponse(201, {
    banner: {
      ...banner.toJSON(),
      isCurrentlyVisible: banner.isCurrentlyVisible()
    }
  }, 'Banner created successfully'));
};

/**
 * Update a banner
 */
const updateBanner = async (req, res) => {
  const { bannerId } = req.params;
  const {
    title,
    subtitle,
    image,
    link,
    linkText,
    position,
    isActive,
    startDate,
    endDate
  } = req.body;

  const banner = await Banner.findByPk(bannerId);

  if (!banner) {
    throw new ApiError(404, 'Banner not found');
  }

  const previousData = banner.toJSON();

  const updateData = {
    updatedBy: getAdminWallet(req)
  };

  if (title !== undefined) updateData.title = title;
  if (subtitle !== undefined) updateData.subtitle = subtitle;
  if (image !== undefined) updateData.image = image;
  if (link !== undefined) updateData.link = link;
  if (linkText !== undefined) updateData.linkText = linkText;
  if (position !== undefined) updateData.position = position;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (startDate !== undefined) updateData.startDate = startDate || null;
  if (endDate !== undefined) updateData.endDate = endDate || null;

  await banner.update(updateData);

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'update',
    banner.id,
    banner.title,
    {
      previousValue: previousData,
      newValue: updateData
    }
  );

  res.status(200).json(new ApiResponse(200, {
    banner: {
      ...banner.toJSON(),
      isCurrentlyVisible: banner.isCurrentlyVisible()
    }
  }, 'Banner updated successfully'));
};

/**
 * Toggle banner active status
 */
const toggleBannerStatus = async (req, res) => {
  const { bannerId } = req.params;

  const banner = await Banner.findByPk(bannerId);

  if (!banner) {
    throw new ApiError(404, 'Banner not found');
  }

  const wasActive = banner.isActive;

  await banner.update({
    isActive: !wasActive,
    updatedBy: getAdminWallet(req)
  });

  // Log activity
  await logActivity(
    getAdminWallet(req),
    wasActive ? 'deactivate' : 'activate',
    banner.id,
    banner.title,
    {
      previousValue: { isActive: wasActive },
      newValue: { isActive: !wasActive }
    }
  );

  res.status(200).json(new ApiResponse(200, {
    banner: {
      ...banner.toJSON(),
      isCurrentlyVisible: banner.isCurrentlyVisible()
    }
  }, `Banner ${!wasActive ? 'activated' : 'deactivated'} successfully`));
};

/**
 * Delete a banner
 */
const deleteBanner = async (req, res) => {
  const { bannerId } = req.params;

  const banner = await Banner.findByPk(bannerId);

  if (!banner) {
    throw new ApiError(404, 'Banner not found');
  }

  const bannerData = banner.toJSON();

  // Log activity before deletion
  await logActivity(
    getAdminWallet(req),
    'delete',
    banner.id,
    banner.title,
    { previousValue: bannerData }
  );

  // Delete the banner
  await banner.destroy();

  res.status(200).json(new ApiResponse(200, null, 'Banner deleted successfully'));
};

/**
 * Reorder banners
 */
const reorderBanners = async (req, res) => {
  const { bannerOrders } = req.body;

  if (!Array.isArray(bannerOrders) || bannerOrders.length === 0) {
    throw new ApiError(400, 'bannerOrders must be a non-empty array of { id, position }');
  }

  // Update positions
  const updates = await Promise.all(
    bannerOrders.map(async ({ id, position }) => {
      const banner = await Banner.findByPk(id);
      if (banner) {
        await banner.update({ position, updatedBy: getAdminWallet(req) });
        return { id, position, success: true };
      }
      return { id, position, success: false };
    })
  );

  // Log activity
  await logActivity(
    getAdminWallet(req),
    'reorder',
    null,
    `${updates.filter(u => u.success).length} banners`,
    { newValue: bannerOrders }
  );

  res.status(200).json(new ApiResponse(200, {
    updates
  }, 'Banners reordered successfully'));
};

/**
 * Get banner statistics
 */
const getBannerStatistics = async (req, res) => {
  const now = new Date();

  const [
    totalBanners,
    activeBanners,
    inactiveBanners,
    scheduledBanners,
    expiredBanners
  ] = await Promise.all([
    Banner.count(),
    Banner.count({ where: { isActive: true } }),
    Banner.count({ where: { isActive: false } }),
    Banner.count({
      where: {
        isActive: true,
        startDate: { [Op.gt]: now }
      }
    }),
    Banner.count({
      where: {
        isActive: true,
        endDate: { [Op.lt]: now }
      }
    })
  ]);

  // Get currently visible banners count
  const allActiveBanners = await Banner.findAll({ where: { isActive: true } });
  const currentlyVisibleCount = allActiveBanners.filter(b => b.isCurrentlyVisible()).length;

  res.status(200).json(new ApiResponse(200, {
    totalBanners,
    activeBanners,
    inactiveBanners,
    scheduledBanners,
    expiredBanners,
    currentlyVisibleCount
  }, 'Banner statistics retrieved successfully'));
};

module.exports = {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  deleteBanner,
  reorderBanners,
  getBannerStatistics
};
