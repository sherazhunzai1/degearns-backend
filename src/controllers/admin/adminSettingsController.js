const { Op } = require('sequelize');
const { PlatformSettings, AdminActivity } = require('../../models');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

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

// Default platform settings
const DEFAULT_SETTINGS = [
  // Fee settings
  {
    key: 'platform_fee_per_nft',
    value: '30000',
    type: 'number',
    category: 'fees',
    label: 'Platform Fee Per NFT (drops)',
    description: 'Platform fee charged per NFT mint in drops (0.03 XRP = 30000 drops)',
    isPublic: true,
    isEditable: true
  },
  {
    key: 'setup_fee',
    value: '3000000',
    type: 'number',
    category: 'fees',
    label: 'Setup Fee (drops)',
    description: 'One-time setup fee for launching a drop in drops (3 XRP = 3000000 drops)',
    isPublic: true,
    isEditable: true
  },
  {
    key: 'marketplace_fee_percentage',
    value: '2.5',
    type: 'number',
    category: 'fees',
    label: 'Marketplace Fee Percentage',
    description: 'Percentage fee on secondary sales',
    isPublic: true,
    isEditable: true
  },
  // Marketplace settings
  {
    key: 'min_listing_price',
    value: '1000000',
    type: 'number',
    category: 'marketplace',
    label: 'Minimum Listing Price (drops)',
    description: 'Minimum price for NFT listings in drops (1 XRP = 1000000 drops)',
    isPublic: true,
    isEditable: true
  },
  {
    key: 'max_royalty_percentage',
    value: '50',
    type: 'number',
    category: 'marketplace',
    label: 'Maximum Royalty Percentage',
    description: 'Maximum royalty percentage creators can set',
    isPublic: true,
    isEditable: true
  },
  // Drop settings
  {
    key: 'max_nfts_per_drop',
    value: '10000',
    type: 'number',
    category: 'drops',
    label: 'Maximum NFTs Per Drop',
    description: 'Maximum number of NFTs allowed in a single drop',
    isPublic: true,
    isEditable: true
  },
  {
    key: 'max_mint_per_wallet',
    value: '100',
    type: 'number',
    category: 'drops',
    label: 'Default Max Mint Per Wallet',
    description: 'Default maximum mints per wallet if not specified by creator',
    isPublic: true,
    isEditable: true
  },
  // Social settings
  {
    key: 'max_post_length',
    value: '5000',
    type: 'number',
    category: 'social',
    label: 'Maximum Post Length',
    description: 'Maximum character length for posts',
    isPublic: true,
    isEditable: true
  },
  {
    key: 'max_comment_length',
    value: '1000',
    type: 'number',
    category: 'social',
    label: 'Maximum Comment Length',
    description: 'Maximum character length for comments',
    isPublic: true,
    isEditable: true
  },
  {
    key: 'max_media_per_post',
    value: '10',
    type: 'number',
    category: 'social',
    label: 'Maximum Media Per Post',
    description: 'Maximum number of media files per post',
    isPublic: true,
    isEditable: true
  },
  // General settings
  {
    key: 'maintenance_mode',
    value: 'false',
    type: 'boolean',
    category: 'general',
    label: 'Maintenance Mode',
    description: 'Enable maintenance mode to restrict access',
    isPublic: true,
    isEditable: true
  },
  {
    key: 'registration_enabled',
    value: 'true',
    type: 'boolean',
    category: 'general',
    label: 'Registration Enabled',
    description: 'Allow new user registrations',
    isPublic: true,
    isEditable: true
  },
  {
    key: 'minting_enabled',
    value: 'true',
    type: 'boolean',
    category: 'general',
    label: 'Minting Enabled',
    description: 'Enable NFT minting platform-wide',
    isPublic: true,
    isEditable: true
  },
  // Notification settings
  {
    key: 'email_notifications_enabled',
    value: 'false',
    type: 'boolean',
    category: 'notifications',
    label: 'Email Notifications Enabled',
    description: 'Enable email notifications',
    isPublic: false,
    isEditable: true
  }
];

/**
 * Initialize default settings
 */
