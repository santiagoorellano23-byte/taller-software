// Autenticación: contraseñas con scrypt, sesiones de servidor y enlaces de invitación/recuperación.
import crypto from 'node:crypto';
import { uno, ejecutar, insertar } from './db.js';
import { ErrorUsuario, falla } from './util.js';

// Sesiones y enlaces vencen según la hora real (el reloj simulado de pruebas no los afecta).
const ahora = () => new Date();
const isoAhora = () => new Date().toISOString();

const DURACION_SESION_H = 12;
const N = 16384, R = 8, P = 1, LARGO = 64;

export function hashClave(clave) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(clave, sal, LARGO, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${h.toString('base64')}`;
}
export function verificarClave(clave, guardado) {
  if (!guardado || typeof clave !== 'string') return false;
  const [alg, n, r, p, sal, h] = guardado.split('$');
  if (alg !== 'scrypt') return false;
  const esperado = Buffer.from(h, 'base64');
  const calc = crypto.scryptSync(clave, Buffer.from(sal, 'base64'), esperado.length, { N: Number(n), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(calc, esperado);
}
export function validarClaveNueva(clave) {
  if (typeof clave !== 'string' || clave.length < 10) falla('La contraseña necesita al menos 10 caracteres. Puede ser una frase fácil de recordar.', 'clave');
  if (clave.length > 200) falla('La contraseña es demasiado larga.', 'clave');
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
export const tokenNuevo = () => crypto.randomBytes(32).toString('base64url');

export function crearSesion(db, usuarioId) {
  const token = tokenNuevo();
  const t = ahora();
  const expira = new Date(t.getTime() + DURACION_SESION_H * 3600e3).toISOString();
  insertar(db, 'INSERT INTO sesiones (token_hash, usuario_id, creada, expira, ultima) VALUES (?, ?, ?, ?, ?)', sha(token), usuarioId, t.toISOString(), expira, t.toISOString());
  ejecutar(db, 'UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?', t.toISOString(), usuarioId);
  return { token, expira };
}

// Devuelve { usuario, taller } si la cookie corresponde a una sesión vigente de un usuario y taller activos.
export function sesionDesdeToken(db, token) {
  if (!token) return null;
  const fila = uno(db, `SELECT s.id AS sesion_id, s.expira, u.id, u.taller_id, u.nombre, u.email, u.rol, u.activo, t.activo AS taller_activo
    FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id JOIN talleres t ON t.id = u.taller_id WHERE s.token_hash = ?`, sha(token));
  if (!fila) return null;
  if (fila.expira < isoAhora() || !fila.activo || !fila.taller_activo) {
    ejecutar(db, 'DELETE FROM sesiones WHERE id = ?', fila.sesion_id);
    return null;
  }
  ejecutar(db, 'UPDATE sesiones SET ultima = ? WHERE id = ?', isoAhora(), fila.sesion_id);
  return { sesionId: fila.sesion_id, id: fila.id, tallerId: fila.taller_id, nombre: fila.nombre, email: fila.email, rol: fila.rol };
}
export const cerrarSesion = (db, token) => ejecutar(db, 'DELETE FROM sesiones WHERE token_hash = ?', sha(token || ''));
export const cerrarSesionesDe = (db, usuarioId) => ejecutar(db, 'DELETE FROM sesiones WHERE usuario_id = ?', usuarioId);

// Invitación o recuperación: enlace de un solo uso, vigencia limitada. Se entrega a la persona por un canal
// que elige el dueño (no hay proveedor de correo configurado). Solo se guarda el hash del token.
export function crearTokenAcceso(db, usuarioId, tipo, creadoPor, horas = 72) {
  ejecutar(db, "UPDATE tokens_acceso SET usado_at = ? WHERE usuario_id = ? AND tipo = ? AND usado_at IS NULL", isoAhora(), usuarioId, tipo);
  const token = tokenNuevo();
  const expira = new Date(ahora().getTime() + horas * 3600e3).toISOString();
  insertar(db, 'INSERT INTO tokens_acceso (usuario_id, tipo, token_hash, expira, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?)', usuarioId, tipo, sha(token), expira, creadoPor, isoAhora());
  return { token, expira };
}
export function leerTokenAcceso(db, token) {
  const f = uno(db, `SELECT k.*, u.nombre, u.email, u.activo, t.nombre AS taller FROM tokens_acceso k JOIN usuarios u ON u.id = k.usuario_id JOIN talleres t ON t.id = u.taller_id WHERE k.token_hash = ?`, sha(token || ''));
  if (!f || f.usado_at || f.expira < isoAhora() || !f.activo) throw new ErrorUsuario(410, 'Este enlace ya no sirve: se usó, venció o el usuario fue desactivado. Pedile al dueño del taller uno nuevo.');
  return f;
}
export function usarTokenAcceso(db, token, claveNueva) {
  const f = leerTokenAcceso(db, token);
  validarClaveNueva(claveNueva);
  ejecutar(db, 'UPDATE usuarios SET pass_hash = ?, version = version + 1 WHERE id = ?', hashClave(claveNueva), f.usuario_id);
  ejecutar(db, 'UPDATE tokens_acceso SET usado_at = ? WHERE id = ?', isoAhora(), f.id);
  cerrarSesionesDe(db, f.usuario_id);
  return f;
}

// Límite de intentos de ingreso en memoria (por email + IP). Suficiente para un proceso único.
const intentos = new Map();
export function controlarIntentos(clave) {
  const t = Date.now();
  const lista = (intentos.get(clave) || []).filter((x) => t - x < 15 * 60e3);
  intentos.set(clave, lista);
  if (lista.length >= 8) throw new ErrorUsuario(429, 'Demasiados intentos. Esperá 15 minutos o pedile al dueño que te genere un enlace para cambiar la contraseña.');
}
export const registrarIntentoFallido = (clave) => intentos.set(clave, [...(intentos.get(clave) || []), Date.now()]);
export const limpiarIntentos = (clave) => intentos.delete(clave);
