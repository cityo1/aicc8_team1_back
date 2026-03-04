import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { findUserByEmail, findUserByNickname, createUser } from "../models/userModel.js";





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

export default {
    signup,
    login,
    refresh,
    logout,
    getUsers
};