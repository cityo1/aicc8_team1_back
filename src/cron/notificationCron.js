import cron from 'node-cron';
import { runMealNudgeJob } from '../services/mealNudgeService.js';
import { runStreakNudgeJob } from '../services/streakNudgeService.js';
import { runInsightSugarFatJob } from '../services/insightSugarFatService.js';
import { runInsightProteinJob } from '../services/insightProteinService.js';
import { runRecommendationTomorrowJob } from '../services/recommendationTomorrowService.js';
import { runRecommendationMenuJob } from '../services/recommendationMenuService.js';
import { runWeeklyReportJob } from '../services/weeklyReportService.js';
import { runGoalAchievementJob } from '../services/goalAchievementService.js';

const TZ = 'Asia/Seoul';

function run(name, fn) {
  return async () => {
    try {
      const r = await fn();
      if (r.sent > 0 || r.reason) {
        console.log(`[cron] ${name}:`, r);
      }
    } catch (e) {
      console.error(`[cron] ${name} 에러:`, e.message);
    }
  };
}

export function startNotificationCron() {
  // 식사 기록 유도: 08:15, 12:45, 19:15
  cron.schedule('15 8 * * *', run('meal-nudge', runMealNudgeJob), { timezone: TZ });
  cron.schedule('45 12 * * *', run('meal-nudge', runMealNudgeJob), { timezone: TZ });
  cron.schedule('15 19 * * *', run('meal-nudge', runMealNudgeJob), { timezone: TZ });

  // 연속 기록 응원: 23:00
  cron.schedule('0 23 * * *', run('streak-nudge', runStreakNudgeJob), { timezone: TZ });

  // 당류/지방 주의: 14:00, 20:30
  cron.schedule('0 14 * * *', run('insight-sugar-fat', runInsightSugarFatJob), { timezone: TZ });
  cron.schedule('30 20 * * *', run('insight-sugar-fat', runInsightSugarFatJob), { timezone: TZ });

  // 단백질 제안: 20:00
  cron.schedule('0 20 * * *', run('insight-protein', runInsightProteinJob), { timezone: TZ });

  // 내일 식단 제안: 20:30
  cron.schedule('30 20 * * *', run('recommendation-tomorrow', runRecommendationTomorrowJob), { timezone: TZ });

  // 메뉴 추천: 11:30, 17:30
  cron.schedule('30 11 * * *', run('recommendation-menu', runRecommendationMenuJob), { timezone: TZ });
  cron.schedule('30 17 * * *', run('recommendation-menu', runRecommendationMenuJob), { timezone: TZ });

  // 주간 리포트: 월 08:30
  cron.schedule('30 8 * * 1', run('weekly-report', runWeeklyReportJob), { timezone: TZ });

  // 목표 달성: 월 08:35
  cron.schedule('35 8 * * 1', run('goal-achievement', runGoalAchievementJob), { timezone: TZ });

  console.log('[cron] 알림 스케줄러 시작 (KST)');
}
