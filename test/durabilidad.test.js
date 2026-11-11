// Guardado real: los datos siguen después de reiniciar el servidor; respaldo y restauración en un entorno aislado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { levantar } from './entorno.js';
import { crearRespaldo, restaurarRespaldo } from '../server/respaldo.js';

test('Los datos persisten tras reiniciar y el respaldo se restaura con archivos y relaciones', async () => {
  const E = await levantar();
  const carla = await E.cliente('recepcion');
  const r = await carla.recibir({ vehiculo: { patente: 'PER 001' }, contacto: { nombre: 'Persistencia (prueba)' }, tipo: 'revision', motivo: 'Prueba de guardado', km: '1234' });
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
  const adj = await carla.ok('POST', `/api/adjuntos?ambito=visita&visitaId=${r.id}`, undefined, { crudo: png, cabeceras: { 'Content-Type': 'image/png' } });
  const dir = E.dir;
  await E.cerrar({ borrar: false });

  // Reinicio sobre la misma carpeta
  const E2 = await levantar({ sembrarDatos: false, carpeta: dir });
  const c2 = await E2.cliente('recepcion');
  const { visita } = await c2.get(`/api/visitas/${r.id}`);
  assert.equal(visita.motivo, 'Prueba de guardado');
  assert.equal(visita.lecturas[0].km, 1234);
  assert.equal((await c2.pedir('GET', `/api/adjuntos/${adj.id}`)).estado, 200);
  await E2.cerrar({ borrar: false });

  // Respaldo y restauración en otra carpeta
  const destRes = fs.mkdtempSync(path.join(os.tmpdir(), 'talleres-respaldos-'));
  const { dir: respaldo, manifiesto } = await crearRespaldo({ archivoBase: path.join(dir, 'talleres.db'), carpetaArchivos: path.join(dir, 'archivos'), destino: destRes });
  assert.ok(manifiesto.archivos.length >= 1);
  const restaurada = fs.mkdtempSync(path.join(os.tmpdir(), 'talleres-restaurada-'));
  const v = restaurarRespaldo({ respaldo, destinoDatos: restaurada });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.throws(() => restaurarRespaldo({ respaldo, destinoDatos: restaurada }), /ya tiene una base/);

  const E3 = await levantar({ sembrarDatos: false, carpeta: restaurada });
  const c3 = await E3.cliente('recepcion');
  assert.equal((await c3.get(`/api/visitas/${r.id}`)).visita.motivo, 'Prueba de guardado');
  assert.equal((await c3.pedir('GET', `/api/adjuntos/${adj.id}`)).estado, 200, 'el archivo privado se recupera');
  const norte = await E3.cliente('norte');
  assert.equal((await norte.pedir('GET', `/api/visitas/${r.id}`)).estado, 404, 'la separación entre talleres se mantiene después de restaurar');
  await E3.cerrar();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(destRes, { recursive: true, force: true });
});
