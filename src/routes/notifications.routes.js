import express from "express";
import { getNotifications, readNotification, updateSettings, getSettings } from "../controllers/notificationsController.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// 앞서 auth.routes.js에 만든 것과 동일한 임시 인증 로직 재사용
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authorization 헤더에 토큰이 필요합니다." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_secret_key');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "유효하지 않거나 만료된 토큰입니다." });
    }
};

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: 알림 목록 조회
 *     tags: [Notifications]
 */
router.get("/", requireAuth, getNotifications);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: 알림 읽음 처리
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.patch("/:id/read", requireAuth, readNotification);

// 참고: /api/users/me/notification-settings 경로는 보통 users 라우터나 auth 라우터에 두지만, 
// 현재 알림 관련 컨트롤러로 모았으므로 /api/notifications/settings 등으로 노출하거나 
// index.js에서 /api/users 경로에 추가 매핑을 할 수 있습니다. 
// 명세서 상 /api/users/me/notification-settings 이므로 라우터에서 다음과 같이 처리할 수도 있습니다.
// 
// 하지만 일관성을 위해 index.js에서 분리하여 매핑합니다. (아래 코드는 보통 /api/users 에 연결됨)

export default router;
export const settingsRouter = express.Router();

settingsRouter.get("/me/notification-settings", requireAuth, getSettings);
settingsRouter.put("/me/notification-settings", requireAuth, updateSettings);
