-- Esquema base. Cada tabla operativa lleva taller_id y las relaciones principales
-- usan claves compuestas (taller_id, id) para que la base rechace vínculos entre talleres.
-- Importes en centavos (enteros). Cantidades en milésimas (enteros). Fechas UTC ISO salvo
-- las marcadas como "local" (hora del taller, AAAA-MM-DDTHH:MM).

CREATE TABLE talleres (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  publico INTEGER NOT NULL DEFAULT 0,
  en_directorio INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL CHECK (rol IN ('dueno','recepcion','mecanico')),
  activo INTEGER NOT NULL DEFAULT 1,
  pass_hash TEXT,
  creado_at TEXT NOT NULL,
  ultimo_acceso TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id)
);

CREATE TABLE tokens_acceso (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('invitacion','recuperacion')),
  token_hash TEXT NOT NULL UNIQUE,
  expira TEXT NOT NULL,
  usado_at TEXT,
  creado_por INTEGER REFERENCES usuarios(id),
  creado_at TEXT NOT NULL
);

CREATE TABLE sesiones (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  creada TEXT NOT NULL,
  expira TEXT NOT NULL,
  ultima TEXT NOT NULL
);

CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  usuario_id INTEGER,
  accion TEXT NOT NULL,
  entidad TEXT,
  entidad_id INTEGER,
  detalle TEXT,
  fecha TEXT NOT NULL
);
CREATE INDEX auditoria_taller ON auditoria(taller_id, fecha);

CREATE TABLE idempotencia (
  taller_id INTEGER NOT NULL,
  clave TEXT NOT NULL,
  usuario_id INTEGER NOT NULL,
  ruta TEXT NOT NULL,
  estado INTEGER NOT NULL,
  respuesta TEXT NOT NULL,
  fecha TEXT NOT NULL,
  PRIMARY KEY (taller_id, clave)
);

CREATE TABLE contadores (
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  nombre TEXT NOT NULL,
  valor INTEGER NOT NULL,
  PRIMARY KEY (taller_id, nombre)
);

CREATE TABLE puestos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id)
);

CREATE TABLE servicios (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  nombre TEXT NOT NULL,
  duracion_min INTEGER NOT NULL DEFAULT 60,
  precio INTEGER,
  publico INTEGER NOT NULL DEFAULT 1,
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id)
);

CREATE TABLE plantillas_service (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  nombre TEXT NOT NULL,
  tareas TEXT NOT NULL DEFAULT '[]',
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id)
);

CREATE TABLE plantillas_trabajo (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  nombre TEXT NOT NULL,
  horas_m INTEGER NOT NULL,
  notas TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id)
);

CREATE TABLE contactos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  notas TEXT,
  acepta_avisos INTEGER,
  archivado INTEGER NOT NULL DEFAULT 0,
  creado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id)
);
CREATE INDEX contactos_taller ON contactos(taller_id, nombre);

CREATE TABLE vehiculos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  patente TEXT NOT NULL,
  patente_norm TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  version_txt TEXT,
  anio INTEGER,
  motor TEXT,
  combustible TEXT,
  vin TEXT,
  color TEXT,
  contacto_id INTEGER,
  notas TEXT,
  archivado INTEGER NOT NULL DEFAULT 0,
  archivado_motivo TEXT,
  creado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, contacto_id) REFERENCES contactos(taller_id, id)
);
CREATE INDEX vehiculos_patente ON vehiculos(taller_id, patente_norm);

CREATE TABLE vehiculo_contactos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  vehiculo_id INTEGER NOT NULL,
  contacto_id INTEGER NOT NULL,
  desde TEXT NOT NULL,
  hasta TEXT,
  motivo TEXT,
  FOREIGN KEY (taller_id, vehiculo_id) REFERENCES vehiculos(taller_id, id),
  FOREIGN KEY (taller_id, contacto_id) REFERENCES contactos(taller_id, id)
);

