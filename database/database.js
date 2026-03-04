import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  DB_SSL,
} = process.env;

export const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT || 5432),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
