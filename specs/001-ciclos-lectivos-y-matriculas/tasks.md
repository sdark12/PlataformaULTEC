# Tareas de Implementación — Spec 001: Ciclos Lectivos

**Spec Asociada:** [`spec.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/001-ciclos-lectivos-y-matriculas/spec.md)  
**Plan Asociado:** [`plan.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/001-ciclos-lectivos-y-matriculas/plan.md)  
**Criterio:** Tareas atómicas de 20-30 min con comprobación verificable ("Hecho cuando:").

---

### Fase 1: Base de Datos y Catálogo de Cursos (Build 36)
- [x] **T1. Migración de Esquema PostgreSQL.**  
  - Archivo: Ejecución DDL en `supabase-db` vía SSH.  
  - Hecho cuando: `\d courses` muestra la columna `academic_year integer DEFAULT 2026` y se actualiza `TAC1-2027` a `2027`.
- [x] **T2. Soporte de Ciclo Lectivo en Backend (`courses.controller.ts`).**  
  - Archivo: `backend-insforge/src/controllers/courses.controller.ts`.  
  - Hecho cuando: Validación Zod admite `academic_year`, `GET /api/courses` ordena por `academic_year DESC` y `POST/PUT` persisten el ciclo escolar.
- [x] **T3. Interfaz de Cursos y Filtrado Dinámico (`CoursesList.tsx`).**  
  - Archivo: `frontend-antigravity/src/features/academic/CoursesList.tsx` y `academicService.ts`.  
  - Hecho cuando: Las píldoras de filtrado por ciclo funcionan en UI, los badges `🏷️ Ciclo {year}` se renderizan y el modal permite editar el año.
- [x] **T4. Suite de Pruebas Pre-Despliegue y Despliegue Build 36.**  
  - Hecho cuando: 9 pruebas automatizadas pasan al 100% y se despliega la versión `1.2.2` (Build 36).

---

### Fase 2: Matrículas e Inscripción Ágil (Build 37)
- [x] **T5. Extensión de Endpoint de Matrículas en Backend.**  
  - Archivo: `backend-insforge/src/controllers/enrollments.controller.ts`.  
  - Hecho cuando: `GET /api/enrollments` devuelve `academic_year` numérico en cada objeto y admite `?academic_year=...`.
- [x] **T6. Robustez de Sede en Inscripción (`enrollStudent`).**  
  - Archivo: `backend-insforge/src/controllers/enrollments.controller.ts`.  
  - Hecho cuando: Si `finalBranchId` no viene en la petición, se hereda la sede del estudiante evitando violación de NOT NULL.
- [x] **T7. Filtros y Búsqueda por Ciclo en Listado de Matrículas.**  
  - Archivo: `frontend-antigravity/src/features/academic/EnrollmentsList.tsx`.  
  - Hecho cuando: Existen píldoras `[Todos] [2026] [2027]`, badges de ciclo en escritorio/móvil y escribir `2026`/`2027` en la barra filtra en tiempo real.
- [x] **T8. Selector de Ciclo en Modal "Inscribir Estudiante".**  
  - Archivo: `frontend-antigravity/src/features/academic/EnrollmentsList.tsx`.  
  - Hecho cuando: El modal contiene botones de selección de ciclo arriba del buscador de cursos, y las opciones de curso muestran el badge del ciclo.
- [x] **T9. Batería de Pruebas Automatizada Pre-Despliegue (6/6).**  
  - Archivo: `test_v123_enrollments.py`.  
  - Hecho cuando: Las 6 pruebas pasan al 100% en `test-backend` validando versión, presencia de campo, filtrado 2026/2027, creación y borrado.
- [x] **T10. Despliegue en Producción e Incremento a Build 37 (v1.2.3).**  
  - Archivos: 5 archivos de versión sincronizados y `memory.md`.  
  - Hecho cuando: `curl -s https://plataformaultec.duckdns.org/api/app-version/latest` devuelve `v1.2.3` (Build 37).
