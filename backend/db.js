// db.js — database connection
// This file creates a single connection pool to Neon Postgres
// and exports it so every other file can use it without creating new connections

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

module.exports = pool;
