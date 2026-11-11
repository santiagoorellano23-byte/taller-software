// Alta de un taller real desde la consola de la plataforma (no hay registro público).
// Uso: npm run crear-taller -- --slug mi-taller --nombre "Mi Taller" --email dueno@ejemplo.com [--dueno "Nombre"]
// Genera un enlace de invitación de un solo uso (72 h) para que el dueño cree su contraseña.
import { abrirBase } from '../server/db.js';
import { crearTaller } from '../server/plataforma.js';
import { archivoBase, config } from '../server/config.js';

const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const slug = arg('slug'), nombre = arg('nombre'), email = arg('email');
if (!slug || !nombre || !email) {
  console.error('Uso: npm run crear-taller -- --slug <identificador> --nombre "<Nombre del taller>" --email <correo del dueño> [--dueno "<Nombre>"]');
  process.exit(1);
}
const db = abrirBase(archivoBase());
// Un taller real no se crea en una base de demostración: sus datos quedarían mezclados con los ficticios.
const demos = db.prepare('SELECT nombre, config FROM talleres').all().filter((t) => JSON.parse(t.config || '{}').demo);
if (demos.length && !process.argv.includes('--junto-a-demo')) {
  console.error(`Esta base tiene talleres de demostración (${demos.map((t) => t.nombre).join(', ')}).`);
  console.error('Para datos reales usá una carpeta propia: TALLERES_DATOS=/ruta/datos-reales npm run crear-taller -- ...');
  db.close();
  process.exit(1);
}
try {
  const r = crearTaller(db, { slug, nombre, dueno: { nombre: arg('dueno') || 'Dueño', email } });
  const base = config.urlPublica || `http://${config.host}:${config.puerto}`;
  console.log(`Taller «${nombre}» creado.`);
  console.log('Enviale al dueño este enlace por un medio seguro (vence en 72 h, sirve una sola vez):');
  console.log(`  ${base}/acceso.html#${r.invitacion.token}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
