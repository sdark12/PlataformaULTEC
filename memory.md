# MEMORY.md — Base de Conocimiento y Memoria Operativa de Plataforma ULTEC

> **REGLA DE ORO DE DESARROLLO (MANDATORY OPERATIONAL RULE):**
> 1. **Instrucciones Rápidas y Estándares de Codificación:** Consultar [`AGENTS.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/AGENTS.md) para comandos de compilación, convenciones de arquitectura y límites de seguridad del sistema.
> 2. **Memoria Operativa e Histórica:** Este archivo (`memory.md`) almacena la bitácora de despliegues, infraestructura VPS en vivo, topología Docker y estado de la Hoja de Ruta institucional.
> 3. **Actualización Continua:** Al concluir cada fase de trabajo, corregir un bug de infraestructura o agregar una nueva característica, este archivo DEBE ser actualizado con el nuevo estado, versión y lecciones aprendidas.

---

## 1. Visión General del Proyecto
- **Nombre:** Plataforma ULTEC (Ultra Tecnología)
- **Propósito:** Sistema Integral de Gestión Académica, Administrativa y Financiera (ERP + LMS) institucional para centros de formación técnica, educación secundaria y bachillerato.
- **Entorno de Ejecución:** Sistema en producción en vivo con estudiantes reales, expedientes académicos, control financiero y sedes activas.
- **Ruta Local del Proyecto:** `C:\Users\saul_\.gemini\antigravity\scratch\PlataformaULTEC`
- **Versión Activa Actual:** **`v1.2.1` (Build 35)** — Desplegada en producción el 30 de Septiembre de 2026.

---

## 2. Infraestructura de Producción (VPS)

### 2.1 Datos de Acceso y Red
- **Proveedor:** Oracle Cloud Infrastructure (OCI) / VPS Ubuntu Server (1 core, 6 GB RAM, disco NVMe).
- **IP Pública:** `129.213.56.16`
- **Dominio Público Oficial:** `https://plataformaultec.duckdns.org`
- **Usuario SSH:** `ubuntu`
- **Clave SSH Privada:** `C:\Users\saul_\Downloads\Claves SSH\ULTECssh-key-2026-09-12.key`
- **Comando de Conexión:**
  ```powershell
  ssh -i "C:\Users\saul_\Downloads\Claves SSH\ULTECssh-key-2026-09-12.key" -o StrictHostKeyChecking=no ubuntu@129.213.56.16
  ```

### 2.2 Topología Docker en VPS
Todos los servicios se ejecutan en contenedores Docker gestionados mediante Docker Compose y el stack de Supabase self-hosted:
- **`ultec-frontend`:** Contenedor Nginx sirviendo la SPA/PWA construida con Vite en el puerto interno `8080` (mapeado al host), además de alojar los APKs móviles en `/usr/share/nginx/html/downloads/`.
- **`ultec-backend`:** API REST en Node.js + Express + TypeScript escuchando en puerto interno `4000`.
- **`supabase-db`:** Motor PostgreSQL 15. Contenedor principal de persistencia de datos.
- **`supabase-pooler`:** Supavisor Connection Pooler (puertos `5432` y `6543`).
- **`realtime-dev.supabase-realtime`:** Servidor Elixir/BEAM para suscripciones y WebSocket en tiempo real.
- **`supabase-auth`:** GoTrue microservicio para autenticación e inicio de sesión.
- **`supabase-rest`:** PostgREST API sobre PostgreSQL.
- **`supabase-storage`:** Almacenamiento de archivos y medios.
- **`supabase-studio`:** Panel web administrativo de Supabase en puerto `3000`.
- **Host Nginx:** Proxy inverso maestro del VPS configurado con certificados SSL Let's Encrypt para `plataformaultec.duckdns.org`.

---

## 3. Stack Tecnológico y Estructura del Código

### 3.1 Frontend (`frontend-antigravity/`)
- **Core:** React 19 + TypeScript + Vite 7.
- **Estilos:** TailwindCSS 3 con tema oscuro/claro persistente (`isDarkMode` en `localStorage`).
- **Gestión de Estado y Servidor:** `@tanstack/react-query` v5 para caché reactiva e invalidación automática.
- **Iconos y UI:** `lucide-react`, ventanas modales con portales nativos (`ConfirmModal`).
- **Empaquetado Móvil:** Capacitor Android 7 (`com.plataformaultec.app`), compatible con PWA (Service Worker autogenerado vía `vite-plugin-pwa`).
- **Cliente HTTP Central:** [`apiClient.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/services/apiClient.ts) — Interceptor de Axios que agrega automáticamente el token Bearer y la cabecera `X-Branch-Id` desde `BranchContext`.
- **Contextos Clave:**
  - `BranchContext.tsx`: Gestión global de sedes, alternancia de ámbito para SuperAdmin y refresco automático de consultas. La consulta de sedes está estrictamente protegida con `enabled: hasAuth` (`!!token && !!user`) para no dispararse en páginas públicas o antes del inicio de sesión.
  - `UpdateContext.tsx`: Detección en segundo plano de nuevas versiones del APK y modal de actualización para Android.
  - `IdleTimerContext.tsx`: Cierre de sesión automático por inactividad tras 20 minutos de inactividad.
- **Blindaje Anti-Bucles de Redirección (Auth Guard):**
  - En `apiClient.ts`: Los interceptores de error `401` y `403` validan `isPublicPath` (`/login`, `/reset-password`, `/verify`) antes de ejecutar `window.location.href`. Nunca se redirige a `/login` si el usuario ya se encuentra en una ruta pública de autenticación o verificación, previniendo recargas infinitas.

### 3.2 Backend (`backend-insforge/`)
- **Core:** Node.js + Express + TypeScript compilado con `tsc` a la carpeta `dist/`.
- **Conectividad a Base de Datos:** `@supabase/supabase-js` exportando:
  - `client`: Con anon key para operaciones autenticadas bajo contexto RLS del usuario (`verifyClient`).
  - `adminClient`: Con `service_role` key para operaciones privilegiadas de SuperAdmin (bypass de RLS).
- **Seguridad:**
  - `helmet` (configurado para no bloquear descargas ni CORS cross-origin).
  - `cors` dinámico con soporte explícito de cabeceras personalizadas (`X-Branch-Id`, `x-branch-id`).
  - `express-rate-limit` protegiendo endpoints globales (300 peticiones/min para evitar falsos positivos por ráfagas legítimas) y login (5 intentos / 15 min).
  - Middleware de auditoría [`audit.middleware.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/middleware/audit.middleware.ts) registrando operaciones en la tabla `audit_logs`.
  - [`auth.middleware.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/middleware/auth.middleware.ts) verificando expiración de JWT, revocación de cuentas desactivadas y modo de mantenimiento.
- **Orden de Enrutamiento en `app.ts` (CRITICAL ARCHITECTURAL RULE):**
  - Todas las rutas públicas o semi-públicas (verificación de comprobantes, estudiantes, versión de app y consulta pública de sedes `/api/branches`) DEBEN montarse en `app.ts` **ANTES** de los enrutadores genéricos como `academicRoutes` (`/api`). Los routers montados en `/api` aplican `router.use(requireAuth)` a nivel raíz, por lo que cualquier ruta montada posteriormente heredará la exigencia de token si Express la evalúa después.
  - La ruta `GET /api/branches` maneja la falta de token de forma segura devolviendo `[]` con `HTTP 200 OK` para proteger clientes desactualizados o pantallas previas a autenticación.

---

## 4. Matriz de Roles y Gobernanza de Acceso (RBAC)

La plataforma utiliza un modelo estricto de control de acceso basado en roles (`role` en la tabla `profiles`):

| Rol | Alcance Territorial | Privilegios Principales |
| :--- | :--- | :--- |
| **`superadmin`** | **Global (Todas las Sedes)** | Control total omnisciente. Puede alternar entre el consolidado institucional y cualquier sede individual mediante el Switcher superior. Gestiona altas/bajas de sedes, usuarios, auditoría, configuración de mantenimiento y panel DevOps. Utiliza `adminClient` para bypass de RLS. |
| **`admin`** | **Sede Asignada (`branch_id`)** | Director de plantel. Restringido estrictamente a los estudiantes, cursos, matrículas y personal de su sede. No puede crear ni eliminar sedes ni alternar de plantel. |
| **`secretary`** | **Sede Asignada (`branch_id`)** | Operaciones de caja, recepción de pagos, emisión y anulación de recibos, matrícula de estudiantes, registro físico de entrega de boletas oficiales. |
| **`instructor`** | **Sede Asignada / Cursos Propios** | Registro de calificaciones, subcalificaciones ponderadas, asistencia por sesión, justificaciones médicas y publicación de tareas. |
| **`student`** | **Propio Alumno** | Consulta de notas, horario de clases, control de méritos acumulados, recibos de pago personales, solicitudes de boleta institucional y entrega física. |
| **`parent`** | **Alumnos Vinculados** | Portal de tutor/familiar. Supervisión de asistencia, rendimiento académico y saldo pendiente de sus hijos enlazados mediante `parent_student_links`. |

---

## 5. Arquitectura Multisede (Fase 2 - Estado Actual)

La arquitectura multisede implementa una delegación jerárquica con aislamiento automático:
1. **Detección de Ámbito en Peticiones:**
   - La función [`getEffectiveBranchId(req)`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/utils/branch.utils.ts) evalúa la cabecera `X-Branch-Id` o el query param `branch_id`.
   - Si `currentUser.role === 'superadmin'`: respeta `'all'` o el UUID de la sede elegida.
   - Si `currentUser.role !== 'superadmin'`: fuerza incondicionalmente `currentUser.branch_id`.
2. **Caché Reactiva Frontend:**
   - Al cambiar de sede desde el componente [`BranchSwitcher.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/components/layout/BranchSwitcher.tsx), `BranchContext` invalida las claves `['students']`, `['courses']`, `['enrollments']`, `['payments']`, `['reports']`, `['attendance']` y `['grades']`, actualizando instantáneamente las pantallas.
3. **Sincronización RLS en PostgreSQL:**
   - Las 9 políticas de RLS en base de datos evalúan `(get_user_role() IN ('admin', 'superadmin'))`, garantizando que el rol SuperAdmin no sufra bloqueos en consultas directas o mantenimiento.
4. **Protección Contra Pérdida de Datos en Sedes:**
   - [`branches.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/branches.controller.ts) bloquea la eliminación de cualquier sede si `students_count > 0`, exigiendo la reasignación previa de los alumnos.

---

## 6. Esquema de Base de Datos (Tablas Críticas)

- **`branches`:** Planteles territoriales (`id`, `name`, `address`, `phone`, `email`, `created_at`).
- **`profiles`:** Cuentas de usuario y credenciales vinculadas a `auth.users` (`id`, `email`, `role`, `branch_id`, `active`, `full_name`).
- **`students`:** Expedientes académicos (`id`, `branch_id`, `user_id`, `full_name`, `birth_date`, `academy_code`, `personal_code`, `status`, `guardian_*`).
- **`courses`:** Catálogo de cursos y carreras (`id`, `branch_id`, `name`, `monthly_fee`, `duration_months`, `is_active`).
- **`enrollments`:** Inscripciones activas de alumnos en cursos (`id`, `student_id`, `course_id`, `status`, `enrolled_at`).
- **`payments`:** Transacciones financieras y cuotas (`id`, `branch_id`, `student_id`, `enrollment_id`, `amount`, `payment_method`, `status`, `receipt_number`).
- **`invoices`:** Facturas y recibos institucionales con código QR público (`verify-receipt/:invoiceNumber`).
- **`grades` / `subgrades`:** Notas y subcalificaciones por categorías ponderadas.
- **`attendance` / `attendance_justifications`:** Control de asistencia y registro de justificaciones médicas/personales con comprobantes.
- **`system_settings`:** Gobernanza institucional (`system_maintenance_mode`, `system_maintenance_message`, `allow_student_portal`, `allow_parent_portal`).
- **`audit_logs`:** Registro inmutable de eventos con usuario, IP, acción, recurso y cambios JSON.

---

## 7. Lecciones Aprendidas y Trampas Críticas (Operational Pitfalls)

> [!CAUTION]
> **1. Contraseña del usuario `supabase_admin` (Bucle de reinicios en Supavisor / Pooler):**
> El contenedor `supabase-pooler` (Supavisor) y `realtime-dev.supabase-realtime` requieren que el usuario interno de PostgreSQL `supabase_admin` tenga exactamente la contraseña:
> `ULTECpostgres2026!Secure`
> Si se desincroniza, Supavisor y Realtime crashean y se reinician cada 8-10 segundos en bucle infinito, provocando saturación continua del CPU en el VPS. Si esto ocurre, ejecutar dentro de `supabase-db`:
> `ALTER USER supabase_admin WITH PASSWORD 'ULTECpostgres2026!Secure';`
> y reiniciar ambos contenedores.

> [!IMPORTANT]
> **2. Cálculo de CPU en Servidores de 1 Core (DevOps Telemetría):**
> Nunca calcular el porcentaje de CPU dividiendo `os.loadavg()[0]` entre el número de cores, ya que en Linux el load average incluye procesos bloqueados en I/O de disco (Uninterruptible Sleep `D`).
> La medición correcta implementada en [`devops.service.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/services/devops.service.ts) muestrea los ticks de CPU (`activeTicks` vs `idleTicks`) durante una ventana de 120ms (`sampleCpuUsage(120)`).

> [!WARNING]
> **3. Cabecera `X-Branch-Id` en CORS:**
> Todo middleware o proxy intermedio debe tener explícitamente `'X-Branch-Id'` y `'x-branch-id'` en `allowedHeaders` en `app.ts` para evitar que los navegadores bloqueen las peticiones preflight `OPTIONS`.

> [!NOTE]
> **4. Conteo de Claves Foráneas en PostgREST:**
> PostgREST soporta conteos relacionados directamente en el select:
> `.select('*, students(count), courses(count)')`
> Retorna arreglos `[{ count: N }]` mapeables sin necesidad de subconsultas manuales o funciones RPC.

---

## 8. Procedimiento Estándar de Despliegue (Deploy Workflow)

Cuando se implemente una nueva versión, seguir rigurosamente este protocolo:

1. **Incrementar Versión (Fuente Única de Verdad):**
   - `backend-insforge/package.json`: Campo `"version"`
   - `backend-insforge/src/controllers/appVersion.controller.ts`: Objeto `LATEST_APP_VERSION` (`version`, `versionCode`, `releaseNotes`)
   - `frontend-antigravity/package.json`: Campo `"version"`
   - `frontend-antigravity/src/config/appConfig.ts`: Objeto `APP_CONFIG` (`version`, `buildNumber`)
   - `frontend-antigravity/android/app/build.gradle`: `versionCode` y `versionName`
2. **Compilar Backend:**
   ```powershell
   cd backend-insforge
   npm run build
   ```
3. **Compilar Frontend y Sincronizar Capacitor:**
   ```powershell
   cd frontend-antigravity
   npm run build
   ```
4. **Empaquetar Tarballs de Producción:**
   ```powershell
   tar -czf dist-backend.tar.gz -C backend-insforge/dist .
   tar -czf dist-frontend.tar.gz -C frontend-antigravity/dist .
   ```
5. **Subir y Desplegar al VPS:**
   Subir `dist-backend.tar.gz`, `dist-frontend.tar.gz` y el script `deploy_vXXXX.sh` mediante SCP, y ejecutar en el servidor:
   ```bash
   tar -xzf /home/ubuntu/dist-backend.tar.gz -C /home/ubuntu/ultec-backend/dist/
   docker restart ultec-backend
   rm -rf /home/ubuntu/ultec-frontend/dist/*
   tar -xzf /home/ubuntu/dist-frontend.tar.gz -C /home/ubuntu/ultec-frontend/dist/
   docker cp /home/ubuntu/ultec-frontend/dist/. ultec-frontend:/usr/share/nginx/html/
   docker exec ultec-frontend nginx -s reload
   ```
6. **Verificar Salud del Servidor:**
   ```bash
   curl -s https://plataformaultec.duckdns.org/api/app-version/latest
   uptime && top -bn1 | head -n 5
   ```

---

---

## 9. Sistema de Copias de Seguridad y Disaster Recovery (v1.1.18)

- **Mecanismo de Volcado:** `pg_dump` oficial ejecutado desde `ultec-backend` contra el contenedor `supabase-db`:
  ```bash
  pg_dump -h supabase-db -U postgres -d postgres --schema=public --schema=auth --clean --if-exists --no-owner --no-privileges
  ```
  - Respalda tanto los datos institucionales (`public`: alumnos, cursos, pagos, notas) como las credenciales y sesiones de Supabase (`auth`).
- **Compresión e Integridad:**
  - Compresión al vuelo mediante Node.js `zlib.createGzip({ level: 9 })`.
  - Cálculo de suma de verificación criptográfica **SHA-256** en el flujo de escritura.
  - Almacenamiento persistente en `/home/ubuntu/ultec-backend/uploads/backups/`.
- **Política de Retención Automática:**
  - Temporizador de fondo que ejecuta un respaldo diario automático.
  - Rotación inteligente: mantiene las 7 copias programadas más recientes y depura las anteriores para preservar espacio en el disco NVMe del VPS.
  - Los respaldos manuales generados por el SuperAdmin se conservan permanentemente.
- **Comando Oficial de Restauración de Emergencia:**
  ```bash
  gunzip -c backup_ultec_YYYYMMDD_HHMMSS.sql.gz | docker exec -i supabase-db psql -U postgres -d postgres
  ```

---

---

## 10. Módulo de Caja Chica y Arqueo Diario por Sede (v1.1.19)

- **Ciclo de Vida de Turnos (`cash_shifts`):**
  - Estados: `'OPEN'`, `'CLOSED'`, `'AUDITED'`.
  - Regla de Negocio: Solo puede haber **un turno activo simultáneamente por sede**.
  - Fondo Inicial: Se registra al momento de la apertura física de la caja.
- **Enlace de Cobros y Conciliación:**
  - Columna `cash_shift_id` en la tabla `payments`.
  - Toda recepción de pago (`createPayment` o `createBulkGroupPayment`) detecta si la sede tiene un turno en `'OPEN'` y enlaza la transacción automáticamente.
  - El backend mantiene acumulados en vivo: `cash_inflow` (cobros en efectivo/gaveta) y `other_inflow` (transferencias bancarias, tarjetas o depósitos que no entran a gaveta física).
  - Al anular o eliminar un pago (`deletePayment`), se descuenta de los acumulados de la caja activa.
- **Gastos Menores / Egresos de Sede (`cash_expenses`):**
  - Registro de compras operativas (suministros, papelería, aseo, transporte, servicios).
  - Soporte de número de comprobante físico / factura.
  - Bloqueo de seguridad: No se pueden eliminar egresos de turnos cerrados o auditados.
- **Arqueo y Cierre Ciego / Guiado:**
  - Fórmula matemática de control: `expected_cash = opening_balance + cash_inflow - expenses_outflow`.
  - Cálculo en tiempo real de la diferencia física: `difference = actual_cash - expected_cash` (Exacto, Sobrante o Faltante).
  - Generación de comprobante oficial imprimible con desglose de conciliación y áreas de firma para Cajero(a) y Dirección.
  - Visado y auditoría por administradores y SuperAdmin con notas inmutables.

---

## 11. Centro de Notificaciones Push Nativas y Alertas Escolares (v1.1.20)

- **Arquitectura Web Push Nativa W3C:**
  - Despacho directo a celulares Android, navegadores de escritorio (Chrome, Edge, Firefox) y PWA sin depender de servicios de terceros de pago.
  - Generación de claves VAPID (`BN8wAlZKsX8...`) criptográficamente seguras (`mailto:soporte@plataformaultec.duckdns.org`).
- **Persistencia de Suscripciones (`push_subscriptions`):**
  - Tabla relacional con `user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`.
  - Integridad referencial con eliminación en cascada (`ON DELETE CASCADE`) al eliminarse usuarios.
  - Políticas RLS: Cada usuario puede gestionar exclusivamente sus terminales y suscripciones; SuperAdmin con visibilidad global.
- **Depuración Automática de Endpoints Caducados (410 Gone / 404):**
  - Al detectar rechazo por desinstalación de la app o revocación de permisos en el navegador, el backend elimina automáticamente el registro huérfano para evitar colas de reintentos innecesarias.
- **Despacho Automático de Alertas Escolares:**
  - Enlazado con `notification.service.ts`: Toda notificación de sistema (aprobación de pagos de colegiatura, emisión de boletas, avisos institucionales) desencadena automáticamente un push en segundo plano a los dispositivos suscritos del alumno o tutor.
- **Service Worker Integrado:**
  - Archivo `custom-sw.js` precargado mediante `importScripts` en `sw.js` de Vite PWA.
  - Soporte de eventos `push` con payload estructurado (título, cuerpo, icono institucional, vibración) y `notificationclick` para enfocar la pestaña activa o navegar a la ruta relevante (`/dashboard/finance`, `/dashboard/grades`, etc.).
- **Experiencia de Usuario en Frontend:**
  - Banner interactivo de activación en un solo clic dentro del desplegable de notificaciones (`NotificationsPopover.tsx`).
  - Sección de gestión de notificaciones y alertas en el perfil del usuario (`UserProfile.tsx`), con botón de prueba con sonido y vibración.
  - Diálogos de advertencia si las notificaciones están bloqueadas en el navegador, indicando cómo habilitarlas.

---

## 12. Modo Offline-First para Registro de Asistencia y Calificaciones (v1.1.21)

- **Persistencia Nativa en IndexedDB (`UltecOfflineDB` v1):**
  - Implementación con la API nativa de `window.indexedDB` (cero dependencias pesadas de terceros, óptimo para WebViews de Capacitor Android y navegadores de escritorio/móvil).
  - Almacenes de objetos (`ObjectStores`):
    - `cached_rosters`: Nóminas completas de estudiantes por curso (`course_id`) con marcas temporales.
    - `cached_attendance`: Registros diarios de asistencia en local indexados por `${course_id}_${date}`.
    - `cached_grades`: Registros de notas por unidad indexados por `${course_id}_${unit_name}`.
    - `sync_outbox`: Cola transaccional de salida (Outbox Pattern) con índices por `status` y `createdAt`.
- **Patrón Outbox (`sync_outbox`) y Resiliencia Transaccional:**
  - Registro de mutaciones pendientes (`ATTENDANCE`, `GRADES`, `SUBGRADES`) con método, payload, reintentos y descripción legible.
  - Estados: `'PENDING'`, `'SYNCING'`, `'FAILED'` con registro detallado de `lastError`.
  - Idempotencia garantizada: El backend de Plataforma ULTEC utiliza `UPSERT` relacional sobre claves compuestas `(course_id, student_id, date)` y `(student_id, course_id, unit_name)`, eliminando cualquier riesgo de registros duplicados al reintentar la sincronización.
- **Detección Reactiva de Red (`useNetworkStatus.ts`):**
  - Monitoreo continuo de eventos `online` y `offline` en el navegador.
  - Sincronización automática no intrusiva: al restablecerse la conexión a internet, se dispara una sincronización en segundo plano tras un periodo de gracia de 1.5 segundos.
- **Componentes Visuales de Conectividad y Experiencia Docente:**
  - `NetworkStatusBar.tsx`: Barra informativa superior visible solo cuando se pierde la conexión a internet, alertando que el modo local está activo y permitiendo ver los registros pendientes.
  - `NetworkIndicatorBadge`: Pastilla interactiva en el encabezado global (junto al selector de sedes) que muestra el conteo de pendientes y animación durante la sincronización activa.
  - `OfflineSyncModal.tsx`: Centro de sincronización donde el docente puede auditar cada transacción pendiente guardada en su dispositivo, reintentar manualmente o descartar registros erróneos.
  - Integración en `Attendance.tsx` y `Grades.tsx`: Fallback automático a nóminas locales cuando no hay señal, persistencia local inmediata y conmutación transparente si la red se interrumpe durante el guardado.

---

## 13. Hoja de Ruta de Fases y Estado

- [x] **Fase 1: Panel DevOps y Telemetría en Vivo de Infraestructura** (v1.1.16)
  - Métricas en tiempo real de CPU, RAM, disco y base de datos PostgreSQL.
  - Inventario de registros operativos para SuperAdmin.
- [x] **Fase 2: Arquitectura Multisede Jerárquica y Delegación Regional** (v1.1.17)
  - Aislamiento estricto por sede para administradores regulares.
  - Selector global con consolidado institucional para SuperAdmin.
  - Validación RLS alineada para rol `superadmin`.
  - Blindaje contra eliminación de sedes con alumnos activos.
- [x] **Fase 3.1: Sistema Automatizado de Respaldos de Base de Datos y Disaster Recovery** (v1.1.18)
  - Motor de respaldo `pg_dump` con compresión gzip nivel 9 y checksums SHA-256.
  - Interfaz de gestión y descarga directa desde el Panel DevOps.
  - Cron inteligente de respaldo diario y rotación de retención de 7 días.
- [x] **Fase 3.2: Módulo de Caja Chica y Arqueo Diario por Sede** (v1.1.19)
  - Apertura y cierre de turnos de caja para secretaría / administración.
  - Control de efectivo en gaveta vs pagos electrónicos y transferencias bancarias.
  - Registro de egresos y gastos operativos menores de sede con comprobante.
  - Corte diario consolidado con acta imprimible y visado de auditoría.
- [x] **Fase 3.3: Centro de Notificaciones Push Nativas y Alertas Escolares** (v1.1.20)
  - Despacho push nativo W3C Web Push con VAPID para celulares Android, PWA y escritorio.
  - Persistencia de suscripciones de dispositivos en tabla `push_subscriptions` con RLS.
  - Despacho automático de alertas para pagos aprobados, avisos de boletas y comunicados.
  - Controles de activación rápida y pruebas en `NotificationsPopover` y `UserProfile`.
- [x] **Fase 3.4: Modo Offline-First para Registro de Asistencia y Calificaciones** (v1.1.21)
  - Almacenamiento local IndexedDB para aulas sin conectividad y sincronización background.
  - Patrón Outbox con idempotencia para asistencia y calificaciones.
  - Indicadores reactivos de red, banner contextual y centro de sincronización.
- [x] **Fase 4: Portal del Estudiante y Tutor Móvil Optimizado (PWA / App)** (v1.1.22)
  - Dock inferior móvil dinámico personalizado por rol (`student` y `parent`) con safe-area inset bottom padding (`pb-[env(safe-area-inset-bottom)]`).
  - Ruta directa `/my-grades` para estudiantes enlazada al Centro Documental y Boleta de Calificaciones.
  - Selector táctil horizontal de hijos (`selectedStudentId`) con avatar y distintivo de estatus en campus para tutores con múltiples estudiantes vinculados.
  - Sincronización bidireccional de pestañas con parámetros URL (`?tab=grades`, `assignments`, `attendance`, `finance`, `discipline`, `summary`).
  - Tarjetas financieras móviles responsivas para historial de pagos y desglose por curso con enlace directo a verificación digital de recibos (`/verify-receipt/:receiptNumber`).
  - Barras visuales de progreso de rendimiento académico por materia.
- [x] **Fase 5: Módulo de Tareas, Recursos Digitales y Entrega de Actividades (LMS)** (v1.1.23)
  - Extensión relacional de base de datos con columna `attachment_url` en tabla `assignments` para guías docentes.
  - Subida directa de guías de trabajo y material de apoyo en modal de creación/edición de tareas para docentes (`AssignmentsModule.tsx`).
  - Botón de descarga/visualización de material de estudio y comprobantes en tarjetas de tareas y modal de entrega para alumnos (`StudentAssignments.tsx`).
  - Soporte de subida de evidencias para estudiantes con formatos extendidos (PDF, imágenes, Word, Excel, PowerPoint, ZIP) hasta 15MB.
  - Monitoreo integral para tutores y padres de familia en `ParentDashboard.tsx` con acceso directo a guías asignadas y comprobantes entregados.
  - Almacenamiento seguro en contenedor y entrega ágil de archivos estáticos vía Nginx `/uploads/`.
- [x] **Fase 6: Carnets Digitales Estudiantiles con Emisión Física Controlada y Validación QR** (v1.2.0 Build 34)
  - Carnet Digital Oficial interactivo en pantalla con efecto 3D flip card, marcas de agua antifalsificación y código QR dinámico.
  - Regla estricta de seguridad: Cero opciones de impresión o descarga para estudiantes y padres desde la app.
  - Flujo de solicitud formal de carnet físico a administración (trámite inicial o reposición por extravío) persistido en `document_authorizations`.
  - Panel administrativo para secretaría y dirección con filtros por sede, estado y buscador por nombre/código.
  - Generación de credenciales físicas en formato estándar PVC CR80 con alta resolución e impresión térmica/láser.
  - Registro de entrega presencial con sello de `delivered_by` y `delivered_at`.
  - Verificación pública QR avanzada en `/verify-student/:code` que certifica la validez académica y la posesión de credencial física entregada por administración.
- [x] **Fase 7: Inteligencia Institucional, Cartera Vencida y Alerta Temprana de Deserción** (v1.2.1 Build 35)
  - Algoritmo de Índice de Retención Escolar (IRE 0-100) ponderando asistencia (40%), promedio académico (35%), mora (20%) y disciplina (5%).
  - Semáforo de riesgo predictivo: 🔴 Crítico (< 60), 🟡 Moderado (60-79) y 🟢 Bajo Riesgo (≥ 80).
  - Bitácora de intervenciones en PostgreSQL con tabla `student_interventions` y enlaces de WhatsApp oficial.
  - Matriz de antigüedad de saldos (Aging Buckets: 0-30, 31-60, 61-90, 90+ días) y tasa de cobranza mensual.
  - Tablero ejecutivo unificado en `ReportsHub.tsx` con exportación en PDF y Excel (.xlsx).
- [ ] **Fase 8: Auditoría Financiera Avanzada, Facturación Electrónica SAT (FEL) y Portal Docente de Evaluaciones** (Próxima Fase `v1.4.0`)

---

## 14. Módulo de Tareas, Recursos Digitales y Entrega de Actividades (LMS) (v1.1.23)

- **Esquema de Base de Datos y Separación de Recursos:**
  - `assignments.attachment_url`: Almacena la ruta del recurso, guía de estudio o material didáctico adjunto por el docente.
  - `assignment_submissions.attachment_url`: Almacena el archivo de evidencia o tarea entregada por el estudiante.
  - Compatibilidad garantizada en controladores `assignments.controller.ts` y `parents.controller.ts` exponiendo `guide_url` y `attachment_url`.
- **Experiencia de Usuario Docente (`AssignmentsModule.tsx`):**
  - Selector de archivos en modal de asignación con indicador de carga y estado de subida.
  - Badge visual de guía adjunta en tarjetas de tareas y enlace de revisión en el modal de calificaciones.
- **Experiencia de Usuario Estudiante (`StudentAssignments.tsx`):**
  - Acceso directo a guía de estudio con botón `Ver Guía / Material Adjunto` en tarjeta.
  - Modal de entrega enriquecido con previsualización del material de referencia, tamaño de archivo, opción para remover archivo seleccionado y soporte hasta 15MB.
  - Notificación de puntos de mérito otorgables por cumplimiento puntual.
- **Supervisión para Padres y Tutores (`ParentDashboard.tsx`):**
  - En la pestaña de Tareas, cada actividad muestra enlaces para revisar tanto la guía oficial proporcionada por el docente como el archivo entregado por el estudiante.
  - Visualización transparente de retroalimentación docente (`feedback`) y punteos obtenidos.

---

## 15. Carnets Digitales Estudiantiles y Emisión Física Controlada (v1.2.0 Build 34)

- **Arquitectura de Seguridad Antifalsificación:**
  - **Identificación Virtual en Pantalla:** Alumnos y tutores visualizan un carnet interactivo 3D con reverso giratorio, datos de contacto de emergencia, sede, curso y marca de agua institucional dinámica con marca de tiempo.
  - **Restricción de Emisión Física:** Por directriz estricta de seguridad institucional, los estudiantes y tutores tienen deshabilitada cualquier opción de descarga o impresión directa del carnet físico.
  - **Solicitud de Carnet a Administración:** Estudiantes o tutores envían solicitudes desde la app (`document_authorizations` con `document_type = 'STUDENT_ID'`), indicando tipo de trámite (`FIRST_TIME` o `REPLACEMENT`) y motivo.
- **Módulo Administrativo de Carnets (`/credentials-admin`):**
  - Disponible exclusivamente para `superadmin`, `admin` y `secretary`.
  - Pestañas de estado (`Pendientes`, `Listos en Plantel`, `Entregados`, `Todas`).
  - Filtro por sede institucional con aislamiento multisede y buscador por nombre o código.
  - **Impresión Profesional PVC CR80:** Generador de credenciales con dimensiones exactas ISO 7810 ID-1 (85.60 mm × 53.98 mm), foto, QR de verificación, datos de sede, vigencia y código de barras de seguridad.
  - **Entrega Presencial Certificada:** Al entregar la credencial en físico, el personal administrativo registra la entrega, estampando en base de datos `delivered_at` y `delivered_by`.
- **Verificación Pública QR (`/verify-student/:code`):**
  - Escaneable desde cámaras de celular o lectores de control de acceso en portería.
  - Muestra el estado oficial de matrícula, sede, ciclo escolar y un distintivo de seguridad que confirma si el alumno cuenta con credencial física oficial entregada por administración.
- **Resolución de Error PGRST200 (Batch Hydration Pattern):**
  - La tabla `document_authorizations` almacena `student_id` como `varchar(255)` sin llave foránea explícita hacia `students(id)`.
  - Las consultas directas con sintaxis embebida de PostgREST (`students:student_id(...)`) fallaban con `PGRST200`.
  - Se implementó el patrón de **Batch Hydration** en [`credentials.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/credentials.controller.ts) (consultando primero `document_authorizations`, extrayendo los IDs únicos de alumnos e hidratando en lote desde `students` junto a sus sedes y matrículas en memoria), blindando `getCredentialRequests`, `updateCredentialRequestStatus` y `getStudentCredentialCard`.

---

## 16. Inteligencia Institucional, Cartera Vencida y Alerta Temprana de Deserción (v1.2.1 Build 35)

- **Arquitectura de Detección Temprana y Retención Escolar:**
  - **Algoritmo del Índice de Retención Escolar (IRE 0-100):** Cálculo ponderado multidimensional que cruza en una sola pasada:
    - **Asistencia (40%):** Asistencia regular (≥85%), faltas intermedias y penalización por 3 o más ausencias consecutivas.
    - **Rendimiento Académico (35%):** Promedio de calificaciones y conteo de materias/unidades reprobadas (< 60 pts).
    - **Salud Financiera (20%):** Meses acumulados en mora a través de `financial_status`.
    - **Disciplina Institucional (5%):** Reportes conductuales abiertos de severidad alta/media.
  - **Semáforo Predictivo:**
    - 🔴 **Riesgo Crítico (IRE < 60 pts):** Deserción inminente que requiere intervención prioritaria de dirección.
    - 🟡 **Riesgo Moderado (IRE 60-79 pts):** Alumnos en observación preventiva por ausencias o primera cuota vencida.
    - 🟢 **Bajo Riesgo (IRE ≥ 80 pts):** Trayectoria y retención saludable.
- **Bitácora de Intervenciones Estudiantiles:**
  - Tabla relacional en PostgreSQL `student_interventions` (`student_id`, `branch_id`, `created_by`, `intervention_type`, `notes`, `commitment`, `follow_up_date`, `status`).
  - Modal interactivo [`InterventionModal.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/finance/InterventionModal.tsx) para registrar llamadas, citas presenciales, acuerdos o tutorías.
  - Botón de enlace directo a WhatsApp institucional con mensaje pre-armado dirigido al tutor o padre de familia.
- **Análisis de Cartera Vencida y Antigüedad de Saldos (Aging Debt):**
  - Desglose en 4 tramos de mora: **1 a 30 días**, **31 a 60 días**, **61 a 90 días** y **Más de 90 días**.
  - Cálculo de la **Tasa de Cobranza Mensual (%)** contra la meta institucional de matrículas activas.
  - Listado priorizado de Top 15 alumnos con mayor deuda y recordatorios de cobro respetuoso por WhatsApp.
- **Tablero Unificado en [`ReportsHub.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/finance/ReportsHub.tsx):**
  - Pestaña de alto nivel `Inteligencia BI` con sub-conmutador entre `Alerta Temprana (EWS)` y `Cartera Vencida (Aging)`.
  - Exportación ejecutiva completa a **PDF** (orientación horizontal para junta directiva) y **Excel** (.xlsx).
- **Resolución Polimórfica de Filtrado por Carreras / Cursos:**
  - El parámetro `course_id` en los endpoints `/api/intelligence/debt-aging` y `/api/intelligence/early-warning` es resuelto mediante `resolveCourseIds`, admitiendo tanto identificadores `UUID` como nombres textuales de cursos (ej. `"TAC 1-2026"`), evitando el error `22P02 (invalid input syntax for type uuid)`.
  - El selector en el frontend ([`DebtAgingDashboard.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/finance/DebtAgingDashboard.tsx) y [`EarlyWarningDashboard.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/finance/EarlyWarningDashboard.tsx)) carga de forma estable el catálogo de cursos vía `getCourses()` desde `academicService.ts`, impidiendo que las opciones desaparezcan al seleccionar un filtro.
  - La recaudación del mes (`paymentsQuery`) en el reporte de cartera vencida se encuentra acotada a las matrículas del curso seleccionado para garantizar precisión contable.






