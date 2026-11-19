// Revisión de la orden (diseño de Revisión): la sección se arma con los datos reales de la API y los permisos de cada
// perfil; hallazgos y revisión se guardan por separado, en versiones, y ninguno autoriza trabajos ni toca el presupuesto.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { api, claveDeEnvio } from '../public/js/api.js';
import { seccionRevision } from '../public/js/views/visita-partes.js';
import { permisosDe } from '../server/permisos.js';

let E, julian, marcos, recepcion, cronosId, julianId;
before(async () => {
  E = await levantar();
  julian = await E.cliente('julian');
  marcos = await E.cliente('marcos');
  recepcion = await E.cliente('recepcion');
  const v = (await recepcion.get('/api/hoy')).presentes.find((x) => x.vehiculo.patente === 'AD 913 LP');
  cronosId = v.id;
  julianId = (await julian.get(`/api/visitas/${cronosId}`)).visita.responsable_id;
});
after(async () => { await E.cerrar(); });

const appDe = (rol, id = 0) => { const p = new Set(permisosDe(rol)); return { puede: (x) => p.has(x), sesion: { usuario: { rol, id } } }; };
const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const visita = async (c = julian) => (await c.get(`/api/visitas/${cronosId}`)).visita;
const tarjeta = (html, id) => html.split('<li class="rv-hc"').find((x) => x.includes(`id="rv-h-${id}"`)) || '';

test('Revisión: un hallazgo muestra solo lo registrado y no se presenta como trabajo autorizado', async () => {
  const antes = await visita(recepcion);
  await julian.post(`/api/visitas/${cronosId}/hallazgos`, { observacion: 'Fuelle de la palanca roto', gravedad: 'recomendado', propuesta: '' });
  const v = await visita();
  const h = v.hallazgos.find((x) => x.observacion === 'Fuelle de la palanca roto');
  const html = seccionRevision(v, appDe('mecanico', julianId)).html;
  const t = texto(tarjeta(html, h.id));
  assert.match(t, /Criterio del técnico Recomendado/);
  assert.match(t, /No se registró propuesta/);
  assert.doesNotMatch(t, /Propuesta del técnico/, 'no sugiere una propuesta vacía');
  assert.match(t, /No es un trabajo autorizado/);
  assert.match(html, new RegExp(`data-editar-hallazgo="${h.id}"`));
  assert.doesNotMatch(html, /data-quitar-hallazgo|Quitar/, 'el sistema no borra hallazgos: no se ofrece quitar');
  const despues = await visita(recepcion);
  assert.deepEqual(despues.presupuesto, antes.presupuesto, 'un hallazgo no agrega líneas ni autoriza');
  assert.deepEqual(despues.totales, antes.totales);
});

test('Revisión: editar un hallazgo crea una versión y conserva la anterior', async () => {
  const h = (await visita()).hallazgos.find((x) => x.observacion === 'Fuelle de la palanca roto');
  await assert.rejects(julian.put(`/api/visitas/${cronosId}/hallazgos/${h.id}`, { observacion: 'Fuelle roto', gravedad: 'recomendado', versionActual: h.version_num }), /por qué actualizás/);
  await julian.put(`/api/visitas/${cronosId}/hallazgos/${h.id}`, { observacion: 'Fuelle de la palanca roto en la base', gravedad: 'prioritario', propuesta: 'Cambiar el fuelle', motivoEdicion: 'Se vio mejor con la consola desarmada', versionActual: h.version_num });
  const v = await visita();
  const nuevo = v.hallazgos.find((x) => x.clave === h.clave);
  assert.equal(nuevo.version_num, 2);
  assert.equal(nuevo.anteriores.length, 1);
  const t = texto(tarjeta(seccionRevision(v, appDe('mecanico', julianId)).html, nuevo.id));
  assert.match(t, /Propuesta del técnico Cambiar el fuelle/);
  assert.match(t, /Prioritario/);
  assert.match(t, /Versiones anteriores \(1\)/);
});

test('Revisión: se guarda en curso sin pruebas, pero concluir exige pruebas y un diagnóstico confirmado expreso', async () => {
  let v = await visita();
  const base = { relato: 'Ruido al pasar de segunda a tercera.', hallazgos: 'Nivel de aceite correcto.', hipotesis: 'Sincronizado gastado' };
  await julian.post(`/api/visitas/${cronosId}/revision`, { ...base, estado: 'en_revision', versionActual: v.revision.version_num });
  v = await visita();
  const n = v.revision.version_num;
  await assert.rejects(julian.post(`/api/visitas/${cronosId}/revision`, { ...base, estado: 'sin_falla', versionActual: n }), (e) => e.datos?.campo === 'pruebas' || /pruebas/.test(e.message));
  await assert.rejects(julian.post(`/api/visitas/${cronosId}/revision`, { ...base, estado: 'confirmado', pruebas: 'Prueba de ruta en frío', diagnostico: 'Sincronizado de tercera gastado', versionActual: n }), /confirmá que lo comprobaste/);
  await assert.rejects(julian.post(`/api/visitas/${cronosId}/revision`, { ...base, estado: 'en_revision', diagnostico: 'Sincronizado de tercera gastado', versionActual: n }), /Lo que podría ser/);
  assert.equal((await visita()).revision.version_num, n, 'los rechazos no crean versiones');

  // La vista en edición indica qué pide el sistema para concluir.
  const form = seccionRevision(await visita(), appDe('mecanico', julianId)).html;
  assert.match(form, /id="f-revision"/);
  assert.match(form, /name="confirma"/);
  assert.match(texto(form), /Pruebas realizadas.*Hacen falta para concluir la revisión/);
});