CREATE TABLE turnos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  codigo TEXT NOT NULL,
  puesto_id INTEGER,
  servicio_id INTEGER,
  inicio TEXT NOT NULL,            -- local
  duracion_min INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  patente TEXT,
  vehiculo_texto TEXT,
  motivo TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('solicitado','confirmado','cancelado','no_asistio','ingresado')),
  origen TEXT NOT NULL CHECK (origen IN ('interno','online')),
  motivo_cierre TEXT,
  acepta_avisos INTEGER NOT NULL DEFAULT 0,
  visita_id INTEGER,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id),
  UNIQUE (taller_id, codigo),
  FOREIGN KEY (taller_id, puesto_id) REFERENCES puestos(taller_id, id),
  FOREIGN KEY (taller_id, servicio_id) REFERENCES servicios(taller_id, id)
);
CREATE INDEX turnos_inicio ON turnos(taller_id, inicio);

CREATE TABLE visitas (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  numero INTEGER NOT NULL,
  vehiculo_id INTEGER NOT NULL,
  contacto_id INTEGER,
  contacto_nombre TEXT,
  contacto_telefono TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('revision','service')),
  motivo TEXT NOT NULL,
  responsable_id INTEGER,
  prioridad TEXT NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('normal','alta')),
  retiro_acordado TEXT,            -- local, NULL = a confirmar
  retiro_nota TEXT,
  ingreso_at TEXT NOT NULL,
  turno_id INTEGER,
  relacionada_id INTEGER,
  relacion_nota TEXT,
  autorizacion_ingreso TEXT,
  plantilla_id INTEGER,
  lista_at TEXT,
  lista_por INTEGER,
  entregada_at TEXT,
  entregada_por INTEGER,
  entrega_nota TEXT,
  pendientes_informados INTEGER,
  anulada_at TEXT,
  anulada_motivo TEXT,
  creado_por INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id),
  UNIQUE (taller_id, numero),
  FOREIGN KEY (taller_id, vehiculo_id) REFERENCES vehiculos(taller_id, id),
  FOREIGN KEY (taller_id, contacto_id) REFERENCES contactos(taller_id, id),
  FOREIGN KEY (taller_id, responsable_id) REFERENCES usuarios(taller_id, id),
  FOREIGN KEY (taller_id, turno_id) REFERENCES turnos(taller_id, id),
  FOREIGN KEY (taller_id, relacionada_id) REFERENCES visitas(taller_id, id)
);
CREATE INDEX visitas_vehiculo ON visitas(taller_id, vehiculo_id);

CREATE TABLE lecturas (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  vehiculo_id INTEGER NOT NULL,
  visita_id INTEGER,
  km INTEGER,                      -- NULL = no se pudo leer (nunca 0 por defecto)
  fecha TEXT NOT NULL,             -- local (día)
  origen TEXT NOT NULL,
  explicacion TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  FOREIGN KEY (taller_id, vehiculo_id) REFERENCES vehiculos(taller_id, id),
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id)
);

CREATE TABLE revisiones (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  visita_id INTEGER NOT NULL,
  version_num INTEGER NOT NULL,
  relato TEXT NOT NULL,
  hallazgos TEXT NOT NULL,
  hipotesis TEXT,
  pruebas TEXT,
  diagnostico TEXT,
  recomendacion TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('en_revision','sin_falla','confirmado')),
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  UNIQUE (visita_id, version_num),
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id)
);

CREATE TABLE presupuesto_versiones (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  visita_id INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  nota TEXT,
  cambios TEXT,
  validez_hasta TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  UNIQUE (taller_id, id),
  UNIQUE (visita_id, numero),
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id)
);

