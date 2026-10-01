# Plan Técnico — Spec 001: Ciclos Lectivos en Cursos y Matrículas

**Spec Asociada:** [`spec.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/001-ciclos-lectivos-y-matriculas/spec.md)  
**Versión de Lanzamiento:** Build 36 (Cursos) / Build 37 (Matrículas)  
**Arquitectura:** PostgreSQL 15 + Node.js/Express + React 19 / TypeScript / Tailwind CSS

---

## 1. Arquitectura y Modelo de Datos (PostgreSQL)

### Migración de Esquema
```sql
ALTER TABLE courses ADD COLUMN IF NOT EXISTS academic_year integer DEFAULT 2026;
CREATE INDEX IF NOT EXISTS idx_courses_academic_year ON courses (academic_year);
```

### Backfill de Datos Existentes
```sql
UPDATE courses SET academic_year = 2027 WHERE name ILIKE '%2027%';
UPDATE courses SET academic_year = 2026 WHERE academic_year IS NULL;
```

---

## 2. Cambios en Backend (`backend-insforge`)

### Archivos Afectados:
1. **[`courses.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/courses.controller.ts):**
   * Esquema Zod de validación: agregar `academic_year: z.number().int().min(2020).max(2040).optional()`.
   * En `getCourses`: soportar query param opcional `?academic_year=...`.
   * Ordenamiento por defecto: `.order('academic_year', { ascending: false }).order('name', { ascending: true })`.
   * En `createCourse`: inferir año desde `start_date` o año actual si no se proporciona.
2. **[`enrollments.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/enrollments.controller.ts):**
   * En `getEnrollments`: incluir `academic_year` en el join de `courses (id, name, description, monthly_fee, academic_year)`.
   * Aplanar en `flatData`: `academic_year: item.courses?.academic_year || 2026`.
   * Soportar query param `?academic_year=...`.
   * En `enrollStudent`: resolución robusta de `finalBranchId` con fallback a la sede del estudiante o sede por defecto.
3. **[`appVersion.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/appVersion.controller.ts):**
   * Actualizar metadatos oficiales a versión `1.2.3`, `versionCode: 37`, título y notas de versión.

---

## 3. Cambios en Frontend (`frontend-antigravity`)

### Archivos Afectados:
1. **[`academicService.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/academic/academicService.ts):**
   * Extender interfaz `Course`: agregar `academic_year?: number;`.
   * Extender interfaz `Enrollment`: agregar `academic_year?: number;`.
   * Modificar `getCourses(academicYear?)` con soporte polimórfico seguro ante `QueryFunctionContext` de TanStack Query.
2. **[`CoursesList.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/academic/CoursesList.tsx):**
   * Estado `selectedYearFilter` para conmutar píldoras de filtrado (`Todos`, `Ciclo 2027`, `Ciclo 2026`).
   * Badge visual `🏷️ Ciclo {c.academic_year}` en tarjetas de cursos.
   * Input numérico `Ciclo / Año Lectivo *` en modal de crear/editar curso.
3. **[`EnrollmentsList.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/academic/EnrollmentsList.tsx):**
   * Píldoras de filtrado rápido por ciclo lectivo en la barra superior.
   * Búsqueda en tiempo real habilitada por año escolar.
   * Badges de ciclo en tabla de escritorio y tarjetas móviles.
   * Selector rápido de ciclo dentro del modal "Inscribir Estudiante" arriba del selector de curso.
   * Badges identificadores de ciclo dentro de las opciones de `SearchableSelect`.

---

## 4. Estrategia de Pruebas y Validación Pre-Despliegue

1. **Compilación Estática:** `npm run build` en backend y frontend (cero errores de TypeScript).
2. **Pruebas en Contenedor Aislado (`test-backend` en puerto 4001):**
   * Verificar endpoint de versión (`GET /api/app-version/latest`).
   * Verificar listado de matrículas con presencia de `academic_year` numérico.
   * Verificar filtrado estricto por 2026 y 2027.
   * Realizar inscripción real de prueba en ciclo 2027 y validar que aparezca en el filtro.
   * Eliminar matrícula de prueba y verificar limpieza absoluta.
3. **Despliegue y Verificación en Producción:**
   * Recargar contenedores Docker (`ultec-backend` y `ultec-frontend`).
   * Validar endpoint público HTTPS `https://plataformaultec.duckdns.org/api/app-version/latest`.
