💰 Flujo de Pago Escalable

Sistema genera automáticamente registros en financial_status cada mes.

Admin registra pago.

Sistema:

Valida monto.

Actualiza financial_status → pagado.

Registra en payments.

Si no hay pago al vencimiento:

status → vencido.

Opcional: bloquear acceso.