// Presupuesto y respuesta del cliente (diseño B): la sección se arma con los datos reales de la API y los permisos de
// cada perfil; la respuesta parcial se guarda una sola vez aunque se pierda la confirmación.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { api, claveDeEnvio } from '../public/js/api.js';
import { pesos } from '../public/js/ui.js';
import { seccionPresupuesto } from '../public/js/views/visita-partes.js';
import { permisosDe } from '../server/permisos.js';

let E, recepcion, marcos, golId;
before(async () => {
  E = await levantar();
  recepcion = await E.cliente('recepcion');
  marcos = await E.cliente('marcos');
  golId = (await recepcion.get('/api/hoy')).presentes.find((v) => v.vehiculo.patente === 'NKO 245').id;
});
after(async () => { await E.cerrar(); });

const appDe = (rol) => { const p = new Set(permisosDe(rol)); return { puede: (x) => p.has(x), sesion: { usuario: { rol, id: 0 } } }; };
const cat = { servicios: [], articulos: [], trabajos: [] };
const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const fila = (html, id) => html.split('<li').find((x) => x.includes(`data-linea-id="${id}"`)) || '';
const visita = async (c) => (await c.get(`/api/visitas/${golId}`)).visita;

test('Presupuesto B: resumen con los importes del servidor, líneas con estado y respuesta parcial', async () => {
  const v = await visita(recepcion);
  const html = seccionPresupuesto(v, appDe('recepcion'), cat).html;
  const t = texto(html);
  const sinResp = v.presupuesto.lineas.filter((l) => l.estado === 'vigente' && !l.respuesta && !l.autorizada_ingreso);
  assert.ok(sinResp.length >= 2);
  assert.match(t, new RegExp(`Total presupuestado ${pesos(v.totales.presupuestado).replace('$', '\\$')}`));
  for (const [rotulo, k] of [['Autorizado', 'autorizado'], ['Sin respuesta', 'sinRespuesta'], ['No autorizado', 'rechazado'], ['Para más adelante', 'postergado']])
    assert.match(t, new RegExp(`${rotulo} ${pesos(v.totales[k]).replace('$', '\\$')}`), rotulo);
  for (const l of sinResp) {
    assert.match(fila(html, l.id), /Sin respuesta/);
    assert.deepEqual([...html.matchAll(new RegExp(`name="r-${l.id}" value="(\\w+)"`, 'g'))].map((m) => m[1]), ['autoriza', 'rechaza', 'posterga']);
  }
  assert.match(html, /data-abrir-respuesta/);
  assert.match(t, new RegExp(`${sinResp.length} trabajos sin respuesta`));
});

test('Presupuesto B: el mecánico ve estados sin importes y no registra respuestas', async () => {
  const v = await visita(marcos);
  assert.doesNotMatch(JSON.stringify(v.presupuesto), /\$\d/, 'la API no manda importes al mecánico, tampoco en el detalle de las versiones');
  const html = seccionPresupuesto(v, appDe('mecanico'), cat).html;
  assert.doesNotMatch(texto(html), /\$/);
  assert.doesNotMatch(html, /name="r-\d+"|data-abrir-respuesta|data-agregar|data-cambiar/);
  assert.match(texto(html), /Los importes los ve recepción o el dueño/);
  assert.match(texto(html), /Sin respuesta/);
});

test('Presupuesto B: un cambio sobre una línea se autoriza o se rechaza, no se posterga', async () => {
  const bomba = (await visita(recepcion)).presupuesto.lineas.find((l) => l.descripcion === 'Bomba de agua' && l.estado === 'vigente');
  await recepcion.post(`/api/visitas/${golId}/lineas/${bomba.id}/modificar`, { precio: '90000', motivo: 'El proveedor actualizó el precio' });
  const v = await visita(recepcion);
  const cambio = v.presupuesto.lineas.find((l) => l.origen_linea_id === bomba.id && l.estado === 'vigente');
  const html = seccionPresupuesto(v, appDe('recepcion'), cat).html;
  assert.deepEqual([...html.matchAll(new RegExp(`name="r-${cambio.id}" value="(\\w+)"`, 'g'))].map((m) => m[1]), ['autoriza', 'rechaza']);
  assert.match(fila(html, cambio.id), /Cambio sin respuesta/);
  assert.match(texto(html), /Versión 3 · vigente/);
});

test('Presupuesto B: una línea sin cargo se muestra como «Sin cargo», no como $0', async () => {
  await recepcion.post(`/api/visitas/${golId}/presupuesto`, { lineas: [{ tipo: 'mano_obra', descripcion: 'Control de mangueras ficticio', cantidad: '1', unidad: 'u.', precio: '0' }] });
  const v = await visita(recepcion);
  const l = v.presupuesto.lineas.find((x) => x.descripcion === 'Control de mangueras ficticio');
  const f = fila(seccionPresupuesto(v, appDe('recepcion'), cat).html, l.id);
  assert.match(f, /Sin cargo/);
  assert.doesNotMatch(texto(f), new RegExp(pesos(0).replace('$', '\\$') + '(?!\\d)'));
});

test('Presupuesto B: respuesta parcial con la confirmación perdida se guarda una sola vez', async () => {
  const v = await visita(recepcion);
  const [una, ...resto] = v.presupuesto.lineas.filter((l) => l.estado === 'vigente' && !l.respuesta && !l.autorizada_ingreso);
  const ruta = `/api/visitas/${golId}/respuestas`;
  const cuerpo = { persona: 'Diego Sosa (ficticio)', canal: 'telefono', fecha: null, respuestas: [{ lineaId: una.id, respuesta: 'autoriza', nota: '' }] };
  const form = { dataset: {} };
  const fetchReal = globalThis.fetch;
  let perder = true;
  globalThis.fetch = async (url, opciones) => {
    const res = await fetchReal(E.base + url, { ...opciones, headers: { ...opciones.headers, Cookie: recepcion.cookie } });
    if (perder) { perder = false; await res.arrayBuffer(); throw new TypeError('Respuesta perdida después del commit'); }
    return res;
  };
  try {
    await assert.rejects(api('POST', ruta, cuerpo, { idempotencia: claveDeEnvio(form) }), (e) => e.datos.guardadoSinConfirmar);
    assert.equal((await api('POST', ruta, cuerpo, { idempotencia: claveDeEnvio(form) })).repetido, true);
  } finally { globalThis.fetch = fetchReal; }
  const despues = await visita(recepcion);
  const l = despues.presupuesto.lineas.find((x) => x.id === una.id);
  assert.equal(l.respuesta.respuesta, 'autoriza');
  assert.equal(l.respuestasAnteriores.length, 0);
  for (const x of resto) assert.equal(despues.presupuesto.lineas.find((y) => y.id === x.id).respuesta, null);
  const html = seccionPresupuesto(despues, appDe('recepcion'), cat).html;
  assert.match(fila(html, una.id), /Autorizado/);
  assert.match(texto(html), new RegExp(`${resto.length} trabajos? sin respuesta`));
});
