import { pool } from '../config/db.js';
import { createNotification } from '../models/notificationsModel.js';

const MEAL_CONFIG = [
  {
    mealType: 'breakfast',
    mealLabel: '아침',
    startHour: 8,
    startMin: 0,
    endMin: 45,
    message: "오늘 아침은 무엇을 드셨나요? 사진 한 장으로 '꿀맛' 점수를 확인해보세요! 🍯",
    title: '아침 기록 알림',
  },
  {
    mealType: 'lunch',
    mealLabel: '점심',
    startHour: 12,
    startMin: 30,
    endMin: 75, // 13:15
    message: "오늘 점심은 무엇을 드셨나요? 사진 한 장으로 '꿀맛' 점수를 확인해보세요! 🍯",
    title: '점심 기록 알림',
  },
  {
    mealType: 'dinner',
    mealLabel: '저녁',
    startHour: 19,
    startMin: 0,
    endMin: 45,
    message: "오늘 저녁은 무엇을 드셨나요? 사진 한 장으로 '꿀맛' 점수를 확인해보세요! 🍯",
    title: '저녁 기록 알림',
  },
];

/**
 * 현재 KST 시각이 지정 구간 내인지 확인
 */
function isInTimeWindow(config, now) {
  const totalStart = config.startHour * 60 + config.startMin;
  const totalEnd = config.startHour * 60 + config.endMin;
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= totalStart && current < totalEnd;
}

/**
 * meal nudge job 실행
 * - receive_notifications=true 사용자만 대상
 * - 오늘 해당 끼니 미기록 & 같은 끼니 중복 발송 없음
 */
export async function runMealNudgeJob() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const config = MEAL_CONFIG.find((c) => isInTimeWindow(c, now));
  if (!config) return { sent: 0, reason: 'no_time_window' };

  let sent = 0;
  try {
    // receive_notifications=true 사용자
    const usersRes = await pool.query(
      `SELECT id FROM users WHERE receive_notifications = true AND deleted_at IS NULL`
    );
    const users = usersRes.rows;

    for (const { id: userId } of users) {
      // 오늘 해당 끼니 기록 여부
      const diaryRes = await pool.query(
        `SELECT 1 FROM diary_entries
         WHERE user_id = $1 AND meal_type = $2
           AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
           AND deleted_at IS NULL
         LIMIT 1`,
        [userId, config.mealType]
      );
      if (diaryRes.rows.length > 0) continue;

      // 오늘 같은 끼니 nudge 중복 여부
      const notifRes = await pool.query(
        `SELECT 1 FROM notifications
         WHERE user_id = $1 AND type = 'meal_nudge' AND title = $2
           AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
         LIMIT 1`,
        [userId, config.title]
      );
      if (notifRes.rows.length > 0) continue;

      await createNotification({
        userId,
        type: 'meal_nudge',
        title: config.title,
        message: config.message,
      });
      sent++;
    }

    return { sent, mealType: config.mealType };
  } catch (error) {
    console.error('runMealNudgeJob 에러:', error);
    throw error;
  }
}
