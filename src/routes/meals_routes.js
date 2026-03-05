import express from "express";
import { pool } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();



/**
 * @swagger
 * tags:
 *   name: Meals
 *   description: Meal logging and nutrition
 */

/**
 * @swagger
 * /api/meals/search:
 *   get:
 *     summary: Search for food by name in the local database
 *     tags: [Meals]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Food name to search for
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Missing query
 */
router.get("/search", async (req, res) => {
    try {
        const { query, limit = 20 } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, message: "검색어(query)가 필요합니다." });
        }

        // Search the local foods table
        const dbQuery = `
            SELECT food_code, food_name, manufacturer, category, serving_size, 
                   calories, carbohydrate, protein, fat, sugars, sodium
            FROM foods
            WHERE food_name ILIKE $1
            LIMIT $2
        `;
        const result = await pool.query(dbQuery, [`%${query}%`, limit]);

        return res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        console.error("Local food search error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * @swagger
 * /api/meals:
 *   post:
 *     summary: Log a meal
 *     tags: [Meals]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - foodCode
 *             properties:
 *               userId:
 *                 type: string
 *               foodCode:
 *                 type: string
 *               servings:
 *                 type: number
 *                 default: 1
 *               mealType:
 *                 type: string
 *                 enum: [breakfast, lunch, dinner, snack]
 *               eatenAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Meal logged successful
 *       400:
 *         description: Invalid input
 */
router.post("/", async (req, res) => {
    try {
        const {
            userId,
            foodCode,
            servings = 1,
            mealType = null,
            eatenAt = null,
            note = null,
        } = req.body;

        // 1) 필수값 체크
        if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
        if (!foodCode) return res.status(400).json({ success: false, message: "foodCode is required" });

        // 2) servings 숫자 체크
        const s = Number(servings);
        if (Number.isNaN(s) || s <= 0) {
            return res.status(400).json({ success: false, message: "servings must be > 0" });
        }

        // 3) mealType 체크(선택)
        const allowed = ["breakfast", "lunch", "dinner", "snack", null];
        if (!allowed.includes(mealType)) {
            return res.status(400).json({
                success: false,
                message: "mealType must be one of breakfast/lunch/dinner/snack",
            });
        }

        // 4) UUID 생성 (DB에서 안 만들고 Node에서 만듦)
        const id = uuidv4();

        // 5) INSERT into diary_entries
        const result = await pool.query(
            `INSERT INTO diary_entries (id, user_id, food_code, meal_type, amount, meal_time)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
       RETURNING *`,
            [id, userId, foodCode, mealType, s, eatenAt]
        );

        const newEntry = result.rows[0];

        return res.json({
            success: true,
            message: "식단 입력이 완료되었습니다.",
            data: newEntry
        });
    } catch (err) {
        console.error(err);
        // Foreign key violation check (e.g. food_code not found in foods table)
        if (err.code === '23503') {
            return res.status(400).json({
                success: false,
                message: "존재하지 않는 foodCode 또는 userId입니다. (외래키 제약 조건 위반)"
            });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;