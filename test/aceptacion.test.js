// Pruebas de aceptación sobre la API real con datos de prueba. Ejecutar: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';

let E, dueno, carla, marcos, julian, norte, anonimo;

before(async () => {
  E = await levantar();
  [dueno, carla, marcos, julian, norte, anonimo] = await Promise.all(['dueno', 'recepcion', 'marcos', 'julian', 'norte', null].map(E.cliente));
});
after(async () => { await E.cerrar(); });

const etiosId = () => E.datos.etios.visitaActual;

test('Hoy muestra el Etios esperando repuesto con próximo paso concreto', async () => {
  const h = await carla.get('/api/hoy');
  const e = h.presentes.find((v) => v.vehiculo.patente === 'AE 482 KJ');
  assert.ok(e, 'el Etios está presente');
  assert.equal(e.situacion.clave, 'repuesto');
  assert.match(e.situacion.paso, /Registrar que llegó: Amortiguadores traseros/);
  assert.ok(h.presentes.some((v) => v.situacion.clave === 'lista'), 'un auto listo sigue en Hoy hasta la entrega');
  assert.ok(h.atencion.some((a) => a.tipo === 'autorizacion'), 'el Gol figura en atención por presupuesto sin respuesta');
});

test('Totales del Etios: 312.000 presupuestado, 214.000 autorizado, 98.000 postergado; revisión incluida una vez', async () => {
  const { visita } = await carla.get(`/api/visitas/${etiosId()}`);
  assert.equal(visita.totales.presupuestado, 31200000);
  assert.equal(visita.totales.autorizado, 21400000);
  assert.equal(visita.totales.postergado, 9800000);
  assert.equal(visita.totales.cobrado, 5000000, 'seña de 50.000');
  assert.equal(visita.totales.liquidado, 0, 'no se liquida lo que no se realizó');
  const p = await carla.get('/api/pendientes');
  assert.ok(p.postergados.some((s) => s.titulo === 'Pastillas de freno delanteras'), 'lo postergado aparece en Pendientes');
  const s = p.services.find((x) => x.vehiculo.patente === 'AE 482 KJ');
  assert.equal(s.km_objetivo, 88420);
  assert.equal(s.faltanKm, 4270, 'faltan 4.270 km según la lectura de 84.150');
});

test('Separación entre talleres: la misma patente no une fichas ni expone datos', async () => {
  const bus = await norte.get('/api/buscar?q=ae482kj');
  assert.equal(bus.vehiculos.length, 1);
  assert.match(bus.vehiculos[0].contacto, /Pedro Gómez/);
  const r1 = await norte.pedir('GET', `/api/visitas/${etiosId()}`);
  assert.equal(r1.estado, 404);
  const r2 = await norte.pedir('GET', `/api/vehiculos/${E.datos.etios.vehiculo}`);
  assert.equal(r2.estado, 404);
  const r3 = await norte.pedir('POST', `/api/visitas/${etiosId()}/pagos`, { importe: '1000', medio: 'efectivo' });
  assert.equal(r3.estado, 404, 'un dueño de otro taller no encuentra la visita');
  const r4 = await norte.pedir('POST', `/api/visitas/${etiosId()}/control`, { resultado: 'resuelto', como: 'x' });
  assert.ok([403, 404].includes(r4.estado));
  const r5 = await norte.pedir('POST', `/api/articulos/${E.datos.articulos.buje}/ajuste`, { sentido: 'salida', cantidad: '1', motivo: 'x' });
  assert.equal(r5.estado, 404, 'no puede tocar el stock de otro taller');
  const exp = await norte.pedir('GET', '/api/exportar');
  assert.equal(exp.estado, 200);
  const datos = typeof exp.datos === 'string' ? JSON.parse(exp.datos) : exp.datos;
  assert.ok(datos.vehiculos.every((v) => v.taller_id === E.datos.tallerB));
  assert.ok(!JSON.stringify(datos).includes('Ana Ferreyra'), 'la exportación no incluye clientes de otro taller');
  // Intentar vincular un vehículo de otro taller al recibir
  const r6 = await norte.pedir('POST', '/api/visitas', { vehiculoId: E.datos.etios.vehiculo, tipo: 'revision', motivo: 'x', km: '1' });
  assert.equal(r6.estado, 404);
});

