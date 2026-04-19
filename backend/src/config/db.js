const mysql = require("mysql2/promise");

function createPool() {
  const {
    DB_HOST = "127.0.0.1",
    DB_PORT = "3306",
    DB_USER = "root",
    DB_PASSWORD = "",
    DB_NAME = "constructora_gg",
  } = process.env;

  return mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

let pool;

function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

async function pingDatabase() {
  const p = getPool();
  const [rows] = await p.query("SELECT 1 AS ok");
  return rows;
}

module.exports = { getPool, pingDatabase };
