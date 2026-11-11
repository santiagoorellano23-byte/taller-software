// Uso: npm run backup  [-- --destino <carpeta>]
// Crea respaldo-<fecha>/ en la carpeta «respaldos» junto a la de datos (fuera del código en el alojamiento) con la base, los archivos privados y un manifiesto con controles.
import path from 'node:path';
import { crearRespaldo } from '../server/respaldo.js';
import { config, archivoBase, carpetaArchivos } from '../server/config.js';

const i = process.argv.indexOf('--destino');
const destino = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(path.dirname(config.datos), 'respaldos');
const { dir, manifiesto } = await crearRespaldo({ archivoBase: archivoBase(), carpetaArchivos: carpetaArchivos(), destino });
console.log('Respaldo creado en', dir);
console.log('Registros:', JSON.stringify(manifiesto.base.conteos));
console.log('Archivos privados copiados:', manifiesto.archivos.length);
console.log('Guardá esta carpeta fuera del servidor (por ejemplo, en otro disco o almacenamiento acordado).');
