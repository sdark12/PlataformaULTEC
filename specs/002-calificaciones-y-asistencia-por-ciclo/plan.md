# Plan Técnico — Spec 002: Ciclos Lectivos en Calificaciones y Asistencia

**Spec Asociada:** [`spec.md`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/specs/002-calificaciones-y-asistencia-por-ciclo/spec.md)  
**Versión de Lanzamiento:** Build 38 (v1.2.4)  
**Stack Involucrado:** React 19 + TypeScript + Tailwind CSS + IndexedDB + Express API

---

## 1. Modificaciones en Frontend (`frontend-antigravity`)

### 1.1 Módulo de Calificaciones ([`Grades.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/academic/Grades.tsx))
- **Estados de Ciclo:**
  - `selectedYearFilter`: `'ALL' | number` (inicializado en `'ALL'`).
- **Memoizaciones:**
  - `distinctCycles`: Extracción y ordenamiento descendente de años únicos a partir de `effectiveCourses`:
    ```typescript
    const distinctCycles = useMemo(() => {
        const years = new Set<number>();
        effectiveCourses.forEach((c: any) => {
            if (c.academic_year) years.add(c.academic_year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [effectiveCourses]);
    ```
  - `filteredCourses`: Filtrado de cursos según `selectedYearFilter`:
    ```typescript
    const filteredCourses = useMemo(() => {
        if (selectedYearFilter === 'ALL') return effectiveCourses;
        return effectiveCourses.filter((c: any) => (c.academic_year || 2026) === selectedYearFilter);
    }, [effectiveCourses, selectedYearFilter]);
    ```
  - `courseOptions`: Mapeo enriquecido para `SearchableSelect` con `badge` y `subLabel`:
    ```typescript
    const courseOptions = useMemo<SearchableOption[]>(() => {
        if (!filteredCourses) return [];
        return filteredCourses.map((c: any) => ({
            value: c.id,
            label: c.name,
            subLabel: `Ciclo ${c.academic_year || 2026}${c.monthly_fee ? ` • Q${c.monthly_fee}/mes` : ''}`,
            badge: `Ciclo ${c.academic_year || 2026}`
        }));
    }, [filteredCourses]);
    ```
- **Ajuste automático de selección:**
  - Si el curso actual deja de existir en `filteredCourses`, seleccionar automáticamente el primer curso del ciclo activo o limpiar.
- **Interfaz (UI):**
  - Renderizar barra superior con píldoras `[Todos] [Ciclo 2027] [Ciclo 2026]` arriba de los selectores.

### 1.2 Módulo de Asistencia ([`Attendance.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/academic/Attendance.tsx))
- **Estados y Memoizaciones:**
  - Agregar `selectedYearFilter` y `distinctCycles`.
  - `filteredCourses`: Filtrar `effectiveCourses` por ciclo.
- **Selector de Curso:**
  - Renderizar opciones mostrando `[Ciclo {year}] {course.name}`.
  - Barra de píldoras de ciclo escolar integrada en la barra de herramientas de selección.

---

## 2. Modificaciones en Backend (`backend-insforge`)

- Sincronización y actualización de versión en [`appVersion.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/appVersion.controller.ts) a Build 38 (v1.2.4) con notas de versión.
- Validación de integridad de endpoints `/api/grades` y `/api/attendance` para garantizar respuesta rápida y precisa.

---

## 3. Protocolo de Pruebas y Despliegue

1. Compilación TypeScript en frontend (`tsc -b && vite build`) y backend (`tsc`).
2. Despliegue en contenedor de pruebas aislado `test-backend` en puerto 4001 en el VPS.
3. Validación automatizada de endpoints y datos de cursos, calificaciones y asistencia.
4. Despliegue final a producción en `ultec-backend` y `ultec-frontend`.
5. Verificación pública en `https://plataformaultec.duckdns.org/api/app-version/latest`.
