const { Drop, DropMint, DropNFT, User } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class DropController {
  /**
   * Bulk upload NFT metadata to be used in drops
   * POST /api/drops/bulk-upload-nfts
   */
  async bulkUploadNFTs(req, res, next) {
    try {
      const { creatorWalletAddress, collectionId, nfts } = req.body;

      // Validate required fields
      if (!creatorWalletAddress) {
        throw new ApiError(400, 'creatorWalletAddress is required');
      }
      if (!nfts || !Array.isArray(nfts) || nfts.length === 0) {
        throw new ApiError(400, 'nfts array is required and must not be empty');
      }

      // Validate each NFT has required fields
      for (let i = 0; i < nfts.length; i++) {
        const nft = nfts[i];
        if (!nft.metadataUri) {
          throw new ApiError(400, `NFT at index ${i} is missing metadataUri`);
        }
        if (!nft.metadata || typeof nft.metadata !== 'object') {
          throw new ApiError(400, `NFT at index ${i} is missing or has invalid metadata`);
        }
      }

      // Create DropNFT records with dropId=null (not yet assigned to a drop)
      const createdNFTs = await Promise.all(
        nfts.map(nft =>
          DropNFT.create({
            collectionId,
            dropId: null,
            metadataUri: nft.metadataUri,
            metadata: nft.metadata,
            isMinted: false
          })
        )
      );

      logger.info(`Bulk uploaded ${createdNFTs.length} NFTs for collection ${collectionId} by ${creatorWalletAddress}`);

      res.status(201).json({
        success: true,
        data: createdNFTs,
        message: `Successfully uploaded ${createdNFTs.length} NFTs`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new drop
   * POST /api/drops
   */
  async createDrop(req, res, next) {
    try {
      const {
        creatorWalletAddress,
        collectionId,
        collectionName,
        taxon,
        name,
        description,
        price,
        startDate,
        endDate,
        transferFee,
        flags,
        maxMintsPerWallet,
        isPublic,
        allowlist
      } = req.body;

      // Validate required fields
      if (!creatorWalletAddress) {
        throw new ApiError(400, 'creatorWalletAddress is required');
      }
      if (!name || !price || !startDate || !endDate) {
        throw new ApiError(400, 'Missing required fields: name, price, startDate, endDate');
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        throw new ApiError(400, 'startDate must be before endDate');
      }

      // Count available DropNFTs for this collection (not yet assigned to a drop)
      const availableNFTs = await DropNFT.findAll({
        where: {
          collectionId,
          dropId: null,
          isMinted: false
        }
      });

      if (availableNFTs.length === 0) {
        throw new ApiError(400, 'No NFTs available for this collection. Please upload NFTs first using /bulk-upload-nfts');
      }

      // Set totalSupply based on available NFTs
      const totalSupply = availableNFTs.length;

      // Validate allowlist if provided
      if (allowlist) {
        if (!Array.isArray(allowlist)) {
          throw new ApiError(400, 'allowlist must be an array of wallet addresses');
        }
        // Validate each address format (basic check for XRPL addresses starting with 'r')
        for (const addr of allowlist) {
          if (typeof addr !== 'string' || !addr.startsWith('r')) {
            throw new ApiError(400, 'Invalid wallet address in allowlist');
          }
        }
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
        collectionName,
        taxon,
        name,
        description,
        price,
        totalSupply,
        startDate: start,
        endDate: end,
        status,
        creatorWalletAddress,
        transferFee: transferFee || 0,
        flags: flags || 8,
        maxMintsPerWallet,
        isPublic: isPublic !== undefined ? isPublic : true,
        allowlist: allowlist || null
      });

      // Assign all available NFTs to this drop
      await DropNFT.update(
        { dropId: drop.id },
        {
          where: {
            id: { [Op.in]: availableNFTs.map(nft => nft.id) }
          }
        }
      );

      logger.info(`Drop created: ${drop.id} with ${totalSupply} NFTs by ${creatorWalletAddress}`);

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
        walletAddress,
        name,
        description,
        price,
        startDate,
        endDate,
        maxMintsPerWallet
      } = req.body;

      // Validate wallet address
      if (!walletAddress) {
        throw new ApiError(400, 'walletAddress is required');
      }

      const drop = await Drop.findByPk(id);
      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Check ownership
      if (drop.creatorWalletAddress !== walletAddress) {
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
      if (maxMintsPerWallet !== undefined) updateData.maxMintsPerWallet = maxMintsPerWallet;
      if (req.body.totalSupply) updateData.totalSupply = req.body.totalSupply;

      await drop.update(updateData);

      // Update status
      drop.updateStatus();
      if (drop.changed()) {
        await drop.save();
      }

      logger.info(`Drop updated: ${drop.id} by ${walletAddress}`);

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
      const { walletAddress } = req.query;

      // Validate wallet address
      if (!walletAddress) {
        throw new ApiError(400, 'walletAddress is required');
      }

      const drop = await Drop.findByPk(id);
      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Check ownership
      if (drop.creatorWalletAddress !== walletAddress) {
        throw new ApiError(403, 'You are not the creator of this drop');
      }

      // Can't delete if any NFTs have been minted
      if (drop.mintedCount > 0) {
        throw new ApiError(400, 'Cannot delete drop with minted NFTs');
      }

      // Unassign DropNFTs from this drop (set dropId back to null)
      await DropNFT.update(
        { dropId: null },
        { where: { dropId: id } }
      );

      await drop.destroy();

      logger.info(`Drop deleted: ${id} by ${walletAddress}`);

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
      const { minterWalletAddress, nftokenId, transactionHash, metadataUri } = req.body;

      // Validate required fields
      if (!minterWalletAddress) {
        throw new ApiError(400, 'minterWalletAddress is required');
      }
      if (!nftokenId || !transactionHash || !metadataUri) {
        throw new ApiError(400, 'nftokenId, transactionHash, and metadataUri are required');
      }

      // Check if this NFT was already recorded
      const existingNFT = await DropNFT.findOne({
        where: { nftokenId }
      });

      if (existingNFT) {
        throw new ApiError(400, 'This NFT has already been recorded');
      }

      // Get drop with lock to prevent race conditions
      const drop = await Drop.findByPk(id, {
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

      // Check allowlist if drop is not public
      if (!drop.isPublic) {
        if (!drop.isAllowed(minterWalletAddress)) {
          throw new ApiError(403, 'You are not allowed to mint from this drop');
        }
      }

      // Check if sold out
      if (drop.mintedCount >= drop.totalSupply) {
        drop.status = 'soldout';
        await drop.save();
        throw new ApiError(400, 'Drop is sold out');
      }

      // Check max mints per wallet if set
      if (drop.maxMintsPerWallet) {
        const userMintCount = await DropNFT.count({
          where: {
            dropId: id,
            mintedBy: minterWalletAddress,
            isMinted: true
          }
        });

        if (userMintCount >= drop.maxMintsPerWallet) {
          throw new ApiError(400, `Maximum ${drop.maxMintsPerWallet} mints per wallet reached`);
        }
      }

      // Find the DropNFT by metadataUri
      const dropNFT = await DropNFT.findOne({
        where: {
          dropId: id,
          metadataUri,
          isMinted: false
        }
      });

      if (!dropNFT) {
        throw new ApiError(404, 'NFT not found in this drop or already minted');
      }

      // Calculate mint number
      const mintNumber = drop.mintedCount + 1;

      // Update the DropNFT record
      await dropNFT.update({
        nftokenId,
        mintedBy: minterWalletAddress,
        mintedAt: new Date(),
        transactionHash,
        isMinted: true,
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
          mint: {
            id: dropNFT.id,
            dropId: id,
            minterWalletAddress,
            nftokenId,
            transactionHash,
            mintNumber,
            metadataUri
          },
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
      const { walletAddress } = req.query;

      const drop = await Drop.findByPk(id);

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

      // Check allowlist if drop is not public
      if (!drop.isPublic) {
        if (!walletAddress) {
          throw new ApiError(400, 'walletAddress is required for allowlist drops');
        }
        if (!drop.isAllowed(walletAddress)) {
          throw new ApiError(403, 'You are not allowed to mint from this drop');
        }
      }

      // Check if sold out
      if (drop.mintedCount >= drop.totalSupply) {
        throw new ApiError(400, 'Drop is sold out');
      }

      // Check max mints per wallet if set and wallet address provided
      if (walletAddress && drop.maxMintsPerWallet) {
        const userMintCount = await DropNFT.count({
          where: {
            dropId: id,
            mintedBy: walletAddress,
            isMinted: true
          }
        });

        if (userMintCount >= drop.maxMintsPerWallet) {
          throw new ApiError(400, `Maximum ${drop.maxMintsPerWallet} mints per wallet reached`);
        }
      }

      // Find ONE unminted DropNFT for this drop
      const unmintedNFT = await DropNFT.findOne({
        where: {
          dropId: id,
          isMinted: false
        },
        order: [['createdAt', 'ASC']] // First uploaded, first minted
      });

      if (!unmintedNFT) {
        throw new ApiError(400, 'No unminted NFTs available in this drop');
      }

      // Calculate mint number (based on how many are already minted)
      const mintNumber = drop.mintedCount + 1;

      // Add mint number and drop info to metadata attributes
      const metadata = {
        ...unmintedNFT.metadata,
        attributes: [
          ...(unmintedNFT.metadata.attributes || []),
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
          metadataUri: unmintedNFT.metadataUri,
          taxon: drop.taxon,
          transferFee: drop.transferFee,
          flags: drop.flags,
          price: drop.price,
          collectionName: drop.collectionName,
          collectionId: drop.collectionId
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
      const { walletAddress, page = 1, limit = 20 } = req.query;

      // Validate wallet address
      if (!walletAddress) {
        throw new ApiError(400, 'walletAddress query parameter is required');
      }

      const offset = (page - 1) * limit;

      const { count, rows: mints } = await DropNFT.findAndCountAll({
        where: {
          mintedBy: walletAddress,
          isMinted: true
        },
        include: [
          {
            model: Drop,
            as: 'drop',
            attributes: ['id', 'name', 'description', 'collectionId', 'collectionName', 'price', 'status']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['mintedAt', 'DESC']]
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
      const { walletAddress } = req.query;

      const drop = await Drop.findByPk(id);
      if (!drop) {
        throw new ApiError(404, 'Drop not found');
      }

      // Update status
      drop.updateStatus();
      await drop.save();

      let canMint = drop.isMintable();
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

      // Check allowlist if drop is not public
      if (!drop.isPublic) {
        if (!walletAddress) {
          canMint = false;
          reason.push('Wallet address is required for allowlist drops');
        } else if (!drop.isAllowed(walletAddress)) {
          canMint = false;
          reason.push('You are not on the allowlist for this drop');
        }
      }

      // Check user-specific constraints if wallet address provided
      let userMintCount = 0;
      if (walletAddress && drop.maxMintsPerWallet) {
        userMintCount = await DropNFT.count({
          where: {
            dropId: id,
            mintedBy: walletAddress,
            isMinted: true
          }
        });

        if (userMintCount >= drop.maxMintsPerWallet) {
          canMint = false;
          reason.push(`Maximum ${drop.maxMintsPerWallet} mints per wallet reached`);
        }
      }

      res.json({
        success: true,
        data: {
          canMint,
          status: drop.status,
          remaining: drop.totalSupply - drop.mintedCount,
          userMintCount,
          maxMintsPerWallet: drop.maxMintsPerWallet,
          isPublic: drop.isPublic,
          reason: reason.length > 0 ? reason : null
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DropController();
