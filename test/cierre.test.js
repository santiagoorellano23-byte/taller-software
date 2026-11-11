import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { levantar } from './entorno.js';
import { normalizarAgenda } from '../server/routes/agenda.js';
import { crearRespaldo, restaurarRespaldo, estadoRespaldo } from '../server/respaldo.js';

let e, dueno, recepcion, norte, anonimo;
before(async () => {
  e = await levantar();
  [dueno, recepcion, norte, anonimo] = await Promise.all(['dueno', 'recepcion', 'norte', null].map(e.cliente));
});
after(async () => { await e.cerrar(); });

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const agenda = { dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '19:00', paso: 15, pausaDesde: '13:30', pausaHasta: '14:30' };
const dia = '2030-01-07'; // lunes, futuro para el cierre de esta versión
async function configurar(cambios) {
  const { taller } = await dueno.get('/api/taller');
  return dueno.put('/api/taller', { version: taller.version, ...cambios });
}

test('Los datos de contacto completan la guía de inicio aunque el taller elija no usar logo', async () => {
  const { taller } = await norte.get('/api/taller');
  await norte.put('/api/taller', { version: taller.version, telefono: '02622 608080' });
  await norte.ok('DELETE', '/api/taller/logo');
  const { configurar: pasos } = await norte.get('/api/hoy');
  assert.equal(pasos.find((p) => p.ruta === 'ajustes').hecho, true);
  assert.match(pasos.find((p) => p.ruta === 'ajustes').texto, /logo opcional/);
});

test('Quitar logo conserva el archivo y los documentos emitidos; no afecta a otro taller', async () => {
  const { id: logoId } = await dueno.ok('POST', '/api/taller/logo', undefined, { crudo: PNG, cabeceras: { 'Content-Type': 'image/png' } });
  const visitaId = (await dueno.get('/api/hoy')).presentes[0].id;
  const { id } = await dueno.post('/api/documentos', { tipo: 'presupuesto', refTipo: 'visita', refId: visitaId });
  const anterior = (await dueno.get(`/api/documentos/${id}`)).documento;
  assert.match(anterior.contenido.taller.logo, /^data:image\/png/);
  assert.equal((await recepcion.pedir('DELETE', '/api/taller/logo')).estado, 403);
  await norte.ok('DELETE', '/api/taller/logo');
  assert.equal((await dueno.get('/api/taller')).taller.config.logoAdjuntoId, logoId);
  await dueno.ok('DELETE', '/api/taller/logo');
  assert.equal((await dueno.get('/api/taller')).taller.config.logoAdjuntoId, null);
  assert.equal((await dueno.get('/api/sesion')).taller.perfil.tieneLogo, false);
  assert.equal((await dueno.pedir('GET', `/api/adjuntos/${logoId}`)).estado, 200);
  assert.deepEqual((await dueno.get(`/api/documentos/${id}`)).documento.contenido, anterior.contenido);
  const nuevo = await dueno.post('/api/documentos', { tipo: 'presupuesto', refTipo: 'visita', refId: visitaId });
  assert.equal((await dueno.get(`/api/documentos/${nuevo.id}`)).documento.contenido.taller.logo, null);
});

test('Agenda interna rechaza mediodía y turnos que cruzan el cierre; acepta ambas franjas', async () => {
  await configurar({ agenda });
  for (const [hora, duracion] of [['13:30', 30], ['14:00', 30], ['13:15', 30], ['18:45', 30]]) {
    const r = await recepcion.pedir('POST', '/api/turnos', { nombre: 'Caso ficticio', telefono: '2622600000', inicio: `${dia}T${hora}`, duracion });
    assert.equal(r.estado, 400, hora);
    assert.match(r.datos.error, /franja/);
  }
  for (const hora of ['08:00', '13:00', '14:30', '18:30']) {
    assert.ok((await recepcion.post('/api/turnos', { nombre: 'Caso ficticio', telefono: '2622600000', inicio: `${dia}T${hora}`, duracion: 30 })).id);
  }
});

