// Orden «Paso a paso» (rediseño del 25/11/2026): Trabajo, Entrega, contacto y «Qué sigue» se arman con los datos
// reales de la API y los permisos de cada perfil. Colocar no marca realizado, un repuesto solo frena el trabajo al
// que está vinculado, listo ≠ entregado ≠ cobrado, y la liquidación pendiente o sin importe se dice con palabras.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { pesos } from '../public/js/ui.js';
import { seccionTrabajo, seccionControl } from '../public/js/views/visita-partes.js';
import { queSigue, tarjetaSigue, capsulaSigue, contactoCliente, clasificarTrabajos } from '../public/js/orden-sigue.js';
import { permisosDe } from '../server/permisos.js';

let E, dueno, recepcion, marcos, idEtios, idOnix, marcosId;
globalThis.window ??= { TALLERES_CATALOGOS: { metodosControl: ['Prueba de ruta'] } };
before(async () => {
  E = await levantar();
  [dueno, recepcion, marcos] = await Promise.all(['dueno', 'recepcion', 'marcos'].map((q) => E.cliente(q)));
  const hoy = (await dueno.get('/api/hoy')).presentes;
  idEtios = hoy.find((v) => v.vehiculo.patente === 'AE 482 KJ').id;
  idOnix = hoy.find((v) => v.vehiculo.patente === 'AC 552 MZ').id;
  marcosId = (await marcos.get('/api/sesion')).usuario.id;
});
after(async () => { await E.cerrar(); });

const appDe = (rol, id = 0) => { const p = new Set(permisosDe(rol)); return { puede: (x) => p.has(x), sesion: { usuario: { rol, id }, taller: {} } }; };
const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const tarjeta = (html, lineaId) => html.split('<article').find((x) => x.includes(`id="lin-${lineaId}"`)) || '';
const visita = async (c, id) => (await c.get(`/api/visitas/${id}`)).visita;
const lineaDe = (v, t) => v.presupuesto.lineas.find((l) => l.estado === 'vigente' && l.descripcion === t);

test('Trabajo: el repuesto vinculado frena solo su trabajo; sin vínculo no se infiere ninguno por el nombre', async () => {
  const v = await visita(marcos, idEtios);
  const app = appDe('mecanico', marcosId);
  const html = seccionTrabajo(v, app, { proveedores: [] }, []).html;
  const pieza = lineaDe(v, 'Amortiguadores traseros (par)');
  const mano = lineaDe(v, 'Cambio de amortiguadores traseros');
  assert.equal(pieza.tipo, 'repuesto');
  assert.match(texto(tarjeta(html, pieza.id)), /Esperando repuesto .*Todavía no se puede marcar realizado\. Falta colocar: Amortiguadores traseros \(par\)\./);
  assert.doesNotMatch(tarjeta(html, pieza.id), /data-realizado=/, 'sin botón gris: la causa reemplaza al botón');
  assert.match(tarjeta(html, pieza.id), /data-ir-ancla="rep-\d+"/, 'lleva al repuesto que frena');
  assert.match(texto(tarjeta(html, mano.id)), /Sin repuestos vinculados a este trabajo/);
  assert.match(tarjeta(html, mano.id), new RegExp(`data-realizado="${mano.id}"`), 'la mano de obra sin vínculo se puede marcar');
  assert.doesNotMatch(tarjeta(html, mano.id), /vínculo a confirmar|Regla a confirmar/i);
  assert.doesNotMatch(texto(html), /\$/, 'el mecánico no ve importes');
  assert.match(texto(html), /\d+ \/ \d+ realizados/);
});

test('Trabajo: colocar un repuesto no marca el trabajo realizado; se confirma aparte', async () => {
  let v = await visita(dueno, idEtios);
  const buje = v.repuestos.find((r) => r.etapa === 'llego');
  assert.ok(buje?.linea_id, 'la demo tiene un repuesto que llegó y está vinculado');
  await marcos.post(`/api/repuestos/${buje.id}/etapa`, { etapa: 'colocado', version: buje.version });
  v = await visita(marcos, idEtios);
  const linea = v.presupuesto.lineas.find((l) => l.id === buje.linea_id);
  assert.equal(linea.realizado_at, null, 'el servidor no lo marca realizado');
  const app = appDe('mecanico', marcosId);
  const html = tarjeta(seccionTrabajo(v, app, { proveedores: [] }, []).html, linea.id);
  assert.match(texto(html), /Repuesto colocado\. Colocarlo no marca el trabajo realizado: confirmalo acá\./);
  assert.match(html, new RegExp(`data-realizado="${linea.id}"`));
  assert.equal(clasificarTrabajos(v, app).trabajos.find((t) => t.l.id === linea.id).estado, 'hacer');
});

test('Trabajo: recepción gestiona repuestos pero no marca trabajos ni coloca', async () => {
  const v = await visita(recepcion, idEtios);
  const html = seccionTrabajo(v, appDe('recepcion'), { proveedores: [] }, []).html;
  assert.doesNotMatch(html, /data-realizado=|data-a="colocado"/);
  assert.match(texto(html), /Lo marca realizado el mecánico o el dueño/);
  assert.match(html, /data-a="llego"/, 'registrar que llegó sigue disponible');
  assert.match(texto(html), new RegExp(pesos(lineaDe(v, 'Amortiguadores traseros (par)').importe).replace('$', '\\$')), 'recepción ve importes');
});

