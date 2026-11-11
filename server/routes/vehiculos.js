import { uno, todos, insertar, ejecutar } from '../db.js';
import { exigir, puede } from '../permisos.js';
import { delTaller, resumenVisita } from '../datos.js';
import {
  ErrorUsuario, falla, conflicto, requerido, opcional, texto, normPatente, normTexto, soloDigitos, parseKm, isoAhora, hoyLocal, idEntero
} from '../util.js';

const zona = (ctx) => ctx.taller.config.zona_horaria || 'America/Argentina/Mendoza';

export function datosContacto(c) {
  const nombre = requerido(c.nombre, 'Escribí el nombre de la persona de contacto.', 'cnombre', 120);
  const telefono = opcional(c.telefono, 40);
  if (telefono && soloDigitos(telefono).length < 6) falla('El teléfono parece incompleto. Revisalo o dejalo vacío.', 'ctelefono');
  const email = opcional(c.email, 160);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) falla('El correo no parece válido. Revisalo o dejalo vacío.', 'cemail');
  return { nombre, telefono, email };
}

export function crearContacto(ctx, c) {
  const d = datosContacto(c);
  const id = insertar(ctx.db, 'INSERT INTO contactos (taller_id, nombre, telefono, email, notas, acepta_avisos, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ctx.taller.id, d.nombre, d.telefono, d.email, opcional(c.notas, 1000), c.acepta_avisos == null ? null : (c.acepta_avisos ? 1 : 0), isoAhora());
  ctx.auditar('Contacto creado', 'contacto', id, d.nombre);
  return id;
}

export function datosVehiculo(b) {
  const patente = formatoPatente(requerido(b.patente, 'Escribí la patente. Si no tiene, poné una referencia como «SIN PATENTE 1».', 'patente', 20).toUpperCase());
  const pn = normPatente(patente);
  if (pn.length < 3) falla('La patente es muy corta. Revisala.', 'patente');
  let anio = null;
  if (b.anio != null && String(b.anio).trim() !== '') {
    anio = Number(b.anio);
    if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) falla('El año debe tener 4 números, por ejemplo 2018. Si no lo sabés, dejalo vacío.', 'anio');
  }
  const vin = opcional(b.vin, 30);
  if (vin && !/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(vin.replace(/\s/g, ''))) falla('El número de chasis (VIN) no parece válido. Dejalo vacío si no lo tenés a mano.', 'vin');
  return {
    patente, patente_norm: pn, marca: opcional(b.marca, 60), modelo: opcional(b.modelo, 80), version_txt: opcional(b.version_txt, 80),
    anio, motor: opcional(b.motor, 60), combustible: opcional(b.combustible, 40), vin: vin ? vin.replace(/\s/g, '').toUpperCase() : null,
    color: opcional(b.color, 40), notas: opcional(b.notas, 1000)
  };
}

