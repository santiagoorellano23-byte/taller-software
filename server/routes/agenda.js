// Agenda y solicitudes online. Una solicitud pública queda "solicitado" hasta que el taller la confirma
// y nunca expone historial, clientes ni otros turnos.
import crypto from 'node:crypto';
import { uno, todos, insertar, ejecutar } from '../db.js';
import { exigir } from '../permisos.js';
import { delTaller } from '../datos.js';
import {
  ErrorUsuario, falla, conflicto, requerido, opcional, texto, enLista, normPatente, soloDigitos, isoAhora, localAhora,
  fechaValida, fechaHoraValida, minutosDe, hhmm, diaSemana, sumarDias, idEntero, json
} from '../util.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const agendaDe = (taller) => ({ dias: [1, 2, 3, 4, 5, 6], desde: '08:00', hasta: '18:00', paso: 15, ...(taller.config.agenda || {}) });
const zona = (taller) => taller.config.zona_horaria || 'America/Argentina/Mendoza';

export function franjasDe(agenda) {
  return agenda.pausaDesde && agenda.pausaHasta
    ? [[agenda.desde, agenda.pausaDesde], [agenda.pausaHasta, agenda.hasta]]
    : [[agenda.desde, agenda.hasta]];
}

export const horaValida = (h) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

export function normalizarAgenda(a) {
  const dias = [...new Set((Array.isArray(a.dias) ? a.dias : []).map(Number))];
  if (!dias.length || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) falla('Elegí al menos un día de atención válido.', 'agendaDias');
  if (!horaValida(a.desde) || !horaValida(a.hasta) || a.desde >= a.hasta) falla('Revisá el horario de turnos (desde y hasta).', 'agendaDesde');
  const paso = Number(a.paso || 15);
  if (![15, 30, 60].includes(paso)) falla('Los turnos pueden empezar cada 15, 30 o 60 minutos.', 'agendaPaso');
  const pausaDesde = a.pausaDesde || '', pausaHasta = a.pausaHasta || '';
  if (pausaDesde || pausaHasta) {
    if (!horaValida(pausaDesde) || !horaValida(pausaHasta) || !(a.desde < pausaDesde && pausaDesde < pausaHasta && pausaHasta < a.hasta)) {
      falla('Completá el inicio y el fin del cierre del mediodía, dentro del horario de atención.', 'pausaDesde');
    }
  }
  return { dias: dias.sort(), desde: a.desde, hasta: a.hasta, paso, pausaDesde, pausaHasta };
}

const entraEnFranja = (a, m, duracion) => franjasDe(a).some(([desde, hasta]) => m >= minutosDe(desde) && m + duracion <= minutosDe(hasta));

function validarHorario(taller, inicio, duracion) {
  const a = agendaDe(taller);
  if (!Number.isInteger(duracion) || duracion < 15 || duracion > 480) falla('La duración debe estar entre 15 minutos y 8 horas.', 'duracion');
  if (!fechaHoraValida(inicio)) falla('Elegí fecha y hora del turno.', 'inicio');
  const fecha = inicio.slice(0, 10), m = minutosDe(inicio.slice(11));
  if (!a.dias.includes(diaSemana(fecha))) falla(`El taller no atiende los ${DIAS[diaSemana(fecha)]}.`, 'inicio');
  if (!entraEnFranja(a, m, duracion)) falla(`El turno debe quedar dentro de una franja de atención: ${franjasDe(a).map(([d, h]) => `${d} a ${h}`).join(' y ')}. No puede cruzar un cierre.`, 'inicio');
  if (m % a.paso) falla(`Los turnos empiezan cada ${a.paso} minutos (por ejemplo ${hhmm(minutosDe(a.desde))}, ${hhmm(minutosDe(a.desde) + a.paso)}…).`, 'inicio');
  if (inicio < localAhora(zona(taller))) falla('Ese horario ya pasó. Elegí uno futuro.', 'inicio');
}
function hayConflicto(db, tallerId, t) {
  if (!t.puesto_id) return null;
  const otros = todos(db, "SELECT * FROM turnos WHERE taller_id = ? AND puesto_id = ? AND estado = 'confirmado' AND id <> ? AND substr(inicio, 1, 10) = ?", tallerId, t.puesto_id, t.id || 0, t.inicio.slice(0, 10));
  const ini = minutosDe(t.inicio.slice(11)), fin = ini + t.duracion_min;
  return otros.find((o) => { const oi = minutosDe(o.inicio.slice(11)); return ini < oi + o.duracion_min && oi < fin; }) || null;
}
function codigoNuevo(db, tallerId) {
  for (let i = 0; i < 10; i++) {
    const c = crypto.randomBytes(4).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    if (c.length === 6 && !uno(db, 'SELECT id FROM turnos WHERE taller_id = ? AND codigo = ?', tallerId, c)) return c;
  }
  throw new Error('No se pudo generar un código de turno');
}
function datosPersona(b) {
  const nombre = requerido(b.nombre, 'Escribí el nombre de quien trae el auto.', 'nombre', 120);
  const telefono = requerido(b.telefono, 'Escribí un teléfono de contacto.', 'telefono', 40);
  if (soloDigitos(telefono).length < 6) falla('El teléfono parece incompleto.', 'telefono');
  const patente = opcional(b.patente, 20);
  return { nombre, telefono, patente: patente ? patente.toUpperCase() : null, vehiculo_texto: opcional(b.vehiculo, 120), motivo: opcional(b.motivo, 500) };
}

