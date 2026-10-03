# Spec 004 — Emisión de Carnets y Credenciales Oficiales por Ciclo Lectivo

**Estado:** Propuesta / En Planificación (Build 41)  
**Fecha:** 2026-10-02  
**Módulos Afectados:** `/credentials-admin` (StudentCredentialsAdmin.tsx), Backend Express (`credentials.controller.ts`), Frontend Service (`credentialsService.ts`).

---

## 1. Contexto y Justificación
En instituciones de educación técnica y superior como **ULTRA TECNOLOGÍA**, la emisión de credenciales oficiales y carnets estudiantiles en PVC (estándar CR80) está estrictamente vinculada al ciclo escolar vigente en el que el alumno se encuentra matriculado:
1. **Aislamiento por Ciclo:** Al comenzar un nuevo año (ej. Ciclo 2027), la Secretaría y Dirección deben procesar las solicitudes de carnets de los nuevos matriculados y reingresos sin mezclar ni reimprimir carnets de estudiantes del ciclo anterior (Ciclo 2026).
2. **Fidelidad y Autenticidad en la Impresión:** Actualmente, la plantilla de impresión de credenciales físicas (`getStudentCredentialCard` y modal de impresión) genera el texto `"Ciclo Lectivo [Año]"` y `"Válido hasta: 31/12/[Año]"` basándose en el reloj del servidor (`new Date().getFullYear()`), lo que genera inconsistencias al imprimir credenciales de ciclos específicos o anticipados.
3. **Control y Auditoría:** La administración necesita filtrar las solicitudes por ciclo (`[Todos] [Ciclo 2027] [Más ciclos... ▾]`), visualizar insignias de ciclo en cada solicitud e imprimir credenciales físicas con el ciclo lectivo oficial correspondiente.

---

## 2. Usuarios y Actores
* **SuperAdmin y Dirección:** Supervisa las emisiones de credenciales en todas las sedes segmentando por ciclo lectivo escolar.
* **Secretaría Académica:** Filtra solicitudes de carnets por ciclo lectivo, manda a imprimir en PVC las credenciales del ciclo activo y registra la entrega física en ventanilla.
* **Estudiantes y Tutores:** Reciben un carnet con la vigencia y ciclo lectivo oficial exacto de su curso.

---

## 3. Historias de Usuario
* **HU-1:** Como secretaria, quiero filtrar las solicitudes de carnets por ciclo lectivo (ej. `Ciclo 2027`) para enfocarme en imprimir los carnets del nuevo ciclo escolar sin confusiones con años pasados.
* **HU-2:** Como administrador, al visualizar la lista de solicitudes, quiero ver claramente la insignia del ciclo escolar al que pertenece el estudiante para validar su solvencia y vigencia.
* **HU-3:** Como funcionario que imprime la credencial en PVC, quiero que el formato de impresión plasme de manera fidedigna el ciclo lectivo oficial (ej. `Ciclo Lectivo 2027`) y su fecha de vigencia según el curso matriculado.

---

## 4. Requisitos Funcionales en Sintaxis EARS

### Interfaz Administrativa (`StudentCredentialsAdmin.tsx`)
* **RF-1 (Evento):** `CUANDO la secretaría o administración ingresa a la Gestión de Carnets y Credenciales, EL SISTEMA presenta el componente híbrido de ciclos lectivos ('Todos', 'Ciclo 2027', 'Más ciclos... ▾') derivado de los ciclos de los cursos activos.`
* **RF-2 (Evento):** `CUANDO el usuario selecciona un ciclo lectivo, EL SISTEMA filtra automáticamente la bandeja de solicitudes (Pendientes, Listos, Entregados, Todos) acotando el listado únicamente a los estudiantes vinculados a dicho ciclo.`
* **RF-3 (Comportamiento permanente):** `EL SISTEMA muestra una insignia distintiva del ciclo escolar (ej. 'Ciclo 2027' en color institucional) en cada tarjeta de solicitud de carnet.`
* **RF-4 (Evento):** `CUANDO el usuario abre la vista previa o genera la impresión física de un carnet (PVC CR80), EL SISTEMA plasma con exactitud el ciclo escolar ('Ciclo Lectivo YYYY') y la fecha de vigencia correspondiente al ciclo del estudiante.`

### Backend y Lógica de Negocio (`credentials.controller.ts`)
* **RF-5 (Evento):** `CUANDO el endpoint GET /api/credentials/requests recibe el parámetro 'academic_year', EL SISTEMA filtra las solicitudes de estudiantes cuyas matrículas pertenezcan a dicho ciclo escolar.`
* **RF-6 (Comportamiento permanente):** `EL SISTEMA incluye el ciclo lectivo ('academic_year') en la respuesta de cada estudiante y solicitud de credencial.`
* **RF-7 (Comportamiento permanente):** `EL SISTEMA en GET /api/credentials/card-data/:studentId determina el ciclo lectivo real a partir de la matrícula activa del estudiante (o parámetro opcional 'academic_year'), sin depender del reloj del servidor.`

---

## 5. Requisitos No Funcionales
* **Diseño e Identidad:** Utiliza el componente estándar `CycleSelectorPills` con soporte para modo claro/oscuro de Tailwind CSS.
* **Compatibilidad:** Mantiene retrocompatibilidad para solicitudes existentes de alumnos que no tengan ciclo explícito asignándoles el ciclo por defecto del curso.
* **Rendimiento:** El filtrado por ciclo aprovecha el `studentMap` de Batch Hydration sin generar consultas N+1 en la base de datos.

---

## 6. Criterios de Aceptación (Acceptance Gate)
1. Parámetro `academic_year` implementado y funcional en `getCredentialRequests` y `getStudentCredentialCard`.
2. Componente `CycleSelectorPills` integrado en la cabecera de filtros de `StudentCredentialsAdmin.tsx`.
3. Badges de ciclo visibles en las tarjetas de solicitudes.
4. Vista previa e impresión física reflejando el ciclo lectivo correspondiente.
5. Cero (0) errores de TypeScript en frontend y backend (`npm run build` exitoso).
6. Despliegue en producción y sincronización de versión a `v1.2.5 (Build 41)`.
