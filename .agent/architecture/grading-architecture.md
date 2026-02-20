Este documento está alineado con:

Promedio simple sobre 100

4 bimestres

Promedio semestral (2 bimestres)

Promedio anual (4 bimestres)

Cálculo dinámico (no persistido)

Compatible con multi-sede

GRADING ARCHITECTURE

Sistema de Calificaciones Académicas
Plataforma Academia

1. Propósito

Este documento define la arquitectura del módulo de calificaciones, permitiendo:

Evaluaciones por curso

Notas por alumno

Promedios bimestrales

Promedios semestrales

Promedio anual

Cálculo flexible

Escalabilidad futura

Este módulo pertenece al dominio académico.

2. Modelo Académico Actual

Estructura institucional:

1 año académico

4 bimestres

Cada bimestre = 100 puntos

Promedio semestral = promedio de 2 bimestres

Promedio anual = promedio de 4 bimestres

El sistema debe permitir modificar la estructura en el futuro sin romper la base de datos.

3. Estructura Jerárquica

El modelo sigue esta jerarquía:

Academic Year
   ↓
Grading Period (Bimestre)
   ↓
Assessment (Rubros)
   ↓
Grade


Nunca se registra nota directamente al alumno sin pasar por enrollment.

4. Entidades del Sistema
4.1 academic_years

Representa el año académico.

Campos:

id

branch_id

year

is_active

created_at

Reglas:

Solo un año activo por sede.

4.2 grading_periods

Representa bimestres.

Campos:

id

academic_year_id

name (Bimestre 1, etc.)

period_type (BIMESTER)

order_index (1,2,3,4)

start_date

end_date

is_closed

created_at

Reglas:

order_index define orden lógico.

is_closed bloquea edición de notas.

4.3 assessments

Representa rubros evaluativos dentro de un bimestre.

Ejemplos:

Cuaderno (10)

Tareas (10)

Comportamiento (10)

Examen (30)

Proyecto (40)

Campos:

id

course_id

grading_period_id

title

weight_points

max_score

created_by (teacher_id)

created_at

Reglas:

SUM(weight_points) por grading_period_id debe ser 100.

max_score generalmente = weight_points.

Solo docentes asignados al curso pueden crear evaluaciones.

4.4 grades

Contiene la nota individual por alumno.

Campos:

id

enrollment_id

assessment_id

score

comments

created_at

updated_at

Restricciones:

UNIQUE (assessment_id, enrollment_id)

score <= max_score

No se puede registrar nota si el período está cerrado.

5. Cálculo de Promedios

El sistema NO guarda promedios en la base de datos.

Todos los cálculos se realizan dinámicamente en backend-insforge.

5.1 Promedio Bimestral

Fórmula:

SUM(score)


Ya que el total de weight_points es 100.

5.2 Promedio Semestral

Semestre 1:
Bimestre 1 + Bimestre 2

Fórmula:

( promedio_bim1 + promedio_bim2 ) / 2


Semestre 2:
Bimestre 3 + Bimestre 4

5.3 Promedio Anual

Fórmula:

( bim1 + bim2 + bim3 + bim4 ) / 4

6. Motor Flexible

La flexibilidad se logra mediante:

No hardcodear cantidad de períodos.

Usar order_index.

Usar period_type.

Agrupar dinámicamente desde el backend.

Esto permite cambiar en el futuro a:

3 trimestres

2 semestres

5 parciales

Modelo por competencias

Sin rediseñar base de datos.

7. Reglas de Negocio

No se puede registrar nota fuera del rango del período.

No se puede editar nota si is_closed = true.

Solo ADMIN puede reabrir período cerrado.

El total de weight_points por período debe ser exactamente 100.

Validar branch_id en todas las operaciones.

Todas las operaciones deben registrar auditoría.

8. Flujo Operativo
Crear Año Académico

Crear academic_year.

Crear 4 grading_periods.

Marcar año activo.

Crear Evaluación

Validar docente asignado.

Validar que período esté abierto.

Validar suma de weight_points.

Insertar assessment.

Registrar Nota

Validar enrollment activo.

Validar score.

Insertar o actualizar grade.

Registrar auditoría.

Generar Reporte

Backend debe devolver:

{
  student: {},
  academicYear: 2026,
  bimesters: [
    { name: "B1", score: 85 },
    { name: "B2", score: 90 },
    { name: "B3", score: 88 },
    { name: "B4", score: 92 }
  ],
  semester1: 87.5,
  semester2: 90,
  annual: 88.75,
  status: "APROBADO"
}

9. Estado Académico

El sistema debe determinar automáticamente:

APROBADO si promedio_anual >= 60
REPROBADO si promedio_anual < 60


Este valor no se guarda, se calcula.

10. Integración con Frontend

Query Keys obligatorias:

['assessments', branchId, courseId, periodId]
['grades', branchId, enrollmentId, periodId]
['studentReport', branchId, enrollmentId, academicYearId]


Invalidaciones:

Crear evaluación → invalidar assessments

Registrar nota → invalidar grades + studentReport

Cerrar período → invalidar studentReport

Nunca invalidación global.