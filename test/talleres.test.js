// Varios talleres en la misma instalación: regla de entrega con saldo y configuración independientes,
// y ningún dato operativo compartido aunque coincida la patente.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';

let e, dueno, recepcion, mecanico, norte;
before(async () => {
  e = await levantar();
  [dueno, recepcion, mecanico, norte] = await Promise.all(['dueno', 'recepcion', 'marcos', 'norte'].map(e.cliente));
});
after(async () => { await e.cerrar(); });

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

// Visita lista para retirar, liquidada y con saldo (recibe recepción del taller indicado).
async function listaConSaldo(quienRecibe, quienEjecuta, patente, importe = '10000') {
  const { visita: v } = await quienRecibe.recibir({
    vehiculo: { patente }, contacto: { nombre: 'Cliente ficticio' }, tipo: 'service', motivo: 'Prueba de regla', km: '1000',
    autorizacion: { persona: 'Cliente ficticio', importe, canal: 'presencial' }
  });
  for (const l of v.presupuesto.lineas) await quienEjecuta.post(`/api/visitas/${v.id}/lineas/${l.id}/realizado`, {});
  await quienEjecuta.post(`/api/visitas/${v.id}/control`, { resultado: 'resuelto', como: 'Comprobación ficticia' });
  await quienRecibe.post(`/api/visitas/${v.id}/lista`, {});
  return (await quienRecibe.post(`/api/visitas/${v.id}/liquidar`, {})).visita;
}
async function cambiarRegla(cliente, regla) {
  const { taller } = await (cliente === recepcion ? dueno : cliente).get('/api/taller');
  return cliente.pedir('PUT', '/api/taller', { version: taller.version, entregaSaldo: regla });
}

test('Entrega con saldo: la regla de cada taller se aplica en el servidor y queda registrada', async () => {
  // Valor inicial: dueño y recepción, con confirmación y motivo (comportamiento anterior).
  assert.equal((await recepcion.get('/api/sesion')).taller.entregaSaldo.regla, 'recepcion');
  let v = await listaConSaldo(recepcion, dueno, 'POL001');
  const sinMotivo = await recepcion.pedir('POST', `/api/visitas/${v.id}/entrega`, { conSaldo: true, nota: '' });
  assert.equal(sinMotivo.estado, 400);
  assert.equal(sinMotivo.datos.campo, 'nota');
  ({ visita: v } = await recepcion.post(`/api/visitas/${v.id}/entrega`, { conSaldo: true, nota: 'Cliente habitual, paga el viernes' }));
  assert.equal(v.entrega_saldo, 1000000);
  assert.equal(v.entrega_regla, 'recepcion');
  assert.ok(v.actividad.some((a) => /saldo pendiente de \$10\.000.*Autorizó/.test(a.accion)));

  // Solo el dueño: la recepción no puede, ni siquiera llamando a la API directamente.
  assert.equal((await cambiarRegla(recepcion, 'dueno')).estado, 403, 'recepción no cambia la regla');
  assert.equal((await cambiarRegla(dueno, 'cualquiera')).estado, 400);
  assert.equal((await cambiarRegla(dueno, 'dueno')).estado, 200);
  assert.equal((await recepcion.get('/api/sesion')).taller.entregaSaldo.puedo, false);
  let w = await listaConSaldo(recepcion, dueno, 'POL002');
  const r = await recepcion.pedir('POST', `/api/visitas/${w.id}/entrega`, { conSaldo: true, nota: 'Paga mañana' });
  assert.equal(r.estado, 403);
  assert.match(r.datos.error, /solo el dueño/);
  ({ visita: w } = await dueno.post(`/api/visitas/${w.id}/entrega`, { conSaldo: true, nota: 'Lo autorizo yo: paga mañana' }));
  assert.equal(w.entrega_regla, 'dueno');

  // El mecánico no ve el saldo de la entrega.
  const vistaMecanico = (await mecanico.get(`/api/visitas/${w.id}`)).visita;
  assert.equal(vistaMecanico.entrega_saldo, null);
  assert.ok(!vistaMecanico.actividad.some((a) => /\$/.test(a.accion + (a.detalle || ''))));

  // No se entrega con saldo: tampoco el dueño; pagado sí se entrega.
  assert.equal((await cambiarRegla(dueno, 'ninguno')).estado, 200);
  const x = await listaConSaldo(recepcion, dueno, 'POL003');
  assert.equal((await dueno.pedir('POST', `/api/visitas/${x.id}/entrega`, { conSaldo: true, nota: 'Igual se lo lleva' })).estado, 403);
  await recepcion.post(`/api/visitas/${x.id}/pagos`, { importe: '10000', medio: 'efectivo' }, { idempotencia: true });
  const entregada = (await recepcion.post(`/api/visitas/${x.id}/entrega`, {})).visita;
  assert.ok(entregada.entregada_at);
  assert.equal(entregada.entrega_saldo, null);

  // El otro taller conserva su propia regla.
  assert.equal((await norte.get('/api/sesion')).taller.entregaSaldo.regla, 'recepcion');
  await cambiarRegla(dueno, 'recepcion');
});

