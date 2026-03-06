import express from 'express';
import * as recommendCtrl from '../controllers/recommendController.js';

const router = express.Router();

// POST
router.get('/random', recommendCtrl.getRandomFoods);
router.post('/chat', recommendCtrl.getAiRecommendation);
router.post('/favorite', recommendCtrl.toggleFavorite);

export default router;
