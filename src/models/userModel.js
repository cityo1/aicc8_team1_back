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
const createUser = async (id, email, password_hash, nickname, profile_image_url, gender, age_group, height, weight, goals, dietary_restrictions) => {
    // 트랜잭션을 사용하여 users와 user_settings 테이블에 동시 삽입
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertUserQuery = `
            INSERT INTO users (id, email, password_hash, nickname, profile_image_url, gender, age_group, height, weight, goals, dietary_restrictions)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, email, nickname, profile_image_url, gender, age_group, height, weight, goals, dietary_restrictions, created_at;
        `;
        const userValues = [
            id, email, password_hash, nickname, profile_image_url || null,
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

/**
 * 비밀번호 재설정 인증 코드 저장
 */
const savePasswordResetCode = async (email, code, expiresAt) => {
    const query = `
        INSERT INTO password_resets (email, code, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) 
        DO UPDATE SET code = EXCLUDED.code, reset_token = NULL, expires_at = EXCLUDED.expires_at
    `;
    await pool.query(query, [email, code, expiresAt]);
};

/**
 * 이메일로 비밀번호 재설정 정보 조회
 */
const findPasswordResetInfo = async (email) => {
    const query = 'SELECT * FROM password_resets WHERE email = $1';
    const { rows } = await pool.query(query, [email]);
    return rows[0];
};

/**
 * 검증 성공 시 reset_token 저장
 */
const savePasswordResetToken = async (email, resetToken, expiresAt) => {
    const query = `
        UPDATE password_resets
        SET code = NULL, reset_token = $2, expires_at = $3
        WHERE email = $1
    `;
    await pool.query(query, [email, resetToken, expiresAt]);
};

/**
 * 비밀번호 업데이트 및 리셋 정보 삭제
 */
const updateUserPassword = async (email, newPasswordHash) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 비밀번호 업데이트
        await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [newPasswordHash, email]);

        // 사용된 토큰/코드 정보 삭제
        await client.query('DELETE FROM password_resets WHERE email = $1', [email]);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("updateUserPassword 에러:", error);
        throw error;
    } finally {
        client.release();
    }
};

export { findUserByEmail, findUserByNickname, createUser, savePasswordResetCode, findPasswordResetInfo, savePasswordResetToken, updateUserPassword };
