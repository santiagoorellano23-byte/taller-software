// Demostración en Vercel (solo datos ficticios). Cada instancia arma su propia base en /tmp con `npm run seed`
// al arrancar: los cambios de quien prueba se pierden cuando Vercel recicla la instancia. No sirve para un taller real.
import net from 'node:net';
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
  const t0 = Date.now();
  const carga = crearServidor({ archivo });
  console.log('demo: base abierta', Date.now() - t0, 'ms');
  try {
    if (!carga.db.prepare('SELECT COUNT(*) AS n FROM talleres').get().n) {
      // Vercel intercepta listen() de los servidores HTTP; un socket TCP propio le pasa las conexiones al manejador.
      const tcp = net.createServer((s) => carga.emit('connection', s));
      await new Promise((ok) => tcp.listen(0, '127.0.0.1', ok));
      try {
        console.log('demo: cargando datos de prueba en el puerto', tcp.address().port);
        await sembrar({ db: carga.db, base: `http://127.0.0.1:${tcp.address().port}` });
        console.log('demo: datos cargados', Date.now() - t0, 'ms');
      } finally {
        tcp.close();
        carga.closeAllConnections();
      }
    }
  } finally {
    delete process.env.TALLERES_RELOJ; // la carga simula fechas pasadas; la demo usa la hora real
    carga.db.close();
  }
  config.seguro = true;
  return crearServidor({ archivo }).listeners('request')[0];
}

const listo = preparar();
listo.catch((e) => console.error('demo: no se pudo preparar', e));

export default async function manejar(req, res) {
  (await listo)(req, res);
}
