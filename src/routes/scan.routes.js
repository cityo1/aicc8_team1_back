import express from 'express';
import multer from 'multer';
import * as scanController from '../controllers/scanController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('JPEG, PNG, WebP만 업로드 가능합니다.'), false);
  },
});

router.post('/food', upload.single('image'), scanController.analyzeFood);
router.post('/food/reanalyze', express.json(), scanController.reanalyzeFood);

// AI 분석 결과 저장 및 식단 기록 저장 API 추가
router.post('/save-ai', express.json(), scanController.saveAi);
router.post('/save-diary', express.json(), scanController.saveDiary);

export default router;