// Límite simple de solicitudes públicas por IP (en memoria).
const solicitudesIp = new Map();
function limitarPublico(ip) {
  const t = Date.now();
  const l = (solicitudesIp.get(ip) || []).filter((x) => t - x < 3600e3);
  if (l.length >= 5) throw new ErrorUsuario(429, 'Recibimos varias solicitudes desde esta conexión. Llamá al taller para coordinar.');
  l.push(t);
  solicitudesIp.set(ip, l);
}

export default function rutas(r) {
  r.get('/api/agenda', (ctx) => {
    exigir(ctx.usuario, 'agenda.ver');
    const desde = fechaValida(ctx.query.desde) ? ctx.query.desde : localAhora(zona(ctx.taller)).slice(0, 10);
    const hasta = fechaValida(ctx.query.hasta) ? ctx.query.hasta : sumarDias(desde, 6);
    const turnos = todos(ctx.db, `SELECT t.*, p.nombre AS puesto, s.nombre AS servicio, v.numero AS visita_numero FROM turnos t LEFT JOIN puestos p ON p.id = t.puesto_id
      LEFT JOIN servicios s ON s.id = t.servicio_id LEFT JOIN visitas v ON v.id = t.visita_id
      WHERE t.taller_id = ? AND substr(t.inicio, 1, 10) BETWEEN ? AND ? ORDER BY t.inicio`, ctx.taller.id, desde, hasta);
    const solicitudes = todos(ctx.db, `SELECT t.*, s.nombre AS servicio FROM turnos t LEFT JOIN servicios s ON s.id = t.servicio_id WHERE t.taller_id = ? AND t.estado = 'solicitado' ORDER BY t.creado_at`, ctx.taller.id);
    return {
      desde, hasta, turnos, solicitudes, agenda: agendaDe(ctx.taller),
      puestos: todos(ctx.db, 'SELECT * FROM puestos WHERE taller_id = ? AND activo = 1 ORDER BY id', ctx.taller.id),
      servicios: todos(ctx.db, 'SELECT * FROM servicios WHERE taller_id = ? AND activo = 1 ORDER BY nombre', ctx.taller.id),
      ahora: localAhora(zona(ctx.taller))
    };
  });

  r.post('/api/turnos', (ctx) => {
    exigir(ctx.usuario, 'agenda.gestionar');
    const b = ctx.cuerpo;
    const p = datosPersona(b);
    const servicio = idEntero(b.servicioId) ? delTaller(ctx.db, 'servicios', ctx.taller.id, idEntero(b.servicioId), 'Elegí un servicio de este taller.') : null;
    const duracion = Number(b.duracion ?? servicio?.duracion_min ?? 60);
    if (!Number.isInteger(duracion) || duracion < 15 || duracion > 480) falla('La duración debe estar entre 15 minutos y 8 horas.', 'duracion');
    const puestoId = idEntero(b.puestoId);
    if (puestoId) delTaller(ctx.db, 'puestos', ctx.taller.id, puestoId, 'Elegí un puesto de este taller.');
    validarHorario(ctx.taller, b.inicio, duracion);
    const t = { inicio: b.inicio, duracion_min: duracion, puesto_id: puestoId };
    const choque = hayConflicto(ctx.db, ctx.taller.id, t);
    if (choque) falla(`Ese puesto está ocupado de ${choque.inicio.slice(11)} por ${choque.duracion_min} min. Elegí otro horario o puesto.`, 'inicio');
    const codigo = codigoNuevo(ctx.db, ctx.taller.id);
    const id = insertar(ctx.db, `INSERT INTO turnos (taller_id, codigo, puesto_id, servicio_id, inicio, duracion_min, nombre, telefono, patente, vehiculo_texto, motivo, estado, origen, acepta_avisos, creado_por, creado_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', 'interno', ?, ?, ?)`, ctx.taller.id, codigo, puestoId, servicio?.id ?? null, b.inicio, duracion,
    p.nombre, p.telefono, p.patente, p.vehiculo_texto, p.motivo, b.aceptaAvisos ? 1 : 0, ctx.usuario.id, isoAhora());
    ctx.auditar('Turno creado y confirmado', 'turno', id, `${b.inicio} · ${p.nombre}`);
    return { id, codigo };
  });

  // Confirmar (con posible reprogramación): comprueba horario y puesto.
  r.post('/api/turnos/:id/confirmar', (ctx) => {
    exigir(ctx.usuario, 'agenda.gestionar');
    const t = delTaller(ctx.db, 'turnos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese turno.');
    if (Number(ctx.cuerpo.version) !== t.version) conflicto('Otra persona cambió este turno. Recargá la agenda.');
    if (!['solicitado', 'confirmado'].includes(t.estado)) falla('Ese turno ya está cerrado.');
    const inicio = ctx.cuerpo.inicio || t.inicio;
    const duracion = Number(ctx.cuerpo.duracion ?? t.duracion_min);
    const puestoId = ctx.cuerpo.puestoId === undefined ? t.puesto_id : idEntero(ctx.cuerpo.puestoId);
    if (puestoId) delTaller(ctx.db, 'puestos', ctx.taller.id, puestoId, 'Elegí un puesto de este taller.');
    validarHorario(ctx.taller, inicio, duracion);
    const choque = hayConflicto(ctx.db, ctx.taller.id, { id: t.id, inicio, duracion_min: duracion, puesto_id: puestoId });
    if (choque) falla(`Ese puesto está ocupado de ${choque.inicio.slice(11)} por ${choque.duracion_min} min. Elegí otro horario o puesto.`, 'inicio');
    ejecutar(ctx.db, "UPDATE turnos SET estado = 'confirmado', inicio = ?, duracion_min = ?, puesto_id = ?, version = version + 1 WHERE id = ?", inicio, duracion, puestoId, t.id);
    ctx.auditar(t.estado === 'solicitado' ? 'Solicitud confirmada' : (inicio !== t.inicio ? 'Turno reprogramado' : 'Turno actualizado'), 'turno', t.id, `${t.inicio} → ${inicio}`);
    return { ok: true };
  });

  r.post('/api/turnos/:id/cerrar', (ctx) => {
    exigir(ctx.usuario, 'agenda.gestionar');
    const t = delTaller(ctx.db, 'turnos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese turno.');
    if (!['solicitado', 'confirmado'].includes(t.estado)) falla('Ese turno ya está cerrado.');
    const estado = enLista(ctx.cuerpo.estado, ['cancelado', 'no_asistio'], 'Elegí Cancelado o No vino.', 'estado');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí el motivo.', 'motivo', 300);
    if (estado === 'no_asistio' && t.inicio > localAhora(zona(ctx.taller))) falla('Todavía no pasó el horario del turno.');
    ejecutar(ctx.db, 'UPDATE turnos SET estado = ?, motivo_cierre = ?, version = version + 1 WHERE id = ?', estado, motivo, t.id);
    ctx.auditar(estado === 'cancelado' ? 'Turno cancelado' : 'El cliente no vino al turno', 'turno', t.id, motivo);
    return { ok: true };
  });

  // ----- Público -----
  function tallerPublicoActivo(db, slug) {
    const t = uno(db, 'SELECT * FROM talleres WHERE slug = ? AND activo = 1 AND publico = 1', String(slug || '').toLowerCase());
    if (!t) throw new ErrorUsuario(404, 'No encontramos ese taller o no tiene página pública.');
    t.config = json(t.config, {});
    return t;
  }

  r.get('/api/publico/:slug/turnos', (ctx) => {
    const t = tallerPublicoActivo(ctx.db, ctx.params.slug);
    if (!t.config.turnosOnline) return { habilitado: false };
    const fecha = fechaValida(ctx.query.fecha) ? ctx.query.fecha : localAhora(zona(t)).slice(0, 10);
    const a = agendaDe(t);
    const puestos = todos(ctx.db, 'SELECT id FROM puestos WHERE taller_id = ? AND activo = 1', t.id).length || 1;
    const ocupados = todos(ctx.db, "SELECT inicio, duracion_min FROM turnos WHERE taller_id = ? AND estado = 'confirmado' AND substr(inicio, 1, 10) = ?", t.id, fecha);
    const servicios = todos(ctx.db, 'SELECT id, nombre, duracion_min FROM servicios WHERE taller_id = ? AND activo = 1 AND publico = 1 ORDER BY nombre', t.id);
    const servicio = ctx.query.servicioId ? servicios.find((s) => s.id === Number(ctx.query.servicioId)) : null;
    if (ctx.query.servicioId && !servicio) throw new ErrorUsuario(404, 'Ese servicio no está disponible. Elegí otro.');
    const duracion = servicio?.duracion_min || 60;
    const ahora = localAhora(zona(t));
    const horarios = [];
    if (a.dias.includes(diaSemana(fecha))) {
      for (let m = Math.ceil(minutosDe(a.desde) / a.paso) * a.paso; m + duracion <= minutosDe(a.hasta); m += a.paso) {
        if (!entraEnFranja(a, m, duracion)) continue;
        const ini = `${fecha}T${hhmm(m)}`;
        if (ini < ahora) continue;
        const enUso = ocupados.filter((o) => { const oi = minutosDe(o.inicio.slice(11)); return m < oi + o.duracion_min && oi < m + duracion; }).length;
        horarios.push({ hora: hhmm(m), libre: enUso < puestos });
      }
    }
    return { habilitado: true, fecha, horarios, servicios, duracion, atiende: a.dias.map((d) => DIAS[d]), desde: a.desde, hasta: a.hasta, franjas: franjasDe(a) };
  }, { auth: false });

  r.post('/api/publico/:slug/turnos', (ctx) => {
    const t = tallerPublicoActivo(ctx.db, ctx.params.slug);
    if (!t.config.turnosOnline) falla('Este taller no recibe solicitudes online. Comunicate por teléfono.');
    if (texto(ctx.cuerpo.sitio)) return { ok: true, codigo: '------' }; // campo trampa para robots
    limitarPublico(ctx.ip);
    const b = ctx.cuerpo;
    const p = datosPersona(b);
    if (!b.acepta) falla('Confirmá que el taller puede contactarte por esta solicitud.', 'acepta');
    const servicio = idEntero(b.servicioId) ? uno(ctx.db, 'SELECT * FROM servicios WHERE taller_id = ? AND id = ? AND activo = 1 AND publico = 1', t.id, idEntero(b.servicioId)) : null;
    const duracion = servicio?.duracion_min || 60;
    const inicio = `${b.fecha}T${b.hora}`;
    validarHorario(t, inicio, duracion);
    const codigo = codigoNuevo(ctx.db, t.id);
    insertar(ctx.db, `INSERT INTO turnos (taller_id, codigo, servicio_id, inicio, duracion_min, nombre, telefono, patente, vehiculo_texto, motivo, estado, origen, acepta_avisos, creado_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'solicitado', 'online', ?, ?)`, t.id, codigo, servicio?.id ?? null, inicio, duracion, p.nombre, p.telefono, p.patente, p.vehiculo_texto, p.motivo, b.avisos ? 1 : 0, isoAhora());
    insertar(ctx.db, 'INSERT INTO auditoria (taller_id, usuario_id, accion, entidad, detalle, fecha) VALUES (?, NULL, ?, ?, ?, ?)', t.id, 'Solicitud de turno recibida desde la página pública', 'turno', `${inicio} · código ${codigo}`, isoAhora());
    return { ok: true, codigo, inicio, mensaje: 'Recibimos tu solicitud. El taller la tiene que confirmar: todavía no es un turno asignado.' };
  }, { auth: false });

  // Consulta pública del estado de una solicitud: exige código y los últimos 4 números del teléfono. No muestra datos del auto ni historial.
  r.get('/api/publico/:slug/turnos/:codigo', (ctx) => {
    const t = tallerPublicoActivo(ctx.db, ctx.params.slug);
    const fila = uno(ctx.db, 'SELECT estado, inicio, telefono FROM turnos WHERE taller_id = ? AND codigo = ?', t.id, String(ctx.params.codigo).toUpperCase());
    const cuatro = soloDigitos(ctx.query.tel).slice(-4);
    if (!fila || cuatro.length !== 4 || soloDigitos(fila.telefono).slice(-4) !== cuatro) throw new ErrorUsuario(404, 'No encontramos una solicitud con ese código y teléfono.');
    const txt = { solicitado: 'Pendiente de confirmación por el taller', confirmado: 'Confirmado', cancelado: 'Cancelado', no_asistio: 'Cerrado', ingresado: 'El auto ya fue recibido' }[fila.estado];
    return { estado: txt, inicio: fila.estado === 'confirmado' || fila.estado === 'solicitado' ? fila.inicio : null };
  }, { auth: false });
}
