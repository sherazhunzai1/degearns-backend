const Joi = require('joi');

// User validation schemas
const userValidation = {
  register: Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    walletAddress: Joi.string().required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    username: Joi.string().min(3).max(30),
    bio: Joi.string().max(500),
    profileImage: Joi.string().uri()
  })
};

// NFT validation schemas
const nftValidation = {
  mint: Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(1000).required(),
    image: Joi.string().uri().required(),
    uri: Joi.string().uri().required(),
    category: Joi.string().valid('art', 'music', 'photography', 'sports', 'gaming', 'collectibles', 'other'),
    tags: Joi.array().items(Joi.string()),
    attributes: Joi.array().items(
      Joi.object({
        trait_type: Joi.string().required(),
        value: Joi.any().required()
      })
    ),
    taxon: Joi.number().integer().min(0),
    transferFee: Joi.number().integer().min(0).max(50000),
    royalties: Joi.number().min(0).max(50)
  }),

  list: Joi.object({
    tokenId: Joi.string().required(),
    price: Joi.string().required(),
    destination: Joi.string(),
    expiration: Joi.number().integer()
  }),

  createOffer: Joi.object({
    tokenId: Joi.string().required(),
    amount: Joi.string().required(),
    owner: Joi.string()
  }),

  updateNFT: Joi.object({
    name: Joi.string().max(100),
    description: Joi.string().max(1000),
    category: Joi.string().valid('art', 'music', 'photography', 'sports', 'gaming', 'collectibles', 'other'),
    tags: Joi.array().items(Joi.string())
  })
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    req.body = value;
    next();
  };
};

module.exports = {
  userValidation,
  nftValidation,
  validate
};
