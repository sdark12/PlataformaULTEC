# INSFORGE – Architecture Rules

---

# 1. Arquitectura General

Modelo estructural:

Frontend (Antigravity SPA)
        ↓
API Gateway / Backend Core (Insforge)
        ↓
Módulos de Dominio desacoplados
        ↓
PostgreSQL (DB principal)

Características:

- API REST modular
- Separación estricta por dominios
- Arquitectura preparada para evolucionar a microservicios
- Multi-sede (multi-tenant por branch_id)
- Separación clara entre capa de negocio y persistencia

---

# 2. Organización por Dominios

backend-insforge/
  modules/
    auth/
    users/
    branches/
    courses/
    enrollments/
    attendance/
    billing/
    grading/
    reports/
    audit/

Reglas:

- Cada módulo contiene:
  - controller
  - service
  - repository
  - validator
- No se permite lógica cruzada directa entre módulos.
- Toda comunicación entre módulos se hace vía services.

---

# 3. Principios de Escalabilidad

## 3.1 Base de Datos

- Normalización mínima 3FN.
- Uso de UUID o SERIAL consistente (no mezclar estilos arbitrariamente).
- Soft delete obligatorio en entidades críticas:
  - deleted_at
- Campos estándar:
  - created_at
  - updated_at
  - created_by (cuando aplique)
- Índices obligatorios en:
  - email
  - foreign keys
  - fechas de búsqueda frecuente
  - branch_id

---

## 3.2 Multi-Sede (Multi-Tenant)

- Toda entidad operativa debe tener branch_id.
- Ninguna consulta puede omitir filtro por branch_id.
- SUPERADMIN puede omitir filtro.
- ADMIN solo puede operar su sede.

Nunca confiar en filtro desde frontend.

---

## 3.3 Preparación para Microservicios

La arquitectura permite separar en el futuro:

- billing-service
- grading-service
- auth-service

Sin modificar modelo de datos.

---

# 4. Separación de Dominios de Datos

Separación conceptual obligatoria:

Datos Académicos:
- students
- courses
- enrollments
- grading_periods
- assessments
- grades

Datos Financieros:
- financial_status
- payments
- invoices
- invoice_sequences

Seguridad:
- users
- roles
- permissions
- audit_logs

Ningún módulo financiero puede modificar datos académicos directamente.

---

# 5. Sistema de Calificaciones (Flexible)

## 5.1 Modelo

Enrollment
  → Assessment (rubros con weight_points)
    → Grades

## 5.2 Reglas

- weight_points por periodo deben sumar 100.
- No registrar nota si periodo cerrado.
- score <= max_score.
- No duplicar grade por enrollment + assessment.

## 5.3 Cálculo

Promedio Bimestral:
  SUM(score ponderado por weight)

Promedio Semestral:
  Promedio ponderado de bimestres asociados

Promedio Anual:
  SUM(promedio_periodo * weight_periodo)

El cálculo vive en backend.
Nunca en frontend.

---

# 6. Facturación Empresarial

- Cada sede tiene invoice_sequence independiente.
- Generación de factura dentro de transacción.
- invoice_number único.
- Cancelación no elimina registro.
- Pagos nunca negativos.

Estados financieros:

- PENDING
- PARTIAL
- PAID

---

# 7. Seguridad Empresarial

## 7.1 Autenticación

- Hash bcrypt o argon2.
- JWT con refresh token.
- Expiración obligatoria.
- Revocación posible.

## 7.2 Autorización

- RBAC obligatorio.
- Tabla roles.
- Tabla permissions.
- Tabla role_permissions.

No validar permisos solo en frontend.

---

## 7.3 Protección

- Rate limiting.
- Protección contra SQL injection (queries parametrizadas).
- Logs de acceso.
- Auditoría en tabla audit_logs.
- Validación de payloads (schema validation).

---

# 8. Frontend Architecture (Antigravity)

- Cliente API centralizado.
- Manejo de tokens centralizado.
- Cache con React Query.
- Invalidación de cache tras mutaciones.
- Manejo global de errores.

Nunca:
- Calcular facturas.
- Calcular promedios finales.
- Generar numeración.
- Validar permisos críticos.

Frontend solo consume y visualiza.

---

# 9. Transacciones Obligatorias

Usar transacciones en:

- Crear factura + actualizar secuencia.
- Registrar pago + actualizar estado financiero.
- Cerrar periodo académico.
- Operaciones masivas.

---

# 10. Seed & Migraciones

## schema.sql
Solo estructura.

## seed.sql
Debe incluir:
- Roles base
- Sede inicial
- Admin operativo
- Secuencia de facturación
- Configuración financiera
- Año académico activo
- Periodos base

No incluir datos ficticios.

## dev-seed.sql
Solo para desarrollo.

---

# 11. Auditoría

Registrar en audit_logs:

- Creación / cancelación de factura
- Registro de pago
- Cierre de periodo
- Modificación de notas
- Creación de usuario

---

# 12. Principios No Negociables

1. Reglas de negocio viven en backend.
2. DB protege integridad estructural.
3. Frontend no toma decisiones críticas.
4. Multi-tenant desde el diseño.
5. Nada financiero sin transacción.
6. No mezclar entorno dev con producción.
7. El sistema debe poder crecer sin rehacer arquitectura.

---

END OF DOCUMENT
