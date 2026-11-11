import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { api, claveDeEnvio } from '../public/js/api.js';
import { seccionTrabajo, seccionCobros } from '../public/js/views/visita-partes.js';

let E, dueno;
before(async () => { E = await levantar(); dueno = await E.cliente('dueno'); });
after(async () => { await E.cerrar(); });

test('presupuesto: respuesta perdida después de guardar, reintento único y contenido cambiado rechazado', async () => {
  const id = E.datos.etios.visitaActual;
  const ruta = `/api/visitas/${id}/presupuesto`;
  const antes = (await dueno.get(`/api/visitas/${id}`)).visita.presupuesto;
  const cuerpo = { lineas: [{ tipo: 'mano_obra', descripcion: 'Adicional ficticio de auditoría', cantidad: '1', unidad: 'u.', precio: '12500' }] };
  const form = { dataset: {} };
  const clave = claveDeEnvio(form);
  assert.equal(claveDeEnvio(form), clave);
  assert.notEqual(claveDeEnvio({ dataset: {} }), clave);
  const fetchReal = globalThis.fetch;
  let perderRespuesta = true;
  globalThis.fetch = async (url, opciones) => {
    const res = await fetchReal(E.base + url, { ...opciones, headers: { ...opciones.headers, Cookie: dueno.cookie } });
    if (perderRespuesta) { perderRespuesta = false; await res.arrayBuffer(); throw new TypeError('Respuesta perdida después del commit'); }
    return res;
  };
  try {
    await assert.rejects(api('POST', ruta, cuerpo, { idempotencia: claveDeEnvio(form) }), e => e.datos.guardadoSinConfirmar && /Reintentá desde este mismo formulario/.test(e.message));
    const repetido = await api('POST', ruta, cuerpo, { idempotencia: claveDeEnvio(form) });
    assert.equal(repetido.repetido, true);
    await assert.rejects(api('POST', ruta, { ...cuerpo, nota: 'Contenido cambiado' }, { idempotencia: claveDeEnvio(form) }), e => e.estado === 409);
  } finally { globalThis.fetch = fetchReal; }
  const despues = (await dueno.get(`/api/visitas/${id}`)).visita.presupuesto;
  assert.equal(despues.versiones.length, antes.versiones.length + 1);
  assert.equal(despues.lineas.filter(l => l.descripcion === cuerpo.lineas[0].descripcion).length, 1);
  assert.equal(despues.lineas.find(l => l.descripcion === cuerpo.lineas[0].descripcion).respuesta, null);
});

test('altas: recepción, compra recibida y turno reutilizan el registro sin duplicar stock ni ingreso', async () => {
  const repetir = async (ruta, cuerpo, clave) => {
    const a = await (ruta==='/api/visitas'?dueno.recibir(cuerpo,{idempotencia:clave}):dueno.post(ruta,cuerpo,{idempotencia:clave}));
    const b = await dueno.post(ruta, cuerpo, { idempotencia: clave });
    assert.equal(b.repetido, true);
    assert.equal(b.id, a.id);
    return a;
  };
  const t = await repetir('/api/turnos', { nombre: 'Auditoría ficticia', telefono: '00000000', patente: 'QA123', inicio: '2030-01-07T10:00', duracion: 60 }, 'audit-turno');
  const ingreso = await repetir('/api/visitas', { vehiculo: { patente: 'QA123' }, contacto: { nombre: 'Auditoría ficticia' }, tipo: 'revision', motivo: 'Prueba de reintento', sinKm: true, turnoId: t.id }, 'audit-ingreso');
  assert.equal((await dueno.get(`/api/visitas/${ingreso.id}`)).visita.turno.id, t.id);
  assert.equal((await dueno.pedir('POST', '/api/visitas', { vehiculo: { patente: 'QA124' }, contacto: { nombre: 'Otro ficticio' }, tipo: 'revision', motivo: 'No duplicar turno', sinKm: true, turnoId: t.id })).estado, 400);
  const articuloId = E.datos.articulos.buje;
  const stockAntes = (await dueno.get(`/api/articulos/${articuloId}`)).articulo.existencia;
  const proveedorId = (await dueno.get('/api/proveedores')).proveedores[0].id;
  await repetir('/api/compras', { proveedorId, fecha: '2026-11-02', lineas: [{ articuloId, cantidad: '1', costo: '1000' }], recibir: true }, 'audit-compra');
  assert.equal((await dueno.get(`/api/articulos/${articuloId}`)).articulo.existencia, stockAntes + 1000);
});

test('trabajo y liquidación explican bloqueos visibles coherentes con el servidor', async () => {
  const id = E.datos.etios.visitaActual;
  let { visita: v } = await dueno.get(`/api/visitas/${id}`);
  const app = { puede: () => true, sesion: { usuario: { id: 1, rol: 'dueno' } } };
  const linea = v.presupuesto.lineas.find(l => l.descripcion === 'Amortiguadores traseros (par)');
  const html = seccionTrabajo(v, app, { proveedores: [] }, []).html;
  assert.match(html, new RegExp(`data-realizado="${linea.id}" disabled aria-describedby="bloqueo-trabajo-${linea.id}"`));
  assert.match(html, /Falta colocar: Amortiguadores traseros/);
  assert.equal((await dueno.pedir('POST', `/api/visitas/${id}/lineas/${linea.id}/realizado`, {})).estado, 400);
  const rp = v.repuestos.find(r => r.linea_id === linea.id);
  await dueno.post(`/api/repuestos/${rp.id}/etapa`, { etapa: 'llego' });
  await dueno.post(`/api/repuestos/${rp.id}/etapa`, { etapa: 'colocado' });
  ({ visita: v } = await dueno.get(`/api/visitas/${id}`));
  assert.doesNotMatch(seccionTrabajo(v, app, { proveedores: [] }, []).html, new RegExp(`data-realizado="${linea.id}" disabled`));
  await dueno.post(`/api/visitas/${id}/lineas/${linea.id}/realizado`, {});
  ({ visita: v } = await dueno.get(`/api/visitas/${id}`));
  const cobros = seccionCobros(v, app).html;
  assert.match(cobros, /id="bloqueo-liquidar"/);
  assert.match(cobros, /disabled aria-disabled="true" aria-describedby="bloqueo-liquidar"/);
  assert.match(cobros, new RegExp(`href="#/visitas/${id}/control"`));
});
