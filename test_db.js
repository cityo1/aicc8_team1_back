import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { pool } from './src/config/db.js';

async function test() {
    try {
        const response = await axios.get("https://docs.google.com/spreadsheets/d/e/2PACX-1vRG0hhlB4XfYM_pQ7OYhDMh3QG1xLnHc_-FqitnphVFAjVtxzxI7yi5PfkIGNXdxqsiqj0Iv-NwuPEo/pub?output=csv");
        const jsonData = parse(response.data, { columns: true, skip_empty_lines: true });

        const mapping = {
            "식품코드": "food_code",
            "식품명": "food_name",
            "에너지(kcal)": "energy_kcal",
            "단백질(g)": "protein_g",
            "지방(g)": "fat_g",
            "당류(g)": "sugar_g",
            "식품중량": "food_weight"
        };
        const csvKeys = Object.keys(mapping);
        const dbColumns = Object.values(mapping);
        const uniqueKey = 'food_code';

        const batch = jsonData.slice(0, 1000);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const values = [];
            const placeholders = [];
            let paramIndex = 1;

            for (const row of batch) {
                const rowValues = csvKeys.map(csvKey => {
                    let val = row[csvKey];
                    if (val === '') val = null;
                    return val;
                });
                values.push(...rowValues);

                const rowPlaceholders = dbColumns.map(() => `$${paramIndex++}`);
                placeholders.push(`(${rowPlaceholders.join(', ')})`);
            }

            const columnsStr = dbColumns.map(col => `"${col}"`).join(', ');
            const excluded = dbColumns.map(col => `"${col}" = EXCLUDED."${col}"`).join(', ');

            const query = `
                INSERT INTO foods (${columnsStr})
                VALUES ${placeholders.join(', ')}
                ON CONFLICT ("${uniqueKey}") DO UPDATE SET ${excluded}
            `;
            await client.query(query, values);
            await client.query('COMMIT');
            console.log("Success batch");
        } catch (e) {
            await client.query('ROLLBACK');
            console.error("DB Query Error:", e.name, e.message);
        } finally {
            client.release();
            pool.end();
        }

    } catch (e) {
        console.error("Outer Error:", e.message);
    }
}

test();
