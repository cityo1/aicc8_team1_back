import express from "express";
import { getNotifications, readNotification, updateSettings, getSettings } from "../controllers/notificationsController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();


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
