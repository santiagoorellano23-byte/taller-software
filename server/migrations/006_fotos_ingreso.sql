-- Las fotos se preparan antes de crear la orden y se vinculan en su transacción.
ALTER TABLE adjuntos ADD COLUMN ingreso_clave TEXT;
ALTER TABLE adjuntos ADD COLUMN ingreso_tipo TEXT CHECK (ingreso_tipo IN ('tablero','exterior','detalle'));
ALTER TABLE adjuntos ADD COLUMN ingreso_token TEXT;
CREATE INDEX adjuntos_ingreso ON adjuntos(taller_id, creado_por, ingreso_clave);
