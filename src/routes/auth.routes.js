import express from "express";
import userController from "../controllers/userController.js";

const router = express.Router();

// ✅ /api/auth/register 도 회원가입으로 받게 “별칭” 추가
router.post("/register", userController.signup);

// [POST] /api/auth/signup
router.post("/signup", userController.signup);

// [POST] /api/auth/login
router.post("/login", userController.login);

router.post("/refresh", userController.refresh);
router.post("/logout", userController.logout);

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