// Servicio de Growth Labs: panel central protegido, altas retomables, planes y límites en servidor,
// suscripción por fechas (reproducible con reloj fijo), conciliación manual idempotente y registro.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { crearAdmin } from '../server/admin.js';
import { evaluarVencimientos } from '../server/planes.js';
import { transaccion, uno, todos } from '../server/db.js';

let e, panel, dueno, norte, anonimo, idModelo, idNorte;
const CLAVE_PANEL = 'frase de prueba del panel 2026';
before(async () => {
  e = await levantar();
  [dueno, norte, anonimo] = await Promise.all(['dueno', 'norte', null].map(e.cliente));
  crearAdmin(e.servidor.db, { nombre: 'Admin de prueba', email: 'admin@growthlabs.test', clave: CLAVE_PANEL });
  panel = await e.cliente();
  await panel.post('/api/plataforma/ingresar', { email: 'admin@growthlabs.test', clave: CLAVE_PANEL });
  idModelo = (await dueno.get('/api/sesion')).taller.id;
  idNorte = (await norte.get('/api/sesion')).taller.id;
});
after(async () => { delete process.env.TALLERES_RELOJ; await e.cerrar(); });

const reloj = (fecha) => { process.env.TALLERES_RELOJ = `${fecha}T15:00:00Z`; };
const suscripcion = async (id) => (await panel.get(`/api/plataforma/talleres/${id}`)).suscripcion;
async function cambiar(id, cambios) {
  const s = await suscripcion(id);
  return panel.pedir('PUT', `/api/plataforma/talleres/${id}/suscripcion`, { version: s.version, motivo: 'Prueba automática', ...cambios });
}
const planId = async (clave) => (await panel.get('/api/plataforma/planes')).planes.find((p) => p.clave === clave).id;

test('Panel: sin sesión de Growth Labs no se accede; la sesión de un dueño de taller tampoco sirve', async () => {
  const rutas = [['GET', '/api/plataforma/talleres'], ['GET', `/api/plataforma/talleres/${idNorte}`], ['GET', '/api/plataforma/registro'],
    ['POST', '/api/plataforma/talleres', { slug: 'tomado', nombre: 'X', duenoNombre: 'X', duenoEmail: 'x@x.test' }],
    ['PUT', `/api/plataforma/talleres/${idNorte}/suscripcion`, { version: 1, motivo: 'x', estado: 'suspendida' }],
    ['POST', `/api/plataforma/talleres/${idNorte}/pagos`, { importe: '1', medio: 'x', referencia: 'x', periodoDesde: '2030-01-01', periodoHasta: '2030-01-31' }]];
  for (const [m, ruta, cuerpo] of rutas) {
    assert.equal((await anonimo.pedir(m, ruta, cuerpo)).estado, 401, `anónimo ${m} ${ruta}`);
    assert.equal((await dueno.pedir(m, ruta, cuerpo)).estado, 401, `dueño de taller ${m} ${ruta}`);
  }
  assert.equal((await panel.pedir('POST', '/api/plataforma/ingresar', { email: 'admin@growthlabs.test', clave: 'incorrecta' })).estado, 401);
  assert.equal((await panel.pedir('POST', '/api/plataforma/ingresar', { email: 'dueno@taller-modelo.test', clave: 'prueba-taller-2026' })).estado, 401, 'un usuario de taller no ingresa al panel');
  // El panel solo muestra datos del servicio.
  const lista = await panel.get('/api/plataforma/talleres');
  assert.ok(lista.talleres.some((t) => t.id === idModelo) && lista.talleres.some((t) => t.id === idNorte));
  assert.doesNotMatch(JSON.stringify(await panel.get(`/api/plataforma/talleres/${idModelo}`)), /patente|telefono|contacto_|importe_total/i);
});

