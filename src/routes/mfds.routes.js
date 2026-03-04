import express from "express";
import { searchFoodByName } from "../services/mfdsService.js";

const router = express.Router();

// GET /api/mfds/search?query=우유&page=1&size=20
router.get("/search", async (req, res) => {
    try {
        const { query, page, size } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, message: "query가 필요해요" });
        }

        const data = await searchFoodByName(query, Number(page || 1), Number(size || 20));
        return res.json({ success: true, data });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "식약처 API 호출 실패" });
    }
});

export default router;