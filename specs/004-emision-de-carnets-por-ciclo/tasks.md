# Desglose de Tareas — Spec 004

## Tarea 1: Backend — Soporte de `academic_year` en `credentials.controller.ts`
- **Archivo:** `backend-insforge/src/controllers/credentials.controller.ts`
- **Cambio:**
  - Extraer `academic_year` en el select de `courses` en `getCredentialRequests` y en `getStudentCredentialCard`.
  - Mapear `academic_year` en cada item devuelto.
  - Implementar filtro `academic_year` en `getCredentialRequests`.
- **Hecho cuando:** `npm run build` en backend compile con 0 errores y el endpoint acepte `?academic_year=2027` devolviendo el campo correspondiente.

---

## Tarea 2: Frontend Service y Tipos — `credentialsService.ts`
- **Archivo:** `frontend-antigravity/src/services/credentialsService.ts`
- **Cambio:**
  - Agregar `academic_year?: number` a `CredentialRequestItem`.
  - Agregar `academic_year?: number | string` a `getCredentialRequests`.
  - Agregar parámetro opcional `params` a `getStudentCredentialCard`.
- **Hecho cuando:** Los tipos de TypeScript estén actualizados sin errores de compilación.

---

## Tarea 3: Frontend UI — Integración de `CycleSelectorPills` en `StudentCredentialsAdmin.tsx`
- **Archivo:** `frontend-antigravity/src/features/academic/StudentCredentialsAdmin.tsx`
- **Cambio:**
  - Cargar catálogo de cursos para calcular `distinctCycles`.
  - Integrar `<CycleSelectorPills>` en la barra de filtros.
  - Conectar `selectedYearFilter` al llamado `fetchRequests`.
  - Mostrar badge visual del ciclo escolar en las tarjetas de solicitud.
  - Enlazar el ciclo a la vista previa del carnet oficial.
- **Hecho cuando:** `npm run build` en frontend compile con 0 errores y la interfaz permita filtrar carnets por ciclo con el selector híbrido.

---

## Tarea 4: Sincronización de Versión a Build 41 y Despliegue en VPS
- **Archivos:**
  - `frontend-antigravity/src/config/appConfig.ts` (`buildNumber: 41`)
  - `backend-insforge/src/controllers/appVersion.controller.ts` (`versionCode: 41`)
- **Acciones:**
  - Empaquetar y subir dist a VPS (`129.213.56.16`).
  - Recargar `ultec-frontend` y `ultec-backend`.
  - Guardar y subir commit a `origin/master`.
- **Hecho cuando:** La versión v1.2.5 (Build 41) esté respondiendo en vivo en el servidor.
