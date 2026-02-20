Preparado para futuro crecimiento.

Agregar tabla:

branches (
  id UUID PK,
  name VARCHAR(150),
  address TEXT,
  phone VARCHAR(30)
)


Y relacionar:

students → branch_id

teachers → branch_id

courses → branch_id

Esto permite abrir múltiples sedes.