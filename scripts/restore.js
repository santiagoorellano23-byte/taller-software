// Uso: npm run restore -- <carpeta-del-respaldo> [--destino <carpeta-de-datos-nueva>] [--reemplazar]
// Restaura en una carpeta nueva y verifica integridad, relaciones, conteos y archivos.
// Para usar los datos restaurados: TALLERES_DATOS=<carpeta-de-datos-nueva> npm start
import path from 'node:path';
import { restaurarRespaldo } from '../server/respaldo.js';
import { config } from '../server/config.js';

const args = process.argv.slice(2);
const respaldo = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--destino');
if (!respaldo) {
  console.error('Indicá la carpeta del respaldo. Ejemplo: npm run restore -- respaldos/respaldo-2026-10-21T12-00-00');
  process.exit(1);
}
const i = args.indexOf('--destino');
const destino = i >= 0 ? path.resolve(args[i + 1]) : path.join(config.raiz, `data-restaurada-${new Date().toISOString().slice(0, 10)}`);
const r = restaurarRespaldo({ respaldo: path.resolve(respaldo), destinoDatos: destino, reemplazar: args.includes('--reemplazar') });
console.log('Restaurado en', destino);
console.log(JSON.stringify(r, null, 1));
if (!r.ok) {
  console.error('ATENCIÓN: la verificación encontró problemas. No uses estos datos sin revisarlos.');
  process.exit(2);
}
console.log(`Verificación correcta. Para abrirlo: TALLERES_DATOS="${destino}" npm start`);
