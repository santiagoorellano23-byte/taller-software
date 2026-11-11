-- Hallazgos versionados: describen observaciones, nunca autorizaciones ni cargos.
CREATE TABLE hallazgos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  visita_id INTEGER NOT NULL,
  clave TEXT NOT NULL,
  version_num INTEGER NOT NULL,
  vigente INTEGER NOT NULL DEFAULT 1 CHECK(vigente IN (0,1)),
  observacion TEXT NOT NULL,
  gravedad TEXT NOT NULL CHECK(gravedad IN ('informativo','recomendado','prioritario')),
  propuesta TEXT,
  adjunto_id INTEGER,
  motivo_edicion TEXT,
  creado_por INTEGER NOT NULL,
  creado_at TEXT NOT NULL,
  UNIQUE(taller_id,id),
  UNIQUE(taller_id,clave,version_num),
  FOREIGN KEY(taller_id,visita_id) REFERENCES visitas(taller_id,id),
  FOREIGN KEY(taller_id,adjunto_id) REFERENCES adjuntos(taller_id,id),
  FOREIGN KEY(taller_id,creado_por) REFERENCES usuarios(taller_id,id)
);
CREATE UNIQUE INDEX hallazgo_vigente ON hallazgos(taller_id,clave) WHERE vigente=1;
CREATE INDEX hallazgos_visita ON hallazgos(taller_id,visita_id);
