1. Objetivo del Módulo Billing

El módulo Billing es responsable de:

Generación de facturación interna

Control de numeración por sede

Emisión de comprobantes PDF

Anulación controlada

Integración futura con FEL

Registro auditable de eventos financieros

Este módulo está desacoplado del proveedor externo para permitir escalabilidad futura.

2. Alcance

Incluye:

Facturación por pago registrado

Control de series por sede

Cálculo de subtotal, impuestos y total

Generación de PDF

Reimpresión

Anulación con trazabilidad

No incluye todavía:

Integración directa con proveedor FEL

Firma electrónica

Envío automático a SAT

3. Principios Arquitectónicos

Monolito modular.

Transacciones ACID obligatorias al facturar.

Inmutabilidad de facturas emitidas.

Numeración secuencial estricta.

Auditoría obligatoria en operaciones críticas.

Desacoplamiento del módulo finance.

4. Relación con Otros Módulos

Billing depende de:

finance (payments)

students

branches

users

Flujo:

payments → billing → invoice → pdf


Una factura solo puede generarse si existe un pago válido.

5. Modelo de Datos
Tablas principales
invoices

Contiene encabezado de factura.

Campos clave:

branch_id

student_id

payment_id

series

invoice_number

status (emitida | anulada)

subtotal

tax

total

Restricciones:

invoice_number UNIQUE

status no editable después de emitida

ON DELETE RESTRICT en relaciones críticas

invoice_items

Detalle de productos/servicios facturados.

Restricciones:

ON DELETE CASCADE respecto a invoices

subtotal calculado automáticamente

invoice_sequences

Controla numeración por sede.

Restricciones:

UNIQUE (branch_id, series)

current_number solo puede incrementarse

Debe actualizarse dentro de transacción

6. Flujo de Generación de Factura

Se registra pago.

Se inicia transacción.

Se obtiene invoice_sequence por branch.

Se incrementa current_number.

Se construye invoice_number.

Se crea registro en invoices.

Se crean invoice_items.

Se confirma transacción.

Se genera PDF.

Se registra en audit_logs.

Si cualquier paso falla → rollback completo.

7. Numeración

Formato recomendado:

[SERIE]-[AÑO]-[NUMERO]


Ejemplo:

A-2026-000045


Cada sede puede tener:

Serie distinta

Secuencia independiente

8. Estados de Factura

emitida
anulada

Reglas:

No se puede editar una factura emitida.

Solo puede cambiar a anulada.

La anulación debe registrar motivo.

La anulación debe quedar en audit_logs.

9. Generación de PDF

Responsabilidad exclusiva del backend.

Requisitos:

Logo por sede

Datos fiscales de la academia

Datos del estudiante

Detalle de mensualidad

Número de factura

Fecha

Total

Código interno de verificación (opcional)

El PDF puede:

Guardarse en almacenamiento

Generarse bajo demanda

10. Seguridad

Solo roles permitidos pueden:

Emitir facturas

Anular facturas

Recomendado:

Solo Admin puede anular

Registro obligatorio en audit_logs

11. Concurrencia

Para evitar duplicación de numeración:

Uso de SELECT FOR UPDATE sobre invoice_sequences

Transacciones bloqueantes

Nivel de aislamiento READ COMMITTED o superior

12. Preparación para FEL Futuro

El diseño permite:

Agregar campos a invoices:

fel_uuid

fel_status

fel_sent_at

fel_response

Sin modificar estructura base.

13. Auditoría

Cada acción debe generar registro en:

audit_logs

Ejemplos:

INVOICE_CREATED

INVOICE_CANCELLED

INVOICE_PDF_GENERATED

14. Escalabilidad

El módulo está preparado para:

Miles de facturas mensuales

Multi-sede

Integración con sistemas externos

Exportación contable futura

15. Riesgos y Mitigación

Riesgo: duplicación de factura
Mitigación: UNIQUE + transacción

Riesgo: manipulación manual de numeración
Mitigación: actualización exclusiva vía servicio backend

Riesgo: pérdida de PDF
Mitigación: regeneración bajo demanda

Estado Arquitectónico

Este módulo cumple nivel:

ERP Académico Financiero Interno
Listo para integración FEL futura