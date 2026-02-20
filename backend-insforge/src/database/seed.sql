-- ROLES
INSERT INTO roles (id, name, description) VALUES
(1, 'SUPERADMIN', 'Control total del sistema'),
(2, 'ADMIN', 'Administrador de sede'),
(3, 'TEACHER', 'Profesor'),
(4, 'STUDENT', 'Alumno')
ON CONFLICT (id) DO NOTHING;

-- BRANCHES
INSERT INTO branches (id, name, address, phone, email, tax_id, created_at) VALUES 
(1, 'Academia Principal', 'Direccion por definir', '00000000', 'admin@academia.com', 'CF', NOW())
ON CONFLICT (id) DO NOTHING;

-- USERS
-- Password: password123 (hashed) - Placeholder, should be properly hashed in production
INSERT INTO users (id, branch_id, role_id, full_name, email, password_hash, is_active, created_at) VALUES 
(1, 1, 1, 'Administrador General', 'admin@academia.com', '$2b$10$EpIxNwllqgWkLpX8q.8Ouu7/2/.8Op/2/.8Op/2/.8Op/2/.8Op', TRUE, NOW())
ON CONFLICT (id) DO NOTHING;

-- INVOICE SEQUENCES
INSERT INTO invoice_sequences (id, branch_id, series, current_number, created_at) VALUES 
(1, 1, 'A', 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- ACADEMIC YEARS
INSERT INTO academic_years (id, branch_id, year, is_active, created_at) VALUES 
(1, 1, 2026, TRUE, NOW())
ON CONFLICT (id) DO NOTHING;

-- GRADING PERIODS
INSERT INTO grading_periods (id, academic_year_id, name, period_type, order_index, start_date, end_date, is_closed) VALUES
(1, 1, 'Bimestre 1', 'BIMESTER', 1, NULL, NULL, FALSE),
(2, 1, 'Bimestre 2', 'BIMESTER', 2, NULL, NULL, FALSE),
(3, 1, 'Bimestre 3', 'BIMESTER', 3, NULL, NULL, FALSE),
(4, 1, 'Bimestre 4', 'BIMESTER', 4, NULL, NULL, FALSE),
(5, 1, 'Semestre 1', 'SEMESTER', 1, NULL, NULL, FALSE),
(6, 1, 'Semestre 2', 'SEMESTER', 1, NULL, NULL, FALSE)
ON CONFLICT (id) DO NOTHING;
