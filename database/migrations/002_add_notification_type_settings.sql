-- 알림 유형별 사용자 설정 (ON/OFF + 시간 등)
-- 실행: psql $DATABASE_URL -f database/migrations/002_add_notification_type_settings.sql

CREATE TABLE IF NOT EXISTS notification_type_settings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, type)
);