CREATE TABLE presupuesto_lineas (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  visita_id INTEGER NOT NULL,
  version_id INTEGER NOT NULL,
  origen_linea_id INTEGER,         -- línea anterior que esta modifica
  tipo TEXT NOT NULL CHECK (tipo IN ('repuesto','insumo','mano_obra','servicio_externo','revision','otro')),
  descripcion TEXT NOT NULL,
  cantidad_m INTEGER NOT NULL,
  unidad TEXT NOT NULL,
  precio_unit INTEGER NOT NULL,
  importe INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','reemplazada','descartada')),
  autorizada_ingreso INTEGER NOT NULL DEFAULT 0,
  realizado_at TEXT,
  realizado_por INTEGER,
  cargo_id INTEGER,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id),
  FOREIGN KEY (taller_id, version_id) REFERENCES presupuesto_versiones(taller_id, id),
  FOREIGN KEY (taller_id, origen_linea_id) REFERENCES presupuesto_lineas(taller_id, id)
);
CREATE INDEX lineas_visita ON presupuesto_lineas(taller_id, visita_id);

CREATE TABLE respuestas (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  linea_id INTEGER NOT NULL,
  respuesta TEXT NOT NULL CHECK (respuesta IN ('autoriza','rechaza','posterga')),
  persona TEXT NOT NULL,
  canal TEXT NOT NULL,
  fecha_respuesta TEXT NOT NULL,
  nota TEXT,
  cargado_por INTEGER,
  creado_at TEXT NOT NULL,
  FOREIGN KEY (taller_id, linea_id) REFERENCES presupuesto_lineas(taller_id, id)
);

CREATE TABLE proveedores (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  notas TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id)
);

CREATE TABLE articulos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  codigo TEXT,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL,
  minimo_m INTEGER NOT NULL DEFAULT 0,
  precio_venta INTEGER,
  costo_ultimo INTEGER,
  activo INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id)
);

CREATE TABLE repuestos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  visita_id INTEGER NOT NULL,
  linea_id INTEGER,
  descripcion TEXT NOT NULL,
  cantidad_m INTEGER NOT NULL,
  unidad TEXT NOT NULL,
  origen TEXT NOT NULL CHECK (origen IN ('taller','cliente')),
  proveedor_id INTEGER,
  articulo_id INTEGER,
  etapa TEXT NOT NULL CHECK (etapa IN ('falta_pedir','pedido','llego','colocado')),
  fecha_prevista TEXT,
  pedido_at TEXT,
  llego_at TEXT,
  colocado_at TEXT,
  colocado_por INTEGER,
  nota TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id),
  FOREIGN KEY (taller_id, linea_id) REFERENCES presupuesto_lineas(taller_id, id),
  FOREIGN KEY (taller_id, proveedor_id) REFERENCES proveedores(taller_id, id),
  FOREIGN KEY (taller_id, articulo_id) REFERENCES articulos(taller_id, id)
);

CREATE TABLE reservas (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  articulo_id INTEGER NOT NULL,
  repuesto_id INTEGER NOT NULL,
  cantidad_m INTEGER NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('activa','consumida','liberada')),
  motivo TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  FOREIGN KEY (taller_id, articulo_id) REFERENCES articulos(taller_id, id),
  FOREIGN KEY (taller_id, repuesto_id) REFERENCES repuestos(taller_id, id)
);
CREATE UNIQUE INDEX reserva_activa ON reservas(repuesto_id) WHERE estado IN ('activa','consumida');

CREATE TABLE tareas_service (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  visita_id INTEGER NOT NULL,
  orden INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','hecho','no_aplica')),
  explicacion TEXT,
  actualizado_por INTEGER,
  actualizado_at TEXT,
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id)
);

CREATE TABLE productos_usados (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  visita_id INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  cantidad_m INTEGER NOT NULL,
  unidad TEXT NOT NULL,
  origen TEXT NOT NULL DEFAULT 'taller' CHECK (origen IN ('taller','cliente')),
  articulo_id INTEGER,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  anulado_at TEXT,
  anulado_motivo TEXT,
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id),
  FOREIGN KEY (taller_id, articulo_id) REFERENCES articulos(taller_id, id)
);

CREATE TABLE controles (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  visita_id INTEGER NOT NULL,
  resultado TEXT NOT NULL CHECK (resultado IN ('resuelto','mejoro','no_reproducido','pendiente')),
  como TEXT NOT NULL,
  nota TEXT,
  vigente INTEGER NOT NULL DEFAULT 1,
  reemplazado_motivo TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id)
);

