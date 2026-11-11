-- Las operaciones anteriores no tienen huella: no se pueden repetir a ciegas.
ALTER TABLE idempotencia ADD COLUMN solicitud_hash TEXT;
