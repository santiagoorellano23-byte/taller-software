// Respaldo y restauración: copia consistente de la base (API de respaldo de SQLite) + archivos privados,
// con un manifiesto que permite comprobar la restauración.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync, backup } from 'node:sqlite';

function hashArchivo(f) {
  return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
}
export function estadoRespaldo(destino) {
  if (!fs.existsSync(destino)) return { ultimaCopia: null, reciente: false };
  const candidatas = fs.readdirSync(destino, { withFileTypes: true }).filter((e) => e.isDirectory() && /^respaldo-\d{4}-\d{2}-\d{2}T/.test(e.name)).map((e) => e.name).sort().reverse();
  for (const nombre of candidatas) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(destino, nombre, 'manifiesto.json'), 'utf8'));
      const edad = Date.now() - Date.parse(m.creado);
      if (!Number.isFinite(edad) || edad < -300000 || !m.base?.sha256 || !Array.isArray(m.archivos) || !fs.existsSync(path.join(destino, nombre, 'talleres.db'))) continue;
      return { ultimaCopia: m.creado, reciente: edad <= 36 * 3600e3 };
    } catch { /* una copia incompleta no cuenta como respaldo terminado */ }
  }
  return { ultimaCopia: null, reciente: false };
}
function conteos(db, nombres = null) {
  const existentes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t=>t.name));
  const tablas = (nombres || ['talleres', 'usuarios', 'vehiculos', 'visitas', 'presupuesto_lineas', 'cuenta_movimientos', 'movimientos_stock', 'adjuntos', 'documentos', 'hallazgos']).filter(t=>existentes.has(t));
  return Object.fromEntries(tablas.map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]));
}

export async function crearRespaldo({ archivoBase, carpetaArchivos, destino }) {
  if (!fs.existsSync(archivoBase)) throw new Error('No existe la base de datos a respaldar: ' + archivoBase);
  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(destino, `respaldo-${marca}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(path.join(dir, 'archivos'), { recursive: true });
  const origen = new DatabaseSync(archivoBase, { readOnly: true });
  try { await backup(origen, path.join(dir, 'talleres.db')); } finally { origen.close(); }
  // Los conteos y archivos pertenecen a la copia, aunque el taller siga trabajando.
  const copia = new DatabaseSync(path.join(dir, 'talleres.db'), { readOnly: true });
  let datos, adjuntos;
  try { datos = conteos(copia); adjuntos = copia.prepare('SELECT ruta, sha256 FROM adjuntos').all(); } finally { copia.close(); }
  const archivos = adjuntos.map((adjunto) => {
    const rel = adjunto.ruta;
    if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error('Ruta de archivo inválida en el respaldo.');
    const de = path.join(carpetaArchivos, rel), a = path.join(dir, 'archivos', rel);
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.copyFileSync(de, a);
    const sha256 = hashArchivo(a);
    if (sha256 !== adjunto.sha256) throw new Error('Un archivo no coincide con el registro: no se completó el respaldo.');
    return { ruta: rel, sha256 };
  });
  const manifiesto = { creado: new Date().toISOString(), base: { sha256: hashArchivo(path.join(dir, 'talleres.db')), conteos: datos }, archivos };
  fs.writeFileSync(path.join(dir, 'manifiesto.json'), JSON.stringify(manifiesto, null, 1));
  return { dir, manifiesto };
}

// Restaura en una carpeta de datos NUEVA (no pisa la base en uso) y verifica integridad y relaciones.
export function restaurarRespaldo({ respaldo, destinoDatos, reemplazar = false }) {
  const man = JSON.parse(fs.readFileSync(path.join(respaldo, 'manifiesto.json'), 'utf8'));
  const dbOrigen = path.join(respaldo, 'talleres.db');
  if (hashArchivo(dbOrigen) !== man.base.sha256) throw new Error('La base del respaldo no coincide con su manifiesto: puede estar dañada.');
  const dbDestino = path.join(destinoDatos, 'talleres.db');
  if (fs.existsSync(dbDestino) && !reemplazar) throw new Error('La carpeta de destino ya tiene una base. Elegí otra carpeta o usá --reemplazar con cuidado.');
  fs.mkdirSync(path.join(destinoDatos, 'archivos'), { recursive: true });
  for (const f of [dbDestino + '-wal', dbDestino + '-shm']) fs.rmSync(f, { force: true });
  fs.copyFileSync(dbOrigen, dbDestino);
  const faltan = [];
  for (const a of man.archivos) {
    const de = path.join(respaldo, 'archivos', a.ruta), aRuta = path.join(destinoDatos, 'archivos', a.ruta);
    if (!fs.existsSync(de) || hashArchivo(de) !== a.sha256) { faltan.push(a.ruta); continue; }
    fs.mkdirSync(path.dirname(aRuta), { recursive: true });
    fs.copyFileSync(de, aRuta);
  }
  const db = new DatabaseSync(dbDestino);
  const integridad = db.prepare('PRAGMA integrity_check').get().integrity_check;
  db.exec('PRAGMA foreign_keys = ON');
  const fk = db.prepare('PRAGMA foreign_key_check').all();
  const datos = conteos(db, Object.keys(man.base.conteos));
  const sinArchivo = db.prepare('SELECT ruta FROM adjuntos').all().filter((a) => !fs.existsSync(path.join(destinoDatos, 'archivos', a.ruta))).map((a) => a.ruta);
  db.close();
  const coincide = JSON.stringify(datos) === JSON.stringify(man.base.conteos);
  return { integridad, relacionesRotas: fk.length, conteos: datos, coincideConManifiesto: coincide, archivosDanados: faltan, adjuntosSinArchivo: sinArchivo, ok: integridad === 'ok' && !fk.length && coincide && !faltan.length && !sinArchivo.length };
}
