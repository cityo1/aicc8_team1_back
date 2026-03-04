import { pool } from "../config/db.js";

/**
 * 이메일로 사용자 조회
 * @param {string} email
 * @returns {Promise<Object>}
 */
const findUserByEmail = async (email) => {
    const query = 'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL';
    const values = [email];
    try {
        const { rows } = await pool.query(query, values);
        return rows[0];
    } catch (error) {
        console.error("findUserByEmail 에러:", error);
        throw error;
    }
};

/**
 * 닉네임 중복 확인 (생략 가능하나 보통 구현)
 * @param {string} nickname
 * @returns {Promise<Object>}
 */
const findUserByNickname = async (nickname) => {
    const query = 'SELECT * FROM users WHERE nickname = $1 AND deleted_at IS NULL';
    const values = [nickname];
    try {
        const { rows } = await pool.query(query, values);
        return rows[0];
    } catch (error) {
        console.error("findUserByNickname 에러:", error);
        throw error;
    }
};

/**
 * 새로운 사용자 생성
 * @param {string} id - UUID v4
 * @param {string} email
 * @param {string} password_hash
 * @param {string} nickname
 * @returns {Promise<Object>}
 */
const createUser = async (id, email, password_hash, nickname, gender, age_group, height, weight, goals, dietary_restrictions) => {
    // 트랜잭션을 사용하여 users와 user_settings 테이블에 동시 삽입
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertUserQuery = `
            INSERT INTO users (id, email, password_hash, nickname, gender, age_group, height, weight, goals, dietary_restrictions)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, email, nickname, gender, age_group, height, weight, goals, dietary_restrictions, created_at;
        `;
        const userValues = [
            id, email, password_hash, nickname,
            gender || null,
            age_group || null,
            height || null,
            weight || null,
            goals ? JSON.stringify(goals) : '[]',
            dietary_restrictions ? JSON.stringify(dietary_restrictions) : '[]'
        ];
        const userResult = await client.query(insertUserQuery, userValues);
        const newUser = userResult.rows[0];

        const insertSettingsQuery = `
            INSERT INTO user_settings (user_id)
            VALUES ($1);
        `;
        await client.query(insertSettingsQuery, [newUser.id]);

        await client.query('COMMIT');
        return newUser;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("createUser 에러:", error);
        throw error;
    } finally {
        client.release();
    }
};

export { findUserByEmail, findUserByNickname, createUser };
