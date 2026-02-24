-- Añadir campos para Pagos Flexibles y Descuentos
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'TUITION';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0;
