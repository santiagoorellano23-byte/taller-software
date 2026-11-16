// Mi plan: el taller ve su servicio de Growth Labs y pide renovar; pedir no habilita nada.
// Solo Growth Labs, al confirmar la acreditación, extiende el período. Plan ≠ permiso; un taller no toca a otro.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { crearAdmin } from '../server/admin.js';
import { finDePeriodo, periodoRenovacion } from '../server/planes.js';
import { uno } from '../server/db.js';

let e, panel, dueno, recepcion, marcos, norte, idModelo, idNorte;
const CLAVE_PANEL = 'frase de prueba del panel 2026';
const reloj = (fecha) => { process.env.TALLERES_RELOJ = `${fecha}T15:00:00Z`; };
before(async () => {
  e = await levantar();
  [dueno, recepcion, marcos, norte] = await Promise.all(['dueno', 'recepcion', 'marcos', 'norte'].map(e.cliente));
  crearAdmin(e.servidor.db, { nombre: 'Admin de prueba', email: 'admin@growthlabs.test', clave: CLAVE_PANEL });
  panel = await e.cliente();
  await panel.post('/api/plataforma/ingresar', { email: 'admin@growthlabs.test', clave: CLAVE_PANEL });
  idModelo = (await dueno.get('/api/sesion')).taller.id;
  idNorte = (await norte.get('/api/sesion')).taller.id;
});
after(async () => { delete process.env.TALLERES_RELOJ; await e.cerrar(); });

async function fijar(id, cambios) {
  const s = (await panel.get(`/api/plataforma/talleres/${id}`)).suscripcion;
  return panel.put(`/api/plataforma/talleres/${id}/suscripcion`, { version: s.version, motivo: 'Prueba automática', ...cambios });
}

test('Períodos: meses calendario con fecha exacta, no 30 días; renovar antes conserva los días pagados', () => {
  assert.equal(finDePeriodo('2026-11-17', 1), '2026-12-16');
  assert.equal(finDePeriodo('2026-12-01', 1), '2026-12-31');
  assert.equal(finDePeriodo('2026-02-01', 1), '2026-02-28', 'febrero tiene 28 días, no 30');
  assert.equal(finDePeriodo('2027-01-31', 1), '2027-02-28', 'el mes siguiente no tiene día 31');
  assert.equal(finDePeriodo('2027-01-28', 1), '2027-02-27');
  assert.equal(finDePeriodo('2026-11-17', 12), '2027-11-16');
  // Quedan días: el período nuevo empieza al día siguiente del vencimiento.
  assert.deepEqual(periodoRenovacion({ periodo_hasta: '2030-03-10' }, 1, '2030-03-01'), { desde: '2030-03-11', hasta: '2030-04-10' });
  // Ya venció: empieza hoy.
  assert.deepEqual(periodoRenovacion({ periodo_hasta: '2030-03-10' }, 1, '2030-03-20'), { desde: '2030-03-20', hasta: '2030-04-19' });
});

test('Mi plan: solo quien administra el taller lo ve y lo pide; mecánico y recepción no', async () => {
  for (const c of [marcos, recepcion]) {
    assert.equal((await c.pedir('GET', '/api/plan')).estado, 403);
    assert.equal((await c.pedir('POST', '/api/plan/solicitudes', { tipo: 'renovacion', meses: 1 })).estado, 403);
  }
  const p = await dueno.get('/api/plan');
  assert.equal(p.renovacionAutomatica, false, 'no hay débito automático');
  assert.deepEqual(p.opciones.map((o) => o.meses), [1]);
  assert.ok(p.servicio.plan && p.planes.length >= 2);
  assert.ok(!('movimientos' in p) && !JSON.stringify(p).match(/cuenta_movimientos|patente/), 'no mezcla los cobros del taller');
});