test('Dos talleres con la misma patente no comparten búsquedas, clientes, trabajos, pagos, documentos ni archivos', async () => {
  // Trabajo completo en el taller Norte sobre la patente que también existe en el Taller Modelo.
  const { vehiculos: [vn] } = await norte.get('/api/buscar?q=AE482KJ');
  // La visita de prueba abierta se anula (sin dinero) para registrar un trabajo completo con cobro.
  if (vn.visitaAbierta) await norte.post(`/api/visitas/${vn.visitaAbierta.id}/anular`, { motivo: 'Prueba: se reemplaza por un service' });
  const { visita: v } = await norte.recibir({
    vehiculoId: vn.id, tipo: 'service', motivo: 'Service Norte', km: '21000',
    autorizacion: { persona: 'Pedro Gómez (ficticio)', importe: '7000', canal: 'presencial' }
  });
  await norte.post(`/api/visitas/${v.id}/pagos`, { importe: '1000', medio: 'transferencia' }, { idempotencia: true });
  const doc = await norte.post('/api/documentos', { tipo: 'presupuesto', refTipo: 'visita', refId: v.id });
  const archivo = await norte.ok('POST', `/api/adjuntos?ambito=visita&visitaId=${v.id}&descripcion=Foto%20Norte`, undefined, { crudo: PNG, cabeceras: { 'Content-Type': 'image/png', 'X-Nombre-Archivo': 'norte.png' } });

  // Búsqueda y clientes: cada taller ve solo su ficha.
  const busA = await dueno.get('/api/buscar?q=AE482KJ');
  assert.equal(busA.vehiculos.length, 1);
  assert.notEqual(busA.vehiculos[0].id, vn.id);
  assert.ok(!(await dueno.get('/api/contactos')).contactos.some((c) => c.telefono === '2622 15-55-0700'));
  // Trabajos, pagos, documentos y archivos del otro taller: no existen para el Taller Modelo.
  assert.equal((await dueno.pedir('GET', `/api/visitas/${v.id}`)).estado, 404);
  assert.equal((await dueno.pedir('POST', `/api/visitas/${v.id}/pagos`, { importe: '1', medio: 'efectivo' })).estado, 404);
  const caja = await dueno.get('/api/caja?desde=2000-01-01&hasta=2100-01-01');
  assert.ok(!caja.movimientos.some((m) => m.visita_id === v.id));
  const cuentas = await dueno.get('/api/cuentas');
  assert.ok(!cuentas.cuentas.some((c) => /Pedro Gómez \(ficticio\)/.test(c.nombre) && c.telefono === '2622 15-55-0700'));
  assert.equal((await dueno.pedir('GET', `/api/documentos/${doc.id}`)).estado, 404);
  assert.ok(!(await dueno.get('/api/documentos')).documentos.some((d) => d.id === doc.id));
  assert.equal((await dueno.pedir('POST', `/api/documentos/${doc.id}/enlace`, { dias: 1 })).estado, 404);
  assert.equal((await dueno.pedir('GET', `/api/adjuntos/${archivo.id}`)).estado, 404);
  assert.equal((await dueno.pedir('POST', `/api/adjuntos/${archivo.id}/archivar`, { motivo: 'x' })).estado, 404);
});

