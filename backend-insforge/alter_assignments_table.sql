-- Execute this query in your Supabase SQL Editor
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES course_schedules(id) ON DELETE SET NULL;
