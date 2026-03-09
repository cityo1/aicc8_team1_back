// src/routes/recommendRoutes.js
import express from 'express';
import { getChatRecommendation } from '../controllers/recommendController.js';

const router = express.Router();

// 1. 챗봇용 POST 경로 (이미 있는 것)
router.post('/', getChatRecommendation);

// 2. 초기 로드용 GET 경로 추가 (테스트 및 초기 데이터용)
router.get('/random', (req, res) => {
  // 임시 더미 데이터 또는 DB에서 랜덤 추출 로직
  res.json({
    success: true,
    foods: [
      {
        id: 999,
        name: '연어 샐러드',
        calories: 210,
        tags: ['다이어트', '고단백'],
      },
    ],
  });
});

export default router;
