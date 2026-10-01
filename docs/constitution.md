# Constitución Institucional — Plataforma ULTEC

> **PRINCIPIOS INNEGOCIABLES DEL SISTEMA**  
> Toda especificación (`spec.md`), plan técnico (`plan.md`), tarea (`tasks.md`) o línea de código implementada en este repositorio DEBE acatar estrictamente los siguientes mandamientos.

---

### 1. La Producción y los Datos son Sagrados
* **Prohibición de sentencias destructivas:** Queda terminantemente prohibido ejecutar `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE` o sentencias `DELETE` masivas sin cláusula `WHERE` restrictiva sobre la base de datos de producción (`supabase-db`).
* **Integridad del expediente institucional:** Ningún dato real de estudiantes, notas académicas o registros financieros puede ser alterado o eliminado sin respaldo previo y aprobación explícita del usuario.
* **Respaldo antes de cambios de esquema:** Toda migración estructural de base de datos debe ser idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

### 2. Aislamiento Multi-Sede Obligatorio (`branch_id`)
* **Filtrado estricto por sede:** Todo endpoint de consulta (`GET`) y mutación (`POST`, `PUT`, `DELETE`) en el backend debe resolver el `branch_id` efectivo del usuario mediante `getEffectiveBranchId(req)`.
* **Seguridad por roles:** Ningún usuario con rol `admin`, `secretary` o `student` puede leer, crear ni modificar registros pertenecientes a una sede distinta a la suya.
* **Excepción exclusiva:** Únicamente el rol `superadmin` está facultado para operar de forma global entre múltiples sedes institucionales.

### 3. Hora Local Institucional (`America/Tegucigalpa`, UTC-6)
* **Zona horaria oficial:** Todas las fechas y horas visibles en la interfaz y empleadas en cálculos de cobranza, recargos por mora, cortes mensuales y reportes deben calcularse en hora local de Honduras (`America/Tegucigalpa` / `UTC-06:00`).
* **Prohibición de desvíos UTC:** Queda prohibido el uso de `.toISOString().slice(0, 7)` o `new Date("YYYY-MM-DD")` para cortes mensuales o comparaciones de fechas que provoquen desfases de día o mes en horarios nocturnos.

### 4. Pruebas como Puerta Infranqueable (Zero-Failure Gate)
* **Compilación obligatoria previa:** Tanto el frontend (`tsc -b && vite build`) como el backend (`tsc`) deben compilar con cero (0) errores antes de cualquier despliegue.
* **Batería de pruebas en entorno aislado:** Toda funcionalidad nueva o modificación de controladores debe ser validada mediante scripts de prueba automatizados en contenedor temporal (`test-backend`) antes de sustituir los binarios en producción. Prohibido desplegar con pruebas fallidas o en rojo.

### 5. La Spec Manda — Anti "Vibe Coding" (Regla 0)
* **Especificación previa a la codificación:** No se escribe ni se modifica código sin antes definir el **QUÉ** y el **POR QUÉ** mediante historias de usuario y requisitos funcionales en sintaxis EARS (`CUANDO... EL SISTEMA...`, `SI... ENTONCES...`).
* **Aprobación mandatoria:** Toda propuesta técnica debe ser presentada y formalmente aprobada por el usuario antes de iniciar la fase de ejecución.

### 6. Trazabilidad de Versión y Memoria Viva (Regla 6)
* **Sincronización de versiones:** Cualquier cambio significativo que altere endpoints, esquemas de datos o módulos clave debe incrementar el número de Build y VersionName de forma simultánea en los 5 archivos del proyecto (`frontend/package.json`, `appConfig.ts`, `build.gradle`, `backend/package.json` y `appVersion.controller.ts`).
* **Actualización de bitácora:** Toda fase concluida o lección técnica aprendida debe quedar registrada en [`memory.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/memory.md) para mantener la memoria a largo plazo del agente.
