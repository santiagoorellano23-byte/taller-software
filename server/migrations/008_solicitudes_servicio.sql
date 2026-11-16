-- Solicitudes del taller a Growth Labs: renovar el período o consultar un cambio de plan.
-- Una solicitud nunca habilita nada por sí sola: Growth Labs confirma la acreditación y registra el pago
-- (pagos_suscripcion); recién entonces se extiende el período.

CREATE TABLE solicitudes_servicio (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('renovacion','cambio_plan')),
  plan_id INTEGER NOT NULL REFERENCES planes(id),
  meses INTEGER NOT NULL CHECK (meses > 0),
  periodo_desde TEXT NOT NULL,            -- fecha local AAAA-MM-DD calculada al pedir
  periodo_hasta TEXT NOT NULL,            -- último día incluido
  importe_centavos INTEGER,               -- NULL: el plan no tiene precio cargado; Growth Labs lo informa
  moneda TEXT NOT NULL DEFAULT 'ARS',
  aviso_pago TEXT,                        -- lo que el taller informa (por ejemplo, número de operación); no prueba el pago
  nota TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmada','rechazada','anulada')),
  creado_por INTEGER NOT NULL REFERENCES usuarios(id),
  creado_at TEXT NOT NULL,
  resuelta_por INTEGER REFERENCES plataforma_admins(id),
  resuelta_at TEXT,
  resolucion TEXT,
  pago_id INTEGER REFERENCES pagos_suscripcion(id)
);
CREATE INDEX solicitudes_servicio_taller ON solicitudes_servicio(taller_id, estado);
-- Una sola solicitud pendiente por taller.
CREATE UNIQUE INDEX solicitudes_servicio_pendiente ON solicitudes_servicio(taller_id) WHERE estado = 'pendiente';
