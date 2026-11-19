// Portada de Hoy: el tercer dato del resumen depende del permiso real. El saldo lo da el servidor solo a quien ve dinero;
// el mecánico recibe «Listos» y ningún importe. Las ilustraciones son archivos estáticos, sin código.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { levantar } from './entorno.js';

let E;
before(async () => { E = await levantar(); });
after(async () => { await E.cerrar(); });

test('Portada de Hoy: el saldo por cobrar sale del servidor solo para quien ve dinero', async () => {
  const recepcion = await E.cliente('recepcion');
  const c = await recepcion.get('/api/cuentas');
  assert.equal(typeof c.total, 'number');
  assert.ok(c.total >= 0);
  const marcos = await E.cliente('marcos');
  assert.equal((await marcos.pedir('GET', '/api/cuentas')).estado, 403);
});

test('Portada de Hoy: el mecánico recibe los contadores sin importes', async () => {
  const marcos = await E.cliente('marcos');
  const d = await marcos.get('/api/hoy');
  assert.ok(d.presentes.length > 0);
  assert.doesNotMatch(JSON.stringify(d), /\$\s?\d/, '/api/hoy no manda importes al mecánico');
  assert.deepEqual(d.pendientes.listas.sort(), d.presentes.filter((v) => v.lista_at).map((v) => v.id).sort());
  assert.deepEqual(Object.keys(d.pendientes).sort(), ['autorizacion', 'listas', 'repuestos', 'retiros']);
});

test('Portada de Hoy: las ilustraciones existen en claro y oscuro y no traen código', () => {
  for (const nombre of ['taller-grande', 'calendario-grande', 'dinero-grande', 'listos-grande', 'taller-chico']) for (const tema of ['claro', 'oscuro']) {
    const f = new URL(`../public/ilustraciones/hoy/${nombre}-${tema}.svg`, import.meta.url);
    assert.ok(fs.existsSync(f), `${nombre}-${tema}`);
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /<script|foreignObject|\son\w+=|href="(?:https?:|\/\/)/i);
  }
});
