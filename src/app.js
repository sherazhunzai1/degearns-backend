const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('express-async-errors');

const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
// const { apiLimiter } = require('./middleware/rateLimiter'); // Rate limiting disabled
const logger = require('./utils/logger');

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Rate limiting - DISABLED to allow unlimited requests
// app.use('/api', apiLimiter);

// API Routes
app.use(`/api/${process.env.API_VERSION || 'v1'}`, routes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'XRPL NFT Marketplace API',
    version: process.env.API_VERSION || 'v1',
    documentation: '/api/v1/health'
  });
});

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

module.exports = app;
