import express from "express";
import { pool } from "../config/db.js";

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
router.get("/daily", async (req, res) => {
    try {
        const { userId, date } = req.query;

        if (!userId || !date) {
            return res.status(400).json({ success: false, message: "userId와 date는 필수입니다." });
        }

        const query = `
            SELECT de.*, f.food_name, f.calories, f.carbohydrate, f.protein, f.fat
            FROM diary_entries de
            LEFT JOIN foods f ON de.food_code = f.food_code
            WHERE de.user_id = $1 AND DATE(de.meal_time) = $2
            ORDER BY de.meal_time ASC
        `;
        const result = await pool.query(query, [userId, date]);

        return res.json({ success: true, count: result.rows.length, data: result.rows });
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
router.get("/meal-summary", async (req, res) => {
    try {
        const { userId, date, mealType } = req.query;

        if (!userId || !date || !mealType) {
            return res.status(400).json({ success: false, message: "userId, date, mealType는 필수입니다." });
        }

        const query = `
            SELECT 
                d.meal_type,
                d.amount,
                f.food_name, 
                (f.calories * d.amount) AS total_calories,
                (f.carbohydrate * d.amount) AS total_carbs,
                (f.protein * d.amount) AS total_protein,
                (f.fat * d.amount) AS total_fat,
                (f.sugars * d.amount) AS total_sugars
            FROM diary_entries d
            JOIN foods f ON d.food_code = f.food_code
            WHERE d.user_id = $1 
              AND d.meal_type = $2
              AND DATE(d.meal_time) = $3;
        `;
        const result = await pool.query(query, [userId, mealType, date]);

        return res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * [GET] /api/diary/:id
 * 특정 식단 기록 상세 조회
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM diary_entries WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "기록을 찾을 수 없습니다." });
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
router.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, mealType, mealTime } = req.body;

        const result = await pool.query(
            `UPDATE diary_entries 
             SET amount = COALESCE($1, amount),
                 meal_type = COALESCE($2, meal_type),
                 meal_time = COALESCE($3, meal_time),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [amount, mealType, mealTime, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "수정할 기록을 찾을 수 없습니다." });
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
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM diary_entries WHERE id = $1 RETURNING id", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "삭제할 기록을 찾을 수 없습니다." });
        }

        return res.json({ success: true, message: "삭제 성공", id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
