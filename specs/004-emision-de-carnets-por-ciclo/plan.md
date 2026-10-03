# Plan Técnico de Implementación — Spec 004
## Emisión de Carnets y Credenciales Oficiales por Ciclo Lectivo

**Versión Objetivo:** `v1.2.5 (Build 41)`  
**Metodología:** Spec-Driven Development (SDD)  

---

## 1. Archivos Afectados

### Backend (`backend-insforge/`)
* [`src/controllers/credentials.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/credentials.controller.ts):
  - Actualizar `getCredentialRequests` para consultar `courses:course_id ( id, name, academic_year )` en la relación de `enrollments`.
  - Extraer y mapear `academic_year` de cada estudiante.
  - Soportar filtro por `req.query.academic_year`.
  - En `getStudentCredentialCard`, determinar `academic_year` de la matrícula activa o `req.query.academic_year`, configurando dinámicamente `cycle: 'Ciclo Lectivo ' + year` y `valid_until: '31/12/' + year`.
* [`src/controllers/appVersion.controller.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/backend-insforge/src/controllers/appVersion.controller.ts):
  - Sincronizar versión a `versionCode: 41`.

### Frontend (`frontend-antigravity/`)
* [`src/services/credentialsService.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/services/credentialsService.ts):
  - Actualizar interfaz `CredentialRequestItem` agregando `academic_year?: number`.
  - Agregar parámetro `academic_year?: number | string` a `getCredentialRequests`.
  - Agregar parámetro opcional `params?: { academic_year?: number | string }` a `getStudentCredentialCard`.
* [`src/features/academic/StudentCredentialsAdmin.tsx`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/features/academic/StudentCredentialsAdmin.tsx):
  - Cargar catálogo de cursos para calcular `distinctCycles`.
  - Integrar `<CycleSelectorPills>` en la barra de filtros con `maxVisiblePills={1}`.
  - Mostrar badge de ciclo en las tarjetas de solicitud.
  - Pasar el ciclo a la vista previa de impresión.
* [`src/config/appConfig.ts`](file:///C:/Users/saul_/.gemini/antigravity/scratch/PlataformaULTEC/frontend-antigravity/src/config/appConfig.ts):
  - Actualizar `buildNumber: 41`.

---

## 2. Pseudocódigo y Lógica

### Backend: `getCredentialRequests`
```typescript
const { status, branch_id, search, academic_year } = req.query;

// En Batch Hydration:
.from('students')
.select(`
    id,
    full_name,
    personal_code,
    academy_code,
    branch_id,
    status,
    branches:branch_id ( id, name, address, phone ),
    enrollments (
        id,
        is_active,
        courses:course_id ( id, name, academic_year )
    )
`)

// Para cada estudiante:
const activeEnrollment = st?.enrollments?.find((e: any) => e.is_active && e.courses);
const studentYear = activeEnrollment?.courses?.academic_year || 2026;

// Filtrar si academic_year está presente y no es 'ALL':
if (academic_year && academic_year !== 'ALL') {
    formatted = formatted.filter(item => String(item.academic_year) === String(academic_year));
}
```

### Frontend: `StudentCredentialsAdmin.tsx`
```tsx
const [selectedYearFilter, setSelectedYearFilter] = useState<'ALL' | number>('ALL');

// Cargar cursos con useQuery para calcular distinctCycles
const { data: coursesList } = useQuery({ queryKey: ['courses'], queryFn: getCourses });
const distinctCycles = useMemo(() => {
    const years = new Set<number>();
    (coursesList || []).forEach((c: any) => {
        if (c.academic_year) years.add(c.academic_year);
    });
    return Array.from(years).sort((a, b) => b - a);
}, [coursesList]);

// Renderizar CycleSelectorPills en la barra de filtros:
<CycleSelectorPills
    cycles={distinctCycles}
    selectedYear={selectedYearFilter}
    onSelectYear={setSelectedYearFilter}
    maxVisiblePills={1}
    className="!bg-slate-100 dark:!bg-slate-800"
/>
```

---

## 3. Estrategia de Pruebas y Validación
1. Compilar Backend con `npm run build` en `backend-insforge` (0 errores).
2. Compilar Frontend con `npm run build` en `frontend-antigravity` (0 errores).
3. Verificar filtrado de solicitudes por ciclo en la API.
4. Desplegar en VPS y recargar Nginx y Docker backend.
