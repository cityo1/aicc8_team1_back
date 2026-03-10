-- 식사 패턴 컬럼 추가 (아침/점심/저녁 평소 식사 시간)
-- 실행: psql $DATABASE_URL -f database/migrations/001_add_meal_pattern.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS breakfast_time TIME DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS lunch_time TIME DEFAULT '12:30',
  ADD COLUMN IF NOT EXISTS dinner_time TIME DEFAULT '19:00';