test('Pedir renovación no habilita: queda pendiente; Growth Labs confirma el pago y recién ahí se extiende', async () => {
  reloj('2030-05-10');
  try {
    await fijar(idModelo, { estado: 'activa', periodoDesde: '2030-04-21', periodoHasta: '2030-05-20', graciaHasta: '' });
    const antes = await dueno.get('/api/plan');
    assert.equal(antes.servicio.diasRestantes, 10);
    assert.deepEqual([antes.opciones[0].desde, antes.opciones[0].hasta], ['2030-05-21', '2030-06-20']);

    const r = await dueno.post('/api/plan/solicitudes', { tipo: 'renovacion', meses: 1, avisoPago: 'OP 123 (dato del taller)' });
    assert.equal(r.estado, 'pendiente');
    assert.equal(r.plan.servicio.periodoHasta, '2030-05-20', 'avisar «ya pagué» no cambia el período');
    assert.equal((await dueno.pedir('POST', '/api/plan/solicitudes', { tipo: 'renovacion', meses: 1 })).estado, 409, 'una sola pendiente');
    assert.equal((await dueno.pedir('POST', '/api/plan/solicitudes', { tipo: 'renovacion', meses: 7 })).estado, 400, 'solo períodos configurados');
    assert.equal((await dueno.pedir('POST', '/api/plan/solicitudes', { tipo: 'renovacion', meses: '0' })).estado, 400);

    // Otro taller no ve ni anula la solicitud por identificador.
    assert.equal((await norte.pedir('POST', `/api/plan/solicitudes/${r.id}/anular`, {})).estado, 400);
    assert.ok(!(await norte.get('/api/plan')).solicitudes.some((q) => q.id === r.id));
    // Un pago de otro taller no puede confirmar esta solicitud.
    const ajeno = await panel.pedir('POST', `/api/plataforma/talleres/${idNorte}/pagos`,
      { importe: '1000', medio: 'transferencia', referencia: 'OP-AJENA', periodoDesde: '2030-05-21', periodoHasta: '2030-06-20', solicitudId: r.id }, { idempotencia: 'pago-ajeno' });
    assert.equal(ajeno.estado, 400);
    assert.equal(uno(e.servidor.db, 'SELECT COUNT(*) AS n FROM pagos_suscripcion WHERE referencia = ?', 'OP-AJENA').n, 0, 'nada se registra');

    // Growth Labs confirma la acreditación con el período de la solicitud.
    const ok = await panel.post(`/api/plataforma/talleres/${idModelo}/pagos`,
      { importe: '1000', medio: 'transferencia', referencia: 'OP-MI-PLAN-1', periodoDesde: '2030-05-21', periodoHasta: '2030-06-20', solicitudId: r.id }, { idempotencia: 'pago-mi-plan-1' });
    assert.equal(ok.servicio.periodoHasta, '2030-06-20', 'conserva los 10 días que quedaban');
    const despues = await dueno.get('/api/plan');
    assert.equal(despues.solicitudes.find((q) => q.id === r.id).estado, 'confirmada');
    assert.ok(despues.pagos.some((p) => p.referencia === 'OP-MI-PLAN-1'));
    assert.equal((await dueno.pedir('POST', `/api/plan/solicitudes/${r.id}/anular`, {})).estado, 409, 'ya resuelta');
  } finally { delete process.env.TALLERES_RELOJ; }
});

test('Vencido y suspendido: puede pedir la renovación, no operar; rechazar no habilita', async () => {
  reloj('2030-08-01');
  try {
    await fijar(idNorte, { estado: 'activa', periodoDesde: '2030-06-01', periodoHasta: '2030-06-30', graciaHasta: '' });
    const s = (await norte.get('/api/sesion')).taller.servicio;
    assert.equal(s.estado, 'suspendida');
    assert.equal((await norte.pedir('POST', '/api/proveedores', { nombre: 'Suspendido' })).estado, 403);
    const q = await norte.post('/api/plan/solicitudes', { tipo: 'renovacion', meses: 1 });
    const pendiente = (await norte.get('/api/plan')).solicitudes.find((x) => x.id === q.id);
    assert.deepEqual([pendiente.periodo_desde, pendiente.periodo_hasta], ['2030-08-01', '2030-08-31'], 'vencido: empieza hoy');
    assert.equal((await norte.get('/api/sesion')).taller.servicio.estado, 'suspendida', 'sigue suspendido hasta la confirmación');
    // Un taller no puede rechazar ni confirmar: esas rutas son del panel.
    assert.equal((await norte.pedir('POST', `/api/plataforma/talleres/${idNorte}/solicitudes/${q.id}/rechazar`, { motivo: 'x' })).estado, 401);
    assert.equal((await panel.pedir('POST', `/api/plataforma/talleres/${idNorte}/solicitudes/${q.id}/rechazar`, {})).estado, 400, 'exige motivo');
    await panel.post(`/api/plataforma/talleres/${idNorte}/solicitudes/${q.id}/rechazar`, { motivo: 'No encontramos la transferencia.' });
    const p = await norte.get('/api/plan');
    assert.equal(p.solicitudes.find((x) => x.id === q.id).estado, 'rechazada');
    assert.equal(p.servicio.estado, 'suspendida');
    // Puede pedir de nuevo y anularla él mismo.
    const q2 = await norte.post('/api/plan/solicitudes', { tipo: 'renovacion', meses: 1 });
    await norte.post(`/api/plan/solicitudes/${q2.id}/anular`, {});
    assert.equal((await norte.get('/api/plan')).solicitudes.find((x) => x.id === q2.id).estado, 'anulada');
  } finally { delete process.env.TALLERES_RELOJ; }
});
