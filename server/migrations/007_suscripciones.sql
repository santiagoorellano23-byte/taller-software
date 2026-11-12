-- Servicio de Growth Labs: planes versionados, suscripción de cada taller, pagos de la suscripción y
-- administración central. Nada de esto se mezcla con la caja ni los cobros del taller a sus clientes.

CREATE TABLE planes (
  id INTEGER PRIMARY KEY,
  clave TEXT NOT NULL,
  version INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  capacidades TEXT NOT NULL,          -- JSON {"modulos": {...}, "limites": {...}}; ver server/planes.js
  precio_centavos INTEGER,            -- NULL: precio no definido
  moneda TEXT NOT NULL DEFAULT 'ARS',
  de_prueba INTEGER NOT NULL DEFAULT 1, -- 1: valores de prueba, no oferta comercial aprobada
  activo INTEGER NOT NULL DEFAULT 1,   -- 0: no se asigna a nuevos talleres; los que lo tienen lo conservan
  creado_at TEXT NOT NULL,
  UNIQUE (clave, version)
);

CREATE TABLE suscripciones (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL UNIQUE REFERENCES talleres(id),
  plan_id INTEGER NOT NULL REFERENCES planes(id),
  estado TEXT NOT NULL CHECK (estado IN ('prueba','activa','vencida','suspendida','cancelada')),
  periodo_desde TEXT,                 -- fecha local AAAA-MM-DD
  periodo_hasta TEXT,                 -- último día incluido; NULL: sin vencimiento
  gracia_hasta TEXT,                  -- último día con acceso completo después de vencer; NULL: sin gracia
  cancela_al_cierre INTEGER NOT NULL DEFAULT 0,
  modalidad TEXT NOT NULL DEFAULT 'manual' CHECK (modalidad IN ('manual','transferencia','sin_cargo')),
  nota TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  actualizado_at TEXT NOT NULL
);

CREATE TABLE plataforma_admins (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_at TEXT NOT NULL
);

CREATE TABLE plataforma_sesiones (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  admin_id INTEGER NOT NULL REFERENCES plataforma_admins(id),
  creada TEXT NOT NULL,
  expira TEXT NOT NULL
);

CREATE TABLE plataforma_tokens (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES plataforma_admins(id),
  token_hash TEXT NOT NULL UNIQUE,
  expira TEXT NOT NULL,
  usado_at TEXT
);

-- Conciliación manual: un pago confirmado por una persona de Growth Labs, con su referencia.
CREATE TABLE pagos_suscripcion (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  suscripcion_id INTEGER NOT NULL REFERENCES suscripciones(id),
  importe_centavos INTEGER NOT NULL CHECK (importe_centavos > 0),
  medio TEXT NOT NULL,
  referencia TEXT NOT NULL,
  periodo_desde TEXT NOT NULL,
  periodo_hasta TEXT NOT NULL,
  nota TEXT,
  registrado_por INTEGER NOT NULL REFERENCES plataforma_admins(id),
  registrado_at TEXT NOT NULL,
  clave TEXT NOT NULL UNIQUE           -- idempotencia: el mismo envío no registra dos pagos
);

CREATE TABLE plataforma_auditoria (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER REFERENCES plataforma_admins(id), -- NULL: proceso automático (vencimientos)
  taller_id INTEGER REFERENCES talleres(id),
  accion TEXT NOT NULL,
  detalle TEXT,
  fecha TEXT NOT NULL
);
CREATE INDEX plataforma_auditoria_taller ON plataforma_auditoria(taller_id, id);

-- Planes iniciales: configuración de PRUEBA para el piloto. Cupos tomados como hipótesis del plan maestro,
-- sin precio. Se reemplazan creando una versión nueva, nunca editando estas filas.
INSERT INTO planes (clave, version, nombre, capacidades, precio_centavos, de_prueba, creado_at) VALUES
  ('esencial', 1, 'Esencial (prueba)', '{"modulos":{"stock":false,"cuentas":false,"reportes":false},"limites":{"usuarios_activos":3,"almacenamiento_mb":2048}}', NULL, 1, '2026-11-12T00:00:00.000Z'),
  ('profesional', 1, 'Profesional (prueba)', '{"modulos":{"stock":true,"cuentas":true,"reportes":true},"limites":{"usuarios_activos":10,"almacenamiento_mb":10240}}', NULL, 1, '2026-11-12T00:00:00.000Z');

-- Talleres que ya existían: conservan todo lo que tenían, sin vencimiento, hasta que Growth Labs asigne su plan.
INSERT INTO suscripciones (taller_id, plan_id, estado, periodo_desde, modalidad, nota, actualizado_at)
  SELECT t.id, (SELECT id FROM planes WHERE clave = 'profesional' AND version = 1), 'activa', substr(t.creado_at, 1, 10), 'sin_cargo',
    'Suscripción inicial creada por la migración: sin vencimiento hasta asignar plan.', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM talleres t;
