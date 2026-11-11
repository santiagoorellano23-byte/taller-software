import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { post as postPantalla } from '../public/js/api.js';
import { seccionControl } from '../public/js/views/visita-partes.js';

let e, c, d;
before(async () => {
  e = await levantar();
  c = await e.cliente('recepcion');
  d = await e.cliente('dueno');
});
after(async () => { await e.cerrar(); });

function pantalla(v) {
  const anterior = globalThis.window;
  try {
    globalThis.window = { TALLERES_CATALOGOS: { metodosControl: [] } };
    return seccionControl(v, { sesion: { usuario: { rol: 'dueno' } }, puede: () => true }).html;
  } finally {
    if (anterior === undefined) delete globalThis.window;
    else globalThis.window = anterior;
  }
}
async function lista(patente, importe = '10000') {
  const { visita: v } = await c.recibir({
    vehiculo: { patente }, contacto: { nombre: 'Cliente ficticio' }, tipo: 'service', motivo: 'Regresion', km: '1000',
    autorizacion: { persona: 'Cliente ficticio', importe, canal: 'presencial' }
  });
  for (const l of v.presupuesto.lineas) await d.post(`/api/visitas/${v.id}/lineas/${l.id}/realizado`, {});
  await d.post(`/api/visitas/${v.id}/control`, { resultado: 'resuelto', como: 'Comprobacion ficticia' });
  return (await c.post(`/api/visitas/${v.id}/lista`, {})).visita;
}

test('Entrega bloqueada hasta liquidar; luego exige confirmar deuda o pagar', async () => {
  let v = await lista('REG001');
  assert.equal(v.totales.saldo, 0);
  assert.ok(!pantalla(v).includes('id="f-entrega"'));
  const bloqueada = await c.pedir('POST', `/api/visitas/${v.id}/entrega`, { conSaldo: true, nota: 'No debe eludir la liquidacion' });
  assert.equal(bloqueada.estado, 400);
  assert.match(bloqueada.datos.error, /sin liquidar/);
  assert.equal((await c.get(`/api/visitas/${v.id}`)).visita.entregada_at, null);
  ({ visita: v } = await c.post(`/api/visitas/${v.id}/liquidar`, {}));
  assert.equal(v.totales.saldo, 1000000);
  assert.ok(pantalla(v).includes('id="f-entrega"'));
  assert.equal((await c.pedir('POST', `/api/visitas/${v.id}/entrega`, {})).estado, 400);
  ({ visita: v } = await c.post(`/api/visitas/${v.id}/entrega`, { conSaldo: true, nota: 'Paga el viernes' }));
  assert.ok(v.entregada_at);
  assert.equal(v.totales.saldo, 1000000);

  let pagada = await lista('REG002');
  await c.post(`/api/visitas/${pagada.id}/liquidar`, {});
  await c.post(`/api/visitas/${pagada.id}/pagos`, { importe: '10000', medio: 'efectivo' }, { idempotencia: 'pagada-regresion' });
  ({ visita: pagada } = await c.post(`/api/visitas/${pagada.id}/entrega`, {}));
  assert.equal(pagada.totales.saldo, 0);
  assert.ok(pagada.entregada_at);
});

test('Una visita sin trabajos cobrables puede entregarse sin liquidacion', async () => {
  const { visita: v } = await c.recibir({ vehiculo: { patente: 'REG003' }, contacto: { nombre: 'Cliente ficticio' }, tipo: 'revision', motivo: 'Consulta sin cargo', sinKm: true });
  await d.post(`/api/visitas/${v.id}/control`, { resultado: 'no_reproducido', como: 'Prueba sin falla' });
  await c.post(`/api/visitas/${v.id}/lista`, {});
  const { visita } = await c.post(`/api/visitas/${v.id}/entrega`, { pendientesInformados: true });
  assert.ok(visita.entregada_at);
  assert.equal(visita.totales.saldo, 0);
});

test('Reintento identico no duplica; importe, medio o huella antigua exigen revision', async () => {
  const v = await lista('REG004');
  const ruta = `/api/visitas/${v.id}/pagos`;
  const op = { idempotencia: 'contenido-regresion' };
  await c.post(ruta, { importe: '1000', medio: 'efectivo' }, op);
  const repetido = await c.post(ruta, { medio: 'efectivo', importe: '1000' }, op);
  assert.equal(repetido.repetido, true, 'orden de propiedades no cambia la solicitud');
  assert.equal((await c.pedir('POST', ruta, { importe: '2000', medio: 'efectivo' }, op)).estado, 409);
  assert.equal((await c.pedir('POST', ruta, { importe: '1000', medio: 'transferencia' }, op)).estado, 409);
  assert.equal((await c.get(`/api/visitas/${v.id}`)).visita.totales.cobrado, 100000);
  e.servidor.db.prepare('UPDATE idempotencia SET solicitud_hash = NULL WHERE clave = ?').run(op.idempotencia);
  assert.equal((await c.pedir('POST', ruta, { importe: '1000', medio: 'efectivo' }, op)).estado, 409, 'registro previo a la migracion no se repite a ciegas');
});

test('Respuesta perdida despues de guardar: pantalla informa incertidumbre y reintento recupera un solo pago', async () => {
  const v = await lista('REG005');
  const ruta = `${e.base}/api/visitas/${v.id}/pagos`;
  const op = { idempotencia: 'respuesta-perdida', cabeceras: { Cookie: c.cookie } };
  const fetchReal = globalThis.fetch;
  try {
    globalThis.fetch = async (...args) => {
      const res = await fetchReal(...args);
      await res.arrayBuffer();
      throw new TypeError('Respuesta perdida despues del guardado');
    };
    await assert.rejects(postPantalla(ruta, { importe: '1000', medio: 'efectivo' }, op), (err) => {
      assert.equal(err.datos.guardadoSinConfirmar, true);
      assert.match(err.message, /sin cambiar los datos ni recargar/);
      assert.doesNotMatch(err.message, /no se guardó nada/);
      return true;
    });
  } finally { globalThis.fetch = fetchReal; }
  const recuperado = await postPantalla(ruta, { importe: '1000', medio: 'efectivo' }, op);
  assert.equal(recuperado.repetido, true);
  const actual = (await c.get(`/api/visitas/${v.id}`)).visita;
  assert.equal(actual.cuenta.filter((m) => m.tipo === 'pago').length, 1);
  assert.equal(actual.totales.cobrado, 100000);
});

test('Respuesta JSON interrumpida no se informa como exito', async () => {
  const fetchReal = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, headers: new Headers({ 'Content-Type': 'application/json' }), json: async () => { throw new SyntaxError('Respuesta incompleta'); } });
    await assert.rejects(postPantalla('/api/ejemplo', {}), (err) => err.datos.guardadoSinConfirmar === true);
  } finally { globalThis.fetch = fetchReal; }
});