test('Cada taller configura su nombre, contactos, servicios, precios, usuarios, agenda y logo por separado', async () => {
  const antesA = (await dueno.get('/api/taller')).taller;
  const { taller: tn } = await norte.get('/api/taller');
  await norte.put('/api/taller', {
    version: tn.version, nombre: 'Taller Norte Renombrado (ficticio)', telefono: '0000 00-0000', valorHora: '19000',
    agenda: { dias: [1, 2, 3], desde: '09:00', hasta: '13:00', paso: 30 }
  });
  await norte.post('/api/catalogos/servicios', { nombre: 'Servicio exclusivo Norte', duracion: 60, precio: '5000' });
  await norte.ok('POST', '/api/taller/logo', undefined, { crudo: PNG, cabeceras: { 'Content-Type': 'image/png', 'X-Nombre-Archivo': 'logo.png' } });
  await norte.post('/api/usuarios', { nombre: 'Recepción Norte (prueba)', email: 'recepcion@norte.test', rol: 'recepcion' });

  const despuesA = (await dueno.get('/api/taller')).taller;
  assert.equal(despuesA.nombre, antesA.nombre);
  assert.equal(despuesA.config.telefono, antesA.config.telefono);
  assert.equal(despuesA.config.valor_hora, antesA.config.valor_hora);
  assert.equal(despuesA.config.logoAdjuntoId, antesA.config.logoAdjuntoId);
  assert.deepEqual((await dueno.get('/api/taller')).agenda, (await dueno.get('/api/taller')).agenda);
  assert.notDeepEqual((await dueno.get('/api/taller')).agenda.dias, [1, 2, 3]);
  assert.ok(!(await dueno.get('/api/catalogos')).servicios.some((s) => s.nombre === 'Servicio exclusivo Norte'));
  assert.ok(!(await dueno.get('/api/usuarios')).usuarios.some((u) => u.email === 'recepcion@norte.test'));
  assert.equal((await norte.get('/api/sesion')).taller.nombre, 'Taller Norte Renombrado (ficticio)');
  assert.ok((await norte.get('/api/catalogos')).servicios.some((s) => s.nombre === 'Servicio exclusivo Norte' && s.precio === 500000));
  // Un dueño no puede editar un servicio de otro taller por id.
  const ajeno = (await norte.get('/api/catalogos')).servicios.find((s) => s.nombre === 'Servicio exclusivo Norte');
  assert.equal((await dueno.pedir('POST', '/api/catalogos/servicios', { id: ajeno.id, nombre: 'Tomado', duracion: 60 })).estado, 404);
});

test('Cierre de sesiones: salir en todos los dispositivos y el dueño corta las de otra persona', async () => {
  const otraRecepcion = await e.cliente('recepcion');
  const mecanico2 = await e.cliente('julian');
  await otraRecepcion.post('/api/sesion/salir-todas', {});
  assert.equal((await otraRecepcion.pedir('GET', '/api/sesion')).estado, 401);
  assert.equal((await recepcion.pedir('GET', '/api/sesion')).estado, 401, 'también se cerró la otra sesión de la misma persona');
  recepcion = await e.cliente('recepcion');
  const { usuarios } = await dueno.get('/api/usuarios');
  const julian = usuarios.find((u) => u.email === 'julian@taller-modelo.test');
  assert.equal((await recepcion.pedir('POST', `/api/usuarios/${julian.id}/cerrar-sesiones`, {})).estado, 403);
  assert.equal((await norte.pedir('POST', `/api/usuarios/${julian.id}/cerrar-sesiones`, {})).estado, 404, 'otro taller no lo encuentra');
  await dueno.post(`/api/usuarios/${julian.id}/cerrar-sesiones`, {});
  assert.equal((await mecanico2.pedir('GET', '/api/sesion')).estado, 401);
});

test('Un auto listo indica el siguiente paso de dinero sin mostrarlo al mecánico', async () => {
  const hoyR = await recepcion.get('/api/hoy');
  const onix = hoyR.presentes.find((v) => v.vehiculo.patente === 'AC 552 MZ');
  assert.match(onix.situacion.paso, /Cobrar el saldo/);
  const hoyM = await mecanico.get('/api/hoy');
  const onixM = hoyM.presentes.find((v) => v.vehiculo.patente === 'AC 552 MZ');
  assert.doesNotMatch(onixM.situacion.paso, /saldo|Cobr|Liquid/);
});

test('Operación: /salud responde sin datos y la IP de un proxy solo se usa si se configura', async () => {
  const r = await fetch(e.base + '/salud');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.deepEqual(Object.keys(d).sort(), ['ok', 'version']);
  const { ipCliente } = await import('../server/http.js');
  const { config } = await import('../server/config.js');
  const req = { headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(ipCliente(req), '127.0.0.1', 'sin TALLERES_PROXY se ignora la cabecera');
  config.proxy = true;
  try { assert.equal(ipCliente(req), '2.2.2.2'); } finally { config.proxy = false; }
});

test('Puesta en marcha: el dueño ve lo que falta configurar; recepción no', async () => {
  const hn = await norte.get('/api/hoy');
  assert.ok(Array.isArray(hn.configurar) && hn.configurar.length === 4);
  assert.ok(hn.configurar.some((x) => x.ruta === 'ajustes/usuarios'));
  assert.equal((await recepcion.get('/api/hoy')).configurar, null);
});
