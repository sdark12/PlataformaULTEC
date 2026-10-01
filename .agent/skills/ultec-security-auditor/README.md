# ultec-security-auditor

**Autor:** Equipo Plataforma ULTEC (Skill interna)
**Propósito:** Auditoría de seguridad multi-sede y control de acceso por roles para garantizar aislamiento de datos y prevenir escalación de privilegios.

## Cuándo se activa
- Al crear o modificar endpoints de la API
- Al agregar nuevas rutas o controladores
- Al modificar middleware de autenticación
- Al crear consultas que involucren datos de estudiantes, pagos o calificaciones
- Al modificar lógica de roles (superadmin, admin, secretary)
