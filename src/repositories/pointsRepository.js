const mysql = require('mysql2');
const pool = require('../db/pool');
const env = require('../config/env');

const SCHEMA_NAME = /^[A-Za-z0-9_]+$/;

function qualifiedMainTable(table) {
  return `${mysql.escapeId(env.DB_MAIN_DATABASE)}.${mysql.escapeId(table)}`;
}

function assertSchemaName(schemaName) {
  if (!SCHEMA_NAME.test(schemaName)) {
    throw Object.assign(new Error('Invalid point database name'), { statusCode: 500 });
  }
  return schemaName;
}

async function getPoints() {
  const [rows] = await pool.query(
    `SELECT p.base,
            CONCAT(c.name, ', ', p.addr) AS name,
            p.id,
            p.city_id
       FROM ${qualifiedMainTable('points')} p
       LEFT JOIN ${qualifiedMainTable('cities')} c ON c.id = p.city_id
      WHERE p.id != 0
      ORDER BY p.city_id`,
  );
  return rows;
}

async function getPoint(pointId) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.base
       FROM ${qualifiedMainTable('points')} p
      WHERE p.id = ? AND p.id != 0
      LIMIT 1`,
    [pointId],
  );

  if (!rows[0]) {
    return null;
  }

  return {
    ...rows[0],
    base: assertSchemaName(String(rows[0].base)),
  };
}

async function hasTvSettings(pointId) {
  const [rows] = await pool.execute(
    `SELECT id FROM ${qualifiedMainTable('points_tv_settings')} WHERE id = ? LIMIT 1`,
    [pointId],
  );
  return rows.length > 0;
}

module.exports = {
  assertSchemaName,
  getPoint,
  getPoints,
  hasTvSettings,
};
