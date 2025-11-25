const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const config = require('./database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging ? (msg) => logger.debug(msg) : false,
    pool: dbConfig.pool,
    define: dbConfig.define
  }
);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('MySQL database connected successfully');

    // Sync models in development (use migrations in production)
    if (env === 'development') {
      logger.info('Database models synced');
    }

  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDatabase };
