import { pool } from './src/config/db.js';
async function run() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log(res.rows);
    } catch (e) { console.error(e); }
    pool.end();
}
run();
