---
name: ultec-security-auditor
description: Security audit checklist for Plataforma ULTEC multi-branch architecture. Ensures branch_id isolation, role-based access control, and prevents privilege escalation in all API endpoints and database queries.
---

# Auditoría de Seguridad — Plataforma ULTEC

## Principio Fundamental

**Cada consulta, mutación y endpoint DEBE respetar el aislamiento multi-sede (`branch_id`) y la jerarquía de roles. Ningún usuario debe poder acceder a datos fuera de su sede asignada, a menos que sea superadmin.**

## Arquitectura de Roles

| Rol | Nivel de Acceso | branch_id | Descripción |
|-----|----------------|-----------|-------------|
| `superadmin` | Global | Todas las sedes | Acceso total al sistema, gestión de sedes |
| `admin` | Sede | Su branch_id | Administración completa de su sede |
| `secretary` | Sede (limitado) | Su branch_id | Gestión académica y financiera de su sede |
| `student` | Personal | Su branch_id | Solo sus propios datos |

## Reglas de Seguridad Obligatorias

### 1. Aislamiento por branch_id

**TODO endpoint que devuelva datos DEBE filtrar por `branch_id`:**

```typescript
// ✅ CORRECTO: Filtrar por sede del usuario
const branchId = getEffectiveBranchId(req);
let query = db.from('students').select('*');
if (branchId) {
    query = query.eq('branch_id', branchId);
}

// ❌ INCORRECTO: Sin filtro de sede — expone datos de TODAS las sedes
const { data } = await db.from('students').select('*');
```

**Excepciones permitidas (solo superadmin):**
- Endpoint de listado de sedes (`/api/branches`)
- Reportes consolidados cross-sede
- Panel de administración global

### 2. Validación de Roles en Endpoints

**Antes de ejecutar una operación, verificar que el usuario tiene el rol necesario:**

```typescript
// ✅ CORRECTO: Verificar rol antes de operar
const user = req.currentUser;
if (user?.role !== 'superadmin' && user?.role !== 'admin') {
    return res.status(403).json({ message: 'Insufficient permissions' });
}

// ❌ INCORRECTO: Confiar solo en la autenticación sin verificar autorización
```

### 3. Prevención de Escalación de Privilegios

**Un usuario NO debe poder:**
- Cambiar su propio rol
- Asignarse a una sede diferente
- Modificar datos de usuarios con rol superior
- Crear usuarios con rol superior al suyo

```typescript
// ✅ CORRECTO: Prevenir auto-escalación
if (targetUser.role === 'superadmin' && user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Cannot modify superadmin' });
}

// ✅ CORRECTO: No permitir crear usuarios de rol superior
const roleHierarchy = { student: 0, secretary: 1, admin: 2, superadmin: 3 };
if (roleHierarchy[newRole] > roleHierarchy[user.role]) {
    return res.status(403).json({ message: 'Cannot create user with higher role' });
}
```

### 4. Protección de Datos Sensibles

**NUNCA incluir en respuestas de la API:**
- Contraseñas (ni siquiera hasheadas)
- Tokens JWT de otros usuarios
- Claves SSH o credenciales del servidor
- Variables de entorno (`.env`)

**Campos sensibles que deben filtrarse:**
```typescript
// ✅ Seleccionar solo campos necesarios
db.from('users').select('id, email, full_name, role, branch_id');

// ❌ Seleccionar todo
db.from('users').select('*'); // Puede incluir password_hash, tokens, etc.
```

### 5. Validación de Entrada

**Toda entrada del usuario debe ser validada antes de procesarse:**

- UUIDs: Verificar formato antes de usar en queries (`/^[0-9a-f]{8}-...$/`)
- Strings: Sanitizar contra XSS si se renderiza en HTML
- Números: Verificar rango válido (ej. `scholarship_amount` entre 0 y 100 para porcentaje)
- Enums: Solo aceptar valores predefinidos (ej. `role` solo puede ser uno de los 4 roles válidos)

### 6. Reglas para Endpoints Financieros

**Los endpoints de pagos, becas y estados financieros tienen reglas adicionales:**

- Solo `admin` y `secretary` pueden registrar pagos
- Solo `admin` puede otorgar o modificar becas
- Los montos de pago deben ser positivos y no exceder el saldo pendiente
- Toda operación financiera debe generar un registro auditable (timestamp, usuario que ejecutó)

## Checklist de Auditoría Pre-Commit

- [ ] ¿Todos los endpoints GET filtran por `branch_id`?
- [ ] ¿Los endpoints POST/PUT/DELETE verifican el rol del usuario?
- [ ] ¿Se usa `getEffectiveBranchId(req)` en lugar de confiar en `req.body.branch_id` para usuarios no-superadmin?
- [ ] ¿Los select de la base de datos especifican columnas en lugar de `*`?
- [ ] ¿Las operaciones financieras validan montos y generan registros de auditoría?
- [ ] ¿Se previene la auto-escalación de roles?
- [ ] ¿Los datos de respuesta no incluyen campos sensibles?
