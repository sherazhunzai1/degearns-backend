const { Op } = require('sequelize');
const { Banner } = require('../models');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get active banners for homepage
 * Only returns banners that are:
 * - isActive = true
 * - startDate <= now (or no startDate)
 * - endDate >= now (or no endDate)
 */
const getActiveBanners = async (req, res) => {
  const { limit = 10 } = req.query;
  const now = new Date();

  // Build where clause for currently visible banners
  const where = {
    isActive: true,
    [Op.and]: [
      {
        [Op.or]: [
          { startDate: null },
          { startDate: { [Op.lte]: now } }
        ]
      },
      {
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gte]: now } }
        ]
      }
    ]
  };

  const banners = await Banner.findAll({
    where,
    order: [['position', 'ASC']],
    limit: parseInt(limit),
    attributes: ['id', 'title', 'subtitle', 'image', 'link', 'linkText', 'position']
  });

  // Extract IPFS hash from full URL
  const formattedBanners = banners.map(banner => {
    const bannerData = banner.toJSON();
    if (bannerData.image) {
      // Extract hash from URL like https://gateway.pinata.cloud/ipfs/bafybeibm3aepwa2lo64jf5ejmjieucnlnamr4x5vkwhwnmzytanlu3w3mm
      const ipfsMatch = bannerData.image.match(/\/ipfs\/([^/?#]+)/);
      if (ipfsMatch) {
        bannerData.image = ipfsMatch[1];
      }
    }
    return bannerData;
  });

  res.status(200).json(new ApiResponse(200, {
    banners: formattedBanners,
    count: formattedBanners.length
  }, 'Active banners retrieved successfully'));
};

/**
 * Get a single banner by ID (public)
 */
const getBannerById = async (req, res) => {
  const { bannerId } = req.params;
  const now = new Date();

  const banner = await Banner.findOne({
    where: {
      id: bannerId,
      isActive: true,
      [Op.and]: [
        {
          [Op.or]: [
            { startDate: null },
            { startDate: { [Op.lte]: now } }
          ]
        },
        {
          [Op.or]: [
            { endDate: null },
            { endDate: { [Op.gte]: now } }
          ]
        }
      ]
    },
    attributes: ['id', 'title', 'subtitle', 'image', 'link', 'linkText']
  });

  if (!banner) {
    return res.status(404).json({
      success: false,
      message: 'Banner not found or not currently active'
    });
  }

  // Extract IPFS hash from full URL
  const bannerData = banner.toJSON();
  if (bannerData.image) {
    const ipfsMatch = bannerData.image.match(/\/ipfs\/([^/?#]+)/);
    if (ipfsMatch) {
      bannerData.image = ipfsMatch[1];
    }
  }

  res.status(200).json(new ApiResponse(200, { banner: bannerData }, 'Banner retrieved successfully'));
};

module.exports = {
  getActiveBanners,
  getBannerById
};
