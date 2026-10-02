# Tareas de Implementación — Spec 002: Ciclos Lectivos en Calificaciones y Asistencia

**Spec Asociada:** [`spec.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/002-calificaciones-y-asistencia-por-ciclo/spec.md)  
**Plan Asociado:** [`plan.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/002-calificaciones-y-asistencia-por-ciclo/plan.md)  
**Criterio:** Tareas atómicas verificables ("Hecho cuando:").

---

### Tareas de Implementación
- [x] **T1. Integración de Ciclos en Módulo de Calificaciones (`Grades.tsx`).**  
  - Archivo: `frontend-antigravity/src/features/academic/Grades.tsx`.  
  - Hecho cuando: Se renderizan las píldoras `[Todos] [Ciclo 2027] [Ciclo 2026]`, `courseOptions` incluye badges de ciclo y el selector se filtra por año.
- [x] **T2. Integración de Ciclos en Módulo de Asistencia (`Attendance.tsx`).**  
  - Archivo: `frontend-antigravity/src/features/academic/Attendance.tsx`.  
  - Hecho cuando: Se integran las píldoras de ciclo escolar, las opciones de curso muestran `[Ciclo YYYY]` y la selección se acota al año activo.
- [x] **T3. Sincronización de Versión a Build 38 (v1.2.4).**  
  - Archivos: 5 archivos de versión sincronizados (`frontend/package.json`, `appConfig.ts`, `build.gradle`, `backend/package.json`, `appVersion.controller.ts`) y `memory.md`.  
  - Hecho cuando: Todos reflejan versión `1.2.4` y Build `38`.
- [x] **T4. Compilación Completa (Frontend & Backend).**  
  - Hecho cuando: `npm run build` en backend y frontend finalizan con cero (0) errores.
- [x] **T5. Suite de Pruebas Pre-Despliegue en Contenedor Aislado.**  
  - Hecho cuando: Se ejecuta el script de validación contra `http://localhost:4001` con 100% de éxito.
- [x] **T6. Despliegue en Producción y Verificación Pública.**  
  - Hecho cuando: Los contenedores en VPS están actualizados y el endpoint público confirma Build 38 (v1.2.4).
