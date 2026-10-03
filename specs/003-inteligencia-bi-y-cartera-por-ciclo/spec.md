# Spec 003 — Segmentación por Ciclo Lectivo en Inteligencia BI y Cartera Vencida

**Estado:** En Proceso (Build 39)  
**Fecha:** 2026-10-02  
**Módulos Afectados:** `/reports` (ReportsHub: EarlyWarningDashboard, DebtAgingDashboard), Backend Express (`intelligence.controller.ts`), Frontend React (`intelligenceService.ts`).

---

## 1. Contexto y Objetivo
Con la incorporación del campo nativo de Ciclo Lectivo / Año Escolar (`academic_year`) en Cursos (Build 36), Matrículas (Build 37), y Calificaciones/Asistencia (Build 38), los módulos estratégicos de Business Intelligence y Finanzas Avanzadas dentro de `ReportsHub` (`/reports`) aún procesaban la población estudiantil y las obligaciones financieras de forma plana o únicamente agrupada por cursos individuales.

Esto provocaba que:
1. El **Semáforo de Deserción Escolar (Early Warning System - EWS)** mezclara estudiantes de ciclos pasados (ej. Ciclo 2026) con estudiantes del ciclo activo (ej. Ciclo 2027), distorsionando el promedio global del Índice de Retención Escolar (IRE).
2. El panel de **Cartera Vencida y Antigüedad de Deuda (Debt Aging)** calculara las metas mensuales esperadas, cuotas facturables, índices de morosidad y antigüedad de saldos (>90 días, 61-90 días, 31-60 días, 0-30 días) sumando todas las matrículas históricas sin poder aislar la gestión de cobranza del ciclo escolar vigente.

El objetivo de esta especificación es integrar de extremo a extremo (Frontend UI, API Client, Backend Controller, Cache de NodeCache y Queries a Supabase/PostgreSQL) el filtrado por ciclo lectivo escolar (`academic_year`), dotando a la dirección y administración de métricas puras por año lectivo.

---

## 2. Usuarios y Actores
* **Director General / SuperAdmin:** Analiza el semáforo de retención escolar y la cartera vencida discriminando por ciclo escolar y comparativa multi-sede.
* **Administrador de Sede:** Monitorea la recaudación mensual esperada y alumnos en riesgo de deserción del ciclo escolar actual (ej. Ciclo 2027).
* **Secretaría Académica / Cobranza:** Gestiona cobranza preventiva y recordatorios de pago por WhatsApp segmentados por ciclo sin mezclar saldos de años concluidos.

---

## 3. Historias de Usuario
* **HU-1:** Como director, quiero filtrar el Semáforo de Deserción Escolar por ciclo lectivo (ej. `Ciclo 2027`) para conocer el índice real de retención de los estudiantes activos en el ciclo actual.
* **HU-2:** Como administrador, quiero consultar la Antigüedad de Deuda (Aging Buckets) seleccionando un ciclo escolar para enfocar la cobranza en las cuotas del año lectivo correspondiente sin contaminación histórica.
* **HU-3:** Como usuario, al exportar a PDF o Excel el reporte de alerta temprana o cartera vencida, quiero que la información y métricas exportadas respeten el ciclo lectivo seleccionado.

---

## 4. Requisitos Funcionales en Sintaxis EARS

### Sistema de Alerta Temprana — EWS (`EarlyWarningDashboard.tsx`)
* **RF-1 (Evento):** `CUANDO el usuario visualiza el Semáforo de Deserción Escolar, EL SISTEMA presenta una barra interactiva de píldoras de ciclo escolar ('Todos', 'Ciclo 2027', 'Ciclo 2026') calculadas dinámicamente a partir del catálogo de cursos.`
* **RF-2 (Evento):** `CUANDO el usuario selecciona una píldora de ciclo escolar, EL SISTEMA filtra automáticamente las opciones del selector de cursos acotándolas al año seleccionado y refresca los KPIs de riesgo (Crítico, Moderado, Bajo e IRE Global).`
* **RF-3 (Comportamiento permanente):** `EL SISTEMA muestra el ciclo lectivo escolar ('[Ciclo YYYY]') en cada opción del selector desplegable de cursos.`
* **RF-4 (Condición no deseada):** `SI el curso seleccionado previamente no pertenece al nuevo ciclo escolar filtrado, ENTONCES EL SISTEMA restablece la selección de curso a 'Todas las Carreras' del ciclo activo.`

### Cartera Vencida y Antigüedad de Saldos (`DebtAgingDashboard.tsx`)
* **RF-5 (Evento):** `CUANDO el usuario accede al panel de Cartera Vencida, EL SISTEMA proporciona selector por píldoras de ciclo escolar ('Todos', 'Ciclo 2027', 'Ciclo 2026') sincronizado con las métricas financieras.`
* **RF-6 (Evento):** `CUANDO se activa un filtro de ciclo escolar, EL SISTEMA recalcula los buckets de antigüedad (1-30 días, 31-60 días, 61-90 días, >90 días), la meta de recaudación esperada y el listado de principales deudores únicamente con las obligaciones asociadas a dicho ciclo.`
* **RF-7 (Comportamiento permanente):** `EL SISTEMA genera los archivos exportados en PDF y Excel respetando fielmente el filtro de ciclo lectivo aplicado.`

### Backend y Caché Inteligente (`intelligence.controller.ts`)
* **RF-8 (Evento):** `CUANDO el backend recibe una solicitud GET con el parámetro 'academic_year', EL SISTEMA restringe la consulta de matrículas y cursos al año escolar indicado.`
* **RF-9 (Comportamiento permanente):** `EL SISTEMA incluye 'academic_year' en la clave de almacenamiento en memoria caché (NodeCache), garantizando respuestas inmediatas y consistentes al alternar entre ciclos.`
* **RF-10 (Condición no deseada):** `SI un curso especificado por 'course_id' no pertenece al 'academic_year' solicitado, ENTONCES EL SISTEMA retorna de forma segura un conjunto vacío sin lanzar excepciones ni mezclar datos de otros periodos.`

---

## 5. Requisitos No Funcionales
* **Rendimiento:** Tiempos de respuesta inferiores a 100 ms gracias a la partición de caché en NodeCache por sede, curso y año escolar.
* **Integridad Financiera:** Las operaciones financieras y de mora respetan la zona horaria `America/Tegucigalpa` (UTC-6).
* **Consistencia de Diseño:** Las píldoras de ciclo escolar mantienen idéntico lenguaje visual (Tailwind CSS, estilos claro/oscuro) empleado en Calificaciones, Asistencia y Matrículas.

---

## 6. Criterios de Aceptación (Acceptance Gate)
1. Parámetro `academic_year` integrado y operativo en endpoints `/api/intelligence/early-warning` y `/api/intelligence/debt-aging`.
2. Claves de NodeCache actualizadas para incluir `academic_year`.
3. Píldoras de ciclo e insignias de curso funcionales en `EarlyWarningDashboard.tsx` y `DebtAgingDashboard.tsx`.
4. Compilación de Frontend y Backend con cero (0) errores TypeScript.
5. Verificación automatizada al 100% en contenedor de pruebas aislado en VPS.
6. Actualización sincronizada de versión a Build 39 (v1.2.5) en los 5 archivos del proyecto.
