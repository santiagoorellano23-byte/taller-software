// Panel central de Growth Labs: talleres, altas, plan, suscripción, pagos conciliados a mano y registro.
// Solo datos del servicio: nunca clientes, autos, trabajos ni importes de los talleres.
import path from 'node:path';
import { uno, todos, ejecutar, insertar } from '../db.js';
import { ErrorUsuario, falla, conflicto, requerido, opcional, texto, enLista, dinero, fechaValida, idEntero, isoAhora } from '../util.js';
import { leerCookies } from '../http.js';
import { controlarIntentos, registrarIntentoFallido, limpiarIntentos, crearTokenAcceso } from '../auth.js';
import { COOKIE_ADMIN, cookieAdmin, ingresarAdmin, adminDesdeToken, cerrarSesionAdmin, usarEnlaceAdmin } from '../admin.js';
import { crearTaller } from '../plataforma.js';
import { resumenServicio, suscripcionDe, planesVigentes, auditarPlataforma, ESTADOS } from '../planes.js';
import { estadoRespaldo } from '../respaldo.js';
import { config } from '../config.js';

const SIN = { auth: false };
function admin(ctx) {
  const a = adminDesdeToken(ctx.db, leerCookies(ctx.req)[COOKIE_ADMIN]);
  if (!a) throw new ErrorUsuario(401, 'Tu sesión del panel terminó o no tenés acceso. Ingresá con tu cuenta de Growth Labs.');
  return a;
}
const tallerDe = (db, id) => uno(db, 'SELECT id, slug, nombre, activo, creado_at FROM talleres WHERE id = ?', idEntero(id)) || falla('No existe ese taller.');
const enlace = (t) => `/acceso.html#${t.token}`;
function duenos(db, tallerId) {
  return todos(db, "SELECT id, nombre, email, activo, (pass_hash IS NULL) AS pendiente FROM usuarios WHERE taller_id = ? AND rol = 'dueno' ORDER BY id", tallerId)
    .map((u) => ({ ...u, pendiente: !!u.pendiente }));
}
const fechaOpcional = (v, campo, nombre) => {
  if (v == null || v === '') return null;
  if (!fechaValida(v)) falla(`La fecha de ${nombre} no es válida.`, campo);
  return v;
};

