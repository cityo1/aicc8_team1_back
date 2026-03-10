import { pool } from '../config/db.js';
import { createNotification } from '../models/notificationsModel.js';

const DEFAULTS = { carb: 250, protein: 50, fat: 65 };
const MIN_DEFICIT_RATIO = 0.2;  // 목표의 20% 이상 부족 시 제안

/** 부족 영양소 → 내일 아침 추천 메뉴 */
const SUGGESTIONS = {
  carb: { label: '식이섬유·탄수화물', menu: '사과와 요거트', emoji: '🍎' },
  protein: { label: '단백질', menu: '계란과 두유', emoji: '🥚' },
  fat: { label: '건강한 지방', menu: '아보카도와 견과류', emoji: '🥑' },
};

/**
 * 저녁 20:00~22:00 KST
 */
function isEveningWindow() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const total = now.getHours() * 60 + now.getMinutes();
  return total >= 20 * 60 && total < 22 * 60;
}

/**
 * 오늘 일간 영양 합계
 */
async function getDailyTotals(userId, dateStr) {
  const res = await pool.query(
    `SELECT
       COALESCE(SUM(snap_carbohydrate), 0) AS carb,
       COALESCE(SUM(snap_protein), 0) AS protein,
       COALESCE(SUM(snap_fat), 0) AS fat
     FROM diary_entries
     WHERE user_id = $1
       AND (meal_time AT TIME ZONE 'Asia/Seoul')::date = $2::date
       AND deleted_at IS NULL`,
    [userId, dateStr]
  );
  const r = res.rows[0] || {};
  return {
    carb: parseFloat(r.carb) || 0,
    protein: parseFloat(r.protein) || 0,
    fat: parseFloat(r.fat) || 0,
  };
}

/**
 * 목표 영양소
 */
async function getTargets(userId, dateStr) {
  const res = await pool.query(
    `SELECT target_carbohydrate, target_protein, target_fat
     FROM nutrition_goals
     WHERE user_id = $1 AND target_date = $2::date
     ORDER BY created_at DESC LIMIT 1`,
    [userId, dateStr]
  );
  const r = res.rows[0];
  return {
    carb: r?.target_carbohydrate != null ? Number(r.target_carbohydrate) : DEFAULTS.carb,
    protein: r?.target_protein != null ? Number(r.target_protein) : DEFAULTS.protein,
    fat: r?.target_fat != null ? Number(r.target_fat) : DEFAULTS.fat,
  };
}

/**
 * 가장 부족한 영양소 (목표 대비 비율)
 */
function getMostDeficient(current, target) {
  let maxDeficit = 0;
  let key = null;
  for (const k of ['carb', 'protein', 'fat']) {
    const t = target[k] || DEFAULTS[k];
    const c = current[k] || 0;
    if (t <= 0) continue;
    const deficit = (t - c) / t;
    if (deficit >= MIN_DEFICIT_RATIO && deficit > maxDeficit) {
      maxDeficit = deficit;
      key = k;
    }
  }
  return key;
}

async function alreadySent(userId, dateStr) {
  const res = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'recommendation_tomorrow'
       AND (created_at AT TIME ZONE 'Asia/Seoul')::date = $2::date
     LIMIT 1`,
    [userId, dateStr]
  );
  return res.rows.length > 0;
}

/**
 * 내일의 식단 제안 알림 배치
 */
export async function runRecommendationTomorrowJob() {
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
        getDailyTotals(userId, dateStr),
        getTargets(userId, dateStr),
      ]);
      const deficient = getMostDeficient(current, target);
      if (!deficient) continue;
      if (await alreadySent(userId, dateStr)) continue;

      const s = SUGGESTIONS[deficient];
      const message = `내일 아침은 오늘 부족했던 ${s.label}를 채워줄 '${s.menu}' 식단 어떠세요? ${s.emoji}`;
      await createNotification({
        userId,
        type: 'recommendation_tomorrow',
        title: '내일의 식단 제안',
        message,
      });
      sent++;
    }
    return { sent };
  } catch (error) {
    console.error('runRecommendationTomorrowJob 에러:', error);
    throw error;
  }
}