test('Permisos por perfil en el servidor', async () => {
  const resp = await marcos.pedir('POST', `/api/visitas/${etiosId()}/respuestas`, { persona: 'x', canal: 'telefono', respuestas: [] });
  assert.equal(resp.estado, 403, 'el mecánico no registra respuestas del cliente');
  assert.equal((await marcos.pedir('GET', '/api/reportes')).estado, 403);
  assert.equal((await carla.pedir('GET', '/api/reportes')).estado, 403);
  assert.equal((await marcos.pedir('GET', '/api/caja')).estado, 403);
  const { visita } = await marcos.get(`/api/visitas/${etiosId()}`);
  assert.equal(visita.totales, null, 'el mecánico no ve importes');
  assert.ok(visita.presupuesto.lineas.every((l) => l.importe === null));
  const otra = (await carla.get('/api/hoy')).presentes.find((v) => v.responsable_id && v.responsable_id !== visita.responsable_id && v.situacion.clave === 'trabajo');
  const r = await marcos.pedir('POST', `/api/visitas/${otra.id}/tareas`, { descripcion: 'x' });
  assert.equal(r.estado, 403, 'un mecánico no registra en la visita asignada a otro');
  assert.equal((await carla.pedir('POST', '/api/usuarios', { nombre: 'x', email: 'x@x.test', rol: 'dueno' })).estado, 403);
});

