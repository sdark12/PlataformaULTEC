1. Principio Arquitectónico

El frontend se construye bajo el modelo:

UI (Antigravity)
    ↓
Stitch (API Client + Cache Layer)
    ↓
backend-insforge (Business Logic)
    ↓
Database


El frontend NO consume directamente el backend.

Stitch actúa como:

Cliente API centralizado

Gestor de autenticación

Capa de caché estilo React Query

Orquestador de invalidaciones

2. Separación de Responsabilidades
Antigravity (UI Layer)

Responsable de:

Componentes visuales

Layout

Routing

Formularios

UX

Estados locales (UI only)

NO maneja:

Tokens

Fetch manual

Caché remota

Stitch (Data Layer)

Responsable de:

2.1 Cliente API

Encapsular todas las llamadas HTTP

Inyectar Authorization header

Manejar interceptores globales

Manejar refresh de token

Normalizar respuestas

2.2 Capa de Caché estilo React Query

Cada request se maneja como:

Query (lectura)

Mutation (escritura)

Debe incluir:

queryKey estructurada

staleTime configurable

cacheTime configurable

invalidación automática tras mutaciones

refetch en background

3. Estructura de Carpetas
frontend-antigravity/
│
├── src/
│   ├── app/
│   ├── pages/
│   ├── components/
│   ├── features/
│   │   ├── students/
│   │   ├── courses/
│   │   ├── billing/
│   │   ├── attendance/
│   │   └── auth/
│   │
│   ├── services/
│   │   ├── apiClient.ts
│   │   ├── queryClient.ts
│   │   └── authService.ts
│   │
│   ├── hooks/
│   │   ├── useStudents.ts
│   │   ├── usePayments.ts
│   │   ├── useInvoices.ts
│   │   └── useEnrollments.ts
│   │
│   ├── store/
│   │   └── uiStore.ts
│   │
│   └── routes/
│
└── stitch.config.ts

4. Patrón de Queries

Cada módulo académico debe usar el patrón:

Ejemplo conceptual
Query
useQuery({
  queryKey: ['students', branchId],
  queryFn: fetchStudents,
  staleTime: 5 minutos,
})

Mutation
useMutation({
  mutationFn: registerPayment,
  onSuccess: () => {
    invalidate(['students'])
    invalidate(['financialStatus'])
  }
})

5. Convención de Query Keys

Estructura obligatoria:

[entity, branchId, optionalFilters]


Ejemplos:

['students', 1]
['payments', 1, { month: '2026-02' }]
['attendance', 1, courseId]
['invoices', 1]


Esto permite:

Multi-sede real

Aislamiento por branch

Escalabilidad

6. Flujo de Autenticación

Login desde Antigravity.

Stitch envía credenciales.

Backend devuelve JWT.

Stitch guarda token seguro.

Stitch inyecta token automáticamente.

QueryClient se resetea en logout.

El frontend nunca manipula JWT directamente.

7. Invalidaciones Estratégicas

Después de:

Registrar pago → invalidar financialStatus + payments

Crear factura → invalidar invoices

Crear enrollment → invalidar students + enrollments

Registrar asistencia → invalidar attendance

Siempre invalidación específica, nunca global.

8. Ventajas Técnicas

✔ Evita requests duplicados
✔ Reduce carga al backend
✔ UI reactiva automática
✔ Refetch inteligente
✔ Experiencia fluida
✔ Escalable a miles de registros

9. Regla Crítica

Nunca:

Hacer fetch manual dentro de componentes.

Guardar datos remotos en estado global manual.

Duplicar lógica de invalidación.

Todo dato remoto debe pasar por Stitch + Query pattern.