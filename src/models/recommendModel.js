import { pool } from '../config/db.js';

/**
 * DB에서 지정된 개수만큼 랜덤하게 음식을 가져옵니다.
 * @param {number} limit 조회할 음식 수 (기본값: 5)
 */
export const getRandomFoods = async (limit = 5) => {
  const query = `
    SELECT 
        food_code AS id, 
        food_name AS name, 
        -- image_url이 foods 테이블에 없으면 null을 반환합니다. 
        -- 만약 있다면 column 이름을 맞추어 수정하세요.
        null AS image 
    FROM foods 
    ORDER BY RANDOM() 
    LIMIT $1
  `;
  try {
    const { rows } = await pool.query(query, [limit]);
    return rows;
  } catch (error) {
    console.error('getRandomFoods 에러:', error);
    throw error;
  }
};

/**
 * 키워드(문자열 배열) 리스트를 받아 foods 테이블에서 일치하거나 유사한 음식을 검색합니다.
 * @param {string[]} keywords 검색할 음식 키워드 배열 (예: ['닭가슴살', '고구마'])
 */
export const searchFoodsByKeywords = async (keywords) => {
  if (!keywords || keywords.length === 0) return [];

  // 각 키워드별로 ILIKE 조건을 만들어 OR로 연결
  const conditions = keywords.map((_, i) => `food_name ILIKE $${i + 1}`);
  const query = `
    SELECT 
      food_code AS id, 
      food_name AS name, 
      null AS image
    FROM foods
    WHERE ${conditions.join(' OR ')}
    LIMIT 10
  `;

  const values = keywords.map((kw) => `%${kw}%`);

  try {
    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    console.error('searchFoodsByKeywords 에러:', error);
    throw error;
  }
};

/**
 * AI 추천 내역을 DB에 저장합니다.
 * @param {string} id 추천 데이터의 UUID
 * @param {string} userId 사용자 UUID
 * @param {Array} foods 추천된 음식 목록 JSON 데이터
 */
export const saveRecommendationResult = async (
  id,
  userId,
  foods,
  reason = '',
) => {
  const query = `
    INSERT INTO recommendations (id, user_id, context_type, recommendation_data, reason)
    VALUES ($1, $2, 'AI_CHAT', $3, $4)
    RETURNING id
  `;
  const dataJson = JSON.stringify({ foods });

  try {
    const { rows } = await pool.query(query, [id, userId, dataJson, reason]);
    return rows[0];
  } catch (error) {
    console.error('saveRecommendationResult 에러:', error);
    throw error;
  }
};
