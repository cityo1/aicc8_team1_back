import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import s3 from "../config/s3.js";

const uploadProfileImage = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    key: function (req, file, cb) {
      const userId = req.user ? req.user.id : "guest";
      const ext = path.extname(file.originalname);
      // S3 버킷 내의 profile 폴더에 저장
      cb(null, `profile/user_${userId}_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다."));
    }
  },
});

export { uploadProfileImage };
