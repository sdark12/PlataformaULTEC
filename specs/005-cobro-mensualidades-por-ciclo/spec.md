# Especificación Funcional: Cobro y Gestión de Mensualidades por Ciclo Lectivo
## Identificador: SPEC-005

---

## 1. Contexto y Problema de Negocio

En **ULTRA TECNOLOGÍA**, la institución opera simultáneamente con estudiantes en el **Ciclo Lectivo 2026** (cursos regulares en curso) y el **Ciclo Lectivo 2027** (cursos adelantados o matrículas nuevas).

Actualmente, el módulo de cobro y tesorería (`/payments`):
1. **Año Fijo en el Modal de Cobro:** Al registrar un pago de colegiatura, el selector de meses está fijado estáticamente a `2026`. Si un cajero cobra a un estudiante matriculado en un curso 2027 (ej. *TAC1-2027*), el sistema no detecta automáticamente el año del curso, obligando al cajero a cambiar manualmente de año o arriesgando pagos registrados bajo meses del 2026.
2. **Falta de Segmentación en la Tabla de Pagos:** La vista general de cobros y el arqueo diario/mensual no cuentan con un filtro por ciclo escolar (`CycleSelectorPills`), dificultando conciliar los ingresos percibidos para el ciclo 2027 versus los del 2026.
3. **Ausencia de Insignia de Ciclo en Recibos y Estados de Cuenta:** En las filas de la tabla de pagos y en el modal de estado de cuenta no se especifica visiblemente a qué ciclo lectivo corresponde el curso cancelado.

---

## 2. Historias de Usuario

- **COMO** Cajero o Secretaria de Plantel, **QUIERO** que al seleccionar a un alumno para cobrar colegiatura el selector de meses se posicione automáticamente en el ciclo lectivo de su carrera (ej. 2027), **PARA** agilizar el cobro y evitar errores de registro en años incorrectos.
- **COMO** Director de Sede o Superadministrador, **QUIERO** filtrar el historial de pagos y totales cobrados por ciclo lectivo (2027 vs 2026), **PARA** realizar auditorías y arqueos de caja específicos por ciclo escolar.
- **COMO** Padre de Familia o Tutor, **QUIERO** ver reflejado en el estado de cuenta y comprobantes el ciclo lectivo exacto de los cursos pagados, **PARA** tener certeza de la vigencia de los pagos realizados.

---

## 3. Requisitos del Sistema (Sintaxis EARS)

### 3.1. Detección y Ajuste Automático en el Cobro (Modal)
- **CUANDO** el usuario seleccione un estudiante en el formulario de nuevo pago, **EL SISTEMA DEBE** inspeccionar los cursos matriculados y establecer `selectedYear` automáticamente en el `academic_year` de la carrera activa.
- **MIENTRAS** el usuario esté seleccionando los meses de colegiatura en la cuadrícula visual, **EL SISTEMA DEBE** permitir alternar entre ciclos lectivos (2027 y 2026) mediante botones de acceso rápido y controles de navegación de año.
- **CUANDO** el usuario alterne de ciclo escolar en el modal de cobro, **EL SISTEMA DEBE** recalcular los meses pendientes y pagados correspondientes a ese año fiscal.

### 3.2. Filtrado de la Tabla de Pagos y Arqueo
- **EL SISTEMA DEBE** proveer el componente `CycleSelectorPills` con `maxVisiblePills={1}` en la barra de herramientas de `/payments`, mostrando `[Todos] [Ciclo 2027] [Más ciclos... ▾]`.
- **CUANDO** el usuario seleccione un ciclo en las píldoras, **EL SISTEMA DEBE** filtrar los pagos listados, los contadores de totales y la exportación de Excel para reflejar únicamente las transacciones del ciclo seleccionado.
- **EL SISTEMA DEBE** mostrar una insignia distintiva de ciclo (ej. `Ciclo 2027` o `Ciclo 2026`) junto al nombre del curso en cada fila de pago y tarjeta móvil.

### 3.3. Estado de Cuenta del Estudiante
- **CUANDO** se consulte el estado de cuenta de un alumno (`StudentStatementModal`), **EL SISTEMA DEBE** mostrar el ciclo lectivo de cada curso matriculado.

---

## 4. Casos Borde
1. **Estudiante con cursos en múltiples ciclos (ej. un curso 2026 y otro 2027):**
   - El sistema debe dar prioridad al ciclo más reciente (2027) por defecto y permitir alternar con un solo clic.
2. **Curso sin `academic_year` definido:**
   - El sistema debe utilizar como respaldo el año de la fecha de inicio (`start_date`) o el año calendario actual.
3. **Pagos de tipo 'INSCRIPCIÓN' o 'OTROS' (no colegiatura):**
   - El filtro de ciclo en la tabla principal debe asociar el pago al ciclo del curso vinculado mediante `enrollments.courses.academic_year`.
