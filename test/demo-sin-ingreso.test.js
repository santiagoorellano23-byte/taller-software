// Demo sin contraseña: solo con TALLERES_DEMO_SIN_INGRESO=1 y solo si todos los talleres de la base son de demostración.
// En una instalación real (sin la variable, o con un taller que no es demo) no entra nadie sin contraseña.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { config } from '../server/config.js';
import { ejecutar } from '../server/db.js';

let e;
before(async () => { e = await levantar(); });
after(async () => { config.demoSinIngreso = false; await e.cerrar(); });

test('Sin la variable no hay ingreso automático', async () => {
  config.demoSinIngreso = false;
  const c = await e.cliente();
  assert.deepEqual(await c.post('/api/sesion/demo', {}), { ok: false });
  await assert.rejects(c.get('/api/sesion'), /→ 401/);
});

test('Con la variable y solo talleres de demostración, entra como dueño del taller modelo', async () => {
  config.demoSinIngreso = true;
  const c = await e.cliente();
  assert.deepEqual(await c.post('/api/sesion/demo', {}), { ok: true });
  const s = await c.get('/api/sesion');
  assert.equal(s.usuario.rol, 'dueno');
  assert.equal(s.taller.slug, 'taller-modelo');
  assert.equal(s.taller.demo, true);
});

test('Si hay un taller que no es de demostración, la variable no alcanza', async () => {
  config.demoSinIngreso = true;
  ejecutar(e.servidor.db, "UPDATE talleres SET config = json_set(config, '$.demo', json('false')) WHERE slug = 'taller-norte'");
  const c = await e.cliente();
  assert.deepEqual(await c.post('/api/sesion/demo', {}), { ok: false });
  await assert.rejects(c.get('/api/sesion'), /→ 401/);
});
