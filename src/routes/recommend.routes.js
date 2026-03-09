import express from 'express';
import { getRandomFoodList, recommendFoodsByAI } from '../controllers/recommendController.js';
import jwt from "jsonwebtoken";

const router = express.Router();

const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authorization 헤더에 토큰이 필요합니다." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_secret_key');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "유효하지 않거나 만료된 토큰입니다." });
    }
};

/**
 * @swagger
 * /api/recommend/random:
 *   get:
 *     summary: 초기 랜덤 식단 조회
 *     tags: [Recommend]
 */
router.get('/random', getRandomFoodList);

/**
 * @swagger
 * /api/recommendation/save:
 *   post:
 *     summary: AI 챗봇 식단 추천 (키워드 추출 후 DB 검색 매핑) 및 저장
 *     tags: [Recommend]
 */
// 주의: requireAuth에 의해 사용자가 로그인(토큰 존재)되어 있어야 합니다.
router.post('/save', requireAuth, recommendFoodsByAI);

export default router;
