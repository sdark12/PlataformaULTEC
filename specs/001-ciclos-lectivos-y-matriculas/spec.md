# Spec 001 — Soporte Nativo de Ciclos Lectivos (Año Escolar) en Cursos y Matrículas

**Estado:** Implementada (Build 36 - 37)  
**Fecha:** 2026-09-30 / 2026-10-01  
**Módulos Afectados:** `/courses` (Gestión de Cursos), `/enrollments` (Matrículas e Inscripción), Backend Express API, PostgreSQL

---

## 1. Contexto y Objetivo
Históricamente, los cursos en Plataforma ULTEC incluían el año de forma manual dentro del nombre (ej. `TAC 1-2026`, `TAC1-2027`) para poder diferenciarse. Esto impedía realizar agrupaciones analíticas por año lectivo, generaba desorden al inscribir estudiantes y dificultaba la consulta histórica de alumnos por ciclo escolar.

El objetivo de esta especificación es dotar a la plataforma de un campo nativo numérico de **Ciclo / Año Lectivo (`academic_year`)** tanto en cursos como en matrículas, con filtrado ágil mediante pestañas, búsqueda rápida por año e insignias visuales tipo badge.

---

## 2. Usuarios y Actores
* **Superadministrador / Administrador:** Crea y edita cursos asignándoles un ciclo lectivo; consulta reportes y matrículas por año.
* **Secretaria:** Inscribe estudiantes filtrando cursos por año escolar para evitar inscribir alumnos en ciclos erróneos; busca matrículas históricas por ciclo lectivo.

---

## 3. Historias de Usuario
* **HU-1:** Como administrador, quiero asignar un año lectivo (ej. 2026, 2027) a cada curso al crearlo o editarlo para mantener el catálogo organizado por ciclos escolares.
* **HU-2:** Como secretaria, quiero filtrar la lista de cursos y matrículas mediante botones de ciclo (`Todos`, `2026`, `2027`) para enfocarme únicamente en los estudiantes del año activo.
* **HU-3:** Como secretaria, al abrir el modal "Inscribir Estudiante", quiero filtrar los cursos disponibles por ciclo escolar o escribir el año en el buscador para seleccionarlo rápidamente sin confusiones.

---

## 4. Requisitos Funcionales en Sintaxis EARS

### Gestión de Cursos
* **RF-1 (Evento):** `CUANDO el usuario crea o edita un curso, EL SISTEMA permite ingresar el Ciclo / Año Lectivo como un valor numérico entre 2020 y 2040.`
* **RF-2 (Condición no deseada):** `SI el usuario omite el campo academic_year al crear un curso, ENTONCES EL SISTEMA infiere el año automáticamente a partir de la fecha de inicio (start_date) o asigna el año actual.`
* **RF-3 (Comportamiento permanente):** `EL SISTEMA ordena el catálogo de cursos de forma descendente por año escolar y alfabéticamente por nombre (academic_year DESC, name ASC).`
* **RF-4 (Evento):** `CUANDO el usuario pulsa una píldora de ciclo en la vista de cursos (ej. 'Ciclo 2027'), EL SISTEMA muestra únicamente los cursos correspondientes a dicho año.`

### Matrículas e Inscripción
* **RF-5 (Comportamiento permanente):** `EL SISTEMA asocia a cada matrícula el academic_year del curso correspondiente mediante join relacional en la API.`
* **RF-6 (Evento):** `CUANDO el usuario escribe un año (ej. '2026' o '2027') en la barra de búsqueda de matrículas, EL SISTEMA filtra en tiempo real a los alumnos matriculados en dicho ciclo.`
* **RF-7 (Evento):** `CUANDO el usuario pulsa un botón de ciclo dentro del modal 'Inscribir Estudiante', EL SISTEMA actualiza las opciones del selector mostrando exclusivamente los cursos del ciclo seleccionado.`
* **RF-8 (Condición no deseada):** `SI el usuario envía una solicitud de inscripción sin especificar branch_id, ENTONCES EL SISTEMA hereda automáticamente la sede asignada al estudiante para evitar errores de restricción no nula en base de datos.`

---

## 5. Requisitos No Funcionales
* **Retrocompatibilidad Total:** Los cursos existentes antes de la migración deben conservar su operatividad y recibir por defecto el ciclo `2026` (o `2027` según corresponda).
* **Consistencia UI:** Todo indicador de ciclo debe utilizar el formato de badge con icono (`🏷️ Ciclo {year}`) coherente con la paleta de diseño institucional.
* **Rendimiento:** Las consultas a `/api/enrollments` y `/api/courses` deben responder en menos de 150 ms utilizando joins directos sin consultas N+1.

---

## 6. Casos Límite y Consideraciones de Borde
* **Cursos sin año explícito en BD antigua:** Deben mostrar fallback defensivo `2026` sin romper la interfaz.
* **Cursos con mismo nombre en diferentes años (ej. TAC 1 en 2026 y TAC 1 en 2027):** El selector de cursos debe incluir la insignia de ciclo en cada opción para que el usuario distinga claramente cuál está eligiendo.
* **Filtro 'Todos':** Debe estar siempre disponible como primera opción para ver el historial consolidado sin restricciones.

---

## 7. Criterios de Finalización (Acceptance Gate)
1. Columna `academic_year integer` presente en la tabla `courses` de PostgreSQL.
2. Compilación de frontend y backend con 0 errores de TypeScript (`npm run build`).
3. Batería de pruebas automatizada de 6 pruebas en contenedor aislado ejecutada con 100% de éxito.
4. Incremento de versión a Build 37 (v1.2.3) en los 5 archivos del proyecto.
