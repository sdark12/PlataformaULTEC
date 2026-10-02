# Spec 002 — Segmentación por Ciclo Lectivo en Calificaciones y Asistencia

**Estado:** En Proceso (Build 38)  
**Fecha:** 2026-10-01  
**Módulos Afectados:** `/grades` (Calificaciones), `/attendance` (Asistencia Escolar), Frontend React, Backend Express

---

## 1. Contexto y Objetivo
Con la incorporación del campo nativo de Ciclo Lectivo / Año Escolar (`academic_year`) en Cursos (Build 36) y Matrículas (Build 37), los módulos de Calificaciones y Asistencia continúan presentando un catálogo plano sin distinción de año. Esto genera que los docentes y el personal administrativo visualicen cursos de ciclos pasados mezclados con el ciclo activo, dificultando la selección y aumentando el riesgo de ingresar calificaciones o asistencias en un periodo lectivo erróneo.

El objetivo de esta especificación es integrar selectores de ciclo escolar mediante píldoras dinámicas (`[Todos] [Ciclo 2027] [Ciclo 2026]`), insignias visuales tipo badge en las opciones de curso y filtrado reactivo seguro compatible con el modo offline en ambos módulos.

---

## 2. Usuarios y Actores
* **Docente / Instructor:** Filtra rápidamente sus cursos por el ciclo escolar actual para asentar calificaciones por unidad o tomar asistencia diaria sin confusiones.
* **Administrador / Secretaría:** Supervisa libros de calificaciones y matrices de asistencia mensuales seleccionando el año escolar correspondiente.

---

## 3. Historias de Usuario
* **HU-1:** Como docente, quiero filtrar la lista de cursos por ciclo escolar para ver únicamente las materias del año lectivo vigente.
* **HU-2:** Como usuario, al desplegar la lista de cursos en Calificaciones o Asistencia, quiero ver claramente la insignia del ciclo (ej. `🏷️ Ciclo 2026`, `🏷️ Ciclo 2027`) para distinguir cursos homónimos de diferentes periodos.
* **HU-3:** Como docente que trabaja en zonas con baja conectividad, quiero que el filtrado por ciclo funcione también en modo offline utilizando la caché local de IndexedDB y localStorage.

---

## 4. Requisitos Funcionales en Sintaxis EARS

### Calificaciones (`Grades.tsx`)
* **RF-1 (Evento):** `CUANDO el usuario ingresa al módulo de Calificaciones, EL SISTEMA presenta una barra superior de píldoras de ciclo escolar ('Todos', 'Ciclo 2027', 'Ciclo 2026') calculadas dinámicamente a partir de los cursos disponibles.`
* **RF-2 (Evento):** `CUANDO el usuario pulsa una píldora de ciclo lectivo (ej. 'Ciclo 2027'), EL SISTEMA filtra automáticamente las opciones del selector de cursos mostrando únicamente aquellos del año seleccionado.`
* **RF-3 (Comportamiento permanente):** `EL SISTEMA muestra una insignia visual distintiva tipo badge ('🏷️ Ciclo {year}') en cada opción de curso dentro del selector SearchableSelect.`
* **RF-4 (Condición no deseada):** `SI el curso seleccionado actualmente no pertenece al ciclo lectivo filtrado por el usuario, ENTONCES EL SISTEMA selecciona automáticamente el primer curso del ciclo activo o limpia la selección para evitar incongruencias.`

### Asistencia Escolar (`Attendance.tsx`)
* **RF-5 (Evento):** `CUANDO el usuario ingresa al módulo de Asistencia, EL SISTEMA muestra los selectores de ciclo escolar junto a los controles de vista (Diaria / Matriz Mensual).`
* **RF-6 (Evento):** `CUANDO el usuario selecciona un ciclo escolar, EL SISTEMA filtra las opciones del menú desplegable de cursos y antepone la etiqueta '[Ciclo YYYY] Nombre del Curso'.`
* **RF-7 (Comportamiento permanente):** `EL SISTEMA preserva la selección de curso en localStorage ('last_attendance_course') únicamente si el curso pertenece al catálogo válido del ciclo.`

### Resiliencia Offline
* **RF-8 (Comportamiento permanente):** `EL SISTEMA almacena el atributo academic_year en la caché local (localStorage 'ultec_cached_courses_catalog'), garantizando que el filtrado por ciclo funcione en modo sin conexión.`

---

## 5. Requisitos No Funcionales
* **Rendimiento:** El cambio de ciclo en la interfaz debe ser instantáneo (< 16 ms) mediante memoización React (`useMemo`).
* **Consistencia UI:** Mismo patrón de diseño de píldoras azules/slate utilizado en `/courses` y `/enrollments`.
* **Zero-Regresión:** No alterar la lógica de cálculo de promedios, recuperación, subcalificaciones ni el registro de asistencias existentes.

---

## 6. Criterios de Finalización (Acceptance Gate)
1. Píldoras de ciclo escolar operativas en `/grades` y `/attendance`.
2. Filtro reactivo funcionando en las opciones del selector de cursos.
3. Compilación limpia (`npm run build`) de frontend y backend con 0 errores.
4. Batería de pruebas pre-despliegue en contenedor aislado superada con 100% de éxito.
5. Incremento de versión a Build 38 (v1.2.4) sincronizado en los 5 archivos institucionales.
