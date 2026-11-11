// Pendientes (próximos services y trabajos postergados) y avisos preparados a mano.
// Estados distintos: preparado → abierto para enviar → enviado (lo confirma una persona) → respondido.
// Abrir WhatsApp no acredita el envío. Los avisos automáticos dependen de una integración que todavía no está activa.
import { uno, todos, insertar, ejecutar } from '../db.js';
import { exigir, puede } from '../permisos.js';
import { delTaller } from '../datos.js';
import { falla, conflicto, requerido, opcional, enLista, isoAhora, fechaValida, parseKm, soloDigitos, idEntero, hoyLocal } from '../util.js';

const ESTADOS = ['preparado', 'abierto', 'enviado', 'respondido', 'fallido', 'descartado'];
const PASOS = { preparado: ['abierto', 'enviado', 'descartado'], abierto: ['enviado', 'fallido', 'descartado', 'abierto'], enviado: ['respondido'], fallido: ['preparado', 'descartado'], respondido: [], descartado: [] };

// Número para wa.me. No se adivina: si el formato no es claro se avisa para revisarlo en WhatsApp.
export function numeroWhatsapp(tel) {
  let d = soloDigitos(tel);
  if (!d) return { numero: null, revisar: true };
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('54')) return { numero: d, revisar: false };
  if (d.length === 10) return { numero: '549' + d, revisar: false };
  return { numero: d, revisar: true };
}
const pesos = (c) => '$' + (c / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });

function enriquecer(db, tallerId, s, verDinero) {
  const v = uno(db, 'SELECT id, patente, marca, modelo FROM vehiculos WHERE id = ?', s.vehiculo_id);
  const c = s.contacto_id ? uno(db, 'SELECT id, nombre, telefono, acepta_avisos FROM contactos WHERE id = ?', s.contacto_id) : null;
  const lectura = uno(db, 'SELECT km, fecha FROM lecturas WHERE taller_id = ? AND vehiculo_id = ? AND km IS NOT NULL ORDER BY fecha DESC, id DESC LIMIT 1', tallerId, s.vehiculo_id);
  const avisos = todos(db, 'SELECT id, canal, estado, creado_at, actualizado_at FROM avisos WHERE taller_id = ? AND seguimiento_id = ? ORDER BY id DESC', tallerId, s.id);
  const origen = s.visita_origen_id ? uno(db, 'SELECT id, numero, ingreso_at FROM visitas WHERE id = ?', s.visita_origen_id) : null;
  return {
    ...s, importe: verDinero ? s.importe : null, vehiculo: v, contacto: c, ultimaLectura: lectura, origen,
    faltanKm: s.km_objetivo != null && lectura ? s.km_objetivo - lectura.km : null,
    ultimoAviso: avisos[0] || null, avisos
  };
}

export function textoSugerido(taller, s) {
  const nombre = s.contacto?.nombre?.split(' ')[0] || '';
  const auto = [s.vehiculo?.marca, s.vehiculo?.modelo].filter(Boolean).join(' ') || 'tu auto';
  if (s.tipo === 'service') {
    const cuando = [s.km_objetivo != null ? `a los ${s.km_objetivo.toLocaleString('es-AR')} km` : null, s.fecha_objetivo ? `alrededor del ${s.fecha_objetivo.split('-').reverse().join('/')}` : null].filter(Boolean).join(' o ');
    return `Hola ${nombre}, te escribimos de ${taller.nombre}. Según lo que registró el mecánico, el próximo service de ${auto} (${s.vehiculo?.patente}) corresponde ${cuando}${s.criterio ? ' (' + s.criterio.replace(/\.$/, '') + ')' : ''}. ¿Querés que coordinemos un turno?`;
  }
  return `Hola ${nombre}, te escribimos de ${taller.nombre}. En ${auto} (${s.vehiculo?.patente}) quedó pendiente: ${s.titulo}${s.importe ? `, presupuestado en ${pesos(s.importe)}` : ''}. ¿Querés que lo revisemos y coordinemos un turno? Este mensaje no confirma trabajos ni diagnóstico.`;
}

