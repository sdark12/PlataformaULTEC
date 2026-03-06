ALTER TABLE invoice_items 
ALTER COLUMN invoice_id TYPE UUID USING invoice_id::text::uuid;
