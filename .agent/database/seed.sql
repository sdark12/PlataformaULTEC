Este seed permite que el sistema:

Arranque sin errores

Tenga RBAC definido

Tenga una sede inicial

Tenga un admin operativo

Tenga numeración lista para facturar

Tenga parámetros financieros configurados

Tenga estructura académica base funcional

Tenga arquitectura de calificaciones preparada

1️⃣ Roles Base (RBAC)

Tabla: roles

INSERT INTO roles (id, name, description) VALUES
(1, 'SUPERADMIN', 'Control total del sistema'),
(2, 'ADMIN', 'Administrador de sede'),
(3, 'TEACHER', 'Profesor'),
(4, 'STUDENT', 'Alumno');

2️⃣ Sede Inicial (Branch Principal)

Tabla: branches

INSERT INTO branches (
    id,
    name,
    address,
    phone,
    email,
    tax_id,
    created_at
) VALUES (
    1,
    'Academia Principal',
    'Direccion por definir',
    '00000000',
    'admin@academia.com',
    'CF',
    NOW()
);

3️⃣ Usuario Admin Inicial

Tabla: users

⚠ El password debe ir previamente hasheado (bcrypt/argon2).

INSERT INTO users (
    id,
    branch_id,
    role_id,
    name,
    email,
    password_hash,
    is_active,
    created_at
) VALUES (
    1,
    1,
    1,
    'Administrador General',
    'admin@academia.com',
    '$2b$12$HASH_GENERADO_AQUI',
    TRUE,
    NOW()
);


Nunca almacenar contraseñas en texto plano.

4️⃣ Secuencia de Facturación

Tabla: invoice_sequences

INSERT INTO invoice_sequences (
    id,
    branch_id,
    series,
    current_number,
    created_at
) VALUES (
    1,
    1,
    'A',
    0,
    NOW()
);


Permite emitir la primera factura sin error de numeración.

5️⃣ Configuración Financiera Base

Tabla: system_settings

INSERT INTO system_settings (key, value) VALUES
('tax_rate', '0.00'),
('currency', 'GTQ'),
('invoice_format', '[SERIE]-[YEAR]-[NUMBER]');

6️⃣ Arquitectura Académica Base

Esto es lo nuevo para tu sistema flexible de promedios.

Año Académico Activo

Tabla: academic_years

INSERT INTO academic_years (
    id,
    branch_id,
    name,
    start_date,
    end_date,
    is_active,
    created_at
) VALUES (
    1,
    1,
    'Ciclo Escolar 2026',
    '2026-01-15',
    '2026-11-30',
    TRUE,
    NOW()
);

Periodos Base (4 Bimestres + 2 Semestres)

Tabla: academic_periods

INSERT INTO academic_periods (
    id,
    academic_year_id,
    name,
    type,
    order_index,
    weight
) VALUES
(1, 1, 'Bimestre 1', 'BIMESTER', 1, 0.25),
(2, 1, 'Bimestre 2', 'BIMESTER', 2, 0.25),
(3, 1, 'Bimestre 3', 'BIMESTER', 3, 0.25),
(4, 1, 'Bimestre 4', 'BIMESTER', 4, 0.25),
(5, 1, 'Semestre 1', 'SEMESTER', 1, 0.50),
(6, 1, 'Semestre 2', 'SEMESTER', 2, 0.50);


Esto permite:

Promedio bimestral

Promedio semestral

Promedio anual ponderado

Sin modificar código.

7️⃣ Configuración del Sistema de Notas

Tabla: grading_settings

Define reglas globales.

INSERT INTO grading_settings (
    branch_id,
    grading_scale,
    max_score,
    calculation_method,
    created_at
) VALUES (
    1,
    'NUMERIC',
    100,
    'WEIGHTED_AVERAGE',
    NOW()
);


Esto permite:

Sistema sobre 100

Promedio simple o ponderado configurable

Escalabilidad futura

8️⃣ Permisos Base (Opcional pero Profesional)

Tabla: permissions

INSERT INTO permissions (id, code, description) VALUES
(1, 'CREATE_INVOICE', 'Crear factura'),
(2, 'CANCEL_INVOICE', 'Cancelar factura'),
(3, 'REGISTER_PAYMENT', 'Registrar pago'),
(4, 'MANAGE_ENROLLMENTS', 'Gestionar inscripciones'),
(5, 'MANAGE_GRADES', 'Gestionar calificaciones'),
(6, 'VIEW_REPORTS', 'Ver reportes');


Luego se asignan a roles en tabla role_permissions.

❌ Qué NO debe tener este seed.sql

Cursos falsos

Estudiantes de prueba

Notas inventadas

Facturas simuladas

Pagos ficticios

Eso pertenece a:

dev-seed.sql

🧱 Estructura Profesional Final
database/
│
├── schema.sql
├── seed.sql
├── dev-seed.sql

🔎 Flujo correcto de despliegue

Ejecutar schema.sql

Ejecutar seed.sql

Iniciar backend

Verificar login con admin

Crear datos reales desde la UI

Nunca mezclar schema con seed.