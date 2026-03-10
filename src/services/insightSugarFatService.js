import { pool } from '../config/db.js';
import { createNotification } from '../models/notificationsModel.js';

const MEAL_LABELS = { breakfast: '아침', lunch: '점심', dinner: '저녁' };
const DEFAULT_SUGARS_PER_MEAL = 17;  // 일일 50g / 3
const DEFAULT_FAT_PER_MEAL = 22;     // 일일 65g / 3
const EXCEED_RATIO = 1.3;            // 목표의 130% 초과 시 알림

/**
 * 해당 끼니의 당류·지방 합계
 */
async function getMealTotals(userId, dateStr, mealType) {
  const res = await pool.query(
    `SELECT
       COALESCE(SUM(snap_sugars), 0) AS sugars,
       COALESCE(SUM(snap_fat), 0) AS fat
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = $2::date
       AND meal_type = $3
       AND deleted_at IS NULL`,
    [userId, dateStr, mealType]
  );
  return res.rows[0] || { sugars: 0, fat: 0 };
}

/**
 * nutrition_goals에서 일일 목표 조회 (없으면 기본값)
 */
async function getTargets(userId, dateStr) {
  const res = await pool.query(
    `SELECT target_sugars, target_fat
     FROM nutrition_goals
     WHERE user_id = $1 AND target_date = $2::date
     ORDER BY created_at DESC LIMIT 1`,
    [userId, dateStr]
  );
  const r = res.rows[0];
  const sugars = r?.target_sugars != null ? Number(r.target_sugars) / 3 : DEFAULT_SUGARS_PER_MEAL;
  const fat = r?.target_fat != null ? Number(r.target_fat) / 3 : DEFAULT_FAT_PER_MEAL;
  return { sugars, fat };
}

/**
 * 이미 insight_sugar_fat 발송했는지 (user+date+meal)
 */
async function alreadySent(userId, dateStr, mealType) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'insight_sugar_fat'
       AND message LIKE $2
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date = $3::date
     LIMIT 1`,
    [userId, `%${MEAL_LABELS[mealType]}%`, dateStr]
  );
  return res.rows.length > 0;
}

/**
 * 당류/지방 주의 알림 배치
 * - 오늘 아침/점심/저녁 끼니별로 당류·지방 목표 초과 여부 확인
 * - 13:30~14:30 점심 시간대, 20:00~21:00 저녁 시간대 등에 실행하면 직전 끼니 검사
 */
export async function runInsightSugarFatJob() {
  const todayRes = await pool.query(
    `SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS today`
  );
  const dateStr = todayRes.rows[0].today.toISOString().slice(0, 10);
  let sent = 0;

  try {
    const usersRes = await pool.query(
      `SELECT id FROM users WHERE receive_notifications = true AND deleted_at IS NULL`
    );

    for (const { id: userId } of usersRes.rows) {
      const targets = await getTargets(userId, dateStr);
      const thresholdSugars = targets.sugars * EXCEED_RATIO;
      const thresholdFat = targets.fat * EXCEED_RATIO;

      for (const mealType of ['breakfast', 'lunch', 'dinner']) {
        const totals = await getMealTotals(userId, dateStr, mealType);
        const sugars = parseFloat(totals.sugars) || 0;
        const fat = parseFloat(totals.fat) || 0;

        const overSugars = sugars >= thresholdSugars;
        const overFat = fat >= thresholdFat;
        if (!overSugars && !overFat) continue;

        if (await alreadySent(userId, dateStr, mealType)) continue;

        const label = MEAL_LABELS[mealType];
        let message;
        if (overSugars && overFat) {
          message = `앗! ${label}에 당류와 지방을 조금 많이 섭취하셨어요. 저녁은 담백한 식단을 추천해 드릴까요? 🥗`;
        } else if (overSugars) {
          message = `앗! ${label}에 당류를 조금 많이 섭취하셨어요. 저녁은 담백한 식단을 추천해 드릴까요? 🥗`;
        } else {
          message = `앗! ${label}에 지방을 조금 많이 섭취하셨어요. 저녁은 담백한 식단을 추천해 드릴까요? 🥗`;
        }

        await createNotification({
          userId,
          type: 'insight_sugar_fat',
          title: '영양 피드백',
          message,
        });
        sent++;
      }
    }
    return { sent };
  } catch (error) {
    console.error('runInsightSugarFatJob 에러:', error);
    throw error;
  }
}
