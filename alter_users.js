import { pool } from './src/config/db.js';

async function alterUsersTable() {
    try {
        await pool.query('BEGIN');

        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
            ADD COLUMN IF NOT EXISTS age_group VARCHAR(20),
            ADD COLUMN IF NOT EXISTS height NUMERIC,
            ADD COLUMN IF NOT EXISTS weight NUMERIC,
            ADD COLUMN IF NOT EXISTS goals JSONB DEFAULT '[]'::JSONB,
            ADD COLUMN IF NOT EXISTS dietary_restrictions JSONB DEFAULT '[]'::JSONB;
        `);

        await pool.query('COMMIT');
        console.log("users 테이블 업데이터 성공");
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error("업데이트 실패:", e);
    } finally {
        pool.end();
    }
}

alterUsersTable();
