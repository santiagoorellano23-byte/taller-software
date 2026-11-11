// Punto de entrada para el alojamiento (en Hostinger, «Entry file»). Algunos alojamientos cargan este archivo
// con require() desde su propio proceso, así que arranca el servidor sin depender de cómo se lo llamó.
import('./server/index.js')
  .then((m) => m.arrancar())
  .catch((e) => { console.error('No se pudo arrancar la plataforma:', e.message); process.exit(1); });
