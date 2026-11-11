// Alta de talleres a nivel plataforma (solo por consola: no hay registro público de talleres).
import { insertar, uno, transaccion } from './db.js';
import { hashClave, validarClaveNueva, crearTokenAcceso } from './auth.js';
import { falla, isoAhora } from './util.js';

export const CONFIG_INICIAL = {
  zona_horaria: 'America/Argentina/Mendoza',
  moneda: 'ARS',
  validez_presupuesto_dias: 15,
  agenda: { dias: [1, 2, 3, 4, 5, 6], desde: '08:00', hasta: '18:00', paso: 15 },
  turnosOnline: false
};

export function crearTaller(db, { slug, nombre, config = {}, publico = false, enDirectorio = false, dueno }) {
  slug = String(slug || '').toLowerCase().trim();
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) falla('El identificador del taller usa letras minúsculas, números y guiones (por ejemplo «taller-norte»).');
  if (!String(nombre || '').trim()) falla('Falta el nombre del taller.');
  if (uno(db, 'SELECT id FROM talleres WHERE slug = ?', slug)) falla(`Ya existe un taller con el identificador «${slug}».`);
  const email = String(dueno?.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) falla('Falta un correo válido para el dueño.');
  if (uno(db, 'SELECT id FROM usuarios WHERE email = ?', email)) falla('Ese correo ya está en uso.');
  if (dueno.clave) validarClaveNueva(dueno.clave);
  return transaccion(db, () => {
    const tallerId = insertar(db, 'INSERT INTO talleres (slug, nombre, config, publico, en_directorio, creado_at) VALUES (?, ?, ?, ?, ?, ?)',
      slug, nombre.trim(), JSON.stringify({ ...CONFIG_INICIAL, ...config }), publico ? 1 : 0, enDirectorio ? 1 : 0, isoAhora());
    const usuarioId = insertar(db, 'INSERT INTO usuarios (taller_id, nombre, email, rol, pass_hash, creado_at) VALUES (?, ?, ?, ?, ?, ?)',
      tallerId, dueno.nombre || 'Dueño', email, 'dueno', dueno.clave ? hashClave(dueno.clave) : null, isoAhora());
    insertar(db, 'INSERT INTO auditoria (taller_id, usuario_id, accion, entidad, entidad_id, fecha) VALUES (?, NULL, ?, ?, ?, ?)', tallerId, 'Taller creado desde la consola de la plataforma', 'taller', tallerId, isoAhora());
    const invitacion = dueno.clave ? null : crearTokenAcceso(db, usuarioId, 'invitacion', null, 72);
    return { tallerId, usuarioId, invitacion };
  });
}

export function agregarUsuario(db, tallerId, { nombre, email, rol, clave }) {
  validarClaveNueva(clave);
  return insertar(db, 'INSERT INTO usuarios (taller_id, nombre, email, rol, pass_hash, creado_at) VALUES (?, ?, ?, ?, ?, ?)', tallerId, nombre, email.toLowerCase(), rol, hashClave(clave), isoAhora());
}
