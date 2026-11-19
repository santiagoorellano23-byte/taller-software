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

// En Vercel cada copia del servidor tiene su propia base de prueba: otra copia no tiene la fila de la sesión.
test('Demo en varias copias: la sesión firmada vale en otra copia; alterada, con otra clave o sin clave no', async () => {
  config.demoSinIngreso = true;
  config.demoClave = '';
  const sinClave = await e.cliente('recepcion');
  ejecutar(e.servidor.db, 'DELETE FROM sesiones');
  await assert.rejects(sinClave.get('/api/sesion'), /→ 401/);

  config.demoClave = 'clave-de-prueba';
  const c = await e.cliente('recepcion');
  ejecutar(e.servidor.db, 'DELETE FROM sesiones');
  assert.equal((await c.get('/api/sesion')).usuario.rol, 'recepcion');
  assert.equal((await c.get('/api/sesion')).usuario.rol, 'recepcion');

  const [nombre, token] = c.cookie.split('=');
  const [pre, , exp, firma] = token.split('.');
  const otro = await e.cliente();
  otro.cookie = `${nombre}=${[pre, 1, exp, firma].join('.')}`;
  await assert.rejects(otro.get('/api/sesion'), /→ 401/);

  const d = await e.cliente();
  assert.deepEqual(await d.post('/api/sesion/demo', {}), { ok: true });
  ejecutar(e.servidor.db, 'DELETE FROM sesiones');
  config.demoClave = 'otra-clave';
  await assert.rejects(d.get('/api/sesion'), /→ 401/);
  config.demoClave = '';
});

test('Si hay un taller que no es de demostración, la variable no alcanza', async () => {
  config.demoSinIngreso = true;
  ejecutar(e.servidor.db, "UPDATE talleres SET config = json_set(config, '$.demo', json('false')) WHERE slug = 'taller-norte'");
  const c = await e.cliente();
  assert.deepEqual(await c.post('/api/sesion/demo', {}), { ok: false });
  await assert.rejects(c.get('/api/sesion'), /→ 401/);
});
