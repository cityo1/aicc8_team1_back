import express from "express";
import userController from "../controllers/userController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and management
 */
// test
/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nickname
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               nickname:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Email already exists
 */
router.post("/register", userController.signup);
router.post("/signup", userController.signup);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", userController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post("/refresh", userController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", userController.logout);

/**
 * @swagger
 * /api/auth/forgot-password/send-code:
 *   post:
 *     summary: 비밀번호 찾기 (인증 코드 이메일 발송)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: 코드 발송 성공
 * /api/auth/forgot-password/verify-code:
 *   post:
 *     summary: 인증 코드 검증
 *     tags: [Auth]
 * /api/auth/forgot-password/reset-password:
 *   post:
 *     summary: 새 비밀번호 설정
 *     tags: [Auth]
 * /api/auth/forgot-password/resend-code:
 *   post:
 *     summary: 인증 코드 재발송
 *     tags: [Auth]
 */
router.post("/forgot-password/send-code", userController.sendPasswordResetCode);
router.post("/forgot-password/verify-code", userController.verifyPasswordResetCode);
router.post("/forgot-password/reset-password", userController.resetPassword);
router.post("/forgot-password/resend-code", userController.resendPasswordResetCode);

// 간단한 인증 미들웨어 (실제로는 jwt.verify를 거치는 별도 미들웨어 파일을 쓰는 것이 좋으나 현재 구조에 맞춰 임시로 작성)
import jwt from "jsonwebtoken";
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        // 테스트의 편의성을 위해 토큰이 없으면 그냥 통과시키지 않고 에러 반환하지만
        // 만약 테스트 목적으로 하드코딩된 user가 필요하다면 아래 주석 해제하여 사용 가능
        // req.user = { id: 'uuid-here' }; return next();
        return res.status(401).json({ success: false, message: "Authorization 헤더에 토큰이 필요합니다." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_secret_key');
        req.user = decoded; // controller에서 req.user.id 사용하도록 주입
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "유효하지 않거나 만료된 토큰입니다." });
    }
};

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: 사용자 정보 조회 (프로필)
 *     tags: [Auth]
 */
router.get("/me", requireAuth, userController.getMyProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: 사용자 정보 수정 (수정하기 버튼)
 *     tags: [Auth]
 */
router.put("/profile", requireAuth, userController.updateMyProfile);

/**
 * @swagger
 * /api/auth/withdraw:
 *   delete:
 *     summary: 회원탈퇴 (접속 불가 처리)
 *     tags: [Auth]
 */
router.delete("/withdraw", requireAuth, userController.withdrawUser);

router.get("/login", (req, res) => {
    res.send("login endpoint alive. Use POST.");
});

router.get("/signup", (req, res) => {
    res.send("signup endpoint alive. Use POST.");
});

router.get("/cookie-test", (req, res) => {
    res.json({ cookies: req.cookies });
});

export default router;