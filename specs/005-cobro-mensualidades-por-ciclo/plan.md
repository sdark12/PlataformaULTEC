# Plan Técnico: Cobro y Gestión de Mensualidades por Ciclo Lectivo
## Identificador: PLAN-005

---

## 1. Arquitectura y Archivos Afectados

```
PlataformaULTEC/
├── backend-insforge/
│   └── src/
│       ├── controllers/
│       │   ├── payments.controller.ts        # Query enrollments->courses(academic_year) en getPayments y getStudentStatement
│       │   └── appVersion.controller.ts      # Bump a v1.2.5 (Build 42)
├── frontend-antigravity/
│   └── src/
│       ├── config/
│       │   └── appConfig.ts                  # Bump buildNumber: 42
│       ├── features/
│       │   └── finance/
│       │       ├── paymentService.ts         # Añadir academic_year a Payment y CourseStatement
│       │       ├── PaymentsList.tsx          # Auto-detección de ciclo al seleccionar alumno, selector rápido de ciclo en modal, CycleSelectorPills en barra
│       │       └── StudentStatementModal.tsx # Insignia de ciclo en los cursos del estado de cuenta
```

---

## 2. Detalles Técnicos por Componente

### 2.1. Backend (`payments.controller.ts`)
- En `getPayments`:
  - En la consulta Supabase, agregar `academic_year` a la relación `courses`:
    ```typescript
    enrollments (
        id,
        course_id,
        courses ( id, name, academic_year )
    )
    ```
  - En la transformación `flatData`:
    ```typescript
    academic_year: p.enrollments?.courses?.academic_year || null
    ```
  - Soporte para parámetro `req.query.academic_year` para filtrado opcional desde API.
- En `getStudentStatement`:
  - En la consulta de `enrollments`, agregar `academic_year` a `courses`:
    ```typescript
    courses ( id, name, academic_year, monthly_fee, duration_months, start_date, end_date )
    ```
  - Mapear `academic_year: e.courses.academic_year` en la respuesta de cursos.

### 2.2. Frontend Service (`paymentService.ts`)
- Extender la interfaz `Payment` con `academic_year?: number`.
- Extender la interfaz `CourseStatement` con `academic_year?: number`.

### 2.3. Frontend UI (`PaymentsList.tsx`)
- **Auto-detección en `selectStudent`:**
  - Extraer los cursos del alumno y determinar su `academic_year`.
  - Si el alumno tiene cursos de 2027, cambiar inmediatamente `setSelectedYear(2027)`.
- **Selector rápido de Ciclo en el Modal de Meses:**
  - En la cabecera del selector de meses, mostrar botones compactos para los ciclos relevantes (ej. `[2027]` `[2026]`) junto con el selector `< 2027 >`.
- **Filtro de Ciclo en la Tabla Principal de Pagos:**
  - Integrar `<CycleSelectorPills>` con `maxVisiblePills={1}` en la barra de herramientas.
  - Derivar `distinctCycles` a partir de los pagos y matrículas.
  - Filtrar `filteredPayments` por `selectedTableCycle` (cuando no sea 'ALL').
  - Mostrar badge `[Ciclo 2027]` en la columna de Curso.
- **Insignia en `StudentStatementModal.tsx`:**
  - Mostrar la insignia del ciclo junto al nombre de la carrera en el desglose de cursos.
