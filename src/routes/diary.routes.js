import express from 'express';
import { pool } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Diary
 *   description: Food diary and meal logging
 */

/**
 * @swagger
 * /api/diary/daily:
 *   get:
 *     summary: Get all diet records for a specific date
 *     tags: [Diary]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: List of diary entries
 *       400:
 *         description: Missing userId or date
 */
router.get('/daily', async (req, res) => {
  try {
    const { userId, date } = req.query;

    if (!userId || !date) {
      return res
        .status(400)
        .json({ success: false, message: 'userId와 date는 필수입니다.' });
    }

    // Query directly from diary_entries using its snapshot values
    const query = `
            SELECT *
            FROM diary_entries
            WHERE user_id = $1 AND DATE(meal_time AT TIME ZONE 'UTC') = $2
               OR user_id = $1 AND DATE(meal_time) = $2
            ORDER BY meal_time ASC
        `;
    const result = await pool.query(query, [userId, date]);

    const summary = { calories: 0, carbs: 0, protein: 0, fat: 0, sugar: 0 };
    const meals = {
      breakfast: {
        foods: [],
        nutrients: { carbs: 0, protein: 0, fat: 0, sugar: 0 },
        calories: 0,
      },
      lunch: {
        foods: [],
        nutrients: { carbs: 0, protein: 0, fat: 0, sugar: 0 },
        calories: 0,
      },
      dinner: {
        foods: [],
        nutrients: { carbs: 0, protein: 0, fat: 0, sugar: 0 },
        calories: 0,
      },
      snack: {
        foods: [],
        nutrients: { carbs: 0, protein: 0, fat: 0, sugar: 0 },
        calories: 0,
      },
    };

    result.rows.forEach((row) => {
      const mType = row.meal_type || 'snack'; // fallback to snack if empty
      if (!meals[mType])
        meals[mType] = {
          foods: [],
          nutrients: { carbs: 0, protein: 0, fat: 0, sugar: 0 },
          calories: 0,
        };

      const cal = Number(row.snap_calories || 0);
      const carb = Number(row.snap_carbohydrate || 0);
      const prot = Number(row.snap_protein || 0);
      const fat = Number(row.snap_fat || 0);
      const sug = Number(row.snap_sugars || 0);

      // Add to summary
      summary.calories += cal;
      summary.carbs += carb;
      summary.protein += prot;
      summary.fat += fat;
      summary.sugar += sug;

      // Add to meal group nutrients
      meals[mType].calories += cal;
      meals[mType].nutrients.carbs += carb;
      meals[mType].nutrients.protein += prot;
      meals[mType].nutrients.fat += fat;
      meals[mType].nutrients.sugar += sug;

      // Push food item
      meals[mType].foods.push({
        id: row.id,
        foodCode: row.food_code,
        foodName: row.snap_food_name || null,
        servings: Number(row.serving_size),
        mealTime: row.meal_time,
        calories: cal,
        nutrients: {
          carbs: carb,
          protein: prot,
          fat: fat,
          sugar: sug,
        },
        memo: row.memo || null,
        imageUrl: row.image_url || null,
      });
    });

    // Round all numbers to 2 decimal places to prevent float math ugliness
    const roundNutrients = Object.keys(summary).forEach(
      (k) => (summary[k] = Number(summary[k].toFixed(2))),
    );
    Object.keys(meals).forEach((mType) => {
      meals[mType].calories = Number(meals[mType].calories.toFixed(2));
      Object.keys(meals[mType].nutrients).forEach((k) => {
        meals[mType].nutrients[k] = Number(
          meals[mType].nutrients[k].toFixed(2),
        );
      });
    });

    return res.json({
      success: true,
      date: date,
      summary: summary,
      breakfast: meals.breakfast,
      lunch: meals.lunch,
      dinner: meals.dinner,
      snack: meals.snack,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /api/diary/meal-summary:
 *   get:
 *     summary: Get nutritional summary for a specific meal (e.g., 아침, 점심)
 *     tags: [Diary]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date (YYYY-MM-DD)
 *       - in: query
 *         name: mealType
 *         required: true
 *         schema:
 *           type: string
 *         description: Meal type (e.g., 아침, 점심, 저녁, 간식)
 *     responses:
 *       200:
 *         description: List of items eaten for the specific meal and their calculated nutritional values
 *       400:
 *         description: Missing parameters
 */
router.get('/meal-summary', async (req, res) => {
  try {
    const { userId, date, mealType } = req.query;

    if (!userId || !date || !mealType) {
      return res.status(400).json({
        success: false,
        message: 'userId, date, mealType는 필수입니다.',
      });
    }

    // Just fetch the entries and map them to the spec format
    const query = `
            SELECT *
            FROM diary_entries
            WHERE user_id = $1 
              AND meal_type = $2
              AND DATE(meal_time) = $3
        `;
    const result = await pool.query(query, [userId, mealType, date]);

    const mappedData = result.rows.map((row) => ({
      mealType: row.meal_type,
      foodName: row.snap_food_name || '알 수 없는 음식',
      servings: Number(row.serving_size),
      totalCalories: Number(row.snap_calories || 0),
      nutrients: {
        carbs: Number(row.snap_carbohydrate || 0),
        protein: Number(row.snap_protein || 0),
        fat: Number(row.snap_fat || 0),
        sugar: Number(row.snap_sugars || 0),
      },
    }));

    return res.json({
      success: true,
      count: mappedData.length,
      data: mappedData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**

 * @swagger
 * /api/diary/monthly:
 *   get:
 *     summary: 월별로 식사 기록이 있는 날짜 목록 반환
 *     tags: [Diary]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: number
 *         description: 조회할 연도 (YYYY)
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: number
 *         description: 조회할 월 (1~12 또는 '03' 등)
 *     responses:
 *       200:
 *         description: 기록이 존재하는 날짜 목록 ("YYYY-MM-DD")
 *       400:
 *         description: 필수 파라미터 누락
 */
router.get('/monthly', async (req, res) => {
  try {
    const { userId, year, month } = req.query;

    if (!userId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: 'userId, year, month는 필수입니다.',
      });
    }

    const paddedMonth = String(month).padStart(2, '0');
    const targetPrefix = `${year}-${paddedMonth}`;

    const query = `
      SELECT DISTINCT TO_CHAR(meal_time, 'YYYY-MM-DD') AS record_date
      FROM diary_entries
      WHERE user_id = $1 
        AND TO_CHAR(meal_time, 'YYYY-MM') = $2
      ORDER BY record_date ASC
    `;

    const result = await pool.query(query, [userId, targetPrefix]);

    const dates = result.rows.map(row => row.record_date);

    return res.json({ success: true, dates });
  } catch (err) {
    console.error(err);

 * POST /api/diary/scan
 * AI 식단 분석 결과를 diary_entries에 저장 (ai_scans + diary_entries)
 * req.body: { userId, mealType, mealTime, imageUrl, foods: [{ name, amount, calories, carbohydrate, protein, fat, sugars }] }
 */
router.post('/scan', async (req, res) => {
  try {
    const {
      userId,
      mealType = 'snack',
      mealTime = null,
      imageUrl = null,
      foods = [],
    } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: 'userId는 필수입니다.' });
    }
    if (!Array.isArray(foods) || foods.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'foods 배열은 비어있을 수 없습니다.',
      });
    }

    const allowedMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!allowedMealTypes.includes(mealType)) {
      return res.status(400).json({
        success: false,
        message:
          'mealType은 breakfast, lunch, dinner, snack 중 하나여야 합니다.',
      });
    }

    const mealTimestamp = mealTime ? new Date(mealTime) : new Date();
    const aiScanId = uuidv4();

    // 1) ai_scans INSERT
    const scanResult = foods.map((f) => ({
      name: f.name,
      amount: Number(f.amount) || 0,
      calories: Number(f.calories) || 0,
      carbohydrate: Number(f.carbohydrate) || 0,
      protein: Number(f.protein) || 0,
      fat: Number(f.fat) || 0,
      sugars: Number(f.sugars) || 0,
    }));

    await pool.query(
      `INSERT INTO ai_scans (id, user_id, image_url, scan_result, status)
       VALUES ($1, $2, $3, $4, 'COMPLETED')`,
      [aiScanId, userId, '', JSON.stringify(scanResult)],
    );

    // 2) diary_entries INSERT (음식별 1행)
    const insertedIds = [];
    for (const f of foods) {
      const entryId = uuidv4();
      const name = String(f.name ?? '').trim() || '알 수 없는 음식';
      const amount = Math.max(0, Number(f.amount) || 0);
      const calories = Number(f.calories) || 0;
      const carb = Number(f.carbohydrate) || 0;
      const protein = Number(f.protein) || 0;
      const fat = Number(f.fat) || 0;
      const sugars = Number(f.sugars) || 0;

      await pool.query(
        `INSERT INTO diary_entries (
          id, user_id, meal_type, meal_time,
          serving_size, snap_food_name, snap_calories, snap_carbohydrate,
          snap_protein, snap_fat, snap_sugars, image_url,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          entryId,
          userId,
          mealType,
          mealTimestamp,
          amount,
          name,
          calories,
          carb,
          protein,
          fat,
          sugars,
          imageUrl,
        ],
      );
      insertedIds.push(entryId);
    }

    return res.json({
      success: true,
      message: 'AI 식단 분석 기록이 저장되었습니다.',
      data: { aiScanId, diaryEntryIds: insertedIds },
    });
  } catch (err) {
    console.error('Diary scan save error:', err);

    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * [GET] /api/diary/:id
 * 특정 식단 기록 상세 조회
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM diary_entries WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: '기록을 찾을 수 없습니다.' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * [PATCH] /api/diary/:id
 * 특정 식단 기록 수정 (양, 식사 타입, 시간 등)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { serving_size, mealType, mealTime } = req.body;

    const result = await pool.query(
      `UPDATE diary_entries 
             SET serving_size = COALESCE($1, serving_size),
                 meal_type = COALESCE($2, meal_type),
                 meal_time = COALESCE($3, meal_time),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
      [serving_size, mealType, mealTime, id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: '수정할 기록을 찾을 수 없습니다.' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * [DELETE] /api/diary/:id
 * 특정 식단 기록 삭제
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM diary_entries WHERE id = $1 RETURNING id',
      [id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: '삭제할 기록을 찾을 수 없습니다.' });
    }

    return res.json({
      success: true,
      message: '삭제 성공',
      id: result.rows[0].id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