export default function rutas(r) {
  r.post('/api/plataforma/ingresar', (ctx) => {
    const email = texto(ctx.cuerpo.email, 200).toLowerCase();
    const llave = 'panel|' + email + '|' + ctx.ip;
    controlarIntentos(llave);
    const s = ingresarAdmin(ctx.db, email, ctx.cuerpo.clave);
    if (!s) { registrarIntentoFallido(llave); throw new ErrorUsuario(401, 'El correo o la contraseña no coinciden.'); }
    limpiarIntentos(llave);
    ctx.cookie = cookieAdmin(s.token, s.expira, ctx.seguro);
    auditarPlataforma(ctx.db, s.admin.id, null, 'Ingreso al panel');
    return { admin: s.admin };
  }, SIN);

  r.post('/api/plataforma/salir', (ctx) => {
    cerrarSesionAdmin(ctx.db, leerCookies(ctx.req)[COOKIE_ADMIN]);
    ctx.cookie = cookieAdmin('', null, ctx.seguro);
    return { ok: true };
  }, SIN);

  r.post('/api/plataforma/acceso/:token', (ctx) => {
    const id = usarEnlaceAdmin(ctx.db, ctx.params.token, ctx.cuerpo.clave);
    auditarPlataforma(ctx.db, id, null, 'Creó su contraseña del panel con un enlace');
    return { ok: true };
  }, SIN);

  r.get('/api/plataforma/sesion', (ctx) => ({ admin: admin(ctx), estados: ESTADOS }), SIN);

  r.get('/api/plataforma/planes', (ctx) => { admin(ctx); return { planes: planesVigentes(ctx.db) }; }, SIN);

  r.get('/api/plataforma/talleres', (ctx) => {
    admin(ctx);
    const q = `%${texto(ctx.query.q, 100).toLowerCase()}%`;
    const filas = todos(ctx.db, 'SELECT id, slug, nombre, activo, creado_at FROM talleres WHERE lower(nombre) LIKE ? OR slug LIKE ? ORDER BY nombre LIMIT 200', q, q);
    return {
      talleres: filas.map((t) => {
        const ds = duenos(ctx.db, t.id);
        return { ...t, servicio: resumenServicio(ctx.db, t.id), altaIncompleta: !ds.some((d) => d.activo && !d.pendiente) };
      })
    };
  }, SIN);

  r.get('/api/plataforma/talleres/:id', (ctx) => {
    admin(ctx);
    const t = tallerDe(ctx.db, ctx.params.id);
    const s = suscripcionDe(ctx.db, t.id);
    return {
      taller: t, duenos: duenos(ctx.db, t.id), servicio: resumenServicio(ctx.db, t.id),
      suscripcion: s && { id: s.id, planId: s.plan_id, estadoGuardado: s.estado, periodoDesde: s.periodo_desde, periodoHasta: s.periodo_hasta, graciaHasta: s.gracia_hasta, cancelaAlCierre: !!s.cancela_al_cierre, modalidad: s.modalidad, nota: s.nota, version: s.version },
      pagos: todos(ctx.db, 'SELECT p.*, a.nombre AS por FROM pagos_suscripcion p JOIN plataforma_admins a ON a.id = p.registrado_por WHERE p.taller_id = ? ORDER BY p.id DESC', t.id),
      registro: todos(ctx.db, 'SELECT r.*, a.nombre AS por FROM plataforma_auditoria r LEFT JOIN plataforma_admins a ON a.id = r.admin_id WHERE r.taller_id = ? ORDER BY r.id DESC LIMIT 100', t.id)
    };
  }, SIN);

  // Alta: crea el espacio, el plan y la invitación del dueño en una sola transacción.
  r.post('/api/plataforma/talleres', (ctx) => {
    const a = admin(ctx);
    const b = ctx.cuerpo;
    const nombre = requerido(b.nombre, 'Escribí el nombre del taller.', 'nombre', 120);
    const r2 = crearTaller(ctx.db, {
      slug: b.slug, nombre, plan: b.plan || 'profesional', periodoHasta: fechaOpcional(b.periodoHasta, 'periodoHasta', 'fin de la prueba'),
      dueno: { nombre: requerido(b.duenoNombre, 'Escribí el nombre del responsable.', 'duenoNombre', 120), email: b.duenoEmail }, origen: 'el panel de Growth Labs'
    });
    auditarPlataforma(ctx.db, a.id, r2.tallerId, 'Alta de taller e invitación al responsable', `${nombre} · plan ${b.plan || 'profesional'}`);
    return { id: r2.tallerId, enlace: enlace(r2.invitacion), expira: r2.invitacion.expira };
  }, SIN);

  // Retomar un alta incompleta: invitación nueva para el dueño que todavía no creó su contraseña.
  r.post('/api/plataforma/talleres/:id/invitacion', (ctx) => {
    const a = admin(ctx);
    const t = tallerDe(ctx.db, ctx.params.id);
    const d = duenos(ctx.db, t.id).find((x) => x.activo && x.pendiente);
    if (!d) falla('El responsable ya creó su contraseña. Si la perdió, el dueño del taller puede generar un enlace desde Ajustes → Usuarios.');
    const k = crearTokenAcceso(ctx.db, d.id, 'invitacion', null, 72);
    auditarPlataforma(ctx.db, a.id, t.id, 'Invitación al responsable generada de nuevo', d.email);
    return { enlace: enlace(k), expira: k.expira };
  }, SIN);

  r.put('/api/plataforma/talleres/:id/suscripcion', (ctx) => {
    const a = admin(ctx);
    const t = tallerDe(ctx.db, ctx.params.id);
    const s = suscripcionDe(ctx.db, t.id);
    const b = ctx.cuerpo;
    if (!s) falla('Este taller no tiene suscripción.');
    if (Number(b.version) !== s.version) conflicto('Otra persona cambió esta suscripción. Recargá para ver los datos actuales.');
    const motivo = requerido(b.motivo, 'Escribí el motivo del cambio: queda en el registro.', 'motivo', 300);
    const planId = idEntero(b.planId) || s.plan_id;
    const plan = uno(ctx.db, 'SELECT * FROM planes WHERE id = ?', planId);
    if (!plan || (!plan.activo && planId !== s.plan_id)) falla('Ese plan no está disponible.', 'planId');
    const estado = enLista(b.estado ?? s.estado, Object.keys(ESTADOS), 'Elegí un estado de la lista.', 'estado');
    const periodoDesde = b.periodoDesde === undefined ? s.periodo_desde : fechaOpcional(b.periodoDesde, 'periodoDesde', 'inicio');
    const periodoHasta = b.periodoHasta === undefined ? s.periodo_hasta : fechaOpcional(b.periodoHasta, 'periodoHasta', 'fin del período');
    const graciaHasta = b.graciaHasta === undefined ? s.gracia_hasta : fechaOpcional(b.graciaHasta, 'graciaHasta', 'fin de la gracia');
    if (periodoDesde && periodoHasta && periodoHasta < periodoDesde) falla('El fin del período no puede ser anterior al inicio.', 'periodoHasta');
    if (graciaHasta && (!periodoHasta || graciaHasta < periodoHasta)) falla('La gracia termina después del fin del período.', 'graciaHasta');
    const modalidad = enLista(b.modalidad ?? s.modalidad, ['manual', 'transferencia', 'sin_cargo'], 'Elegí la modalidad de cobro.', 'modalidad');
    const cancela = b.cancelaAlCierre === undefined ? s.cancela_al_cierre : (b.cancelaAlCierre ? 1 : 0);
    ejecutar(ctx.db, `UPDATE suscripciones SET plan_id = ?, estado = ?, periodo_desde = ?, periodo_hasta = ?, gracia_hasta = ?, cancela_al_cierre = ?, modalidad = ?, nota = ?,
      version = version + 1, actualizado_at = ? WHERE id = ?`, planId, estado, periodoDesde, periodoHasta, graciaHasta, cancela, modalidad, opcional(b.nota, 1000) ?? s.nota, isoAhora(), s.id);
    const cambios = [];
    if (planId !== s.plan_id) cambios.push(`plan: ${s.plan_nombre} → ${plan.nombre}`);
    for (const [k, antes, despues] of [['estado', s.estado, estado], ['período hasta', s.periodo_hasta, periodoHasta], ['gracia hasta', s.gracia_hasta, graciaHasta], ['modalidad', s.modalidad, modalidad], ['cancela al cierre', !!s.cancela_al_cierre, !!cancela]]) {
      if (antes !== despues) cambios.push(`${k}: ${antes ?? '—'} → ${despues ?? '—'}`);
    }
    auditarPlataforma(ctx.db, a.id, t.id, 'Suscripción modificada', `${cambios.join('; ') || 'sin cambios de datos'}. Motivo: ${motivo}`);
    return { servicio: resumenServicio(ctx.db, t.id) };
  }, SIN);

  // Conciliación manual: alguien de Growth Labs confirmó el pago (por ejemplo, una transferencia) y lo registra.
  // No es un cobro automático. La clave de idempotencia evita registrar dos veces el mismo envío.
  r.post('/api/plataforma/talleres/:id/pagos', (ctx) => {
    const a = admin(ctx);
    const t = tallerDe(ctx.db, ctx.params.id);
    const s = suscripcionDe(ctx.db, t.id);
    if (!s) falla('Este taller no tiene suscripción.');
    const clave = String(ctx.req.headers['idempotency-key'] || '').slice(0, 100);
    if (!clave) falla('Falta la clave de la operación. Recargá la página e intentá de nuevo.');
    const b = ctx.cuerpo;
    const importe = dinero(b.importe, 'Escribí el importe recibido con números.', 'importe');
    const medio = requerido(b.medio, 'Indicá el medio de pago.', 'medio', 60);
    const referencia = requerido(b.referencia, 'Escribí la referencia del comprobante (número de operación).', 'referencia', 120);
    const desde = fechaOpcional(b.periodoDesde, 'periodoDesde', 'inicio') || falla('Indicá desde qué día cubre el pago.', 'periodoDesde');
    const hasta = fechaOpcional(b.periodoHasta, 'periodoHasta', 'fin') || falla('Indicá hasta qué día cubre el pago.', 'periodoHasta');
    if (hasta < desde) falla('El fin del período pagado no puede ser anterior al inicio.', 'periodoHasta');
    const previo = uno(ctx.db, 'SELECT * FROM pagos_suscripcion WHERE clave = ?', clave);
    if (previo) {
      if (previo.taller_id !== t.id || previo.importe_centavos !== importe || previo.referencia !== referencia || previo.periodo_hasta !== hasta) throw new ErrorUsuario(409, 'Esta operación ya tiene un pago registrado con otros datos. Revisá los pagos antes de registrar otro.');
      return { pago: previo, servicio: resumenServicio(ctx.db, t.id), repetido: true };
    }
    if (uno(ctx.db, 'SELECT id FROM pagos_suscripcion WHERE taller_id = ? AND referencia = ?', t.id, referencia)) falla('Ya hay un pago registrado con esa referencia para este taller.', 'referencia');
    const id = insertar(ctx.db, `INSERT INTO pagos_suscripcion (taller_id, suscripcion_id, importe_centavos, medio, referencia, periodo_desde, periodo_hasta, nota, registrado_por, registrado_at, clave)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, t.id, s.id, importe, medio, referencia, desde, hasta, opcional(b.nota, 500), a.id, isoAhora(), clave);
    // El período pagado solo extiende la vigencia; un pago atrasado no acorta un período ya registrado.
    const nuevoHasta = !s.periodo_hasta || hasta > s.periodo_hasta ? hasta : s.periodo_hasta;
    ejecutar(ctx.db, "UPDATE suscripciones SET estado = 'activa', periodo_desde = COALESCE(periodo_desde, ?), periodo_hasta = ?, gracia_hasta = NULL, version = version + 1, actualizado_at = ? WHERE id = ?",
      desde, nuevoHasta, isoAhora(), s.id);
    auditarPlataforma(ctx.db, a.id, t.id, 'Pago de suscripción conciliado manualmente', `${(importe / 100).toLocaleString('es-AR')} ${medio}, ref. ${referencia}, cubre ${desde} a ${hasta}; vigencia hasta ${nuevoHasta}`);
    return { pago: uno(ctx.db, 'SELECT * FROM pagos_suscripcion WHERE id = ?', id), servicio: resumenServicio(ctx.db, t.id) };
  }, SIN);

  r.get('/api/plataforma/registro', (ctx) => {
    admin(ctx);
    return { registro: todos(ctx.db, 'SELECT r.*, a.nombre AS por, t.nombre AS taller FROM plataforma_auditoria r LEFT JOIN plataforma_admins a ON a.id = r.admin_id LEFT JOIN talleres t ON t.id = r.taller_id ORDER BY r.id DESC LIMIT 300') };
  }, SIN);

  // Salud medida: estado real de la carpeta de respaldos. Sin respaldos encontrados, el panel muestra «sin verificar».
  r.get('/api/plataforma/salud', (ctx) => {
    admin(ctx);
    return { respaldos: estadoRespaldo(path.join(path.dirname(config.datos), 'respaldos')) };
  }, SIN);
}
