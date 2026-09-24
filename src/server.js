const { createServer } = require('node:http');
const { createApp } = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const pool = require('./db/pool');

const server = createServer(createApp());
server.requestTimeout = 10_000;
server.headersTimeout = 7_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.listen(env.PORT, env.HOST, () => {
  logger.info({ host: env.HOST, port: env.PORT }, 'HTTP server started');
});

let stopping = false;
async function shutdown(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    server.closeAllConnections();
  }, 10_000);
  forceTimer.unref();

  server.close(async () => {
    clearTimeout(forceTimer);
    try {
      await pool.end();
      logger.info('Graceful shutdown completed');
      process.exitCode = exitCode;
    } catch (error) {
      logger.error({ err: error }, 'Database pool shutdown failed');
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'Unhandled rejection');
  shutdown('unhandledRejection', 1);
});
