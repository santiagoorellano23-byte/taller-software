-- Saldo y regla vigentes al momento de una entrega con deuda (la nota guarda el motivo).
ALTER TABLE visitas ADD COLUMN entrega_saldo INTEGER;
ALTER TABLE visitas ADD COLUMN entrega_regla TEXT;
