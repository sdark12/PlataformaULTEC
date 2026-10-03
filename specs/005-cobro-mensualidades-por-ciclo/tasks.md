# Tareas de Implementación: SPEC-005

---

## Tarea 1: Backend Updates (`payments.controller.ts`)
- **Archivo:** `backend-insforge/src/controllers/payments.controller.ts`
- **Cambio:** Agregar `academic_year` a la selección y retorno de cursos en `getPayments` y `getStudentStatement`.
- **Hecho cuando:** `npm run build` en backend finalice con 0 errores y el endpoint devuelva `academic_year`.

## Tarea 2: Tipos y Servicio Frontend (`paymentService.ts`)
- **Archivo:** `frontend-antigravity/src/features/finance/paymentService.ts`
- **Cambio:** Agregar `academic_year?: number` a las interfaces `Payment` y `CourseStatement`.
- **Hecho cuando:** Los tipos compilen sin inconsistencias.

## Tarea 3: UI de Cobro y Filtro por Ciclo (`PaymentsList.tsx` & `StudentStatementModal.tsx`)
- **Archivos:** 
  - `frontend-antigravity/src/features/finance/PaymentsList.tsx`
  - `frontend-antigravity/src/features/finance/StudentStatementModal.tsx`
- **Cambios:**
  - Auto-sincronizar `selectedYear` al ciclo del alumno en `selectStudent`.
  - Agregar botones rápidos de ciclo en la cabecera del selector de meses de colegiatura.
  - Insertar `CycleSelectorPills` (`maxVisiblePills={1}`) en la barra de pagos.
  - Filtrar pagos de la tabla y exportación por ciclo lectivo.
  - Agregar badges de ciclo en filas, tarjetas móviles y modal de estado de cuenta.
- **Hecho cuando:** `npm run build` en frontend finalice con 0 errores.

## Tarea 4: Versionado, Despliegue en VPS y Verificación
- **Archivos:**
  - `backend-insforge/src/controllers/appVersion.controller.ts` (Build 42)
  - `frontend-antigravity/src/config/appConfig.ts` (Build 42)
- **Acciones:**
  - Compilar backend y frontend con 0 errores.
  - Subir y desplegar en VPS (`ultec-backend` y `ultec-frontend`).
  - Ejecutar verificación automatizada y confirmar en producción.
  - Commit y push a GitHub.