test('Sin sesión o sin cabecera de seguridad se rechaza', async () => {
  assert.equal((await anonimo.pedir('GET', '/api/hoy')).estado, 401);
  const sinCabecera = await fetch(E.base + '/api/sesion/ingresar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(sinCabecera.status, 403);
  const malo = await anonimo.pedir('POST', '/api/sesion/ingresar', { email: 'dueno@taller-modelo.test', clave: 'incorrecta' });
  assert.equal(malo.estado, 401);
});

test('Cambiar el importe de un trabajo autorizado conserva el original y exige respuesta', async () => {
  let { visita: v } = await carla.get(`/api/visitas/${etiosId()}`);
  const mo = v.presupuesto.lineas.find((l) => l.descripcion === 'Cambio de amortiguadores traseros' && l.estado === 'vigente');
  const antes = v.totales.autorizado;
  ({ visita: v } = await carla.post(`/api/visitas/${etiosId()}/lineas/${mo.id}/modificar`, { precio: '26000', motivo: 'Se agregó un soporte' }));
  const original = v.presupuesto.lineas.find((l) => l.id === mo.id);
  const nueva = v.presupuesto.lineas.find((l) => l.origen_linea_id === mo.id);
  assert.equal(original.estado, 'reemplazada');
  assert.equal(original.respuesta.respuesta, 'autoriza', 'la autorización anterior se conserva');
  assert.equal(nueva.respuesta, null, 'el cambio espera respuesta');
  assert.equal(nueva.importe, 2600000);
  assert.equal(v.totales.autorizado, antes, 'mientras tanto sigue autorizado lo anterior');
  assert.equal(v.situacion.clave, 'autorizacion');
  assert.ok(v.presupuesto.versiones.length >= 3, 'se creó una versión nueva');
  // No se puede marcar realizado mientras el cambio no tiene respuesta
  const r = await marcos.pedir('POST', `/api/visitas/${etiosId()}/lineas/${nueva.id}/realizado`, {});
  assert.equal(r.estado, 400);
  // Rechazo del cambio: vuelve a regir la línea anterior con su autorización
  ({ visita: v } = await carla.post(`/api/visitas/${etiosId()}/respuestas`, { persona: 'Ana Ferreyra', canal: 'whatsapp', respuestas: [{ lineaId: nueva.id, respuesta: 'rechaza' }] }));
  assert.equal(v.presupuesto.lineas.find((l) => l.id === mo.id).estado, 'vigente');
  assert.equal(v.presupuesto.lineas.find((l) => l.id === nueva.id).estado, 'descartada');
  assert.equal(v.totales.autorizado, antes);
  // Un segundo cambio, ahora autorizado: rige el nuevo importe
  ({ visita: v } = await carla.post(`/api/visitas/${etiosId()}/lineas/${mo.id}/modificar`, { cantidad: '1', precio: '24000', motivo: 'Precio actualizado' }));
  const n2 = v.presupuesto.lineas.find((l) => l.origen_linea_id === mo.id && l.estado === 'vigente');
  ({ visita: v } = await carla.post(`/api/visitas/${etiosId()}/respuestas`, { persona: 'Ana Ferreyra', canal: 'telefono', respuestas: [{ lineaId: n2.id, respuesta: 'autoriza' }] }));
  assert.equal(v.totales.autorizado, antes - 2200000 + 2400000);
  // Una postergación no aplica a un cambio
  const otra = v.presupuesto.lineas.find((l) => l.descripcion.startsWith('Cambio de bujes') && l.estado === 'vigente');
  ({ visita: v } = await carla.post(`/api/visitas/${etiosId()}/lineas/${otra.id}/modificar`, { precio: '50000', motivo: 'x' }));
  const n3 = v.presupuesto.lineas.find((l) => l.origen_linea_id === otra.id && l.estado === 'vigente');
  const p = await carla.pedir('POST', `/api/visitas/${etiosId()}/respuestas`, { persona: 'Ana', canal: 'telefono', respuestas: [{ lineaId: n3.id, respuesta: 'posterga' }] });
  assert.equal(p.estado, 400);
  await carla.post(`/api/visitas/${etiosId()}/respuestas`, { persona: 'Ana Ferreyra', canal: 'telefono', respuestas: [{ lineaId: n3.id, respuesta: 'rechaza' }] });
});

test('Recorrido completo del Etios: llegó ≠ colocado, control, lista, entrega con saldo controlado', async () => {
  let { visita: v } = await carla.get(`/api/visitas/${etiosId()}`);
  const amort = v.repuestos.find((r) => r.descripcion.startsWith('Amortiguadores'));
  const buje = v.repuestos.find((r) => r.descripcion.startsWith('Buje'));
  // Colocar antes de que llegue: rechazado
  assert.equal((await marcos.pedir('POST', `/api/repuestos/${amort.id}/etapa`, { etapa: 'colocado' })).estado, 400);
  ({ visita: v } = await carla.post(`/api/repuestos/${amort.id}/etapa`, { etapa: 'llego' }));
  assert.equal(v.situacion.clave, 'trabajo', 'llegó no completa el trabajo');
  const stockAntes = (await dueno.get(`/api/articulos/${E.datos.articulos.buje}`)).articulo;
  assert.equal(stockAntes.reservado, 2000);
  await marcos.post(`/api/repuestos/${amort.id}/etapa`, { etapa: 'colocado' });
  await marcos.post(`/api/repuestos/${buje.id}/etapa`, { etapa: 'colocado' });
  const stockDespues = (await dueno.get(`/api/articulos/${E.datos.articulos.buje}`)).articulo;
  assert.equal(stockDespues.existencia, stockAntes.existencia - 2000, 'se descuenta una sola vez al colocar');
  assert.equal(stockDespues.reservado, 0);
  // Control bloqueado hasta marcar realizados los trabajos autorizados
  assert.equal((await marcos.pedir('POST', `/api/visitas/${etiosId()}/control`, { resultado: 'resuelto', como: 'Prueba de ruta' })).estado, 400);
  ({ visita: v } = await marcos.get(`/api/visitas/${etiosId()}`));
  for (const l of v.presupuesto.lineas.filter((x) => x.estado === 'vigente' && x.respuesta?.respuesta === 'autoriza' && !x.realizado_at)) {
    await marcos.post(`/api/visitas/${etiosId()}/lineas/${l.id}/realizado`, {});
  }
  ({ visita: v } = await marcos.post(`/api/visitas/${etiosId()}/control`, { resultado: 'resuelto', como: 'Prueba de ruta con lomos de burro y elevador' }));
  assert.equal(v.situacion.clave, 'controlada');
  // Entregar sin estar lista: rechazado
  assert.equal((await carla.pedir('POST', `/api/visitas/${etiosId()}/entrega`, {})).estado, 400);
  ({ visita: v } = await carla.post(`/api/visitas/${etiosId()}/lista`, {}));
  assert.equal(v.situacion.clave, 'lista');
  // Liquidación: solo lo realizado (sin las pastillas postergadas)
  ({ visita: v } = await carla.post(`/api/visitas/${etiosId()}/liquidar`, {}));
  assert.equal(v.totales.liquidado, v.totales.realizado);
  assert.ok(!v.presupuesto.lineas.some((l) => l.descripcion.startsWith('Pastillas') && l.cargo_id), 'lo postergado no se liquida');
  // Entrega con saldo: requiere confirmación y nota
  const sin = await carla.pedir('POST', `/api/visitas/${etiosId()}/entrega`, { pendientesInformados: true });
  assert.equal(sin.estado, 400);
  assert.equal(sin.datos.campo, 'conSaldo');
  ({ visita: v } = await carla.post(`/api/visitas/${etiosId()}/entrega`, { pendientesInformados: true, conSaldo: true, nota: 'Paga el saldo el viernes.' }));
  assert.ok(v.entregada_at);
  assert.ok(v.totales.saldo > 0, 'entregar no marca pagado');
  const h = await carla.get('/api/hoy');
  assert.ok(!h.presentes.some((x) => x.id === etiosId()), 'entregado sale de Hoy');
});

test('Cobro parcial deja saldo correcto y un reintento no lo duplica', async () => {
  const hoy = await carla.get('/api/hoy');
  const onix = hoy.presentes.find((v) => v.vehiculo.patente === 'AC 552 MZ');
  let { visita: v } = await carla.get(`/api/visitas/${onix.id}`);
  assert.equal(v.totales.saldo, 3500000, 'liquidado 60.000 con pago a cuenta de 25.000');
  const clave = 'pago-prueba-123';
  const a = await carla.post(`/api/visitas/${onix.id}/pagos`, { importe: '20.000', medio: 'efectivo' }, { idempotencia: clave });
  const b = await carla.post(`/api/visitas/${onix.id}/pagos`, { importe: '20.000', medio: 'efectivo' }, { idempotencia: clave });
  assert.equal(b.repetido, true);
  assert.equal(b.visita.totales.saldo, a.visita.totales.saldo);
  ({ visita: v } = await carla.get(`/api/visitas/${onix.id}`));
  assert.equal(v.totales.saldo, 1500000);
  assert.equal(v.cuenta.filter((m) => m.tipo === 'pago').length, 2, 'el pago a cuenta de los datos y uno solo nuevo');
  // Pago mayor que el saldo: rechazado
  assert.equal((await carla.pedir('POST', `/api/visitas/${onix.id}/pagos`, { importe: '90000', medio: 'efectivo' })).estado, 400);
  // Anulación: solo el dueño, con motivo; el original se conserva
  const pago = v.cuenta.filter((m) => m.tipo === 'pago').at(-1);
  assert.equal((await carla.pedir('POST', `/api/movimientos/${pago.id}/anular`, { motivo: 'error' })).estado, 403);
  assert.equal((await dueno.pedir('POST', `/api/movimientos/${pago.id}/anular`, {})).estado, 400);
  await dueno.post(`/api/movimientos/${pago.id}/anular`, { motivo: 'Se cargó dos veces por error' });
  ({ visita: v } = await carla.get(`/api/visitas/${onix.id}`));
  assert.equal(v.totales.saldo, 3500000);
  assert.equal(v.cuenta.length, 4, 'cargo, pagos y anulación quedan registrados');
  assert.equal((await dueno.pedir('POST', `/api/movimientos/${pago.id}/anular`, { motivo: 'otra vez' })).estado, 400, 'no se anula dos veces');
  // Caja del día refleja entrada y salida
  const caja = await dueno.get('/api/caja');
  const ef = caja.porMedio.find((m) => m.medio === 'efectivo');
  assert.ok(ef.entra >= 2000000 && ef.sale >= 2000000);
});

test('Compras y stock: una recepción ingresa una vez; remito y factura no duplican; venta, devolución y anulación coherentes', async () => {
  const art = E.datos.articulos.pastillas;
  const prov = (await dueno.get('/api/proveedores')).proveedores[0].id;
  const ex = async () => (await dueno.get(`/api/articulos/${art}`)).articulo.existencia;
  assert.equal(await ex(), 0);
  const c = await carla.post('/api/compras', { proveedorId: prov, documento: { tipo: 'remito', numero: 'R-9-1' }, lineas: [{ articuloId: art, cantidad: '4', costo: '60000' }] });
  assert.equal(await ex(), 0, 'una compra en borrador no mueve stock');
  await carla.post(`/api/compras/${c.id}/recibir`, {});
  assert.equal(await ex(), 4000);
  assert.equal((await carla.pedir('POST', `/api/compras/${c.id}/recibir`, {})).estado, 409, 'no se recibe dos veces');
  const dup = await carla.pedir('POST', '/api/compras', { proveedorId: prov, documento: { tipo: 'remito', numero: 'r-9-1' }, lineas: [{ articuloId: art, cantidad: '4', costo: '60000' }], recibir: true });
  assert.equal(dup.estado, 409, 'el mismo remito no se carga otra vez');
  assert.equal(await ex(), 4000);
  await carla.post(`/api/compras/${c.id}/documentos`, { tipo: 'factura', numero: 'A-1-77', importe: '240000' });
  assert.equal(await ex(), 4000, 'vincular la factura no ingresa mercadería');
  // Venta de mostrador
  const v = await carla.post('/api/ventas', { lineas: [{ articuloId: art, cantidad: '2', precio: '98000' }], cobro: { importe: '196000', medio: 'debito' } }, { idempotencia: true });
  assert.equal(await ex(), 2000);
  assert.equal((await carla.pedir('POST', '/api/ventas', { lineas: [{ articuloId: art, cantidad: '5', precio: '1' }], cobro: { importe: '5', medio: 'efectivo' } })).estado, 409, 'sin stock suficiente no vende');
  await carla.post(`/api/ventas/${v.id}/devolucion`, { motivo: 'No era la medida', lineas: [{ lineaId: v.venta.lineas[0].id, cantidad: '1' }], reintegro: { importe: '98000', medio: 'efectivo' } });
  assert.equal(await ex(), 3000);
  assert.equal((await carla.pedir('POST', `/api/ventas/${v.id}/anular`, { motivo: 'x' })).estado, 403, 'recepción no anula ventas');
  const anulada = await dueno.post(`/api/ventas/${v.id}/anular`, { motivo: 'Venta cargada por error' });
  assert.equal(await ex(), 4000, 'anular repone solo lo no devuelto');
  assert.equal(anulada.venta.estado, 'anulada');
  assert.equal(anulada.venta.saldo, 0);
  // Ajuste solo del dueño y con motivo
  assert.equal((await carla.pedir('POST', `/api/articulos/${art}/ajuste`, { sentido: 'salida', cantidad: '1', motivo: 'rotura' })).estado, 403);
  await dueno.post(`/api/articulos/${art}/ajuste`, { sentido: 'salida', cantidad: '1', motivo: 'Juego dañado en el depósito' });
  assert.equal(await ex(), 3000);
  assert.equal((await dueno.pedir('POST', `/api/articulos/${art}/ajuste`, { sentido: 'salida', cantidad: '10', motivo: 'x' })).estado, 409, 'no deja stock negativo');
});

test('Recibir un auto con datos mínimos y kilómetros desconocidos; lectura menor exige explicación', async () => {
  const r = await carla.recibir({ vehiculo: { patente: 'zz 999 zz' }, contacto: { nombre: 'Cliente Nuevo (prueba)' }, tipo: 'revision', motivo: 'Hace un ruido', sinKm: true });
  assert.equal(r.visita.lecturas[0].km, null, 'desconocido no es cero');
  assert.equal(r.visita.vehiculo.patente, 'ZZ 999 ZZ');
  const otra = await carla.pedir('POST', '/api/visitas', { vehiculoId: r.visita.vehiculo.id, tipo: 'revision', motivo: 'x', sinKm: true });
  assert.equal(otra.estado, 409, 'no se abre una segunda visita del mismo auto');
  const dup = await carla.pedir('POST', '/api/vehiculos', { patente: 'ZZ-999-ZZ' });
  assert.equal(dup.estado, 409, 'patente repetida en el mismo taller pide confirmación');
  const kangooHoy = (await carla.get('/api/hoy')).presentes.find((v) => v.vehiculo.patente === 'AD 913 LP');
  const lect = await carla.pedir('POST', `/api/vehiculos/${kangooHoy.vehiculo.id}/lecturas`, { km: '1000' });
  assert.equal(lect.estado, 400);
  assert.equal(lect.datos.campo, 'kmExplicacion');
  await carla.post(`/api/vehiculos/${kangooHoy.vehiculo.id}/lecturas`, { km: '1000', explicacion: 'Cambio de tablero (prueba)' });
  // Service sin autorización al ingreso: se pide recibir como revisión
  const s = await carla.pedir('POST', '/api/visitas', { vehiculo: { patente: 'QQ111QQ' }, contacto: { nombre: 'Otro (prueba)' }, tipo: 'service', motivo: 'Service', km: '1000' });
  assert.equal(s.estado, 400);
  assert.equal(s.datos.campo, 'autPersona');
});

test('Edición simultánea: una versión vieja no pisa cambios', async () => {
  const hoy = await carla.get('/api/hoy');
  const id = hoy.presentes.find((v) => v.vehiculo.patente === 'NKO 245').id;
  const { visita } = await carla.get(`/api/visitas/${id}`);
  await carla.put(`/api/visitas/${id}`, { version: visita.version, retiro: null });
  const r = await dueno.pedir('PUT', `/api/visitas/${id}`, { version: visita.version, prioridad: 'alta' });
  assert.equal(r.estado, 409);
});

test('Agenda: solicitud online queda pendiente; conflicto de puesto; no expone historial', async () => {
  const pub = await anonimo.get('/api/publico/taller-modelo');
  assert.ok(!JSON.stringify(pub).includes('Ferreyra'));
  const dir = await anonimo.get('/api/publico/directorio');
  assert.deepEqual(dir.talleres.map((t) => t.slug), ['taller-modelo'], 'el taller sin página pública no aparece');
  assert.equal((await anonimo.pedir('GET', '/api/publico/taller-norte')).estado, 404);
  const ag = await carla.get('/api/agenda');
  assert.ok(ag.solicitudes.length >= 1);
  const t = ag.turnos.find((x) => x.estado === 'confirmado' && x.puesto_id);
  const choque = await carla.pedir('POST', '/api/turnos', { nombre: 'Prueba', telefono: '2622555555', inicio: t.inicio, puestoId: t.puesto_id, duracion: 60 });
  assert.equal(choque.estado, 400);
  assert.match(choque.datos.error, /ocupado/);
  const sol = ag.solicitudes[0];
  const cons = await anonimo.pedir('GET', `/api/publico/taller-modelo/turnos/${sol.codigo}?tel=0000`);
  assert.equal(cons.estado, 404, 'sin los 4 números del teléfono no informa nada');
  await carla.post(`/api/turnos/${sol.id}/confirmar`, { version: sol.version, puestoId: ag.puestos[2].id });
  const cons2 = await anonimo.get(`/api/publico/taller-modelo/turnos/${sol.codigo}?tel=${sol.telefono.replace(/\D/g, '').slice(-4)}`);
  assert.equal(cons2.estado, 'Confirmado');
});

test('Documentos: copia fechada, enlace público limitado y revocable', async () => {
  const hoy = await carla.get('/api/hoy');
  const gol = hoy.presentes.find((v) => v.vehiculo.patente === 'NKO 245');
  const { id } = await carla.post('/api/documentos', { tipo: 'presupuesto', refTipo: 'visita', refId: gol.id });
  const { documento } = await carla.get(`/api/documentos/${id}`);
  assert.match(documento.contenido.leyenda, /No es una factura/);
  const enlace = await carla.post(`/api/documentos/${id}/enlace`, { dias: 3 });
  const pub = await fetch(E.base + enlace.ruta);
  assert.equal(pub.status, 200);
  const html = await pub.text();
  assert.match(html, /Bomba de agua/);
  assert.doesNotMatch(html, /Ferreyra/, 'solo ese documento');
  assert.equal((await norte.pedir('GET', `/api/documentos/${id}`)).estado, 404);
  const enlaces = (await carla.get(`/api/documentos/${id}`)).documento.enlaces;
  await carla.post(`/api/enlaces/${enlaces[0].id}/revocar`, {});
  assert.equal((await fetch(E.base + enlace.ruta)).status, 410);
  // Cambiar el nombre del taller no reescribe el documento emitido
  const t = await dueno.get('/api/taller');
  await dueno.put('/api/taller', { version: t.taller.version, nombre: 'Taller Modelo (nuevo nombre de prueba)' });
  assert.equal((await carla.get(`/api/documentos/${id}`)).documento.contenido.taller.nombre, 'Taller Modelo');
});

test('Avisos: preparar no es enviar; abrir WhatsApp no confirma el envío', async () => {
  const p = await carla.get('/api/pendientes');
  const s = p.services[0];
  const a = await carla.post('/api/avisos', { seguimientoId: s.id, canal: 'whatsapp', texto: 'Hola, prueba.' });
  assert.equal(a.estado, 'preparado');
  assert.match(a.enlace || '', /^https:\/\/wa\.me\//);
  await carla.post(`/api/avisos/${a.id}/estado`, { estado: 'abierto' });
  assert.equal((await carla.pedir('POST', `/api/avisos/${a.id}/estado`, { estado: 'enviado' })).estado, 400, 'exige confirmación de una persona');
  await carla.post(`/api/avisos/${a.id}/estado`, { estado: 'enviado', confirmo: true });
  assert.equal(p.integracion.activa, false);
});

test('Usuarios: invitación de un solo uso, desactivación corta la sesión', async () => {
  const inv = await dueno.post('/api/usuarios', { nombre: 'Nuevo mecánico (prueba)', email: 'nuevo@taller-modelo.test', rol: 'mecanico' });
  const token = inv.enlace.split('#')[1];
  const nuevo = await E.cliente(null);
  assert.equal((await nuevo.pedir('POST', `/api/acceso/${token}`, { clave: 'corta' })).estado, 400);
  await nuevo.post(`/api/acceso/${token}`, { clave: 'una frase larga de prueba' });
  assert.equal((await nuevo.pedir('POST', `/api/acceso/${token}`, { clave: 'una frase larga de prueba' })).estado, 410, 'el enlace no se reutiliza');
  await nuevo.ingresar('nuevo@taller-modelo.test', 'una frase larga de prueba');
  assert.equal((await nuevo.pedir('GET', '/api/hoy')).estado, 200);
  const u = (await dueno.get('/api/usuarios')).usuarios.find((x) => x.email === 'nuevo@taller-modelo.test');
  await dueno.put(`/api/usuarios/${u.id}`, { version: u.version, activo: false });
  assert.equal((await nuevo.pedir('GET', '/api/hoy')).estado, 401, 'al desactivarlo se cierra su sesión');
  const yo = (await dueno.get('/api/usuarios')).usuarios.find((x) => x.email === 'dueno@taller-modelo.test');
  assert.equal((await dueno.pedir('PUT', `/api/usuarios/${yo.id}`, { version: yo.version, rol: 'mecanico' })).estado, 400, 'debe quedar un dueño');
});

test('Archivos privados: tipo verificado y descarga solo del mismo taller', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
  const r = await carla.ok('POST', `/api/adjuntos?ambito=visita&visitaId=${etiosId()}&descripcion=Foto%20de%20prueba`, undefined, { crudo: png, cabeceras: { 'Content-Type': 'image/png', 'X-Nombre-Archivo': 'foto.png' } });
  assert.ok(r.id);
  const bajada = await marcos.pedir('GET', `/api/adjuntos/${r.id}`);
  assert.equal(bajada.estado, 200);
  assert.equal((await norte.pedir('GET', `/api/adjuntos/${r.id}`)).estado, 404);
  assert.equal((await anonimo.pedir('GET', `/api/adjuntos/${r.id}`)).estado, 401);
  const falso = await carla.pedir('POST', `/api/adjuntos?ambito=visita&visitaId=${etiosId()}`, undefined, { crudo: Buffer.from('<script>alert(1)</script>'), cabeceras: { 'Content-Type': 'image/png' } });
  assert.equal(falso.estado, 400, 'un archivo que no es lo que dice se rechaza');
});
