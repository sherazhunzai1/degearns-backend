const { Drop, DropMint, Collection, User } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class DropController {
  /**
   * Create a new drop
   * POST /api/drops
   */
  async createDrop(req, res, next) {
    try {
      const {
        collectionId,
        name,
        description,
        price,
        totalSupply,
        startDate,
        endDate,
        nftMetadata,
        transferFee,
        flags,
        maxMintsPerWallet
      } = req.body;

      // Validate required fields
      if (!collectionId || !name || !price || !totalSupply || !startDate || !endDate || !nftMetadata) {
        throw new ApiError(400, 'Missing required fields: collectionId, name, price, totalSupply, startDate, endDate, nftMetadata');
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        throw new ApiError(400, 'startDate must be before endDate');
      }

      // Check if collection exists and user is the creator
      const collection = await Collection.findByPk(collectionId);
      if (!collection) {
        throw new ApiError(404, 'Collection not found');
      }

      if (collection.creatorWalletAddress !== req.user.walletAddress) {
        throw new ApiError(403, 'You are not the creator of this collection');
      }

      // Determine initial status based on dates
      const now = new Date();
      let status = 'upcoming';
      if (now >= start && now <= end) {
        status = 'active';
      } else if (now > end) {
        status = 'ended';
      }

      // Create drop
      const drop = await Drop.create({
        collectionId,
        name,
        description,
        price,
        totalSupply,
        startDate: start,
        endDate: end,
        status,
        creatorWalletAddress: req.user.walletAddress,
        nftMetadata,
        transferFee: transferFee || 0,
        flags: flags || 8,
        maxMintsPerWallet
      });

      logger.info(`Drop created: ${drop.id} by ${req.user.walletAddress}`);

      res.status(201).json({
        success: true,
        data: drop
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all drops with filters
   * GET /api/drops
   */
  async getDrops(req, res, next) {
    try {
      const {
        status,
        collectionId,
        creatorWalletAddress,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      if (status) {
        where.status = status;
      }
      if (collectionId) {
        where.collectionId = collectionId;
      }
      if (creatorWalletAddress) {
        where.creatorWalletAddress = creatorWalletAddress;
      }

      const { count, rows: drops } = await Drop.findAndCountAll({
        where,
        include: [
          {
            model: Collection,
            as: 'collection',
            attributes: ['id', 'name', 'slug', 'image', 'taxon']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['walletAddress', 'username', 'profileImage']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[sortBy, sortOrder.toUpperCase()]]
      });

      res.json({
        success: true,
        data: {
          drops,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single drop by ID
   * GET /api/drops/:id
   */
  async getDrop(req, res, next) {
    try {
      const { id } = req.params;

      const drop = await Drop.findByPk(id, {
        include: [
          {
            model: Collection,
            as: 'collection',
            attributes: ['id', 'name', 'slug', 'image', 'bannerImage', 'description', 'taxon', 'category', 'royaltyPercentage']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['walletAddress', 'username', 'profileImage', 'bio']
          },
          {
            model: DropMint,
            as: 'mints',
            limit: 10,
            order: [['createdAt', 'DESC']],
            include: [
              {
                model: User,
                as: 'minter',
                attributes: ['walletAddress', 'username', 'profileImage']
              }
            ]
          }
        ]
      });

      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Update status if needed
      drop.updateStatus();
      if (drop.changed()) {
        await drop.save();
      }

      res.json({
        success: true,
        data: drop
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a drop
   * PUT /api/drops/:id
   */
  async updateDrop(req, res, next) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        price,
        startDate,
        endDate,
        nftMetadata,
        maxMintsPerWallet
      } = req.body;

      const drop = await Drop.findByPk(id);
      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Check ownership
      if (drop.creatorWalletAddress !== req.user.walletAddress) {
        throw new ApiError(403, 'You are not the creator of this drop');
      }

      // Can't update if already ended or sold out
      if (drop.status === 'ended' || drop.status === 'soldout') {
        throw new ApiError(400, 'Cannot update ended or sold out drops');
      }

      // Can't reduce total supply below minted count
      if (req.body.totalSupply && req.body.totalSupply < drop.mintedCount) {
        throw new ApiError(400, 'Cannot reduce total supply below minted count');
      }

      // Validate dates if provided
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
          throw new ApiError(400, 'startDate must be before endDate');
        }
      }

      // Update fields
      const updateData = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price) updateData.price = price;
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);
      if (nftMetadata) updateData.nftMetadata = nftMetadata;
      if (maxMintsPerWallet !== undefined) updateData.maxMintsPerWallet = maxMintsPerWallet;
      if (req.body.totalSupply) updateData.totalSupply = req.body.totalSupply;

      await drop.update(updateData);

      // Update status
      drop.updateStatus();
      if (drop.changed()) {
        await drop.save();
      }

      logger.info(`Drop updated: ${drop.id} by ${req.user.walletAddress}`);

      res.json({
        success: true,
        data: drop
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a drop
   * DELETE /api/drops/:id
   */
  async deleteDrop(req, res, next) {
    try {
      const { id } = req.params;

      const drop = await Drop.findByPk(id);
      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Check ownership
      if (drop.creatorWalletAddress !== req.user.walletAddress) {
        throw new ApiError(403, 'You are not the creator of this drop');
      }

      // Can't delete if any NFTs have been minted
      if (drop.mintedCount > 0) {
        throw new ApiError(400, 'Cannot delete drop with minted NFTs');
      }

      await drop.destroy();

      logger.info(`Drop deleted: ${id} by ${req.user.walletAddress}`);

      res.json({
        success: true,
        message: 'Drop deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record an NFT mint from a drop (after frontend mints on XRPL)
   * POST /api/drops/:id/mint
   */
  async mintFromDrop(req, res, next) {
    try {
      const { id } = req.params;
      const { nftokenId, transactionHash } = req.body;
      const minterWalletAddress = req.user.walletAddress;

      // Validate required fields
      if (!nftokenId || !transactionHash) {
        throw new ApiError(400, 'nftokenId and transactionHash are required');
      }

      // Check if this NFT was already recorded
      const existingMint = await DropMint.findOne({
        where: { nftokenId }
      });

      if (existingMint) {
        throw new ApiError(400, 'This NFT has already been recorded');
      }

      // Get drop with lock to prevent race conditions
      const drop = await Drop.findByPk(id, {
        include: [
          {
            model: Collection,
            as: 'collection',
            attributes: ['id', 'name', 'taxon']
          }
        ],
        lock: true
      });

      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Update and check status
      drop.updateStatus();
      await drop.save();

      // Validate drop is mintable
      if (!drop.isMintable()) {
        throw new ApiError(400, 'Drop is not currently available for minting');
      }

      // Check if sold out
      if (drop.mintedCount >= drop.totalSupply) {
        drop.status = 'soldout';
        await drop.save();
        throw new ApiError(400, 'Drop is sold out');
      }

      // Check max mints per wallet if set
      if (drop.maxMintsPerWallet) {
        const userMintCount = await DropMint.count({
          where: {
            dropId: id,
            minterWalletAddress
          }
        });

        if (userMintCount >= drop.maxMintsPerWallet) {
          throw new ApiError(400, `Maximum ${drop.maxMintsPerWallet} mints per wallet reached`);
        }
      }

      // Calculate mint number
      const mintNumber = drop.mintedCount + 1;

      // Record the mint
      const dropMint = await DropMint.create({
        dropId: id,
        minterWalletAddress,
        nftokenId,
        transactionHash,
        mintNumber
      });

      // Update drop minted count
      await drop.increment('mintedCount');

      // Check if sold out
      if (drop.mintedCount + 1 >= drop.totalSupply) {
        await drop.update({ status: 'soldout' });
      }

      logger.info(`NFT mint recorded for drop ${id}: ${nftokenId} by ${minterWalletAddress} (Mint #${mintNumber})`);

      res.status(201).json({
        success: true,
        data: {
          mint: dropMint,
          mintNumber,
          drop: {
            id: drop.id,
            name: drop.name,
            mintedCount: drop.mintedCount + 1,
            totalSupply: drop.totalSupply,
            status: drop.mintedCount + 1 >= drop.totalSupply ? 'soldout' : drop.status
          }
        },
        message: 'NFT mint recorded successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get drop metadata for minting (for frontend to use when minting on XRPL)
   * GET /api/drops/:id/mint-metadata
   */
  async getMintMetadata(req, res, next) {
    try {
      const { id } = req.params;
      const minterWalletAddress = req.user?.walletAddress;

      const drop = await Drop.findByPk(id, {
        include: [
          {
            model: Collection,
            as: 'collection',
            attributes: ['id', 'name', 'taxon', 'royaltyPercentage']
          }
        ]
      });

      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Update status
      drop.updateStatus();
      await drop.save();

      // Validate drop is mintable
      if (!drop.isMintable()) {
        throw new ApiError(400, 'Drop is not currently available for minting');
      }

      // Check if sold out
      if (drop.mintedCount >= drop.totalSupply) {
        throw new ApiError(400, 'Drop is sold out');
      }

      // Check max mints per wallet if set and user is authenticated
      if (minterWalletAddress && drop.maxMintsPerWallet) {
        const userMintCount = await DropMint.count({
          where: {
            dropId: id,
            minterWalletAddress
          }
        });

        if (userMintCount >= drop.maxMintsPerWallet) {
          throw new ApiError(400, `Maximum ${drop.maxMintsPerWallet} mints per wallet reached`);
        }
      }

      // Calculate next mint number
      const mintNumber = drop.mintedCount + 1;

      // Prepare metadata with mint number
      const metadata = {
        ...drop.nftMetadata,
        name: `${drop.nftMetadata.name} #${mintNumber}`,
        attributes: [
          ...(drop.nftMetadata.attributes || []),
          {
            trait_type: 'Mint Number',
            value: mintNumber
          },
          {
            trait_type: 'Drop',
            value: drop.name
          }
        ]
      };

      res.json({
        success: true,
        data: {
          dropId: drop.id,
          dropName: drop.name,
          mintNumber,
          metadata,
          taxon: drop.collection.taxon,
          transferFee: drop.transferFee,
          flags: drop.flags,
          price: drop.price,
          collectionName: drop.collection.name
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get mints for a drop
   * GET /api/drops/:id/mints
   */
  async getDropMints(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const drop = await Drop.findByPk(id);
      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      const offset = (page - 1) * limit;

      const { count, rows: mints } = await DropMint.findAndCountAll({
        where: { dropId: id },
        include: [
          {
            model: User,
            as: 'minter',
            attributes: ['walletAddress', 'username', 'profileImage']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          mints,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's mints from drops
   * GET /api/drops/my-mints
   */
  async getMyMints(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows: mints } = await DropMint.findAndCountAll({
        where: { minterWalletAddress: req.user.walletAddress },
        include: [
          {
            model: Drop,
            as: 'drop',
            include: [
              {
                model: Collection,
                as: 'collection',
                attributes: ['id', 'name', 'slug', 'image']
              }
            ]
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          mints,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if user can mint from a drop
   * GET /api/drops/:id/can-mint
   */
  async canMint(req, res, next) {
    try {
      const { id } = req.params;
      const walletAddress = req.user?.walletAddress;

      const drop = await Drop.findByPk(id);
      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Update status
      drop.updateStatus();
      await drop.save();

      const canMint = drop.isMintable();
      const reason = [];

      if (!canMint) {
        if (drop.status === 'upcoming') {
          reason.push('Drop has not started yet');
        } else if (drop.status === 'ended') {
          reason.push('Drop has ended');
        } else if (drop.status === 'soldout') {
          reason.push('Drop is sold out');
        }
      }

      // Check user-specific constraints if authenticated
      let userMintCount = 0;
      if (walletAddress && drop.maxMintsPerWallet) {
        userMintCount = await DropMint.count({
          where: {
            dropId: id,
            minterWalletAddress: walletAddress
          }
        });

        if (userMintCount >= drop.maxMintsPerWallet) {
          reason.push(`Maximum ${drop.maxMintsPerWallet} mints per wallet reached`);
        }
      }

      res.json({
        success: true,
        data: {
          canMint: canMint && (drop.maxMintsPerWallet ? userMintCount < drop.maxMintsPerWallet : true),
          status: drop.status,
          remaining: drop.totalSupply - drop.mintedCount,
          userMintCount,
          maxMintsPerWallet: drop.maxMintsPerWallet,
          reason: reason.length > 0 ? reason : null
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DropController();
