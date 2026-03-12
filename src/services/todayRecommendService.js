/**
 * 홈 화면용 오늘의 추천 한 줄 문구 (규칙 기반)
 * daily_summary + nutrition_goals 기반
 */
import { summarizeDay } from './dailySummariesService.js';
import { getOrCreateGoals } from '../models/nutritionGoalsModel.js';

const MIN_PROTEIN_DEFICIT = 15;  // 15g 이상 부족 시
const EXCEED_RATIO = 1.2;        // 목표의 120% 초과 시
const GOOD_SCORE = 80;           // 80점 이상이면 양호

/**
 * 오늘의 추천 한 줄 문구 생성
 * @param {string} userId
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<string>}
 */
export async function getTodayMessage(userId, dateStr) {
  const [summary, goals] = await Promise.all([
    summarizeDay(userId, dateStr),
    getOrCreateGoals(userId, dateStr),
  ]);

  const actual = {
    calories: Number(summary?.total_calories) || 0,
    protein: Number(summary?.total_protein) || 0,
    sugars: Number(summary?.total_sugars) || 0,
    fat: Number(summary?.total_fat) || 0,
  };

  const target = {
    calories: Number(goals?.target_calories) || 2000,
    protein: Number(goals?.target_protein) || 50,
    sugars: Number(goals?.target_sugars) || 50,
    fat: Number(goals?.target_fat) || 65,
  };

  const score = Number(summary?.score) ?? 0;

  // 1. 단백질 부족
  const proteinDeficit = target.protein - actual.protein;
  if (proteinDeficit >= MIN_PROTEIN_DEFICIT) {
    return `오늘 목표 단백질까지 ${Math.round(proteinDeficit)}g 남았어요! 간식으로 삶은 계란이나 두유 어떠세요? 💪`;
  }

  // 2. 당류·지방 과다
  const overSugars = target.sugars > 0 && actual.sugars >= target.sugars * EXCEED_RATIO;
  const overFat = target.fat > 0 && actual.fat >= target.fat * EXCEED_RATIO;
  if (overSugars && overFat) {
    return '오늘 당류·지방을 조금 많이 드셨어요. 내일은 담백한 식단 어떠세요? 🥗';
  }
  if (overSugars) {
    return '오늘 당류를 조금 많이 드셨어요. 내일은 담백한 식단 어떠세요? 🥗';
  }
  if (overFat) {
    return '오늘 지방을 조금 많이 드셨어요. 내일은 담백한 식단 어떠세요? 🥗';
  }

  // 3. 칼로리 부족 (목표의 70% 미만)
  if (target.calories > 0 && actual.calories < target.calories * 0.7) {
    return '오늘 칼로리가 부족해요. 영양 가득한 간식 어떠세요? 🍎';
  }

  // 4. 전반적으로 양호
  if (score >= GOOD_SCORE) {
    return '오늘도 균형 잡힌 식사 잘 하고 계시네요! 👍';
  }

  // 5. 기본
  return '오늘 메뉴 고민되시죠? AI가 맛있는 식단을 추천해 드릴게요! 🍽️';
}
