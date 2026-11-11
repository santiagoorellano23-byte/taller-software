-- NULL conserva intactas las órdenes de versiones anteriores.
ALTER TABLE visitas ADD COLUMN recepcion_json TEXT;