CREATE TABLE seguimientos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  vehiculo_id INTEGER NOT NULL,
  contacto_id INTEGER,
  visita_origen_id INTEGER,
  linea_id INTEGER,
  tipo TEXT NOT NULL CHECK (tipo IN ('service','postergado','otro')),
  titulo TEXT NOT NULL,
  km_objetivo INTEGER,
  fecha_objetivo TEXT,
  criterio TEXT,
  importe INTEGER,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','resuelto','descartado')),
  cierre_nota TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, vehiculo_id) REFERENCES vehiculos(taller_id, id),
  FOREIGN KEY (taller_id, contacto_id) REFERENCES contactos(taller_id, id),
  FOREIGN KEY (taller_id, visita_origen_id) REFERENCES visitas(taller_id, id)
);

CREATE TABLE avisos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  seguimiento_id INTEGER,
  visita_id INTEGER,
  turno_id INTEGER,
  contacto_nombre TEXT,
  telefono TEXT,
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp','telefono','correo','presencial','otro')),
  texto TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('preparado','abierto','enviado','respondido','fallido','descartado')),
  nota TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  actualizado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, seguimiento_id) REFERENCES seguimientos(taller_id, id),
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id),
  FOREIGN KEY (taller_id, turno_id) REFERENCES turnos(taller_id, id)
);

CREATE TABLE adjuntos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  ambito TEXT NOT NULL CHECK (ambito IN ('visita','vehiculo','biblioteca','compra','logo')),
  visita_id INTEGER,
  vehiculo_id INTEGER,
  nombre_original TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  ruta TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  descripcion TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  archivado_at TEXT,
  archivado_motivo TEXT,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id),
  FOREIGN KEY (taller_id, vehiculo_id) REFERENCES vehiculos(taller_id, id)
);

CREATE TABLE movimientos_stock (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  articulo_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('inicial','compra','devolucion_proveedor','venta','anulacion_venta','devolucion_cliente','consumo','reintegro_consumo','ajuste')),
  cantidad_m INTEGER NOT NULL,     -- con signo: + entra, - sale
  costo_unit INTEGER,
  ref_tipo TEXT,
  ref_id INTEGER,
  motivo TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  FOREIGN KEY (taller_id, articulo_id) REFERENCES articulos(taller_id, id)
);
CREATE INDEX movimientos_articulo ON movimientos_stock(taller_id, articulo_id);
-- Una misma referencia no puede mover dos veces el mismo artículo con el mismo tipo.
CREATE UNIQUE INDEX movimiento_unico ON movimientos_stock(taller_id, tipo, ref_tipo, ref_id, articulo_id) WHERE ref_id IS NOT NULL;

CREATE TABLE compras (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  proveedor_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,             -- local (día)
  estado TEXT NOT NULL CHECK (estado IN ('borrador','recibida','anulada')),
  recibida_at TEXT,
  recibida_por INTEGER,
  nota TEXT,
  anulada_motivo TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id),
  UNIQUE (taller_id, numero),
  FOREIGN KEY (taller_id, proveedor_id) REFERENCES proveedores(taller_id, id)
);

CREATE TABLE compra_lineas (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  compra_id INTEGER NOT NULL,
  articulo_id INTEGER NOT NULL,
  cantidad_m INTEGER NOT NULL,
  costo_unit INTEGER NOT NULL,
  devuelto_m INTEGER NOT NULL DEFAULT 0,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, compra_id) REFERENCES compras(taller_id, id),
  FOREIGN KEY (taller_id, articulo_id) REFERENCES articulos(taller_id, id)
);

CREATE TABLE compra_documentos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  compra_id INTEGER NOT NULL,
  proveedor_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('remito','factura','otro')),
  numero TEXT NOT NULL,
  fecha TEXT,
  importe INTEGER,
  adjunto_id INTEGER,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  UNIQUE (taller_id, proveedor_id, tipo, numero),
  FOREIGN KEY (taller_id, compra_id) REFERENCES compras(taller_id, id)
);

