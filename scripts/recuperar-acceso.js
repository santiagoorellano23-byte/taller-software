// Recuperación controlada para un dueño que perdió su contraseña (lo ejecuta quien administra el servidor).
// Uso: npm run recuperar-acceso -- --email dueno@ejemplo.com
import { abrirBase, uno } from '../server/db.js';
import { crearTokenAcceso } from '../server/auth.js';
import { archivoBase, config } from '../server/config.js';
import { isoAhora } from '../server/util.js';

const i = process.argv.indexOf('--email');
const email = i > 0 ? String(process.argv[i + 1]).toLowerCase() : null;
if (!email) { console.error('Uso: npm run recuperar-acceso -- --email <correo>'); process.exit(1); }
const db = abrirBase(archivoBase());
const u = uno(db, 'SELECT * FROM usuarios WHERE email = ?', email);
if (!u || !u.activo) { console.error('No hay un usuario activo con ese correo.'); process.exit(1); }
const t = crearTokenAcceso(db, u.id, u.pass_hash ? 'recuperacion' : 'invitacion', null, 24);
db.prepare('INSERT INTO auditoria (taller_id, usuario_id, accion, entidad, entidad_id, fecha) VALUES (?, NULL, ?, ?, ?, ?)').run(u.taller_id, 'Enlace de recuperación generado desde la consola', 'usuario', u.id, isoAhora());
db.close();
const base = config.urlPublica || `http://${config.host}:${config.puerto}`;
console.log(`Enlace para ${u.nombre} (vence en 24 h, un solo uso):`);
console.log(`  ${base}/acceso.html#${t.token}`);
