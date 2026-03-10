import express from "express";
import { getNotifications, readNotification, updateSettings, getSettings } from "../controllers/notificationsController.js";
import { getPattern, updatePattern } from "../controllers/mealPatternController.js";
import {
  getSettings as getNotificationTypeSettings,
  updateSettings as updateNotificationTypeSettings,
} from "../controllers/notificationTypeSettingsController.js";
import { runMealNudgeJob } from "../services/mealNudgeService.js";
import { runStreakNudgeJob } from "../services/streakNudgeService.js";
import { runInsightSugarFatJob } from "../services/insightSugarFatService.js";
import { runInsightProteinJob } from "../services/insightProteinService.js";
import { runRecommendationTomorrowJob } from "../services/recommendationTomorrowService.js";
import { runRecommendationMenuJob } from "../services/recommendationMenuService.js";
import { runWeeklyReportJob } from "../services/weeklyReportService.js";
import { runGoalAchievementJob } from "../services/goalAchievementService.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

/** cron 전용: CRON_SECRET 있으면 X-Cron-Secret 헤더 일치 필요 */
const cronAuth = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
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
 * POST /api/notifications/test
 * 테스트용: 현재 로그인한 사용자에게 샘플 알림 3개 생성 (시간 제한 없음)
 */
router.post("/test", requireAuth, async (req, res) => {
  try {
    const { createNotification } = await import("../models/notificationsModel.js");
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "인증 필요" });

    const samples = [
      { type: "recommendation_menu", title: "메뉴 추천", message: "오늘 메뉴 고민되시죠? 담백하고 균형 잡힌 '샐러드와 닭가슴살' 레시피를 확인해보세요." },
      { type: "insight_protein", title: "단백질 채우기", message: "오늘 목표 단백질까지 20g 남았어요! 간식으로 삶은 계란이나 두유 어떠세요? 💪" },
      { type: "weekly_report", title: "주간 리포트", message: "지난주 'HoneyMat' 리포트가 도착했습니다! 영양 점수를 확인해보세요. 📈" },
    ];
    for (const s of samples) {
      await createNotification({ userId, ...s });
    }
    return res.status(200).json({ success: true, message: "테스트 알림 3개 생성됨" });
  } catch (error) {
    console.error("test 알림 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

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

/**
 * POST /api/notifications/jobs/meal-nudge
 * 식사 기록 유도 알림 배치 (cron에서 15~30분마다 호출)
 * 헤더: X-Cron-Secret (CRON_SECRET 설정 시 필수)
 */
router.post("/jobs/meal-nudge", cronAuth, async (req, res) => {
  try {
    const result = await runMealNudgeJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("meal-nudge job 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/jobs/streak-nudge
 * 연속 기록 응원 알림 배치 (cron에서 1일 1회, 예: 23:00 호출)
 */
router.post("/jobs/streak-nudge", cronAuth, async (req, res) => {
  try {
    const result = await runStreakNudgeJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("streak-nudge job 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/jobs/insight-sugar-fat
 * 당류/지방 주의 알림 배치 (cron에서 14:00, 20:30 등 식사 후 호출)
 */
router.post("/jobs/insight-sugar-fat", cronAuth, async (req, res) => {
  try {
    const result = await runInsightSugarFatJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("insight-sugar-fat job 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/jobs/insight-protein
 * 단백질 채우기 제안 알림 배치 (저녁 19:00~22:00, cron에서 1회 호출)
 */
router.post("/jobs/insight-protein", cronAuth, async (req, res) => {
  try {
    const result = await runInsightProteinJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("insight-protein job 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/jobs/recommendation-tomorrow
 * 내일의 식단 제안 알림 배치 (저녁 20:00~22:00)
 */
router.post("/jobs/recommendation-tomorrow", cronAuth, async (req, res) => {
  try {
    const result = await runRecommendationTomorrowJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("recommendation-tomorrow job 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/jobs/recommendation-menu
 * 메뉴 고민 해결 알림 (날씨 연동, 11:00~12:00 / 17:00~18:00)
 */
router.post("/jobs/recommendation-menu", cronAuth, async (req, res) => {
  try {
    const result = await runRecommendationMenuJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("recommendation-menu job 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/jobs/weekly-report
 * 주간 리포트 발행 알림 (월요일 08:00~10:00)
 */
router.post("/jobs/weekly-report", cronAuth, async (req, res) => {
  try {
    const result = await runWeeklyReportJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("weekly-report job 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/jobs/goal-achievement
 * 목표 달성 축하 알림 (월요일 08:00~10:00)
 */
router.post("/jobs/goal-achievement", cronAuth, async (req, res) => {
  try {
    const result = await runGoalAchievementJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("goal-achievement job 에러:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

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
settingsRouter.get("/me/meal-pattern", requireAuth, getPattern);
settingsRouter.put("/me/meal-pattern", requireAuth, updatePattern);
settingsRouter.get("/me/notification-type-settings", requireAuth, getNotificationTypeSettings);
settingsRouter.put("/me/notification-type-settings", requireAuth, updateNotificationTypeSettings);
