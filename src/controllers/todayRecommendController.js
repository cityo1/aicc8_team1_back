import { getTodayMessage } from '../services/todayRecommendService.js';
import { getRandomFoods } from '../models/recommendModel.js';
import { filterFoodsByUser, getExcludedKeywords } from '../utils/allergyFilter.js';
import { findUserById } from '../models/userModel.js';

/**
 * GET /api/users/me/today-recommend
 * 홈 화면용: 오늘의 추천 한 줄 문구 + 추천 식품 2~3개
 */
export async function getTodayRecommend(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);

    const [message, rawFoods, user] = await Promise.all([
      getTodayMessage(userId, dateStr),
      getRandomFoods(5),
      findUserById(userId),
    ]);

    const excluded = getExcludedKeywords(user);
    const filtered = filterFoodsByUser(rawFoods, excluded);
    const foods = filtered.slice(0, 3).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description || '',
      tags: f.tags || [],
      kcal: f.kcal ?? f.calories ?? 0,
      carbs: f.carbs ?? f.carbohydrate ?? 0,
      protein: f.protein ?? 0,
      fat: f.fat ?? 0,
      sugar: f.sugar ?? f.sugars ?? 0,
      image: f.image,
    }));

    return res.json({
      success: true,
      data: { message, foods },
    });
  } catch (err) {
    console.error('getTodayRecommend 에러:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
