// Entorno de prueba aislado: carpeta temporal propia, base nueva y datos de prueba cargados por la API.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ClienteApi } from '../scripts/cliente-api.js';

export async function levantar({ sembrarDatos = true, carpeta } = {}) {
  const dir = carpeta || fs.mkdtempSync(path.join(os.tmpdir(), 'talleres-prueba-'));
  process.env.TALLERES_DATOS = dir;
  const { config } = await import('../server/config.js');
  config.datos = dir;
  const { crearServidor } = await import('../server/index.js');
  const servidor = crearServidor({ archivo: path.join(dir, 'talleres.db') });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  let datos = null;
  if (sembrarDatos) {
    const { sembrar } = await import('../scripts/seed.js');
    datos = await sembrar({ db: servidor.db, base });
  }
  const { USUARIOS_PRUEBA, CLAVE_PRUEBA } = await import('../scripts/seed.js');
  const cliente = async (quien) => {
    const c = new ClienteApi(base);
    if (quien) await c.ingresar(USUARIOS_PRUEBA[quien], CLAVE_PRUEBA);
    return c;
  };
  const cerrar = async ({ borrar = true } = {}) => {
    await new Promise((ok) => servidor.close(ok));
    servidor.db.close();
    if (borrar) fs.rmSync(dir, { recursive: true, force: true });
  };
  return { servidor, base, dir, datos, cliente, cerrar };
}
