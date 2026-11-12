// Alta de una persona administradora del panel de Growth Labs (solo por consola).
// Uso: npm run crear-admin -- --email persona@growthlabs.example --nombre "Nombre"
// Genera un enlace de un solo uso (24 h) para crear la contraseña. No se imprime ni se guarda ninguna clave.
import { abrirBase } from '../server/db.js';
import { crearAdmin } from '../server/admin.js';
import { archivoBase, config } from '../server/config.js';

const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const email = arg('email'), nombre = arg('nombre');
if (!email || !nombre) {
  console.error('Uso: npm run crear-admin -- --email <correo> --nombre "<Nombre>"');
  process.exit(1);
}
const db = abrirBase(archivoBase());
try {
  const r = crearAdmin(db, { nombre, email });
  const base = config.urlPublica || `http://${config.host}:${config.puerto}`;
  console.log(`Cuenta del panel creada para ${email}.`);
  console.log('Entregá este enlace por un medio seguro (vence en 24 h, sirve una sola vez):');
  console.log(`  ${base}/plataforma.html#acceso=${r.enlace.token}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