const initializeSettings = async (req, res) => {
  const createdSettings = [];
  const existingSettings = [];

  for (const setting of DEFAULT_SETTINGS) {
    const [instance, created] = await PlatformSettings.findOrCreate({
      where: { key: setting.key },
      defaults: {
        ...setting,
        lastUpdatedBy: req.user.walletAddress
      }
    });

    if (created) {
      createdSettings.push(instance.key);
    } else {
      existingSettings.push(instance.key);
    }
  }

  res.status(200).json(new ApiResponse(200, {
    created: createdSettings,
    existing: existingSettings,
    total: DEFAULT_SETTINGS.length
  }, 'Settings initialized successfully'));
};

/**
 * Get all settings
 */
const getAllSettings = async (req, res) => {
  const { category, isPublic } = req.query;

  const where = {};

  if (category) {
    where.category = category;
  }

  if (isPublic !== undefined) {
    where.isPublic = isPublic === 'true';
  }

  const settings = await PlatformSettings.findAll({
    where,
    order: [['category', 'ASC'], ['key', 'ASC']]
  });

  // Group by category
  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push({
      ...setting.toJSON(),
      parsedValue: setting.getParsedValue()
    });
    return acc;
  }, {});

  res.status(200).json(new ApiResponse(200, {
    settings: groupedSettings,
    total: settings.length
  }, 'Settings retrieved successfully'));
};

/**
 * Get public settings only (for frontend)
 */
const getPublicSettings = async (req, res) => {
  const settings = await PlatformSettings.findAll({
    where: { isPublic: true },
    attributes: ['key', 'value', 'type', 'category', 'label']
  });

  // Convert to key-value object
  const settingsObject = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.getParsedValue();
    return acc;
  }, {});

  res.status(200).json(new ApiResponse(200, settingsObject, 'Public settings retrieved successfully'));
};

/**
 * Get setting by key
 */
const getSettingByKey = async (req, res) => {
  const { key } = req.params;

  const setting = await PlatformSettings.findOne({ where: { key } });

  if (!setting) {
    throw new ApiError(404, 'Setting not found');
  }

  res.status(200).json(new ApiResponse(200, {
    ...setting.toJSON(),
    parsedValue: setting.getParsedValue()
  }, 'Setting retrieved successfully'));
};

/**
 * Update setting
 */
const updateSetting = async (req, res) => {
  const { key } = req.params;
  const { value, label, description, isPublic, reason } = req.body;

  const setting = await PlatformSettings.findOne({ where: { key } });

  if (!setting) {
    throw new ApiError(404, 'Setting not found');
  }

  if (!setting.isEditable) {
    throw new ApiError(400, 'This setting cannot be edited');
  }

  const previousValue = setting.toJSON();

  const updateData = {
    lastUpdatedBy: req.user.walletAddress
  };

  if (value !== undefined) {
    // Validate value based on type
    if (setting.type === 'number' && isNaN(parseFloat(value))) {
      throw new ApiError(400, 'Value must be a valid number');
    }
    if (setting.type === 'boolean' && !['true', 'false', '1', '0'].includes(String(value).toLowerCase())) {
      throw new ApiError(400, 'Value must be a valid boolean');
    }
    if (setting.type === 'json') {
      try {
        JSON.parse(value);
      } catch (e) {
        throw new ApiError(400, 'Value must be valid JSON');
      }
    }
    updateData.value = String(value);
  }

  if (label !== undefined) updateData.label = label;
  if (description !== undefined) updateData.description = description;
  if (isPublic !== undefined) updateData.isPublic = isPublic;

  await setting.update(updateData);

  // Log activity
  await logActivity(
    req.user.walletAddress,
    'setting_update',
    'setting',
    setting.id,
    setting.key,
    {
      previousValue: { value: previousValue.value },
      newValue: { value: updateData.value },
      reason
    }
  );

  res.status(200).json(new ApiResponse(200, {
    ...setting.toJSON(),
    parsedValue: setting.getParsedValue()
  }, 'Setting updated successfully'));
};

/**
 * Create custom setting
 */
