import { uno, todos } from '../db.js';
import { ErrorUsuario, texto, json } from '../util.js';
import { config } from '../config.js';
import {
  verificarClave, crearSesion, cerrarSesion, cerrarSesionesDe, controlarIntentos, registrarIntentoFallido, limpiarIntentos,
  leerTokenAcceso, usarTokenAcceso, hashClave
} from '../auth.js';
import { cookieSesion, leerCookies, COOKIE } from '../http.js';
import { permisosDe, ROLES } from '../permisos.js';
import { tallerPublico } from '../datos.js';
import { reglaEntregaSaldo, puedeEntregarConSaldo } from '../reglas.js';
import { aparienciaEfectiva } from '../../public/js/marca.js';
import { resumenServicio } from '../planes.js';

// Hash fijo para comparar en tiempo similar cuando el email no existe.
const HASH_FALSO = hashClave('clave-inexistente-para-tiempo-constante');

export default function rutas(r) {
  r.post('/api/sesion/ingresar', (ctx) => {
    const email = texto(ctx.cuerpo.email, 200).toLowerCase();
    const clave = String(ctx.cuerpo.clave ?? '');
    const llave = email + '|' + ctx.ip;
    controlarIntentos(llave);
    const u = email ? uno(ctx.db, 'SELECT u.*, t.activo AS taller_activo FROM usuarios u JOIN talleres t ON t.id = u.taller_id WHERE u.email = ?', email) : null;
    const ok = verificarClave(clave, u?.pass_hash || HASH_FALSO) && u && u.activo && u.taller_activo;
    if (!ok) {
      registrarIntentoFallido(llave);
      throw new ErrorUsuario(401, 'El correo o la contraseña no coinciden. Si no la recordás, pedile al dueño del taller un enlace para cambiarla.');
    }
    limpiarIntentos(llave);
    const s = crearSesion(ctx.db, u.id);
    ctx.cookie = cookieSesion(s.token, s.expira, ctx.seguro);
    ctx.taller = { id: u.taller_id };
    ctx.usuario = { id: u.id };
    ctx.auditar('Ingreso al sistema', 'usuario', u.id);
    return { ok: true };
  }, { auth: false });

  // Demostración sin contraseña (TALLERES_DEMO_SIN_INGRESO=1). Se niega si la base tiene algún taller que no sea
  // de demostración: así la variable puesta por error en una instalación real no abre ninguna cuenta.
  r.post('/api/sesion/demo', (ctx) => {
    if (!config.demoSinIngreso) return { ok: false };
    const talleres = todos(ctx.db, 'SELECT config FROM talleres');
    if (!talleres.length || talleres.some((t) => json(t.config, {})?.demo !== true)) return { ok: false };
    const u = uno(ctx.db, "SELECT u.id, u.taller_id FROM usuarios u JOIN talleres t ON t.id = u.taller_id WHERE u.rol = 'dueno' AND u.activo = 1 AND t.activo = 1 ORDER BY t.id, u.id LIMIT 1");
    if (!u) return { ok: false };
    const s = crearSesion(ctx.db, u.id);
    ctx.cookie = cookieSesion(s.token, s.expira, ctx.seguro);
    ctx.taller = { id: u.taller_id };
    ctx.usuario = { id: u.id };
    ctx.auditar('Ingreso a la demostración sin contraseña', 'usuario', u.id);
    return { ok: true };
  }, { auth: false });

  r.post('/api/sesion/salir', (ctx) => {
    cerrarSesion(ctx.db, leerCookies(ctx.req)[COOKIE]);
    ctx.cookie = cookieSesion('', null, ctx.seguro);
    return { ok: true };
  }, { auth: false });

  // Por ejemplo, si se perdió un teléfono con la sesión abierta.
  r.post('/api/sesion/salir-todas', (ctx) => {
    cerrarSesionesDe(ctx.db, ctx.usuario.id);
    ctx.cookie = cookieSesion('', null, ctx.seguro);
    ctx.auditar('Cerró su sesión en todos los dispositivos', 'usuario', ctx.usuario.id);
    return { ok: true };
  });

  r.get('/api/sesion', (ctx) => {
    const t = ctx.taller;
    return {
      usuario: { id: ctx.usuario.id, nombre: ctx.usuario.nombre, email: ctx.usuario.email, rol: ctx.usuario.rol, rolTexto: ROLES[ctx.usuario.rol] },
      permisos: permisosDe(ctx.usuario.rol),
      taller: {
        id: t.id, slug: t.slug, nombre: t.nombre, publico: !!t.publico, en_directorio: !!t.en_directorio,
        zona: t.config.zona_horaria || 'America/Argentina/Mendoza', moneda: t.config.moneda || 'ARS',
        validezDias: t.config.validez_presupuesto_dias || 15, agenda: t.config.agenda || null,
        perfil: tallerPublico(t), logoId: t.config.logoAdjuntoId || null, apariencia: aparienciaEfectiva(t.config.apariencia), servicio: resumenServicio(ctx.db, t.id), demo: !!t.config.demo, entregaSaldo: { regla: reglaEntregaSaldo(t), puedo: puedeEntregarConSaldo(ctx.usuario, t) }, integraciones: t.config.integraciones || {}, guiaVista: (json(t.config.guiasVistas, {}) || {})
      },
      ahora: new Date().toISOString()
    };
  });

  // Enlaces de invitación o recuperación (sin sesión)
  r.get('/api/acceso/:token', (ctx) => {
    const f = leerTokenAcceso(ctx.db, ctx.params.token);
    return { nombre: f.nombre, email: f.email, taller: f.taller, tipo: f.tipo, expira: f.expira };
  }, { auth: false });

  r.post('/api/acceso/:token', (ctx) => {
    const f = usarTokenAcceso(ctx.db, ctx.params.token, ctx.cuerpo.clave);
    const u = uno(ctx.db, 'SELECT taller_id FROM usuarios WHERE id = ?', f.usuario_id);
    ctx.taller = { id: u.taller_id };
    ctx.usuario = { id: f.usuario_id };
    ctx.auditar(f.tipo === 'invitacion' ? 'Aceptó la invitación y creó su contraseña' : 'Cambió su contraseña con un enlace de recuperación', 'usuario', f.usuario_id);
    return { ok: true, email: f.email };
  }, { auth: false });
}
