import express from 'express';
import { getRandomFoodList, recommendFoodsByAI } from '../controllers/recommendController.js';
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();


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
