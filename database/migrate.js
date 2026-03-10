import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pg;

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("❌ DATABASE_URL이 없습니다. back/.env를 확인하세요.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  const migrationsDir = path.join(process.cwd(), "database", "migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  try {
    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, "utf-8");
      await pool.query(sql);
      console.log("✅", file, "실행 완료");
    }
    console.log("✅ 마이그레이션 모두 완료");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("❌ 마이그레이션 실패:", err.message);
  process.exit(1);
});
