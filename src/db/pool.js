const mysql = require('mysql2/promise');
const env = require('../config/env');
const { mysqlOffset } = require('../config/clock');

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_MAIN_DATABASE,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  maxIdle: env.DB_CONNECTION_LIMIT,
  idleTimeout: 60_000,
  queueLimit: 100,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  charset: 'utf8mb4',
  timezone: mysqlOffset(),
  dateStrings: true,
});

module.exports = pool;
