const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize Socket.io server
 * @param {Object} httpServer - HTTP server instance
 * @param {Object} options - Socket.io options
 */
const init = (httpServer, options = {}) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    ...options
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join lucky draw room
    socket.on('join-lucky-draw', (month) => {
      const room = `lucky-draw-${month}`;
      socket.join(room);
      logger.info(`Socket ${socket.id} joined room: ${room}`);
    });

    // Leave lucky draw room
    socket.on('leave-lucky-draw', (month) => {
      const room = `lucky-draw-${month}`;
      socket.leave(room);
      logger.info(`Socket ${socket.id} left room: ${room}`);
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  logger.info('Socket.io server initialized');
  return io;
};

/**
 * Get Socket.io instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call init() first.');
  }
  return io;
};

/**
 * Emit event to all clients in a lucky draw room
 * @param {string} month - Lucky draw month (YYYY-MM)
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
const emitToLuckyDrawRoom = (month, event, data) => {
  if (!io) {
    logger.warn('Socket.io not initialized, cannot emit event');
    return;
  }
  const room = `lucky-draw-${month}`;
  io.to(room).emit(event, data);
  logger.info(`Emitted ${event} to room ${room}`);
};

/**
 * Emit event to all connected clients
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
const emitToAll = (event, data) => {
  if (!io) {
    logger.warn('Socket.io not initialized, cannot emit event');
    return;
  }
  io.emit(event, data);
  logger.info(`Emitted ${event} to all clients`);
};

/**
 * Lucky Draw specific events
 */
const luckyDrawEvents = {
  /**
   * Broadcast that a live draw is starting
   */
  drawStarting: (month, data) => {
    emitToLuckyDrawRoom(month, 'lucky-draw:starting', {
      month,
      message: 'Lucky draw is starting!',
      ...data
    });
    // Also emit to all for notifications
    emitToAll('lucky-draw:starting-global', { month });
  },

  /**
   * Broadcast participant shuffle animation data
   */
  shuffling: (month, data) => {
    emitToLuckyDrawRoom(month, 'lucky-draw:shuffling', {
      month,
      ...data
    });
  },

  /**
   * Broadcast highlighting a participant during animation
   */
  highlighting: (month, data) => {
    emitToLuckyDrawRoom(month, 'lucky-draw:highlighting', {
      month,
      ...data
    });
  },

  /**
   * Broadcast the winner selection
   */
  winnerSelected: (month, data) => {
    emitToLuckyDrawRoom(month, 'lucky-draw:winner-selected', {
      month,
      ...data
    });
    // Also emit to all
    emitToAll('lucky-draw:winner-announced', {
      month,
      winner: data.winner
    });
  },

  /**
   * Broadcast draw completion
   */
  drawComplete: (month, data) => {
    emitToLuckyDrawRoom(month, 'lucky-draw:complete', {
      month,
      ...data
    });
  },

  /**
   * Broadcast new participant joined
   */
  newParticipant: (month, data) => {
    emitToLuckyDrawRoom(month, 'lucky-draw:new-participant', {
      month,
      ...data
    });
  },

  /**
   * Broadcast countdown update
   */
  countdownUpdate: (month, data) => {
    emitToLuckyDrawRoom(month, 'lucky-draw:countdown', {
      month,
      ...data
    });
  },

  /**
   * Broadcast draw cancelled
   */
  drawCancelled: (month, data) => {
    emitToLuckyDrawRoom(month, 'lucky-draw:cancelled', {
      month,
      ...data
    });
  }
};

module.exports = {
  init,
  getIO,
  emitToLuckyDrawRoom,
  emitToAll,
  luckyDrawEvents
};