test('Qué sigue: acción útil con destino real, otras posibles como sugerencia y lo que espera repuesto', async () => {
  const v = await visita(marcos, idEtios);
  const m = queSigue(v, appDe('mecanico', marcosId));
  assert.ok(m.accion?.sec && m.accion.texto);
  assert.ok(m.espera.some((w) => w.texto === 'Amortiguadores traseros (par)' && /^Pedido/.test(w.detalle)));
  assert.ok(m.tambien.length >= 1 && m.sugerido, 'varias acciones: el orden se presenta como sugerencia');
  const html = tarjetaSigue(m) + capsulaSigue(m, v);
  assert.match(texto(html), /Orden sugerido: lo decide el taller/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-label="Cerrar Qué sigue"/);
  // Recepción no registra avances: no se le sugieren acciones de mecánico.
  const r = queSigue(await visita(recepcion, idEtios), appDe('recepcion'));
  assert.ok(!r.tambien.length && !r.sugerido);
  assert.equal(queSigue({ ...v, entregada_at: '2026-11-25T10:00:00Z' }, appDe('dueno')), null, 'orden cerrada: sin Qué sigue');
});

test('Contacto: llamar y WhatsApp con el teléfono cargado; sin teléfono, un estado claro y ningún enlace', async () => {
  const v = await visita(marcos, idEtios);
  const html = contactoCliente(v);
  assert.match(html, /href="tel:262215550142"/);
  // Mismo armado de número que los avisos de WhatsApp (telWhatsApp): 10 dígitos llevan 549 adelante.
  assert.match(html, /href="https:\/\/wa\.me\/262215550142" target="_blank" rel="noopener"/);
  assert.match(contactoCliente({ ...v, contacto_telefono: '261 555-0142' }), /wa\.me\/5492615550142"/);
  assert.doesNotMatch(html, /\?text=/, 'WhatsApp se abre sin mensaje');
  const sin = contactoCliente({ ...v, contacto_telefono: '' });
  assert.match(texto(sin), /Sin teléfono cargado · no se puede llamar ni escribir/);
  assert.doesNotMatch(sin, /href=/);
});

test('Entrega: listo con saldo; recepción ve el cobro aparte y la entrega pide confirmar el saldo', async () => {
  const v = await visita(recepcion, idOnix);
  assert.ok(v.lista_at && v.totales.liquidado > 0 && v.totales.saldo > 0, 'la demo tiene una orden lista, liquidada y con saldo');
  const html = seccionControl(v, { ...appDe('recepcion'), sesion: { usuario: { rol: 'recepcion', id: 0 }, taller: { entregaSaldo: { regla: 'recepcion', puedo: true } } } }).html;
  const t = texto(html);
  assert.match(t, /Listo para retirar Sí/);
  assert.match(t, /Entregado Disponible ahora/);
  assert.match(t, new RegExp(`Con saldo .*Falta cobrar ${pesos(v.totales.saldo).replace('$', '\\$')}`));
  assert.match(html, /name="conSaldo"/);
  assert.match(t, /Entregar no lo marca pagado/);
  const mec = texto(seccionControl(await visita(marcos, idOnix), appDe('mecanico', marcosId)).html);
  assert.match(mec, /La entrega la registran recepción o el dueño/);
  assert.match(mec, /Cobro: lo ven y registran recepción o el dueño/);
  assert.doesNotMatch(mec, /\$/);
});

test('Entrega: sin liquidar con anticipo, liquidación pendiente y trabajo sin importe se dicen distinto', async () => {
  const v = await visita(dueno, idEtios);
  const app = { ...appDe('dueno'), sesion: { usuario: { rol: 'dueno', id: 0 }, taller: {} } };
  const t = texto(seccionControl(v, app).html);
  assert.match(t, /Sin liquidar .*de anticipo .*El total se fija al liquidar lo realizado/);
  assert.match(t, /Para comprobar, falta/);
  // Todo lo autorizado realizado sin importe: no hay nada que liquidar ni deuda inventada.
  const lineas = v.presupuesto.lineas.map((l) => (l.estado === 'vigente' && (l.respuesta?.respuesta === 'autoriza' || l.autorizada_ingreso) ? { ...l, importe: 0, realizado_at: '2026-11-24T10:00:00Z' } : l));
  const cero = { ...v, presupuesto: { ...v.presupuesto, lineas }, totales: { ...v.totales, realizado: 0, liquidado: 0, saldo: 0 }, lista_at: '2026-11-24T11:00:00Z', controles: [{ vigente: 1, resultado: 'resuelto', como: 'Prueba', creado_at: '2026-11-24T10:30:00Z' }] };
  const t0 = texto(seccionControl(cero, app).html);
  assert.match(t0, /Lo realizado no tiene importe: no hay nada que liquidar/);
  assert.doesNotMatch(t0, /Antes de entregar falta liquidar/);
  assert.match(t0, /Registrar entrega/);
});
