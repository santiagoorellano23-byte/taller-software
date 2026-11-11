// Reportes coherentes con la caja, biblioteca técnica con derechos y permisos, búsqueda por número aislada por taller.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';

let E, dueno, carla, marcos, norte;
before(async () => {
  E = await levantar();
  [dueno, carla, marcos, norte] = await Promise.all(['dueno', 'recepcion', 'marcos', 'norte'].map(E.cliente));
});
after(async () => { await E.cerrar(); });

test('Los reportes coinciden con los movimientos de caja del mismo período', async () => {
  const r = await dueno.get('/api/reportes?desde=2025-01-01&hasta=2027-12-31');
  const c = await dueno.get('/api/caja?desde=2025-01-01&hasta=2027-12-31');
  const cobrado = r.indicadores.find((i) => i.clave === 'cobrado').valor;
  assert.equal(cobrado, c.movimientos.reduce((n, m) => n + m.dinero, 0));
  const porMedio = r.porMedio.reduce((n, m) => n + m.importe, 0);
  assert.equal(porMedio, cobrado, 'la suma por medio coincide con el total');
  const adeudado = r.indicadores.find((i) => i.clave === 'adeudado').valor;
  const cuentas = await dueno.get('/api/cuentas');
  assert.equal(adeudado, cuentas.total, 'saldos del reporte = cuentas de clientes');
  const csv = await dueno.pedir('GET', '/api/reportes/csv?tipo=cobros&desde=2025-01-01&hasta=2027-12-31');
  const filas = csv.datos.trim().split('\r\n').slice(1);
  const sumaCsv = filas.reduce((n, f) => n + Math.round(Number(f.split(';').at(-1).replace(',', '.')) * 100), 0);
  assert.equal(sumaCsv, cobrado, 'la exportación suma lo mismo que la pantalla');
});

test('Biblioteca: exige confirmar derechos, respeta perfiles y queda aislada por taller', async () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF', 'latin1');
  const op = { crudo: pdf, cabeceras: { 'Content-Type': 'application/pdf', 'X-Nombre-Archivo': 'diagrama.pdf' } };
  const sinDerechos = await marcos.pedir('POST', '/api/biblioteca?titulo=Diagrama&procedencia=Apunte%20propio', undefined, op);
  assert.equal(sinDerechos.estado, 400);
  assert.equal((await carla.pedir('POST', '/api/biblioteca?titulo=Diagrama&procedencia=Apunte&derechos=1', undefined, op)).estado, 403, 'recepción no carga en la biblioteca');
  const ok = await marcos.ok('POST', '/api/biblioteca?titulo=Diagrama%20frenos%20Etios&procedencia=Apunte%20propio&marca=Toyota&anioDesde=2014&anioHasta=2020&derechos=1', undefined, op);
  assert.ok(ok.id);
  const lista = await carla.get('/api/biblioteca?q=frenos&anio=2019');
  assert.equal(lista.documentos.length, 1);
  assert.equal((await carla.get('/api/biblioteca?q=frenos&anio=2022')).documentos.length, 0, 'filtra por año');
  assert.equal((await norte.get('/api/biblioteca')).documentos.length, 0, 'otro taller no ve la biblioteca');
  assert.equal((await norte.pedir('GET', `/api/adjuntos/${lista.documentos[0].adjunto_id}`)).estado, 404);
});

test('Buscar una visita por número solo encuentra las del propio taller', async () => {
  const a = await carla.get('/api/visitas/numero/3');
  const b = await norte.pedir('GET', '/api/visitas/numero/3');
  assert.ok(a.id);
  assert.equal(b.estado, 404, 'el otro taller tiene una sola visita: la 3 no existe allí');
  const propia = await norte.get('/api/visitas/numero/1');
  assert.notEqual(propia.id, (await carla.get('/api/visitas/numero/1')).id);
});

test('Mostrador: una venta con saldo exige cliente; el cobro posterior no se duplica', async () => {
  const art = E.datos.articulos.aceite;
  assert.equal((await carla.pedir('POST', '/api/ventas', { lineas: [{ articuloId: art, cantidad: '1', precio: '9000' }], cobro: { importe: '5000', medio: 'efectivo' } })).estado, 400);
  const v = await carla.post('/api/ventas', { contacto: { nombre: 'Cliente mostrador (prueba)' }, lineas: [{ articuloId: art, cantidad: '2', precio: '9000' }], cobro: { importe: '5000', medio: 'efectivo' } }, { idempotencia: true });
  assert.equal(v.venta.saldo, 1300000);
  const clave = 'cobro-venta-1';
  await carla.post(`/api/ventas/${v.id}/pagos`, { importe: '13000', medio: 'transferencia' }, { idempotencia: clave });
  const rep = await carla.post(`/api/ventas/${v.id}/pagos`, { importe: '13000', medio: 'transferencia' }, { idempotencia: clave });
  assert.equal(rep.repetido, true);
  assert.equal((await carla.get(`/api/ventas/${v.id}`)).venta.saldo, 0);
});
