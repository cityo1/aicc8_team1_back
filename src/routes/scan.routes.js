import express from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import s3 from '../config/s3.js';
import * as scanController from '../controllers/scanController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// AI 분석용 (메모리 - base64로 OpenAI 전달)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('JPEG, PNG, WebP만 업로드 가능합니다.'), false);
  },
});

// save-ai용: S3 버킷에 저장, DB에는 S3 URL 저장
const uploadDisk = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `scans/scan-${uniqueSuffix}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('JPEG, PNG, WebP만 업로드 가능합니다.'), false);
  },
});

router.post('/food', uploadDisk.single('image'), scanController.analyzeFood);
router.post('/food/reanalyze', express.json(), scanController.reanalyzeFood);

// AI 분석 결과 저장 - FormData(image, user_id, scan_result) → uploads에 저장, DB에 경로 저장
// router.post('/save-ai', requireAuth, uploadDisk.single('image'), scanController.saveAi);
router.post('/save-diary', requireAuth, uploadDisk.single('image'), scanController.saveDiary);

export default router;