test('Revisión: la hipótesis y el diagnóstico confirmado se muestran por separado, y la recomendación no autoriza', async () => {
  const antes = await visita(recepcion);
  await julian.post(`/api/visitas/${cronosId}/revision`, { relato: 'Ruido al pasar de segunda a tercera.', hallazgos: 'Nivel de aceite correcto.', hipotesis: 'Sincronizado de segunda gastado', pruebas: 'Prueba de ruta en frío: rasca en tercera.', estado: 'confirmado', diagnostico: 'Sincronizado de tercera gastado', confirma: true, recomendacion: 'Presupuestar el sincronizado', versionActual: antes.revision.version_num });
  const v = await visita();
  const html = seccionRevision(v, appDe('mecanico', julianId)).html;
  const conf = html.split('<div class="rv-sr ').find((x) => x.startsWith('rv-conf')) || '';
  const hipo = html.split('<div class="rv-sr ').find((x) => x.startsWith('rv-hipo')) || '';
  assert.match(texto(conf), /Diagnóstico confirmado Comprobado Sincronizado de tercera gastado/);
  assert.match(texto(hipo), /Posible causa · hipótesis previa Sin confirmar Sincronizado de segunda gastado/);
  assert.match(texto(html), /Recomendación para el presupuesto No es una autorización Presupuestar el sincronizado/);
  assert.match(texto(html), new RegExp(`Guardada · versión ${v.revision.version_num}`));
  assert.match(texto(html), /Versiones anteriores \(\d+\)/);
  const despues = await visita(recepcion);
  assert.deepEqual(despues.presupuesto, antes.presupuesto, 'la revisión no crea presupuesto ni autorizaciones');
});

test('Revisión: con la confirmación perdida, reintentar con la misma clave no crea otra versión', async () => {
  const v = await visita();
  const ruta = `/api/visitas/${cronosId}/revision`;
  const cuerpo = { relato: 'Ruido al pasar de segunda a tercera.', hallazgos: 'Nivel de aceite correcto.', pruebas: 'Prueba de ruta.', estado: 'en_revision', diagnostico: '', confirma: false, versionActual: v.revision.version_num };
  const form = { dataset: {} };
  const fetchReal = globalThis.fetch;
  let perder = true;
  globalThis.fetch = async (url, opciones) => {
    const res = await fetchReal(E.base + url, { ...opciones, headers: { ...opciones.headers, Cookie: julian.cookie } });
    if (perder) { perder = false; await res.arrayBuffer(); throw new TypeError('Respuesta perdida después del commit'); }
    return res;
  };
  try {
    await assert.rejects(api('POST', ruta, cuerpo, { idempotencia: claveDeEnvio(form) }), (e) => e.datos.guardadoSinConfirmar);
    assert.equal((await api('POST', ruta, cuerpo, { idempotencia: claveDeEnvio(form) })).repetido, true);
  } finally { globalThis.fetch = fetchReal; }
  const despues = await visita();
  assert.equal(despues.revision.version_num, v.revision.version_num + 1, 'una sola versión nueva');
});

test('Revisión: cada perfil ve lo que puede hacer', async () => {
  const v = await visita(marcos);
  const otro = seccionRevision(v, appDe('mecanico', -1)).html;
  assert.doesNotMatch(otro, /id="f-revision"|data-nuevo-hallazgo|data-editar-hallazgo|data-editar-rev/, 'un mecánico no asignado solo consulta');
  await assert.rejects(marcos.post(`/api/visitas/${cronosId}/hallazgos`, { observacion: 'Prueba', gravedad: 'informativo' }), /asignada a otra persona/);
  const rec = seccionRevision(await visita(recepcion), appDe('recepcion')).html;
  assert.doesNotMatch(rec, /id="f-revision"|data-nuevo-hallazgo/, 'recepción no registra la revisión');
  assert.match(texto(rec), /Hallazgos de inspección/);
  const due = seccionRevision(await visita(recepcion), appDe('dueno')).html;
  assert.match(due, /id="f-revision"/);
  assert.match(due, /data-nuevo-hallazgo/);
});
