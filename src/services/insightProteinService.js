import { pool } from '../config/db.js';
import { createNotification } from '../models/notificationsModel.js';

const DEFAULT_PROTEIN_TARGET = 50;  // g
const MIN_DEFICIT = 15;             // 15g 이상 부족 시 알림

/**
 * 저녁 시간대(19:00~22:00 KST)인지
 */
function isEveningWindow() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const total = now.getHours() * 60 + now.getMinutes();
  return total >= 19 * 60 && total < 22 * 60;
}

/**
 * 오늘 일간 단백질 합계
 */
async function getDailyProtein(userId, dateStr) {
  const res = await pool.query(
    `SELECT COALESCE(SUM(snap_protein), 0) AS total
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = $2::date
       AND deleted_at IS NULL`,
    [userId, dateStr]
  );
  return parseFloat(res.rows[0]?.total ?? 0) || 0;
}

/**
 * 목표 단백질 조회
 */
async function getProteinTarget(userId, dateStr) {
  const res = await pool.query(
    `SELECT target_protein FROM nutrition_goals
     WHERE user_id = $1 AND target_date = $2::date
     ORDER BY created_at DESC LIMIT 1`,
    [userId, dateStr]
  );
  const v = res.rows[0]?.target_protein;
  return v != null ? Number(v) : DEFAULT_PROTEIN_TARGET;
}

/**
 * 오늘 insight_protein 이미 발송했는지
 */
async function alreadySent(userId, dateStr) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'insight_protein'
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date = $2::date
     LIMIT 1`,
    [userId, dateStr]
  );
  return res.rows.length > 0;
}

/**
 * 단백질 채우기 제안 알림 배치
 * - 저녁 19:00~22:00에만 실행
 * - 목표 대비 부족분 15g 이상 시 알림
 */
export async function runInsightProteinJob() {
  if (!isEveningWindow()) {
    return { sent: 0, reason: 'not_evening' };
  }

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
      const [current, target] = await Promise.all([
        getDailyProtein(userId, dateStr),
        getProteinTarget(userId, dateStr),
      ]);
      const deficit = Math.round(target - current);
      if (deficit < MIN_DEFICIT) continue;
      if (await alreadySent(userId, dateStr)) continue;

      const message = `오늘 목표 단백질까지 ${deficit}g 남았어요! 간식으로 삶은 계란이나 두유 어떠세요? 💪`;
      await createNotification({
        userId,
        type: 'insight_protein',
        title: '단백질 채우기',
        message,
      });
      sent++;
    }
    return { sent };
  } catch (error) {
    console.error('runInsightProteinJob 에러:', error);
    throw error;
  }
}
