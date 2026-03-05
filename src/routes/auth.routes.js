import express from "express";
import userController from "../controllers/userController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and management
 */

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