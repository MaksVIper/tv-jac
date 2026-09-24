const mysql = require('mysql2');
const pool = require('../db/pool');
const { businessNowParts } = require('../config/clock');
const { assertSchemaName } = require('./pointsRepository');

async function getScreenOrders(schemaName, now = new Date()) {
  const safeSchema = assertSchemaName(schemaName);
  const ordersTable = `${mysql.escapeId(safeSchema)}.${mysql.escapeId('orders')}`;
  const { startOfDay, endOfDay, readyThreshold } = businessNowParts(now);

  const [rows] = await pool.execute({
    sql: `SELECT id, type_order, number, status_order, give_data_time, date_time_order
            FROM ${ordersTable}
           WHERE status_order BETWEEN 4 AND 6
             AND type_order IN (2, 3, 4)
             AND is_delete = 0
             AND NOT (type_order = 2 AND status_order = 6)
             AND (
               (date_time_order BETWEEN ? AND ? AND unix_date_time_preorder = 0)
               OR date_time_preorder BETWEEN ? AND ?
             )
             AND give_data_time >= ?
           ORDER BY give_data_time ASC`,
    timeout: 5_000,
    values: [
      startOfDay,
      endOfDay,
      startOfDay,
      endOfDay,
      readyThreshold,
    ],
  });

  return rows;
}

module.exports = {
  getScreenOrders,
};
