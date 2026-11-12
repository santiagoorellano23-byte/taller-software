// Administración central de Growth Labs: personas, sesiones y enlaces propios, separados de los usuarios de talleres.
// Una sesión de taller nunca habilita estas rutas, ni siquiera la de un dueño.
import crypto from 'node:crypto';
import { uno, ejecutar, insertar } from './db.js';
import { hashClave, verificarClave, validarClaveNueva, tokenNuevo } from './auth.js';
import { ErrorUsuario, falla } from './util.js';

// Sesiones y enlaces vencen según la hora real, como en server/auth.js (el reloj simulado de pruebas no los afecta).
const isoAhora = () => new Date().toISOString();

export const COOKIE_ADMIN = 'glt_admin';
const DURACION_H = 8;
const sha = (t) => crypto.createHash('sha256').update(String(t || '')).digest('hex');

export function cookieAdmin(token, expira, seguro) {
  // Limitada a la API del panel: no viaja en las solicitudes de la aplicación de talleres.
  const partes = [`${COOKIE_ADMIN}=${token}`, 'Path=/api/plataforma', 'HttpOnly', 'SameSite=Strict'];
  partes.push(expira ? `Expires=${new Date(expira).toUTCString()}` : 'Max-Age=0');
  if (seguro) partes.push('Secure');
  return partes.join('; ');
}

export function crearAdmin(db, { nombre, email, clave }) {
  email = String(email || '').trim().toLowerCase();
  if (!String(nombre || '').trim()) falla('Falta el nombre.', 'nombre');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) falla('Falta un correo válido.', 'email');
  if (uno(db, 'SELECT id FROM plataforma_admins WHERE email = ?', email)) falla('Ya existe una persona administradora con ese correo.', 'email');
  if (clave) validarClaveNueva(clave);
  const id = insertar(db, 'INSERT INTO plataforma_admins (nombre, email, pass_hash, creado_at) VALUES (?, ?, ?, ?)', nombre.trim(), email, clave ? hashClave(clave) : null, isoAhora());
  return { id, enlace: clave ? null : enlaceAdmin(db, id) };
}

// Enlace de un uso para crear la contraseña. Se entrega por un medio seguro; solo se guarda su hash.
export function enlaceAdmin(db, adminId, horas = 24) {
  ejecutar(db, 'UPDATE plataforma_tokens SET usado_at = ? WHERE admin_id = ? AND usado_at IS NULL', isoAhora(), adminId);
  const token = tokenNuevo();
  const expira = new Date(Date.now() + horas * 3600e3).toISOString();
  insertar(db, 'INSERT INTO plataforma_tokens (admin_id, token_hash, expira) VALUES (?, ?, ?)', adminId, sha(token), expira);
  return { token, expira };
}
export function usarEnlaceAdmin(db, token, clave) {
  const f = uno(db, 'SELECT k.*, a.activo FROM plataforma_tokens k JOIN plataforma_admins a ON a.id = k.admin_id WHERE k.token_hash = ?', sha(token));
  if (!f || f.usado_at || f.expira < isoAhora() || !f.activo) throw new ErrorUsuario(410, 'Este enlace ya no sirve: se usó, venció o la cuenta fue desactivada.');
  validarClaveNueva(clave);
  ejecutar(db, 'UPDATE plataforma_admins SET pass_hash = ? WHERE id = ?', hashClave(clave), f.admin_id);
  ejecutar(db, 'UPDATE plataforma_tokens SET usado_at = ? WHERE id = ?', isoAhora(), f.id);
  ejecutar(db, 'DELETE FROM plataforma_sesiones WHERE admin_id = ?', f.admin_id);
  return f.admin_id;
}

const HASH_FALSO = hashClave('administracion-inexistente');
export function ingresarAdmin(db, email, clave) {
  const a = uno(db, 'SELECT * FROM plataforma_admins WHERE email = ?', String(email || '').trim().toLowerCase());
  const ok = verificarClave(String(clave ?? ''), a?.pass_hash || HASH_FALSO) && a && a.activo;
  if (!ok) return null;
  const token = tokenNuevo();
  const expira = new Date(Date.now() + DURACION_H * 3600e3).toISOString();
  insertar(db, 'INSERT INTO plataforma_sesiones (token_hash, admin_id, creada, expira) VALUES (?, ?, ?, ?)', sha(token), a.id, isoAhora(), expira);
  return { token, expira, admin: { id: a.id, nombre: a.nombre, email: a.email } };
}
export function adminDesdeToken(db, token) {
  if (!token) return null;
  const f = uno(db, 'SELECT s.id AS sesion_id, s.expira, a.id, a.nombre, a.email, a.activo FROM plataforma_sesiones s JOIN plataforma_admins a ON a.id = s.admin_id WHERE s.token_hash = ?', sha(token));
  if (!f) return null;
  if (f.expira < isoAhora() || !f.activo) { ejecutar(db, 'DELETE FROM plataforma_sesiones WHERE id = ?', f.sesion_id); return null; }
  return { id: f.id, nombre: f.nombre, email: f.email };
}
export const cerrarSesionAdmin = (db, token) => ejecutar(db, 'DELETE FROM plataforma_sesiones WHERE token_hash = ?', sha(token));
