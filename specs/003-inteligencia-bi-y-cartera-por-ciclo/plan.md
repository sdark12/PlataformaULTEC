# Plan Técnico — Spec 003: Ciclos Lectivos en Inteligencia BI y Cartera Vencida

**Spec Asociada:** [`spec.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/003-inteligencia-bi-y-cartera-por-ciclo/spec.md)  
**Versión de Lanzamiento:** Build 39 (v1.2.5)  
**Stack Involucrado:** Node.js + Express + TypeScript + NodeCache + Supabase PostgreSQL + React 19 + Tailwind CSS

---

## 1. Modificaciones en Backend (`backend-insforge`)

### 1.1 Controlador de Inteligencia ([`intelligence.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/intelligence.controller.ts))
1. **Helper `resolveCourseIds`:**
   - Modificar la firma para aceptar `academicYearParam?: any`:
     ```typescript
     async function resolveCourseIds(
         courseParam?: any, 
         branchId?: string | null, 
         academicYearParam?: any
     ): Promise<string[] | null>
     ```
   - Si se especifica `academicYearParam` (distinto de `'all'`, `'undefined'`, etc.):
     - Si se especificó además un curso particular (`courseParam`): verificar que dicho curso pertenezca al `academic_year` solicitado. Si no pertenece, retornar lista vacía `[]`.
     - Si no se especificó curso (o es `'all'`): obtener todos los IDs de cursos de dicho año (`adminClient.from('courses').select('id').eq('academic_year', year)`), filtrando por `branch_id` si aplica.
   - Si no se especifica ni curso ni año: retornar `null` (sin filtro).

2. **Endpoint `getEarlyWarningReport`:**
   - Extraer `academic_year` de `req.query`.
   - Modificar la clave de caché:
     ```typescript
     const cacheKey = `ews_${branchId || 'all'}_${course_id || 'all'}_${academic_year || 'all'}`;
     ```
   - Invocar `resolveCourseIds(course_id, branchId, academic_year)`.
   - Incluir `academic_year` en el selector `courses (id, name, academic_year)`.
   - Cuando se filtra por cursos (`matchedCourseIds !== null`), filtrar también las consultas por lotes de `attendance` y `grades` con `.in('course_id', matchedCourseIds)` para aislar el desempeño al ciclo lectivo seleccionado.

3. **Endpoint `getDebtAgingReport`:**
   - Extraer `academic_year` de `req.query`.
   - Modificar la clave de caché:
     ```typescript
     const cacheKey = `debt_aging_${branchId || 'all'}_${course_id || 'all'}_${academic_year || 'all'}`;
     ```
   - Invocar `resolveCourseIds(course_id, branchId, academic_year)`.
   - Incluir `academic_year` en el select de `courses (id, name, monthly_fee, academic_year)`.
   - Todas las métricas (facturación esperada mensual, pagos del mes en TUITION, saldos en mora y buckets de mora) se calculan estrictamente sobre los `enrollmentIds` del ciclo escolar seleccionado.

---

## 2. Modificaciones en Frontend (`frontend-antigravity`)

### 2.1 Servicio de Inteligencia ([`intelligenceService.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/finance/intelligenceService.ts))
- Extender los parámetros de `getEarlyWarningReport` y `getDebtAgingReport` para incluir:
  ```typescript
  academic_year?: number | string;
  ```

### 2.2 Semáforo de Deserción Escolar ([`EarlyWarningDashboard.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/finance/EarlyWarningDashboard.tsx))
- **Estados:**
  - `selectedYearFilter`: `'ALL' | number` (inicializado en `'ALL'`).
- **Memoizaciones:**
  - `distinctCycles`: extraer años descendentes únicos de `coursesList`.
  - `availableCourses`: filtrar por `selectedYearFilter` y formatear opciones con insignia `[Ciclo YYYY]`.
- **Efectos:**
  - Resetear `selectedCourse` a `'all'` si deja de ser válido para el ciclo activo.
- **React Query:**
  - `queryKey: ['earlyWarningReport', selectedCourse, selectedYearFilter]` pasando `academic_year` al servicio.
- **UI:**
  - Renderizar barra superior de píldoras `[Todos] [Ciclo 2027] [Ciclo 2026]` junto a los filtros.

### 2.3 Cartera Vencida ([`DebtAgingDashboard.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/finance/DebtAgingDashboard.tsx))
- **Estados y Filtros:**
  - Añadir `selectedYearFilter` y `distinctCycles`.
  - Actualizar `queryKey: ['debtAgingReport', selectedCourse, selectedYearFilter]`.
  - Formatear opciones del menú desplegable con `[Ciclo YYYY] {course.name}`.
  - Renderizar barra de píldoras de ciclo escolar.

---

## 3. Protocolo de Pruebas y Despliegue

1. **Compilación estricta:** `npm run build` en backend y frontend (cero errores TS).
2. **Empaquetado y transferencia al VPS:** Generar `backend-dist.tar.gz` y `frontend-dist.tar.gz`.
3. **Suite automatizada en contenedor aislado `test-backend` (puerto 4001):**
   - Verificar respuesta de `/api/intelligence/early-warning?academic_year=2027` (1 estudiante aislado).
   - Verificar respuesta de `/api/intelligence/early-warning?academic_year=2026` (estudiantes de 2026).
   - Verificar respuesta de `/api/intelligence/debt-aging?academic_year=2027` (aislamiento financiero).
   - Verificar respuesta de `/api/intelligence/debt-aging?academic_year=2026`.
   - Verificar persistencia e invalidación en NodeCache.
4. **Despliegue a producción:** Contenedores `ultec-backend` y `ultec-frontend`.
5. **Verificación pública final:** `https://plataformaultec.duckdns.org/api/app-version/latest`.
