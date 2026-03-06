-- Fix missing foreign keys
DO $$
BEGIN
    -- Add constraint to payments
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payments_student_id_fkey'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
    END IF;

    -- Add constraint to invoices
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_student_id_fkey'
    ) THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Reload PostgREST schema cache so it detects the new foreign keys
NOTIFY pgrst, 'reload schema';
