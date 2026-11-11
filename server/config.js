// Configuración por variables de entorno. Ningún secreto vive en el código.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  raiz,
  puerto: Number(process.env.PORT || process.env.TALLERES_PUERTO || 3000),
  host: process.env.TALLERES_HOST || '127.0.0.1',
  datos: path.resolve(process.env.TALLERES_DATOS || path.join(raiz, 'data')),
  // true cuando el sitio se sirve por HTTPS (agrega Secure a la cookie de sesión)
  seguro: process.env.TALLERES_SEGURO === '1',
  // true cuando hay un proxy propio delante (Hostinger, Nginx, etc.) que agrega X-Forwarded-For
  proxy: process.env.TALLERES_PROXY === '1',
  // Dirección pública para enlaces y QR (por ejemplo https://panel.ejemplo.com). Si falta, se usa la del navegador.
  urlPublica: (process.env.TALLERES_URL_PUBLICA || '').replace(/\/$/, '')
};

// En un alojamiento la carpeta del código se reemplaza en cada despliegue (en Hostinger, hbuilds/ y public_html/).
// Si la base o los archivos quedaran ahí, se perderían. Devuelve el motivo para no arrancar, o null.
export function problemaCarpetaDatos({ raiz: r = config.raiz, datos = config.datos, env = process.env } = {}) {
  const partes = (p) => path.resolve(p).split(/[\\/]+/);
  const reemplazable = (p) => partes(p).some((x) => x === 'hbuilds' || x === 'public_html');
  const rel = path.relative(r, datos);
  const dentroDelCodigo = !rel.startsWith('..') && !path.isAbsolute(rel);
  const publicado = env.NODE_ENV === 'production' || env.TALLERES_SEGURO === '1' || reemplazable(r);
  if (publicado && !env.TALLERES_DATOS) return 'Falta TALLERES_DATOS: en el alojamiento la base y los archivos tienen que ir en una carpeta fuera del código.';
  if (reemplazable(datos)) return `TALLERES_DATOS (${datos}) está dentro de una carpeta que el alojamiento reemplaza en cada despliegue.`;
  if (publicado && dentroDelCodigo) return `TALLERES_DATOS (${datos}) está dentro de la carpeta del código, que se reemplaza al actualizar.`;
  return null;
}

export function archivoBase() {
  const problema = problemaCarpetaDatos();
  if (problema) throw new Error(problema + ' Definí TALLERES_DATOS con una ruta absoluta propia, por ejemplo /home/<usuario>/talleres-datos.');
  return path.join(config.datos, 'talleres.db');
}
export const carpetaArchivos = () => path.join(config.datos, 'archivos');