export default function rutas(r) {
  r.get('/api/pendientes', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const verDinero = puede(ctx.usuario, 'ver.dinero');
    const filas = todos(ctx.db, "SELECT * FROM seguimientos WHERE taller_id = ? AND estado = 'pendiente' ORDER BY COALESCE(fecha_objetivo, '9999'), id", ctx.taller.id)
      .map((s) => enriquecer(ctx.db, ctx.taller.id, s, verDinero));
    return {
      hoy: hoyLocal(ctx.taller.config.zona_horaria || 'America/Argentina/Mendoza'),
      services: filas.filter((s) => s.tipo === 'service'),
      postergados: filas.filter((s) => s.tipo === 'postergado'),
      otros: filas.filter((s) => s.tipo === 'otro'),
      integracion: { activa: false, motivo: 'Los avisos automáticos por WhatsApp o correo necesitan una cuenta y un proveedor configurados. Mientras tanto, preparalos y envialos a mano.' }
    };
  });

  r.get('/api/seguimientos/:id', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const s = enriquecer(ctx.db, ctx.taller.id, delTaller(ctx.db, 'seguimientos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese pendiente.'), puede(ctx.usuario, 'ver.dinero'));
    s.textoSugerido = textoSugerido(ctx.taller, s);
    s.whatsapp = numeroWhatsapp(s.contacto?.telefono);
    return { seguimiento: s };
  });

  r.post('/api/seguimientos', (ctx) => {
    exigir(ctx.usuario, 'seguimientos.gestionar');
    const v = delTaller(ctx.db, 'vehiculos', ctx.taller.id, idEntero(ctx.cuerpo.vehiculoId), 'Elegí el auto.');
    const titulo = requerido(ctx.cuerpo.titulo, 'Escribí qué queda pendiente.', 'titulo', 200);
    const fecha = ctx.cuerpo.fecha || null;
    if (fecha && !fechaValida(fecha)) falla('La fecha no es válida.', 'fecha');
    const km = ctx.cuerpo.km ? parseKm(ctx.cuerpo.km) : null;
    if (ctx.cuerpo.km && km === null) falla('Los kilómetros deben escribirse con números.', 'km');
    const id = insertar(ctx.db, "INSERT INTO seguimientos (taller_id, vehiculo_id, contacto_id, tipo, titulo, km_objetivo, fecha_objetivo, criterio, creado_por, creado_at) VALUES (?, ?, ?, 'otro', ?, ?, ?, ?, ?, ?)",
      ctx.taller.id, v.id, v.contacto_id, titulo, km, fecha, opcional(ctx.cuerpo.criterio, 300), ctx.usuario.id, isoAhora());
    ctx.auditar('Pendiente creado', 'seguimiento', id, titulo);
    return { id };
  });

  r.post('/api/seguimientos/:id/cerrar', (ctx) => {
    exigir(ctx.usuario, 'seguimientos.gestionar');
    const s = delTaller(ctx.db, 'seguimientos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese pendiente.');
    if (s.estado !== 'pendiente') falla('Ese pendiente ya está cerrado.');
    if (Number(ctx.cuerpo.version) !== s.version) conflicto();
    const estado = enLista(ctx.cuerpo.estado, ['resuelto', 'descartado'], 'Elegí Resuelto o Descartado.', 'estado');
    const nota = requerido(ctx.cuerpo.nota, 'Escribí qué pasó (por ejemplo: se hizo en la visita 1040, o el cliente no quiere).', 'nota', 300);
    ejecutar(ctx.db, 'UPDATE seguimientos SET estado = ?, cierre_nota = ?, version = version + 1 WHERE id = ?', estado, nota, s.id);
    ctx.auditar(estado === 'resuelto' ? 'Pendiente resuelto' : 'Pendiente descartado', 'seguimiento', s.id, nota);
    return { ok: true };
  });

  // Avisos manuales
  r.post('/api/avisos', (ctx) => {
    exigir(ctx.usuario, 'avisos.preparar');
    const b = ctx.cuerpo;
    const canal = enLista(b.canal, ['whatsapp', 'telefono', 'correo', 'presencial', 'otro'], 'Elegí por dónde vas a avisar.', 'canal');
    const texto = requerido(b.texto, 'Escribí el mensaje.', 'texto', 2000);
    let seguimientoId = idEntero(b.seguimientoId), visitaId = idEntero(b.visitaId), turnoId = idEntero(b.turnoId);
    let nombre = null, telefono = null, entidad = null, entidadId = null;
    if (seguimientoId) {
      const s = delTaller(ctx.db, 'seguimientos', ctx.taller.id, seguimientoId, 'No encontramos ese pendiente.');
      const c = s.contacto_id ? uno(ctx.db, 'SELECT nombre, telefono FROM contactos WHERE id = ?', s.contacto_id) : null;
      nombre = c?.nombre; telefono = c?.telefono; entidad = 'seguimiento'; entidadId = s.id;
    } else if (visitaId) {
      const v = delTaller(ctx.db, 'visitas', ctx.taller.id, visitaId, 'No encontramos esa visita.');
      nombre = v.contacto_nombre; telefono = v.contacto_telefono; entidad = 'visita'; entidadId = v.id;
    } else if (turnoId) {
      const t = delTaller(ctx.db, 'turnos', ctx.taller.id, turnoId, 'No encontramos ese turno.');
      nombre = t.nombre; telefono = t.telefono; entidad = 'turno'; entidadId = t.id;
    } else falla('El aviso debe estar ligado a un pendiente, una visita o un turno.');
    const t = isoAhora();
    const id = insertar(ctx.db, 'INSERT INTO avisos (taller_id, seguimiento_id, visita_id, turno_id, contacto_nombre, telefono, canal, texto, estado, creado_por, creado_at, actualizado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ctx.taller.id, seguimientoId, visitaId, turnoId, nombre, telefono, canal, texto, 'preparado', ctx.usuario.id, t, t);
    ctx.auditar('Mensaje preparado (no enviado)', entidad, entidadId, canal);
    const wa = canal === 'whatsapp' ? numeroWhatsapp(telefono) : null;
    return { id, estado: 'preparado', whatsapp: wa, enlace: wa?.numero ? `https://wa.me/${wa.numero}?text=${encodeURIComponent(texto)}` : null };
  });

  r.get('/api/avisos', (ctx) => {
    exigir(ctx.usuario, 'avisos.preparar');
    const filtro = idEntero(ctx.query.visitaId) ? ['visita_id', idEntero(ctx.query.visitaId)] : idEntero(ctx.query.seguimientoId) ? ['seguimiento_id', idEntero(ctx.query.seguimientoId)] : idEntero(ctx.query.turnoId) ? ['turno_id', idEntero(ctx.query.turnoId)] : null;
    const filas = filtro
      ? todos(ctx.db, `SELECT a.*, u.nombre AS por FROM avisos a LEFT JOIN usuarios u ON u.id = a.creado_por WHERE a.taller_id = ? AND a.${filtro[0]} = ? ORDER BY a.id DESC`, ctx.taller.id, filtro[1])
      : todos(ctx.db, 'SELECT a.*, u.nombre AS por FROM avisos a LEFT JOIN usuarios u ON u.id = a.creado_por WHERE a.taller_id = ? ORDER BY a.id DESC LIMIT 100', ctx.taller.id);
    return { avisos: filas };
  });

  r.post('/api/avisos/:id/estado', (ctx) => {
    exigir(ctx.usuario, 'avisos.preparar');
    const a = delTaller(ctx.db, 'avisos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese aviso.');
    const estado = enLista(ctx.cuerpo.estado, ESTADOS, 'Estado no válido.', 'estado');
    if (!PASOS[a.estado].includes(estado)) falla(`No se puede pasar de «${a.estado}» a «${estado}».`);
    if (estado === 'enviado' && !ctx.cuerpo.confirmo) falla('Confirmá que el mensaje salió realmente (lo enviaste vos o lo viste enviado).', 'confirmo');
    ejecutar(ctx.db, 'UPDATE avisos SET estado = ?, nota = COALESCE(?, nota), actualizado_at = ?, version = version + 1 WHERE id = ?', estado, opcional(ctx.cuerpo.nota, 300), isoAhora(), a.id);
    const txt = { abierto: 'WhatsApp abierto para enviar (todavía no confirma el envío)', enviado: 'Mensaje enviado (confirmado por una persona)', respondido: 'El cliente respondió', fallido: 'No se pudo enviar', descartado: 'Mensaje descartado', preparado: 'Mensaje preparado de nuevo' }[estado];
    const [ent, id] = a.seguimiento_id ? ['seguimiento', a.seguimiento_id] : a.visita_id ? ['visita', a.visita_id] : ['turno', a.turno_id];
    ctx.auditar(txt, ent, id, opcional(ctx.cuerpo.nota, 300));
    return { ok: true, estado };
  });
}