test('Alta: crea el espacio con su plan, se puede retomar y la invitación anterior deja de servir', async () => {
  const alta = await panel.post('/api/plataforma/talleres', { slug: 'taller-sur', nombre: 'Taller Sur (ficticio)', duenoNombre: 'Responsable Sur', duenoEmail: 'sur@taller-sur.test', plan: 'esencial' });
  assert.match(alta.enlace, /^\/acceso\.html#[\w-]{20,}$/);
  let fila = (await panel.get('/api/plataforma/talleres?q=sur')).talleres.find((t) => t.id === alta.id);
  assert.equal(fila.altaIncompleta, true);
  assert.equal(fila.servicio.plan.clave, 'esencial');
  assert.equal(fila.servicio.estado, 'prueba');
  assert.equal((await panel.pedir('POST', '/api/plataforma/talleres', { slug: 'taller-sur', nombre: 'Otro', duenoNombre: 'X', duenoEmail: 'otro@sur.test' })).estado, 400, 'identificador repetido');
  const nueva = await panel.post(`/api/plataforma/talleres/${alta.id}/invitacion`, {});
  const tokenViejo = alta.enlace.split('#')[1], tokenNuevo = nueva.enlace.split('#')[1];
  assert.equal((await anonimo.pedir('GET', `/api/acceso/${tokenViejo}`)).estado, 410, 'la invitación anterior quedó anulada');
  await anonimo.post(`/api/acceso/${tokenNuevo}`, { clave: 'frase larga del responsable sur' });
  fila = (await panel.get('/api/plataforma/talleres?q=sur')).talleres.find((t) => t.id === alta.id);
  assert.equal(fila.altaIncompleta, false);
  assert.equal((await panel.pedir('POST', `/api/plataforma/talleres/${alta.id}/invitacion`, {})).estado, 400, 'alta completa: no se reinvita');
  // El registro conserva autor y acción, nunca el enlace.
  const reg = (await panel.get(`/api/plataforma/talleres/${alta.id}`)).registro;
  assert.ok(reg.some((r) => r.accion === 'Alta de taller e invitación al responsable' && r.por === 'Admin de prueba'));
  assert.ok(!JSON.stringify(reg).includes(tokenNuevo) && !JSON.stringify(reg).includes(tokenViejo));
});

test('Plan: un módulo no contratado no se usa ni por API; lo cargado se conserva y vuelve al cambiar de plan', async () => {
  const articulosAntes = (await dueno.get('/api/articulos')).articulos.length;
  const doc = await dueno.post('/api/documentos', { tipo: 'presupuesto', refTipo: 'visita', refId: (await dueno.get('/api/hoy')).presentes[0].id });
  const contenidoDoc = JSON.stringify((await dueno.get(`/api/documentos/${doc.id}`)).documento.contenido);
  assert.equal((await cambiar(idModelo, { planId: await planId('esencial') })).estado, 200);

  const proveedor = await dueno.pedir('POST', '/api/proveedores', { nombre: 'Proveedor sin plan' });
  assert.equal(proveedor.estado, 403);
  assert.equal(proveedor.datos.motivo, 'plan');
  assert.equal((await dueno.pedir('POST', '/api/ventas', { lineas: [] })).estado, 403);
  assert.equal((await dueno.get('/api/articulos')).articulos.length, articulosAntes, 'el stock cargado se sigue consultando');
  assert.equal((await dueno.pedir('GET', '/api/reportes')).estado, 403);
  assert.equal((await dueno.pedir('GET', '/api/cuentas')).estado, 403);
  assert.equal((await dueno.pedir('GET', '/api/exportar')).estado, 200, 'exportar siempre está disponible');
  const servicio = (await dueno.get('/api/sesion')).taller.servicio;
  assert.equal(servicio.modulos.stock, false);
  assert.equal(JSON.stringify((await dueno.get(`/api/documentos/${doc.id}`)).documento.contenido), contenidoDoc, 'cambiar de plan no altera documentos');

  assert.equal((await cambiar(idModelo, { planId: await planId('profesional') })).estado, 200);
  assert.equal((await dueno.pedir('POST', '/api/proveedores', { nombre: 'Proveedor con plan' })).estado, 200);
  assert.equal((await dueno.get('/api/articulos')).articulos.length, articulosAntes);
});

test('Límites: con más usuarios que el plan nadie pierde el acceso, y altas simultáneas no superan el cupo', async () => {
  await cambiar(idModelo, { planId: await planId('esencial') }); // 3 usuarios activos; el taller tiene 4
  const lleno = await dueno.pedir('POST', '/api/usuarios', { nombre: 'Quinta persona', email: 'quinta@taller-modelo.test', rol: 'mecanico' });
  assert.equal(lleno.estado, 403);
  assert.equal(lleno.datos.motivo, 'limite');
  assert.match(lleno.datos.error, /No se borra a nadie/);
  const marcos = await e.cliente('marcos');
  assert.equal((await marcos.pedir('GET', '/api/hoy')).estado, 200, 'los usuarios que ya estaban siguen entrando');

  // Se liberan dos lugares (quedan 2 de 3) y llegan tres invitaciones a la vez: entra una sola.
  const usuarios = (await dueno.get('/api/usuarios')).usuarios.filter((u) => u.rol === 'mecanico');
  for (const u of usuarios) await dueno.put(`/api/usuarios/${u.id}`, { version: u.version, activo: false });
  const intentos = await Promise.all([1, 2, 3].map((i) => dueno.pedir('POST', '/api/usuarios', { nombre: `Simultánea ${i}`, email: `simultanea${i}@taller-modelo.test`, rol: 'recepcion' })));
  assert.deepEqual(intentos.map((r) => r.estado).sort(), [200, 403, 403]);
  assert.equal(uno(e.servidor.db, 'SELECT COUNT(*) AS n FROM usuarios WHERE taller_id = ? AND activo = 1', idModelo).n, 3);
  // Reactivar también respeta el cupo.
  const u = (await dueno.get('/api/usuarios')).usuarios.find((x) => x.id === usuarios[0].id);
  assert.equal((await dueno.pedir('PUT', `/api/usuarios/${u.id}`, { version: u.version, activo: true })).estado, 403);
  await cambiar(idModelo, { planId: await planId('profesional') });
});

test('Suscripción: vigencia, gracia, suspensión y cancelación por fecha, con lectura y exportación conservadas', async () => {
  await cambiar(idNorte, { estado: 'activa', periodoDesde: '2030-01-01', periodoHasta: '2030-01-31', graciaHasta: '2030-02-07' });
  try {
    reloj('2030-01-31');
    assert.equal((await norte.get('/api/sesion')).taller.servicio.estado, 'activa');
    assert.equal((await norte.pedir('POST', '/api/proveedores', { nombre: 'Último día' })).estado, 200);
    reloj('2030-02-03');
    assert.equal((await norte.get('/api/sesion')).taller.servicio.estado, 'vencida');
    assert.equal((await norte.pedir('POST', '/api/proveedores', { nombre: 'En gracia' })).estado, 200, 'la gracia mantiene el acceso');
    reloj('2030-02-08');
    const s = (await norte.get('/api/sesion')).taller.servicio;
    assert.equal(s.estado, 'suspendida');
    assert.equal(s.soloLectura, true);
    const bloqueado = await norte.pedir('POST', '/api/proveedores', { nombre: 'Suspendido' });
    assert.equal(bloqueado.estado, 403);
    assert.equal(bloqueado.datos.motivo, 'suscripcion');
    assert.equal((await norte.pedir('GET', '/api/proveedores')).estado, 200, 'consultar sigue disponible');
    assert.ok((await norte.get('/api/exportar')).proveedores.some((p) => p.nombre === 'En gracia'), 'exportar sigue disponible y no se perdió nada');
    assert.equal((await dueno.pedir('POST', '/api/proveedores', { nombre: 'El otro taller sigue' })).estado, 200, 'solo afecta a su taller');

    // El proceso periódico guarda el cambio una sola vez, aunque corra dos veces.
    const primera = transaccion(e.servidor.db, () => evaluarVencimientos(e.servidor.db, '2030-02-08'));
    const segunda = transaccion(e.servidor.db, () => evaluarVencimientos(e.servidor.db, '2030-02-08'));
    assert.deepEqual(primera.filter((c) => c.tallerId === idNorte), [{ tallerId: idNorte, de: 'activa', a: 'suspendida' }]);
    assert.equal(segunda.filter((c) => c.tallerId === idNorte).length, 0);
    assert.equal(todos(e.servidor.db, "SELECT * FROM plataforma_auditoria WHERE taller_id = ? AND admin_id IS NULL AND accion LIKE 'Suscripción:%'", idNorte).length, 1);

    // Conciliación manual: reactiva y extiende; repetir el envío no duplica.
    const cajaAntes = uno(e.servidor.db, 'SELECT COUNT(*) AS n FROM cuenta_movimientos WHERE taller_id = ?', idNorte).n;
    const pago = { importe: '1000', medio: 'transferencia', referencia: 'OP-0001-prueba', periodoDesde: '2030-02-01', periodoHasta: '2030-02-28' };
    const r1 = await panel.post(`/api/plataforma/talleres/${idNorte}/pagos`, pago, { idempotencia: 'pago-norte-febrero' });
    assert.equal(r1.servicio.estado, 'activa');
    assert.equal(r1.servicio.periodoHasta, '2030-02-28');
    const r2 = await panel.post(`/api/plataforma/talleres/${idNorte}/pagos`, pago, { idempotencia: 'pago-norte-febrero' });
    assert.equal(r2.repetido, true);
    assert.equal((await panel.pedir('POST', `/api/plataforma/talleres/${idNorte}/pagos`, { ...pago, importe: '2000' }, { idempotencia: 'pago-norte-febrero' })).estado, 409);
    assert.equal((await panel.pedir('POST', `/api/plataforma/talleres/${idNorte}/pagos`, pago, { idempotencia: 'otra-clave' })).estado, 400, 'misma referencia');
    assert.equal(uno(e.servidor.db, 'SELECT COUNT(*) AS n FROM pagos_suscripcion WHERE taller_id = ?', idNorte).n, 1);
    // Un pago atrasado de un período anterior no acorta la vigencia.
    const viejo = await panel.post(`/api/plataforma/talleres/${idNorte}/pagos`, { ...pago, referencia: 'OP-0000-enero', periodoDesde: '2030-01-01', periodoHasta: '2030-01-31' }, { idempotencia: 'pago-norte-enero' });
    assert.equal(viejo.servicio.periodoHasta, '2030-02-28');
    assert.equal((await norte.pedir('POST', '/api/proveedores', { nombre: 'Reactivado' })).estado, 200);
    assert.equal(uno(e.servidor.db, 'SELECT COUNT(*) AS n FROM cuenta_movimientos WHERE taller_id = ?', idNorte).n, cajaAntes, 'la suscripción no toca la caja del taller');

    // Cancelación al cierre: acceso hasta el último día pagado, después solo lectura.
    await cambiar(idNorte, { cancelaAlCierre: true });
    reloj('2030-02-28');
    assert.equal((await norte.get('/api/sesion')).taller.servicio.estado, 'activa');
    reloj('2030-03-01');
    assert.equal((await norte.get('/api/sesion')).taller.servicio.estado, 'cancelada');
    assert.equal((await norte.pedir('POST', '/api/proveedores', { nombre: 'Cancelado' })).estado, 403);
    assert.equal((await norte.pedir('POST', '/api/sesion/salir-todas', {})).estado, 200, 'cerrar sesión siempre se puede');
  } finally {
    delete process.env.TALLERES_RELOJ;
  }
});

test('Suscripción: los cambios administrativos exigen motivo, fechas coherentes y versión vigente, y quedan con autor', async () => {
  const s = await suscripcion(idModelo);
  const sinMotivo = await panel.pedir('PUT', `/api/plataforma/talleres/${idModelo}/suscripcion`, { version: s.version, estado: 'suspendida' });
  assert.equal(sinMotivo.estado, 400);
  assert.equal(sinMotivo.datos.campo, 'motivo');
  assert.equal((await cambiar(idModelo, { periodoHasta: '2030-05-31', graciaHasta: '2030-05-01' })).datos.campo, 'graciaHasta');
  assert.equal((await cambiar(idModelo, { estado: 'inventado' })).estado, 400);
  assert.equal((await panel.pedir('PUT', `/api/plataforma/talleres/${idModelo}/suscripcion`, { version: s.version - 1, motivo: 'x', estado: 'activa' })).estado, 409);
  assert.equal((await cambiar(idModelo, { modalidad: 'transferencia' })).estado, 200);
  const reg = (await panel.get(`/api/plataforma/talleres/${idModelo}`)).registro;
  assert.ok(reg.some((r) => r.accion === 'Suscripción modificada' && /modalidad: sin_cargo → transferencia|modalidad: manual → transferencia/.test(r.detalle) && r.por === 'Admin de prueba'));
});
