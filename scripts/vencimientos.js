// Evalúa vencimientos de suscripciones y guarda los cambios de estado con su registro. Idempotente.
// El servidor ya lo hace al arrancar y cada hora; este script sirve para un cron del alojamiento
// (por ejemplo, una vez por día) si el proceso se reinicia seguido o queda dormido.
// Uso: npm run vencimientos
import { abrirBase, transaccion } from '../server/db.js';
import { evaluarVencimientos } from '../server/planes.js';
import { archivoBase } from '../server/config.js';

const db = abrirBase(archivoBase());
try {
  const cambios = transaccion(db, () => evaluarVencimientos(db));
  if (!cambios.length) console.log('Sin cambios de estado.');
  for (const c of cambios) console.log(`Taller ${c.tallerId}: ${c.de} → ${c.a}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
