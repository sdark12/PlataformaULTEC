-- Script to add a unique index to prevent duplicate tuition payments
-- This ensures a student (via enrollment_id) cannot map to the same tuition_month twice for 'TUITION' payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tuition_payment ON payments(enrollment_id, tuition_month) WHERE payment_type = 'TUITION';
