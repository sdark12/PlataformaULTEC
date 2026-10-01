---
name: local-dates
description: Standardizes date and timezone handling for Plataforma ULTEC to prevent financial calculation errors, payment due date mismatches, and reporting inaccuracies caused by UTC conversions.
---

# Manejo de Fechas Locales — Plataforma ULTEC

## Principio Fundamental

**Todas las fechas y horas visibles al usuario o usadas en cálculos financieros DEBEN representar la hora local de Honduras (America/Tegucigalpa, UTC-6).**

La base de datos (PostgreSQL) almacena timestamps en UTC (`timestamptz`), pero toda lógica de presentación y cálculo debe convertirse a zona horaria local antes de comparar, filtrar o mostrar.

## Zona Horaria Oficial

- **Zona:** `America/Tegucigalpa`
- **Offset fijo:** `UTC-06:00` (Honduras no observa horario de verano)
- **Formato de fecha institucional:** `DD/MM/YYYY` (día/mes/año)
- **Formato de hora institucional:** `HH:mm` (24 horas)

## Reglas Obligatorias

### 1. Backend (Node.js / Express)

```typescript
// ✅ CORRECTO: Obtener fecha actual en hora local
const now = new Date();
const localDate = now.toLocaleDateString('es-HN', { timeZone: 'America/Tegucigalpa' });

// ✅ CORRECTO: Obtener mes actual para cortes de pago (YYYY-MM)
const currentMonth = new Date().toLocaleString('sv-SE', { 
  timeZone: 'America/Tegucigalpa' 
}).slice(0, 7); // "2026-10"

// ❌ INCORRECTO: Esto puede dar el día/mes equivocado cerca de medianoche
const badMonth = new Date().toISOString().slice(0, 7);
```

**Regla para consultas de rango de fechas:**
```typescript
// ✅ CORRECTO: Inicio y fin del mes actual en hora local
const startOfMonth = new Date(
  new Date().toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' })
);
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

// ❌ INCORRECTO: UTC puede estar en un día diferente
const badStart = new Date(new Date().toISOString().slice(0, 7) + '-01');
```

### 2. Frontend (React / TypeScript)

```typescript
// ✅ CORRECTO: Formatear fecha para mostrar al usuario
const formatDate = (isoString: string): string => {
  return new Date(isoString).toLocaleDateString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// ✅ CORRECTO: Formatear fecha y hora
const formatDateTime = (isoString: string): string => {
  return new Date(isoString).toLocaleString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// ❌ INCORRECTO: toISOString() siempre devuelve UTC
const bad = new Date(isoString).toISOString().split('T')[0];
```

### 3. PostgreSQL / Supabase Queries

```sql
-- ✅ CORRECTO: Filtrar pagos del mes actual en hora local
SELECT * FROM payments 
WHERE created_at AT TIME ZONE 'America/Tegucigalpa' >= 
      date_trunc('month', NOW() AT TIME ZONE 'America/Tegucigalpa');

-- ❌ INCORRECTO: Esto usa medianoche UTC, no local
SELECT * FROM payments 
WHERE created_at >= date_trunc('month', NOW());
```

### 4. Cron Jobs y Tareas Programadas

- Los schedulers del backend (backup, envío de recordatorios) deben calcularse en hora local.
- Si se usa `node-cron`, la expresión cron se evalúa en la zona del servidor (UTC en el VPS). Ajustar +6 horas para equivalencia Honduras.
- Ejemplo: Para ejecutar a las 8:00 AM Honduras = cron `0 14 * * *` en UTC.

## Checklist Pre-Commit

- [ ] ¿Alguna fecha usa `.toISOString()` para comparaciones o visualización? → Reemplazar con `.toLocaleString()` + timeZone.
- [ ] ¿Los cortes de mes usan `.slice(0, 7)` sobre un ISO string? → Usar `toLocaleString('sv-SE', { timeZone })` en su lugar.
- [ ] ¿Los reportes de antigüedad de deuda calculan días de mora correctamente en hora local?
- [ ] ¿Los cron jobs consideran el offset UTC-6?
