Plataforma Academia – Orquestador General

1. Propósito

Este documento define la orquestación total del sistema:

Infraestructura

Seguridad

Flujo académico

Flujo financiero

Facturación

Integración frontend

Gobernanza de cambios

Este documento NO redefine arquitectura.
Referencia oficialmente los siguientes archivos:

2. Documentos Dependientes

Arquitectura:

docs/architecture/system-architecture.md

docs/architecture/backend-architecture.md

docs/architecture/frontend-architecture.md

docs/architecture/billing-architecture.md

Base de datos:

database/schema.sql

database/seed.sql

3. Arquitectura Global Actual
Antigravity (UI)
    ↓
Stitch (API Client + Cache Layer estilo React Query)
    ↓
backend-insforge
    ↓
PostgreSQL (Database)


Separación estricta:

UI no maneja tokens.

UI no hace fetch manual.

Backend no conoce cache.

DB no contiene lógica de negocio.

4. Fases de Activación del Sistema
FASE 1 — Infraestructura Base

Referencia:

backend-architecture.md

schema.sql

seed.sql

Secuencia:

Crear base de datos.

Ejecutar schema.sql.

Ejecutar seed.sql.

Levantar backend-insforge.

Verificar conexión DB.

Probar endpoint /health.

Estado esperado:
Sistema autenticable con ADMIN inicial.

FASE 2 — Inicialización Frontend

Referencia:

frontend-architecture.md

Secuencia:

Configurar Stitch como cliente API.

Configurar QueryClient.

Definir Query Keys globales.

Configurar interceptores de autenticación.

Implementar Provider global de Query.

Resultado:
Frontend preparado para consumir backend con cache inteligente.

FASE 3 — Autenticación

Flujo:

Antigravity → Stitch → Backend → DB

Secuencia:

Usuario envía credenciales.

Stitch ejecuta mutation login.

Backend valida usuario.

Backend genera JWT.

Stitch almacena token seguro.

Stitch invalida cache global si es necesario.

UI se actualiza automáticamente.

Regla:
QueryClient debe resetearse en logout.

FASE 4 — Activación Académica

Referencia:

schema.sql

backend-architecture.md

Flujo:

Crear curso.

Registrar alumno.

Crear enrollment.

Generar financial_status automático.

Registrar auditoría.

Frontend:

useMutation()

invalidar ['students', branchId]

invalidar ['enrollments', branchId]

FASE 5 — Registro de Pago

Referencia:

billing-architecture.md

Flujo transaccional backend:

Validar enrollment.

Insertar payment.

Actualizar financial_status.

Registrar auditoría.

Commit.

Frontend:

useMutation(registerPayment)

invalidar:

['financialStatus', branchId]

['payments', branchId]

Nunca invalidación global.

FASE 6 — Facturación

Referencia directa:

billing-architecture.md

Flujo backend (transacción obligatoria):

Lock invoice_sequences.

Incrementar correlativo.

Crear invoice.

Crear invoice_items.

Commit.

Generar PDF.

Registrar auditoría.

Frontend:

mutation issueInvoice

invalidar ['invoices', branchId]

Resultado:
Factura numerada formalmente.

FASE 7 — Asistencia

Flujo:

Registrar asistencia por curso.

Insertar attendance.

Commit.

Registrar auditoría.

Frontend:

mutation registerAttendance

invalidar ['attendance', branchId, courseId]

FASE 8 — Reportes

Backend:

Queries agregadas

Filtros por branch_id obligatorios

Frontend:

Queries con staleTime configurable

No invalidación innecesaria

Refetch manual solo en acciones críticas

5. Reglas Globales del Sistema

Toda operación crítica debe:

Validar JWT.

Validar rol.

Validar branch_id.

Ejecutarse en transacción.

Registrar auditoría.

Devolver respuesta normalizada.

Frontend debe:

Usar Stitch exclusivamente.

Usar cache tipo React Query.

No hacer fetch manual.

No almacenar estado remoto en store global.

6. Flujo Integral Consolidado
AUTH
 ↓
BRANCH VALIDATION
 ↓
COURSE MANAGEMENT
 ↓
ENROLLMENT
 ↓
FINANCIAL STATUS
 ↓
PAYMENT
 ↓
INVOICE
 ↓
PDF
 ↓
AUDIT LOG


Frontend siempre gestionado por:

Query → Cache → Invalidación selectiva → UI reactiva

7. Estado de Sistema Operativo Completo

El sistema se considera productivo cuando:

ADMIN puede autenticarse.

Se pueden crear cursos.

Se pueden inscribir alumnos.

Se pueden registrar pagos.

Se puede emitir factura con numeración.

Se genera PDF.

Auditoría funcional.

Cache funcionando sin inconsistencias.

8. Gobernanza de Cambios

Si se modifica:

schema.sql → revisar Fases 4–8.

billing-architecture.md → revisar Fases 5–6.

frontend-architecture.md → revisar Fase 2.

backend-architecture.md → revisar todas las fases.

Este documento coordina todos los módulos.