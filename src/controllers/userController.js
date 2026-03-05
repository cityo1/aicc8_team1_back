import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import {
    findUserByEmail, findUserByNickname, createUser,
    savePasswordResetCode, findPasswordResetInfo,
    savePasswordResetToken, updateUserPassword
} from "../models/userModel.js";
import { sendVerificationEmail } from "../services/emailService.js";





// require('dotenv').config(); // Removed for ES module compatibility/redundancy

const signup = async (req, res) => {
    try {
        const {
            email, password, nickname,
            gender, age_group, height, weight, goals, dietary_restrictions
        } = req.body;

        // 필수 값 검증
        if (!email || !password || !nickname) {
            return res.status(400).json({ message: "이메일, 비밀번호, 닉네임은 필수입니다." });
        }

        // 이메일 중복 확인
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: "이미 가입된 이메일입니다." });
        }

        // 비밀번호 해싱
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // UUIDv4 생성
        const userId = uuidv4();

        // 사용자 생성 (DB 저장)
        const newUser = await createUser(
            userId, email, passwordHash, nickname,
            gender, age_group, height, weight, goals, dietary_restrictions
        );

        // 비밀번호 해시 제외 후 반환
        res.status(201).json({
            message: "회원가입이 완료되었습니다.",
            user: {
                id: newUser.id,
                email: newUser.email,
                nickname: newUser.nickname,
                gender: newUser.gender,
                ageGroup: newUser.age_group,
                height: newUser.height,
                weight: newUser.weight,
                goals: newUser.goals,
                dietaryRestrictions: newUser.dietary_restrictions,
                createdAt: newUser.created_at
            }
        });
    } catch (error) {
        console.error("signup 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};

const login = async (req, res) => {

    try {
        const { email, password } = req.body;

        // 필수 값 검증
        if (!email || !password) {
            return res.status(400).json({ message: "이메일과 비밀번호를 입력해주세요." });
        }

        // 사용자 조회
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
        }

        // 비밀번호 검증
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
        }
        // JWT 발급 (Access + Refresh)
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, nickname: user.nickname },
            process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '14d' }
        );

        // ✅ refreshToken은 쿠키에 저장 (httpOnly)
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,   // HTTPS면 true
            sameSite: 'lax',
            maxAge: 14 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: "로그인 성공",
            token: accessToken, // ✅ accessToken만 내려줌
            user: {
                id: user.id,
                email: user.email,
                nickname: user.nickname
            }
        });

    } catch (error) {
        console.error("login 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};
// login 함수 끝난 다음 줄에 그대로 붙여넣기
const refresh = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) return res.status(401).json({ message: "refreshToken 없음" });

        const decoded = jwt.verify(
            token,
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "fallback_secret_key"
        );

        // ✅ userModel에 findUserById 없으면 아래 줄을 email 기반으로 바꿔야 함 (아래 참고)
        const user = await findUserByEmail(decoded.email);
        if (!user) return res.status(401).json({ message: "유저 없음" });

        const newAccessToken = jwt.sign(
            { id: user.id, email: user.email, nickname: user.nickname },
            process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "fallback_secret_key",
            { expiresIn: "15m" }
        );

        return res.status(200).json({ message: "토큰 재발급 성공", token: newAccessToken });
    } catch (e) {
        return res.status(401).json({ message: "refreshToken 만료/위조" });
    }
};

const logout = async (req, res) => {
    res.clearCookie("refreshToken", { httpOnly: true, sameSite: "lax", secure: false });
    return res.status(200).json({ message: "로그아웃 완료" });
}; const getUsers = async (req, res) => {
    try {
        res.status(200).json({ message: "Get users success (placeholder)" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Step 0: 이메일 입력 → 인증 코드 발송 / 재전송 (동일 로직)
const sendPasswordResetCode = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "이메일을 입력해주세요." });

        const user = await findUserByEmail(email);
        if (!user) return res.status(404).json({ message: "가입되지 않은 이메일입니다." });

        // 6자리 인증 코드 생성
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // 5분 후 만료 시간 설정
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await savePasswordResetCode(email, code, expiresAt);
        await sendVerificationEmail(email, code);

        return res.status(200).json({ message: "인증 코드가 이메일로 발송되었습니다." });
    } catch (error) {
        console.error("sendPasswordResetCode 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};

// Step 1: 인증 코드 검증 → 토큰 발급
const verifyPasswordResetCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ message: "이메일과 인증 코드를 입력해주세요." });

        const info = await findPasswordResetInfo(email);
        if (!info || info.code !== code) {
            return res.status(400).json({ message: "인증 코드가 일치하지 않습니다." });
        }

        if (new Date(info.expires_at) < new Date()) {
            return res.status(400).json({ message: "만료된 인증 코드입니다." });
        }

        // 인증 성공 시 30분 유효한 resetToken 발급
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

        await savePasswordResetToken(email, resetToken, tokenExpiresAt);

        return res.status(200).json({
            message: "인증이 완료되었습니다.",
            resetToken
        });
    } catch (error) {
        console.error("verifyPasswordResetCode 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};

// Step 2: 새 비밀번호 설정
const resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;
        if (!resetToken || !newPassword) {
            return res.status(400).json({ message: "재설정 토큰과 새 비밀번호를 입력해주세요." });
        }

        // 모든 password_resets 조회 (토큰을 기반으로 사용자 찾기 위해)
        // 실제로는 토큰으로 조회하는 함수를 만들면 더 좋으나, 코드를 간단하게 하기 위해 클라이언트에서 받는다고 가정하거나, 토큰으로 DB 조회.
        const poolQuery = await import("../config/db.js");
        const { rows } = await poolQuery.pool.query('SELECT * FROM password_resets WHERE reset_token = $1', [resetToken]);

        if (rows.length === 0) {
            return res.status(400).json({ message: "유효하지 않은 재설정 정보입니다." });
        }

        const info = rows[0];
        if (new Date(info.expires_at) < new Date()) {
            return res.status(400).json({ message: "시간이 초과되었습니다. 처음부터 다시 진행해주세요." });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        await updateUserPassword(info.email, passwordHash);

        return res.status(200).json({ message: "비밀번호가 성공적으로 변경되었습니다." });
    } catch (error) {
        console.error("resetPassword 에러:", error);
        res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
};

export default {
    signup,
    login,
    refresh,
    logout,
    getUsers,
    sendPasswordResetCode,
    verifyPasswordResetCode,
    resetPassword,
    resendPasswordResetCode: sendPasswordResetCode // Step 0 함수 재사용
};