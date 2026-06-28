const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { isXrplError, translateXrplError } = require('../utils/xrplErrors');

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  // Safety net: convert any raw XRP Ledger error (engine result codes, RPC
  // errors, or xrpl.js connection errors) that reached here into a
  // plain-language message. Short-circuits so later branches don't reprocess it.
  if (isXrplError(err)) {
    const xrplError = translateXrplError(err);
    return res.status(xrplError.statusCode).json({
      success: false,
      message: xrplError.message,
      ...(xrplError.xrplCode && { code: xrplError.xrplCode }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ApiError(404, message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = new ApiError(400, message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    error = new ApiError(400, messages.join(', '));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token expired');
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
  const error = new ApiError(404, `Route not found: ${req.originalUrl}`);
  next(error);
};

module.exports = {
  errorHandler,
  notFound
};
