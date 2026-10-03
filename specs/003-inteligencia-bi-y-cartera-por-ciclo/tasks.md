# Tareas de Implementación — Spec 003: Ciclos Lectivos en Inteligencia BI y Cartera Vencida

**Spec Asociada:** [`spec.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/003-inteligencia-bi-y-cartera-por-ciclo/spec.md)  
**Plan Asociado:** [`plan.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/003-inteligencia-bi-y-cartera-por-ciclo/plan.md)  
**Criterio:** Tareas atómicas verificables ("Hecho cuando:").

---

### Tareas de Implementación
- [x] **T1. Adaptación del Backend (`intelligence.controller.ts`).**  
  - Archivo: `backend-insforge/src/controllers/intelligence.controller.ts`.  
  - Hecho cuando: `resolveCourseIds` filtra por `academic_year`, `getEarlyWarningReport` y `getDebtAgingReport` reciben `academic_year`, la clave de NodeCache incluye el año y las métricas se aíslan al ciclo solicitado.
- [x] **T2. Actualización de API Client (`intelligenceService.ts`).**  
  - Archivo: `frontend-antigravity/src/features/finance/intelligenceService.ts`.  
  - Hecho cuando: Las interfaces de parámetros aceptan `academic_year?: number | string` y lo transmiten en la query HTTP.
- [x] **T3. Integración de Ciclos en Semáforo de Deserción (`EarlyWarningDashboard.tsx`).**  
  - Archivo: `frontend-antigravity/src/features/finance/EarlyWarningDashboard.tsx`.  
  - Hecho cuando: Se renderizan las píldoras interactivas `[Todos] [Ciclo 2027] [Ciclo 2026]`, el selector de cursos filtra por año y el informe EWS se recalcula reactivamente.
- [x] **T4. Integración de Ciclos en Cartera Vencida (`DebtAgingDashboard.tsx`).**  
  - Archivo: `frontend-antigravity/src/features/finance/DebtAgingDashboard.tsx`.  
  - Hecho cuando: Se integran las píldoras de ciclo escolar, las opciones muestran insignia de ciclo y los buckets de antigüedad reflejan únicamente el ciclo activo.
- [x] **T5. Sincronización de Versión a Build 39 (v1.2.5).**  
  - Archivos: 5 archivos de versión sincronizados (`frontend/package.json`, `appConfig.ts`, `build.gradle`, `backend/package.json`, `appVersion.controller.ts`) y `memory.md`.  
  - Hecho cuando: Todos reflejan versión `1.2.5` y Build `39`.
- [x] **T6. Compilación Completa (Frontend & Backend).**  
  - Hecho cuando: `npm run build` en backend y frontend finalizan con cero (0) errores.
- [x] **T7. Suite de Pruebas Pre-Despliegue en Contenedor Aislado.**  
  - Hecho cuando: Se ejecuta el script de validación contra `http://localhost:4001` con 100% de éxito.
- [x] **T8. Despliegue en Producción y Verificación Pública.**  
  - Hecho cuando: Los contenedores en VPS están actualizados y el endpoint público confirma Build 39 (v1.2.5).