test('La disponibilidad pública respeta el paso, el cierre y la duración elegida', async () => {
  await configurar({ publico: true, turnosOnline: true, agenda });
  await dueno.post('/api/catalogos/servicios', { nombre: 'Prueba 90 minutos', duracion: 90, publico: true });
  const { servicios } = await dueno.get('/api/catalogos');
  const servicio = servicios.find((s) => s.nombre === 'Prueba 90 minutos');
  const d = await anonimo.get(`/api/publico/taller-modelo/turnos?fecha=${dia}&servicioId=${servicio.id}`);
  assert.equal(d.duracion, 90);
  assert.ok(d.horarios.some((x) => x.hora === '08:15'), 'usa paso de 15 min');
  assert.ok(d.horarios.some((x) => x.hora === '12:00'));
  assert.ok(!d.horarios.some((x) => x.hora === '12:15'));
  assert.ok(!d.horarios.some((x) => x.hora >= '13:30' && x.hora < '14:30'));
  assert.ok(d.horarios.some((x) => x.hora === '17:30'));
  assert.ok(!d.horarios.some((x) => x.hora > '17:30'));
  assert.equal((await anonimo.pedir('GET', `/api/publico/taller-modelo/turnos?fecha=${dia}&servicioId=999999`)).estado, 404);
  const ficha = (await anonimo.get('/api/publico/taller-modelo')).taller;
  assert.deepEqual(ficha.agenda.franjas, [['08:00', '13:30'], ['14:30', '19:00']]);
});

test('No se puede eludir el cierre al solicitar ni reprogramar un turno', async () => {
  assert.equal((await anonimo.pedir('POST', '/api/publico/taller-modelo/turnos', { nombre: 'Caso ficticio', telefono: '2622600000', fecha: dia, hora: '13:30', acepta: true })).estado, 400);
  const r = await recepcion.post('/api/turnos', { nombre: 'Caso ficticio', telefono: '2622600000', inicio: `${dia}T10:00`, duracion: 30 });
  const turno = (await recepcion.get(`/api/agenda?desde=${dia}&hasta=${dia}`)).turnos.find((t) => t.id === r.id);
  assert.equal((await recepcion.pedir('POST', `/api/turnos/${r.id}/confirmar`, { version: turno.version, inicio: `${dia}T13:45` })).estado, 400);
  for (const duracion of [-15, 0, 12.5, 600]) {
    assert.equal((await recepcion.pedir('POST', `/api/turnos/${r.id}/confirmar`, { version: turno.version, duracion })).estado, 400, String(duracion));
  }
});

test('La configuración valida horas y pausas; cambiar un dato conserva el cierre', async () => {
  for (const cambios of [{ desde: '25:00' }, { pausaDesde: '13:30', pausaHasta: '' }, { pausaDesde: '07:00' }, { pausaHasta: '13:00' }, { dias: [1.5] }]) {
    assert.throws(() => normalizarAgenda({ ...agenda, ...cambios }));
  }
  await configurar({ agenda: { paso: 30 } });
  assert.equal((await dueno.get('/api/taller')).agenda.pausaDesde, '13:30');
  await configurar({ agenda: { pausaDesde: '', pausaHasta: '' } });
  const horarios = await anonimo.get(`/api/publico/taller-modelo/turnos?fecha=${dia}`);
  assert.ok(horarios.horarios.some((h) => h.hora === '13:30'), 'sin pausa se mantiene el funcionamiento anterior');
});