CREATE TABLE pagos_proveedor (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  compra_id INTEGER NOT NULL,
  importe INTEGER NOT NULL CHECK (importe > 0),
  medio TEXT NOT NULL,
  fecha TEXT NOT NULL,
  nota TEXT,
  anulado_at TEXT,
  anulado_motivo TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  FOREIGN KEY (taller_id, compra_id) REFERENCES compras(taller_id, id)
);

CREATE TABLE ventas (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  contacto_id INTEGER,
  cliente_nombre TEXT,
  fecha TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('confirmada','anulada')),
  total INTEGER NOT NULL,
  anulada_motivo TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (taller_id, id),
  UNIQUE (taller_id, numero),
  FOREIGN KEY (taller_id, contacto_id) REFERENCES contactos(taller_id, id)
);

CREATE TABLE venta_lineas (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  venta_id INTEGER NOT NULL,
  articulo_id INTEGER,
  descripcion TEXT NOT NULL,
  cantidad_m INTEGER NOT NULL,
  precio_unit INTEGER NOT NULL,
  importe INTEGER NOT NULL,
  devuelto_m INTEGER NOT NULL DEFAULT 0,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, venta_id) REFERENCES ventas(taller_id, id),
  FOREIGN KEY (taller_id, articulo_id) REFERENCES articulos(taller_id, id)
);

-- Dinero de clientes. efecto con signo sobre lo que el cliente debe:
-- cargo (+), pago (-), devolución de dinero (+), nota de crédito (-), anulación (opuesto de lo anulado).
CREATE TABLE cuenta_movimientos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  contacto_id INTEGER,
  visita_id INTEGER,
  venta_id INTEGER,
  tipo TEXT NOT NULL CHECK (tipo IN ('cargo','pago','devolucion_dinero','nota_credito','anulacion')),
  importe INTEGER NOT NULL CHECK (importe > 0),
  efecto INTEGER NOT NULL,
  medio TEXT,
  referencia TEXT,
  fecha TEXT NOT NULL,             -- UTC ISO
  motivo TEXT,
  anula_id INTEGER UNIQUE,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  UNIQUE (taller_id, id),
  FOREIGN KEY (taller_id, contacto_id) REFERENCES contactos(taller_id, id),
  FOREIGN KEY (taller_id, visita_id) REFERENCES visitas(taller_id, id),
  FOREIGN KEY (taller_id, venta_id) REFERENCES ventas(taller_id, id),
  FOREIGN KEY (taller_id, anula_id) REFERENCES cuenta_movimientos(taller_id, id)
);
CREATE INDEX cuenta_contacto ON cuenta_movimientos(taller_id, contacto_id);

CREATE TABLE documentos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('presupuesto','informe','entrega','venta','recibo')),
  ref_tipo TEXT NOT NULL,
  ref_id INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  contenido TEXT NOT NULL,
  anulado_at TEXT,
  anulado_motivo TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  UNIQUE (taller_id, id),
  UNIQUE (taller_id, tipo, numero)
);

CREATE TABLE enlaces_publicos (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  documento_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expira TEXT NOT NULL,
  revocado_at TEXT,
  accesos INTEGER NOT NULL DEFAULT 0,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  FOREIGN KEY (taller_id, documento_id) REFERENCES documentos(taller_id, id)
);

CREATE TABLE biblioteca (
  id INTEGER PRIMARY KEY,
  taller_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  adjunto_id INTEGER NOT NULL,
  marca TEXT,
  modelo TEXT,
  sistema TEXT,
  anio_desde INTEGER,
  anio_hasta INTEGER,
  procedencia TEXT NOT NULL,
  version_doc TEXT,
  derechos TEXT NOT NULL,
  etiquetas TEXT,
  archivado_at TEXT,
  creado_por INTEGER,
  creado_at TEXT NOT NULL,
  FOREIGN KEY (taller_id, adjunto_id) REFERENCES adjuntos(taller_id, id)
);
