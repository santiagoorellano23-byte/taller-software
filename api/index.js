// Demostración en Vercel (solo datos ficticios). Cada instancia arma su propia base en /tmp con `npm run seed`
// al arrancar: los cambios de quien prueba se pierden cuando Vercel recicla la instancia. No sirve para un taller real.
import path from 'node:path';

process.env.TALLERES_DATOS = path.join('/tmp', 'talleres-demo');
process.env.TALLERES_PROXY = '1';
process.env.TALLERES_SEGURO = '1';

const { config, archivoBase } = await import('../server/config.js');
const { crearServidor } = await import('../server/index.js');
const { sembrar } = await import('../scripts/seed.js');

async function preparar() {
  const archivo = archivoBase();
  // La carga de prueba entra por la API real con un cliente HTTP local, que no usa HTTPS.
  config.seguro = false;
  const carga = crearServidor({ archivo });
  try {
    if (!carga.db.prepare('SELECT COUNT(*) AS n FROM talleres').get().n) {
      await new Promise((ok) => carga.listen(0, '127.0.0.1', ok));
      await sembrar({ db: carga.db, base: `http://127.0.0.1:${carga.address().port}` });
    }
  } finally {
    delete process.env.TALLERES_RELOJ; // la carga simula fechas pasadas; la demo usa la hora real
    await new Promise((ok) => (carga.listening ? carga.close(ok) : ok()));
    carga.db.close();
  }
  config.seguro = true;
  return crearServidor({ archivo }).listeners('request')[0];
}

const listo = preparar();

export default async function manejar(req, res) {
  (await listo)(req, res);
}
