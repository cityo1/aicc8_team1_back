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
 *             properties:
 *               userId:
 *                 type: string
 *               foodCode:
 *                 type: string
 *               foodName:
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
            image = null,
            memo = null,
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

        // 5) foods 테이블에서 영양소 정보 가져오기
        const foodRes = await pool.query(
            `SELECT food_name, calories, carbohydrate, protein, fat, sugars, sodium, cholesterol, saturated_fat, trans_fat 
             FROM foods 
             WHERE food_code = $1`,
            [foodCode]
        );

        let snapData = {
            snap_food_name: null,
            snap_calories: null,
            snap_carbohydrate: null,
            snap_protein: null,
            snap_fat: null,
            snap_sugars: null,
            snap_sodium: null,
            snap_cholesterol: null,
            snap_saturated_fat: null,
            snap_trans_fat: null
        };

        if (foodRes.rows.length > 0) {
            const food = foodRes.rows[0];
            // 제공량(servings)을 곱해서 snap_* 에 넣습니다.
            snapData = {
                snap_food_name: food.food_name || null,
                snap_calories: food.calories != null ? (Number(food.calories) * s) : null,
                snap_carbohydrate: food.carbohydrate != null ? (Number(food.carbohydrate) * s) : null,
                snap_protein: food.protein != null ? (Number(food.protein) * s) : null,
                snap_fat: food.fat != null ? (Number(food.fat) * s) : null,
                snap_sugars: food.sugars != null ? (Number(food.sugars) * s) : null,
                snap_sodium: food.sodium != null ? (Number(food.sodium) * s) : null,
                snap_cholesterol: food.cholesterol != null ? (Number(food.cholesterol) * s) : null,
                snap_saturated_fat: food.saturated_fat != null ? (Number(food.saturated_fat) * s) : null,
                snap_trans_fat: food.trans_fat != null ? (Number(food.trans_fat) * s) : null
            };
        }

        // 6) INSERT into diary_entries (가져온 영양소 값 포함)
        const result = await pool.query(
            `INSERT INTO diary_entries (
                id, user_id, food_code, meal_type, amount, meal_time,
                snap_food_name, snap_calories, snap_carbohydrate, snap_protein, 
                snap_fat, snap_sugars, snap_sodium, snap_cholesterol, snap_saturated_fat, snap_trans_fat,
                created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, 
                COALESCE($6::timestamptz, NOW()), 
                $7, $8, $9, $10, 
                $11, $12, $13, $14, $15, $16,
                NOW(), NOW()
            )
            RETURNING *`,
            [
                id,
                userId,
                foodCode,
                mealType,
                s,
                eatenAt,
                snapData.snap_food_name,
                snapData.snap_calories,
                snapData.snap_carbohydrate,
                snapData.snap_protein,
                snapData.snap_fat,
                snapData.snap_sugars,
                snapData.snap_sodium,
                snapData.snap_cholesterol,
                snapData.snap_saturated_fat,
                snapData.snap_trans_fat
            ]
        );

        const newEntry = result.rows[0];

        // Format to perfectly match requested payload returning structure.
        return res.json({
            success: true,
            message: "식단 입력이 완료되었습니다.",
            data: {
                id: newEntry.id,
                user_id: newEntry.user_id,
                ai_scan_id: newEntry.ai_scan_id || null, // Ensure explicit null mapping
                meal_type: newEntry.meal_type,
                meal_time: newEntry.meal_time,
                food_code: newEntry.food_code,
                custom_food_id: newEntry.custom_food_id || null,
                amount: newEntry.amount,
                snap_food_name: newEntry.snap_food_name,
                snap_calories: newEntry.snap_calories,
                snap_carbohydrate: newEntry.snap_carbohydrate,
                snap_protein: newEntry.snap_protein,
                snap_fat: newEntry.snap_fat,
                snap_sugars: newEntry.snap_sugars,
                snap_sodium: newEntry.snap_sodium,
                snap_cholesterol: newEntry.snap_cholesterol,
                snap_saturated_fat: newEntry.snap_saturated_fat,
                snap_trans_fat: newEntry.snap_trans_fat,
                created_at: newEntry.created_at,
                updated_at: newEntry.updated_at,
                deleted_at: newEntry.deleted_at || null
            }
        });

    } catch (err) {
        console.error("Meal POST error:", err);
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