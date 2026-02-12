require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDatabase } = require('./config/sequelize');
const xrplConfig = require('./config/xrpl');
const logger = require('./utils/logger');
const { initScoringJobs } = require('./jobs/scoringJobs');
const { initLuckyDrawJobs } = require('./jobs/luckyDrawJobs');
const socketService = require('./services/socketService');

const PORT = process.env.PORT || 5000;

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to MySQL database
    await connectDatabase();

    // Connect to XRPL
    await xrplConfig.connect();

    // Initialize and start scoring jobs
    const models = require('./models');
    const scoringJobs = initScoringJobs(models);
    if (process.env.ENABLE_SCORING_JOBS !== 'false') {
      scoringJobs.start();
      logger.info('Scoring cron jobs initialized');
    }

    // Initialize and start lucky draw jobs
    const luckyDrawJobs = initLuckyDrawJobs(models);
    if (process.env.ENABLE_LUCKY_DRAW_JOBS !== 'false') {
      luckyDrawJobs.start();
      logger.info('Lucky draw cron jobs initialized');
    }

    // Create HTTP server and initialize Socket.io
    const server = http.createServer(app);
    socketService.init(server);

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logger.info(`XRPL Network: ${xrplConfig.getNetwork()}`);
      logger.info('Socket.io server ready for connections');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (error) => {
      logger.error('Unhandled Rejection:', error);
      server.close(() => {
        process.exit(1);
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      scoringJobs.stop();
      luckyDrawJobs.stop();
      server.close(async () => {
        logger.info('HTTP server closed');
        await xrplConfig.disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing HTTP server');
      scoringJobs.stop();
      luckyDrawJobs.stop();
      server.close(async () => {
        logger.info('HTTP server closed');
        await xrplConfig.disconnect();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