test('Dos respaldos seguidos tienen carpetas propias y recuperan solo archivos registrados', async () => {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'talleres-cierre-respaldo-'));
  try {
    fs.writeFileSync(path.join(e.dir, 'archivos', 'archivo-huerfano.txt'), 'No pertenece a la base');
    const opciones = { archivoBase: path.join(e.dir, 'talleres.db'), carpetaArchivos: path.join(e.dir, 'archivos'), destino };
    const uno = await crearRespaldo(opciones);
    const dos = await crearRespaldo(opciones);
    assert.notEqual(uno.dir, dos.dir);
    assert.ok(!uno.manifiesto.archivos.some((a) => a.ruta === 'archivo-huerfano.txt'));
    assert.ok(uno.manifiesto.archivos.length > 0);
    assert.equal(restaurarRespaldo({ respaldo: uno.dir, destinoDatos: path.join(destino, 'restaurada') }).ok, true);
  } finally { fs.rmSync(destino, { recursive: true, force: true }); }
});

test('Estado del respaldo no cuenta copias incompletas y avisa si la copia es antigua', async () => {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'talleres-estado-respaldo-'));
  try {
    assert.deepEqual(estadoRespaldo(destino), { ultimaCopia: null, reciente: false });
    fs.mkdirSync(path.join(destino, 'respaldo-2099-01-01T00-00-00-incompleto'));
    const r = await crearRespaldo({ archivoBase: path.join(e.dir, 'talleres.db'), carpetaArchivos: path.join(e.dir, 'archivos'), destino });
    assert.equal(estadoRespaldo(destino).reciente, true);
    const vieja = { ...r.manifiesto, creado: new Date(Date.now() - 48 * 3600e3).toISOString() };
    fs.writeFileSync(path.join(r.dir, 'manifiesto.json'), JSON.stringify(vieja));
    assert.equal(estadoRespaldo(destino).reciente, false);
    assert.equal(estadoRespaldo(destino).ultimaCopia, vieja.creado);
    assert.equal((await recepcion.pedir('GET', '/api/respaldos/estado')).estado, 403);
    assert.equal((await dueno.pedir('GET', '/api/respaldos/estado')).estado, 200);
  } finally { fs.rmSync(destino, { recursive: true, force: true }); }
});

test('Una visita puede anularse después de compensar todos sus movimientos, conservando el historial', async () => {
  let { visita: v } = await recepcion.recibir({ vehiculo: { patente: 'CIERRE01' }, contacto: { nombre: 'Prueba ficticia' }, tipo: 'service', motivo: 'Prueba de cierre', sinKm: true, autorizacion: { persona: 'Prueba', importe: '1000', canal: 'presencial' } });
  for (const l of v.presupuesto.lineas) await dueno.post(`/api/visitas/${v.id}/lineas/${l.id}/realizado`, {});
  await dueno.post(`/api/visitas/${v.id}/control`, { resultado: 'resuelto', como: 'Comprobación ficticia' });
  await recepcion.post(`/api/visitas/${v.id}/liquidar`, {});
  ({ visita: v } = await recepcion.post(`/api/visitas/${v.id}/pagos`, { importe: '1000', medio: 'efectivo' }));
  assert.equal((await dueno.pedir('POST', `/api/visitas/${v.id}/anular`, { motivo: 'Prueba terminada' })).estado, 400);
  const pago = v.cuenta.find((m) => m.tipo === 'pago');
  const cargo = v.cuenta.find((m) => m.tipo === 'cargo');
  await dueno.post(`/api/movimientos/${pago.id}/anular`, { motivo: 'Prueba terminada' });
  assert.equal((await dueno.pedir('POST', `/api/visitas/${v.id}/anular`, { motivo: 'Prueba terminada' })).estado, 400, 'el cargo sigue vigente');
  await dueno.post(`/api/movimientos/${cargo.id}/anular`, { motivo: 'Prueba terminada' });
  const r = await dueno.post(`/api/visitas/${v.id}/anular`, { motivo: 'Prueba terminada, no es una operación real' });
  assert.ok(r.visita.anulada_at);
  assert.equal(r.visita.totales.saldo, 0);
  assert.equal(r.visita.cuenta.length, 4);
  assert.ok(!(await dueno.get('/api/hoy')).presentes.some((x) => x.id === v.id));
});