const createSetting = async (req, res) => {
  const { key, value, type = 'string', category = 'general', label, description, isPublic = false } = req.body;

  if (!key) {
    throw new ApiError(400, 'Setting key is required');
  }

  // Check if setting already exists
  const existingSetting = await PlatformSettings.findOne({ where: { key } });
  if (existingSetting) {
    throw new ApiError(400, 'Setting with this key already exists');
  }

  // Validate type
  const validTypes = ['string', 'number', 'boolean', 'json'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate category
  const validCategories = ['fees', 'marketplace', 'drops', 'social', 'notifications', 'general'];
  if (!validCategories.includes(category)) {
    throw new ApiError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  const setting = await PlatformSettings.create({
    key,
    value: String(value || ''),
    type,
    category,
    label,
    description,
    isPublic,
    isEditable: true,
    lastUpdatedBy: req.user.walletAddress
  });

  // Log activity
  await logActivity(
    req.user.walletAddress,
    'setting_update',
    'setting',
    setting.id,
    setting.key,
    {
      newValue: setting.toJSON()
    }
  );

  res.status(201).json(new ApiResponse(201, {
    ...setting.toJSON(),
    parsedValue: setting.getParsedValue()
  }, 'Setting created successfully'));
};

/**
 * Delete setting
 */
const deleteSetting = async (req, res) => {
  const { key } = req.params;
  const { reason } = req.body;

  const setting = await PlatformSettings.findOne({ where: { key } });

  if (!setting) {
    throw new ApiError(404, 'Setting not found');
  }

  // Prevent deleting default settings
  const isDefaultSetting = DEFAULT_SETTINGS.some(s => s.key === key);
  if (isDefaultSetting) {
    throw new ApiError(400, 'Cannot delete default platform settings');
  }

  // Log activity before deletion
  await logActivity(
    req.user.walletAddress,
    'setting_update',
    'setting',
    setting.id,
    setting.key,
    {
      previousValue: setting.toJSON(),
      reason
    }
  );

  await setting.destroy();

  res.status(200).json(new ApiResponse(200, null, 'Setting deleted successfully'));
};

/**
 * Bulk update settings
 */
const bulkUpdateSettings = async (req, res) => {
  const { settings, reason } = req.body;

  if (!Array.isArray(settings) || settings.length === 0) {
    throw new ApiError(400, 'Settings must be a non-empty array');
  }

  const results = {
    updated: [],
    failed: []
  };

  for (const { key, value } of settings) {
    try {
      const setting = await PlatformSettings.findOne({ where: { key } });

      if (!setting) {
        results.failed.push({ key, error: 'Setting not found' });
        continue;
      }

      if (!setting.isEditable) {
        results.failed.push({ key, error: 'Setting is not editable' });
        continue;
      }

      const previousValue = setting.value;

      await setting.update({
        value: String(value),
        lastUpdatedBy: req.user.walletAddress
      });

      results.updated.push({ key, previousValue, newValue: String(value) });
    } catch (error) {
      results.failed.push({ key, error: error.message });
    }
  }

  // Log activity
  if (results.updated.length > 0) {
    await logActivity(
      req.user.walletAddress,
      'setting_update',
      'setting',
      null,
      `Bulk: ${results.updated.length} settings`,
      {
        previousValue: results.updated.map(u => ({ key: u.key, value: u.previousValue })),
        newValue: results.updated.map(u => ({ key: u.key, value: u.newValue })),
        reason
      }
    );
  }

  res.status(200).json(new ApiResponse(200, results, `${results.updated.length} settings updated successfully`));
};

/**
 * Reset setting to default value
 */
const resetSettingToDefault = async (req, res) => {
  const { key } = req.params;
  const { reason } = req.body;

  const defaultSetting = DEFAULT_SETTINGS.find(s => s.key === key);

  if (!defaultSetting) {
    throw new ApiError(400, 'This setting does not have a default value');
  }

  const setting = await PlatformSettings.findOne({ where: { key } });

  if (!setting) {
    throw new ApiError(404, 'Setting not found');
  }

  const previousValue = setting.value;

  await setting.update({
    value: defaultSetting.value,
    lastUpdatedBy: req.user.walletAddress
  });

  // Log activity
  await logActivity(
    req.user.walletAddress,
    'setting_update',
    'setting',
    setting.id,
    setting.key,
    {
      previousValue: { value: previousValue },
      newValue: { value: defaultSetting.value },
      reason: reason || 'Reset to default'
    }
  );

  res.status(200).json(new ApiResponse(200, {
    ...setting.toJSON(),
    parsedValue: setting.getParsedValue()
  }, 'Setting reset to default successfully'));
};

module.exports = {
  initializeSettings,
  getAllSettings,
  getPublicSettings,
  getSettingByKey,
  updateSetting,
  createSetting,
  deleteSetting,
  bulkUpdateSettings,
  resetSettingToDefault,
  DEFAULT_SETTINGS
};
