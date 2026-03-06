import { pool } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 특정 사용자의 특정 날짜 영양소 결핍 여부를 체크합니다.
 */
export const checkDeficiency = async (req, res) => {
  try {
    const { userId } = req.body;
    const { date } = req.query;

    if (!userId || !date) {
      return res
        .status(400)
        .json({ success: false, message: 'userId와 date가 필요합니다.' });
    }

    // 1. 해당 날짜의 섭취 영양소 합계 계산
    const query = `
            SELECT 
                SUM(f.calories) as total_calories,
                SUM(f.carbohydrate) as total_carbohydrate,
                SUM(f.protein) as total_protein,
                SUM(f.fat) as total_fat
            FROM diary_entries de
            JOIN foods f ON de.food_code = f.food_code
            WHERE de.user_id = $1 AND DATE(de.meal_time) = $2
        `;
    const result = await pool.query(query, [userId, date]);
    const nutrition = result.rows[0];

    // 2. 결핍 알림 로직 (예시: 칼로리 1500 미만 시 알림 발생)
    // 실제 운영 시에는 nutrition_goals 테이블 등을 참고하여 동적으로 판별 가능
    const alerts = [];
    const thresholds = {
      calories: 1500,
      protein: 50,
      carbohydrate: 100,
      fat: 30,
    };

    if (nutrition.total_calories < thresholds.calories) {
      alerts.push({
        type: 'CALORIES',
        current: nutrition.total_calories,
        target: thresholds.calories,
      });
    }
    if (nutrition.total_protein < thresholds.protein) {
      alerts.push({
        type: 'PROTEIN',
        current: nutrition.total_protein,
        target: thresholds.protein,
      });
    }

    // 3. 결핍 데이터가 있으면 deficiency_alerts 테이블에 기록 (선택 사항)
    for (const alert of alerts) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO deficiency_alerts (id, user_id, deficiency_type, current_value, target_value, detected_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, userId, alert.type, alert.current, alert.target],
      );
    }

    return res.json({
      success: true,
      data: {
        date,
        nutrition,
        alerts,
      },
    });
  } catch (err) {
    console.error('checkDeficiency 에러:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