export function crearVehiculo(ctx, b, contactoId) {
  const d = datosVehiculo(b);
  const iguales = todos(ctx.db, 'SELECT id, patente, marca, modelo FROM vehiculos WHERE taller_id = ? AND patente_norm = ? AND archivado = 0', ctx.taller.id, d.patente_norm);
  if (iguales.length && !b.confirmarDuplicado) {
    throw new ErrorUsuario(409, 'Ya hay un auto con esa patente en este taller. Abrí esa ficha o confirmá que es otro vehículo.', 'patente', { duplicados: iguales });
  }
  const id = insertar(ctx.db, `INSERT INTO vehiculos (taller_id, patente, patente_norm, marca, modelo, version_txt, anio, motor, combustible, vin, color, contacto_id, notas, creado_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ctx.taller.id, d.patente, d.patente_norm, d.marca, d.modelo, d.version_txt, d.anio, d.motor, d.combustible, d.vin, d.color, contactoId, d.notas, isoAhora());
  if (contactoId) insertar(ctx.db, 'INSERT INTO vehiculo_contactos (taller_id, vehiculo_id, contacto_id, desde) VALUES (?, ?, ?, ?)', ctx.taller.id, id, contactoId, isoAhora());
  ctx.auditar('Vehículo creado', 'vehiculo', id, d.patente);
  return id;
}

// Lectura de kilómetros: desconocido se guarda como NULL. Una lectura menor que la anterior exige explicación.
export function registrarLectura(ctx, vehiculoId, visitaId, { km, sinKm, explicacion, origen }) {
  let valor = null;
  if (!sinKm) {
    valor = parseKm(km);
    if (valor === null) falla('Escribí los kilómetros con números (por ejemplo 84150) o marcá «Sin lectura».', 'km');
    const ultima = uno(ctx.db, 'SELECT km, fecha FROM lecturas WHERE taller_id = ? AND vehiculo_id = ? AND km IS NOT NULL ORDER BY fecha DESC, id DESC LIMIT 1', ctx.taller.id, vehiculoId);
    if (ultima && valor < ultima.km && !texto(explicacion)) {
      falla(`La lectura es menor que la anterior (${ultima.km.toLocaleString('es-AR')} km). Explicá la diferencia: cambio de tablero, error de carga anterior u otro motivo.`, 'kmExplicacion');
    }
  }
  return insertar(ctx.db, 'INSERT INTO lecturas (taller_id, vehiculo_id, visita_id, km, fecha, origen, explicacion, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.taller.id, vehiculoId, visitaId, valor, hoyLocal(zona(ctx)), sinKm ? 'No se pudo leer' : (origen || 'Tablero'), opcional(explicacion, 500), ctx.usuario.id, isoAhora());
}

export function proximoService(db, tallerId, vehiculoId) {
  const s = uno(db, "SELECT * FROM seguimientos WHERE taller_id = ? AND vehiculo_id = ? AND tipo = 'service' AND estado = 'pendiente' ORDER BY id DESC LIMIT 1", tallerId, vehiculoId);
  if (!s) return null;
  const ultima = uno(db, 'SELECT km, fecha FROM lecturas WHERE taller_id = ? AND vehiculo_id = ? AND km IS NOT NULL ORDER BY fecha DESC, id DESC LIMIT 1', tallerId, vehiculoId);
  return { ...s, ultimaLectura: ultima, faltanKm: ultima && s.km_objetivo != null ? s.km_objetivo - ultima.km : null };
}

// Patentes argentinas escritas todo junto se muestran con espacios (AF220QR → AF 220 QR, ABC123 → ABC 123).
function formatoPatente(p) {
  const t = p.trim().replace(/s+/g, ' ');
  if (/^[A-Z]{2}d{3}[A-Z]{2}$/.test(t)) return `${t.slice(0, 2)} ${t.slice(2, 5)} ${t.slice(5)}`;
  if (/^[A-Z]{3}d{3}$/.test(t)) return `${t.slice(0, 3)} ${t.slice(3)}`;
  return t;
}

export default function rutas(r) {
  // Búsqueda unificada: patente (sin espacios ni guiones), nombre o teléfono.
  r.get('/api/buscar', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const q = texto(ctx.query.q, 80);
    if (q.length < 2) return { vehiculos: [] };
    const qp = normPatente(q), qt = normTexto(q), qd = soloDigitos(q);
    const filas = todos(ctx.db, `SELECT v.id, v.patente, v.patente_norm, v.marca, v.modelo, v.version_txt, v.anio, v.archivado, c.nombre AS contacto, c.telefono,
      (SELECT MAX(x.ingreso_at) FROM visitas x WHERE x.taller_id = v.taller_id AND x.vehiculo_id = v.id) AS ultima_visita
      FROM vehiculos v LEFT JOIN contactos c ON c.id = v.contacto_id WHERE v.taller_id = ?`, ctx.taller.id);
    const res = filas.filter((f) =>
      (qp.length >= 2 && f.patente_norm.includes(qp)) ||
      (qt.length >= 2 && (normTexto(f.contacto).includes(qt) || normTexto(`${f.marca || ''} ${f.modelo || ''}`).includes(qt))) ||
      (qd.length >= 4 && soloDigitos(f.telefono).includes(qd))
    ).slice(0, 25);
    const abiertas = new Map(todos(ctx.db, 'SELECT vehiculo_id, id, numero FROM visitas WHERE taller_id = ? AND entregada_at IS NULL AND anulada_at IS NULL', ctx.taller.id).map((v) => [v.vehiculo_id, v]));
    return { vehiculos: res.map((f) => ({ ...f, telefono: puede(ctx.usuario, 'ver.contactos') ? f.telefono : null, visitaAbierta: abiertas.get(f.id) || null })) };
  });

  r.get('/api/vehiculos', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const filas = todos(ctx.db, `SELECT v.id, v.patente, v.marca, v.modelo, v.version_txt, v.archivado, c.nombre AS contacto,
      (SELECT MAX(ingreso_at) FROM visitas x WHERE x.taller_id = v.taller_id AND x.vehiculo_id = v.id) AS ultima_visita
      FROM vehiculos v LEFT JOIN contactos c ON c.id = v.contacto_id WHERE v.taller_id = ? AND v.archivado = ? ORDER BY ultima_visita DESC NULLS LAST, v.id DESC LIMIT 200`,
    ctx.taller.id, ctx.query.archivados === '1' ? 1 : 0);
    const abiertas = new Map(todos(ctx.db, 'SELECT vehiculo_id, id, numero FROM visitas WHERE taller_id = ? AND entregada_at IS NULL AND anulada_at IS NULL', ctx.taller.id).map(v=>[v.vehiculo_id,v]));
    return { vehiculos: filas.map(v=>({...v,visitaAbierta:abiertas.get(v.id)||null})) };
  });

  r.get('/api/vehiculos/:id', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const v = delTaller(ctx.db, 'vehiculos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese auto en este taller.');
    v.contacto = v.contacto_id ? uno(ctx.db, 'SELECT id, nombre, telefono, email, acepta_avisos, version FROM contactos WHERE taller_id = ? AND id = ?', ctx.taller.id, v.contacto_id) : null;
    if (v.contacto && puede(ctx.usuario, 'ver.dinero')) v.contacto.saldo = uno(ctx.db, 'SELECT COALESCE(SUM(efecto), 0) AS n FROM cuenta_movimientos WHERE taller_id = ? AND contacto_id = ?', ctx.taller.id, v.contacto.id).n;
    v.contactosAnteriores = todos(ctx.db, `SELECT c.nombre, vc.desde, vc.hasta, vc.motivo FROM vehiculo_contactos vc JOIN contactos c ON c.id = vc.contacto_id
      WHERE vc.taller_id = ? AND vc.vehiculo_id = ? AND vc.hasta IS NOT NULL ORDER BY vc.id DESC`, ctx.taller.id, v.id);
    v.lecturas = todos(ctx.db, 'SELECT l.*, x.numero AS visita_numero FROM lecturas l LEFT JOIN visitas x ON x.id = l.visita_id WHERE l.taller_id = ? AND l.vehiculo_id = ? ORDER BY l.fecha DESC, l.id DESC', ctx.taller.id, v.id);
    const visitas = todos(ctx.db, 'SELECT * FROM visitas WHERE taller_id = ? AND vehiculo_id = ? ORDER BY ingreso_at DESC', ctx.taller.id, v.id);
    v.visitas = visitas.map((x) => {
      const res = resumenVisita(ctx.db, ctx.taller.id, x, { conDinero: puede(ctx.usuario, 'ver.dinero') });
      const control = uno(ctx.db, 'SELECT resultado, como FROM controles WHERE taller_id = ? AND visita_id = ? AND vigente = 1', ctx.taller.id, x.id);
      return { ...res, control };
    });
    v.seguimientos = todos(ctx.db, "SELECT * FROM seguimientos WHERE taller_id = ? AND vehiculo_id = ? AND estado = 'pendiente' ORDER BY id DESC", ctx.taller.id, v.id);
    if (!puede(ctx.usuario, 'ver.dinero')) v.seguimientos.forEach((s) => { s.importe = null; });
    v.proximoService = proximoService(ctx.db, ctx.taller.id, v.id);
    v.adjuntos = todos(ctx.db, 'SELECT id, nombre_original, mime, bytes, descripcion, creado_at FROM adjuntos WHERE taller_id = ? AND vehiculo_id = ? AND visita_id IS NULL AND archivado_at IS NULL', ctx.taller.id, v.id);
    v.mismaPatente = todos(ctx.db, 'SELECT id, patente, marca, modelo FROM vehiculos WHERE taller_id = ? AND patente_norm = ? AND id <> ?', ctx.taller.id, v.patente_norm, v.id);
    return { vehiculo: v };
  });

  r.post('/api/vehiculos', (ctx) => {
    exigir(ctx.usuario, 'vehiculos.editar');
    const b = ctx.cuerpo;
    let contactoId = idEntero(b.contactoId);
    if (contactoId) delTaller(ctx.db, 'contactos', ctx.taller.id, contactoId);
    else if (b.contacto && texto(b.contacto.nombre)) contactoId = crearContacto(ctx, b.contacto);
    const id = crearVehiculo(ctx, b, contactoId);
    return { id };
  });

  r.put('/api/vehiculos/:id', (ctx) => {
    exigir(ctx.usuario, 'vehiculos.editar');
    const v = delTaller(ctx.db, 'vehiculos', ctx.taller.id, idEntero(ctx.params.id));
    if (Number(ctx.cuerpo.version) !== v.version) conflicto();
    const d = datosVehiculo({ ...v, ...ctx.cuerpo });
    if (d.patente_norm !== v.patente_norm) {
      const otro = uno(ctx.db, 'SELECT id FROM vehiculos WHERE taller_id = ? AND patente_norm = ? AND id <> ? AND archivado = 0', ctx.taller.id, d.patente_norm, v.id);
      if (otro && !ctx.cuerpo.confirmarDuplicado) falla('Otra ficha de este taller ya usa esa patente. Revisá antes de cambiarla.', 'patente');
    }
    ejecutar(ctx.db, `UPDATE vehiculos SET patente = ?, patente_norm = ?, marca = ?, modelo = ?, version_txt = ?, anio = ?, motor = ?, combustible = ?, vin = ?, color = ?, notas = ?, version = version + 1
      WHERE taller_id = ? AND id = ?`, d.patente, d.patente_norm, d.marca, d.modelo, d.version_txt, d.anio, d.motor, d.combustible, d.vin, d.color, d.notas, ctx.taller.id, v.id);
    const cambios = Object.keys(d).filter((k) => k !== 'patente_norm' && (v[k] ?? null) !== (d[k] ?? null)).map((k) => `${k}: «${v[k] ?? ''}» → «${d[k] ?? ''}»`);
    ctx.auditar('Datos del vehículo corregidos', 'vehiculo', v.id, cambios.join('; ') || 'Sin cambios');
    return { ok: true };
  });

  // Cambiar el contacto actual: las visitas anteriores conservan su contacto y autorizante.
  r.post('/api/vehiculos/:id/contacto', (ctx) => {
    exigir(ctx.usuario, 'vehiculos.editar');
    const v = delTaller(ctx.db, 'vehiculos', ctx.taller.id, idEntero(ctx.params.id));
    const motivo = requerido(ctx.cuerpo.motivo, 'Contá por qué cambia el contacto (por ejemplo: venta del auto).', 'motivo', 300);
    let contactoId = idEntero(ctx.cuerpo.contactoId);
    if (contactoId) delTaller(ctx.db, 'contactos', ctx.taller.id, contactoId);
    else contactoId = crearContacto(ctx, ctx.cuerpo.contacto || {});
    ejecutar(ctx.db, 'UPDATE vehiculo_contactos SET hasta = ?, motivo = ? WHERE taller_id = ? AND vehiculo_id = ? AND hasta IS NULL', isoAhora(), motivo, ctx.taller.id, v.id);
    insertar(ctx.db, 'INSERT INTO vehiculo_contactos (taller_id, vehiculo_id, contacto_id, desde) VALUES (?, ?, ?, ?)', ctx.taller.id, v.id, contactoId, isoAhora());
    ejecutar(ctx.db, 'UPDATE vehiculos SET contacto_id = ?, version = version + 1 WHERE taller_id = ? AND id = ?', contactoId, ctx.taller.id, v.id);
    ctx.auditar('Contacto del vehículo cambiado', 'vehiculo', v.id, motivo);
    return { ok: true, contactoId };
  });

  r.post('/api/vehiculos/:id/archivar', (ctx) => {
    exigir(ctx.usuario, 'vehiculos.archivar');
    const v = delTaller(ctx.db, 'vehiculos', ctx.taller.id, idEntero(ctx.params.id));
    const archivar = !!ctx.cuerpo.archivar;
    const motivo = archivar ? requerido(ctx.cuerpo.motivo, 'Escribí el motivo del archivo.', 'motivo', 300) : null;
    if (archivar && uno(ctx.db, 'SELECT id FROM visitas WHERE taller_id = ? AND vehiculo_id = ? AND entregada_at IS NULL AND anulada_at IS NULL', ctx.taller.id, v.id)) {
      falla('Este auto tiene una visita abierta. Entregala o anulala antes de archivar la ficha.');
    }
    ejecutar(ctx.db, 'UPDATE vehiculos SET archivado = ?, archivado_motivo = ?, version = version + 1 WHERE taller_id = ? AND id = ?', archivar ? 1 : 0, motivo, ctx.taller.id, v.id);
    ctx.auditar(archivar ? 'Ficha archivada' : 'Ficha recuperada del archivo', 'vehiculo', v.id, motivo);
    return { ok: true };
  });

  r.post('/api/vehiculos/:id/lecturas', (ctx) => {
    exigir(ctx.usuario, 'vehiculos.editar');
    const v = delTaller(ctx.db, 'vehiculos', ctx.taller.id, idEntero(ctx.params.id));
    const id = registrarLectura(ctx, v.id, null, { km: ctx.cuerpo.km, sinKm: false, explicacion: ctx.cuerpo.explicacion, origen: opcional(ctx.cuerpo.origen, 100) || 'Informado' });
    ctx.auditar('Lectura de kilómetros registrada', 'vehiculo', v.id, String(ctx.cuerpo.km));
    return { id };
  });

  // Contactos
  r.get('/api/contactos', (ctx) => {
    exigir(ctx.usuario, 'ver.contactos');
    const q = normTexto(ctx.query.q || '');
    const filas = todos(ctx.db, 'SELECT id, nombre, telefono, email, acepta_avisos FROM contactos WHERE taller_id = ? AND archivado = 0 ORDER BY nombre', ctx.taller.id);
    return { contactos: (q ? filas.filter((c) => normTexto(c.nombre).includes(q) || soloDigitos(c.telefono).includes(soloDigitos(q) || '¬')) : filas).slice(0, 50) };
  });

  r.put('/api/contactos/:id', (ctx) => {
    exigir(ctx.usuario, 'vehiculos.editar');
    const c = delTaller(ctx.db, 'contactos', ctx.taller.id, idEntero(ctx.params.id));
    if (Number(ctx.cuerpo.version) !== c.version) conflicto();
    const d = datosContacto({ ...c, ...ctx.cuerpo });
    const acepta = ctx.cuerpo.acepta_avisos === undefined ? c.acepta_avisos : (ctx.cuerpo.acepta_avisos === null ? null : (ctx.cuerpo.acepta_avisos ? 1 : 0));
    ejecutar(ctx.db, 'UPDATE contactos SET nombre = ?, telefono = ?, email = ?, notas = ?, acepta_avisos = ?, version = version + 1 WHERE taller_id = ? AND id = ?',
      d.nombre, d.telefono, d.email, opcional(ctx.cuerpo.notas ?? c.notas, 1000), acepta, ctx.taller.id, c.id);
    ctx.auditar('Contacto actualizado (las visitas anteriores conservan sus datos)', 'contacto', c.id);
    return { ok: true };
  });
}
