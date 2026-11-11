// Acceso a SQLite (módulo integrado de Node 24). Sin dependencias externas.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRACIONES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export function abrirBase(archivo) {
  if (archivo !== ':memory:') fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const db = new DatabaseSync(archivo);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (archivo !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrar(db);
  return db;
}

function migrar(db) {
  db.exec('CREATE TABLE IF NOT EXISTS migraciones (nombre TEXT PRIMARY KEY, aplicada_at TEXT NOT NULL)');
  const hechas = new Set(db.prepare('SELECT nombre FROM migraciones').all().map((r) => r.nombre));
  const archivos = fs.readdirSync(MIGRACIONES).filter((f) => f.endsWith('.sql')).sort();
  for (const f of archivos) {
    if (hechas.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRACIONES, f), 'utf8');
    transaccion(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO migraciones (nombre, aplicada_at) VALUES (?, ?)').run(f, new Date().toISOString());
    });
  }
}

// Transacción con soporte de anidamiento mediante SAVEPOINT.
const profundidad = new WeakMap();
export function transaccion(db, fn) {
  const nivel = profundidad.get(db) || 0;
  const sp = `sp${nivel}`;
  db.exec(nivel === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
  profundidad.set(db, nivel + 1);
  try {
    const r = fn();
    db.exec(nivel === 0 ? 'COMMIT' : `RELEASE ${sp}`);
    return r;
  } catch (e) {
    db.exec(nivel === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw e;
  } finally {
    profundidad.set(db, nivel);
  }
}

// Helpers de consulta. Los parámetros siempre van ligados, nunca concatenados.
export const uno = (db, sql, ...p) => db.prepare(sql).get(...p) ?? null;
export const todos = (db, sql, ...p) => db.prepare(sql).all(...p);
export const ejecutar = (db, sql, ...p) => db.prepare(sql).run(...p);
export const insertar = (db, sql, ...p) => Number(db.prepare(sql).run(...p).lastInsertRowid);

export function siguiente(db, tallerId, nombre) {
  const fila = uno(db, 'SELECT valor FROM contadores WHERE taller_id = ? AND nombre = ?', tallerId, nombre);
  const valor = (fila?.valor || 0) + 1;
  ejecutar(db, 'INSERT INTO contadores (taller_id, nombre, valor) VALUES (?, ?, ?) ON CONFLICT (taller_id, nombre) DO UPDATE SET valor = excluded.valor', tallerId, nombre, valor);
  return valor;
}
