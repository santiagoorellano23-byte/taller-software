// Matriz de aislamiento: un usuario del Taller Modelo no puede relacionar, leer ni exportar datos del Taller Norte
// mandando identificadores ajenos en la solicitud. También roles restringidos y accesos revocados con sesión abierta.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { fotosPrueba } from '../scripts/fotos-prueba.js';

let e, dueno, mecanico, norte, B;
before(async () => {
  e = await levantar();
  [dueno, mecanico, norte] = await Promise.all(['dueno', 'marcos', 'norte'].map(e.cliente));
  // Registros propios del Taller Norte, creados por su dueño.
  const { vehiculos: [vn] } = await norte.get('/api/buscar?q=AE482KJ');
  const contacto = (await norte.get('/api/contactos')).contactos[0];
  const proveedor = await norte.post('/api/proveedores', { nombre: 'Proveedor exclusivo Norte (ficticio)' });
  const articulo = await norte.post('/api/articulos', { nombre: 'Filtro exclusivo Norte', unidad: 'u.' });
  const puesto = await norte.post('/api/catalogos/puestos', { nombre: 'Elevador Norte' });
  const puestos = (await norte.get('/api/catalogos')).puestos;
  const usuarioNorte = (await norte.get('/api/usuarios')).usuarios[0];
  B = { vehiculo: vn.id, contacto: contacto.id, proveedor: proveedor.id, articulo: articulo.id, puesto: puestos.at(-1).id, usuario: usuarioNorte.id };
  assert.ok(puesto && Object.values(B).every(Number.isInteger));
});
after(async () => { await e.cerrar(); });

test('Aislamiento: identificadores de otro taller en el cuerpo de la solicitud se rechazan y no crean relaciones', async () => {
  const visitaA = (await dueno.get('/api/hoy')).presentes[0];
  const ingreso = { tipo: 'revision', motivo: 'Prueba de aislamiento', km: '1000', autorizacion: { persona: 'Cliente ficticio', canal: 'presencial' } };
  const conFotos = async (extra) => ({ ...ingreso, ...extra, estadoIngreso: await fotosPrueba(dueno) });
  const intentos = [
    ['vehículo ajeno al recibir', dueno.pedir('POST', '/api/visitas', await conFotos({ vehiculoId: B.vehiculo }))],
    ['contacto ajeno al recibir', dueno.pedir('POST', '/api/visitas', await conFotos({ vehiculo: { patente: 'ZZ999ZZ' }, contactoId: B.contacto }))],
    ['responsable ajeno al recibir', dueno.pedir('POST', '/api/visitas', await conFotos({ vehiculo: { patente: 'ZZ998ZZ' }, contacto: { nombre: 'Ficticio' }, responsableId: B.usuario }))],
    ['contacto ajeno en una ficha nueva', dueno.pedir('POST', '/api/vehiculos', { patente: 'ZZ997ZZ', contactoId: B.contacto })],
    ['responsable ajeno al editar una orden', dueno.pedir('PUT', `/api/visitas/${visitaA.id}`, { version: (await dueno.get(`/api/visitas/${visitaA.id}`)).visita.version, responsableId: B.usuario })],
    ['artículo ajeno en un repuesto', dueno.pedir('POST', `/api/visitas/${visitaA.id}/repuestos`, { descripcion: 'Filtro', articuloId: B.articulo })],
    ['proveedor ajeno en un repuesto', dueno.pedir('POST', `/api/visitas/${visitaA.id}/repuestos`, { descripcion: 'Filtro', proveedorId: B.proveedor })],
    ['artículo ajeno como producto usado', dueno.pedir('POST', `/api/visitas/${visitaA.id}/productos`, { descripcion: 'Aceite', cantidad: '1', unidad: 'u.', articuloId: B.articulo })],
    ['proveedor ajeno en una compra', dueno.pedir('POST', '/api/compras', { proveedorId: B.proveedor, lineas: [{ descripcion: 'x', cantidad: '1', costo: '10' }] })],
    ['cliente ajeno en una venta', dueno.pedir('POST', '/api/ventas', { contactoId: B.contacto, lineas: [{ descripcion: 'x', cantidad: '1', precio: '10' }] })],
    ['puesto ajeno en un turno', dueno.pedir('POST', '/api/turnos', { nombre: 'Ficticio', telefono: '2600000000', patente: 'ZZ996ZZ', inicio: '2030-01-07T10:00', duracion: 60, puestoId: B.puesto })],
    ['vehículo ajeno en un pendiente', dueno.pedir('POST', '/api/seguimientos', { vehiculoId: B.vehiculo, tipo: 'service', fecha: '2030-01-07', motivo: 'x' })],
    ['ficha ajena por URL', dueno.pedir('GET', `/api/vehiculos/${B.vehiculo}`)],
    ['contacto ajeno por URL', dueno.pedir('POST', `/api/vehiculos/${B.vehiculo}/contacto`, { motivo: 'x', contactoId: B.contacto })]
  ];
  for (const [que, promesa] of intentos) {
    const r = await promesa;
    if (process.env.VER_AISLAMIENTO) console.log(que, r.estado, r.datos?.error);
    assert.equal(r.estado, 404, `${que}: respondió ${r.estado} ${JSON.stringify(r.datos).slice(0, 160)}`);
  }
  // Nada de lo intentado quedó asociado a registros del otro taller.
  const exp = await dueno.get('/api/exportar');
  const idsVehiculos = exp.vehiculos.map((v) => v.id), idsContactos = exp.contactos.map((c) => c.id);
  assert.ok(!idsVehiculos.includes(B.vehiculo) && !idsContactos.includes(B.contacto));
  assert.ok(!exp.articulos.some((a) => a.id === B.articulo) && !exp.proveedores.some((p) => p.id === B.proveedor));
  assert.ok(exp.vehiculos.every((v) => !v.contacto_id || idsContactos.includes(v.contacto_id)), 'ninguna ficha apunta a un contacto ajeno');
  assert.ok(!exp.usuarios.some((u) => u.id === B.usuario));
  for (const tabla of ['visitas', 'repuestos', 'turnos', 'seguimientos', 'compras', 'ventas', 'documentos', 'adjuntos', 'auditoria']) {
    assert.ok(exp[tabla].every((f) => f.taller_id === exp.visitas[0]?.taller_id), `exportación de ${tabla} limitada al propio taller`);
  }
});

test('Aislamiento: el taller lo decide la sesión; un taller_id enviado por el navegador se ignora', async () => {
  const yoNorte = (await norte.get('/api/sesion')).taller.id;
  const { id } = await dueno.post('/api/proveedores', { nombre: 'Proveedor con taller_id inventado', taller_id: yoNorte, tallerId: yoNorte });
  assert.ok((await dueno.get('/api/proveedores')).proveedores.some((p) => p.id === id));
  assert.ok(!(await norte.get('/api/proveedores')).proveedores.some((p) => p.id === id));
  const listaNorte = await norte.get(`/api/proveedores?taller_id=${(await dueno.get('/api/sesion')).taller.id}`);
  assert.ok(!listaNorte.proveedores.some((p) => p.id === id));
});

test('Roles: un mecánico no ejecuta acciones de administración llamando a la API', async () => {
  const { taller } = await dueno.get('/api/taller');
  const acciones = [
    ['PUT', '/api/taller', { version: taller.version, nombre: 'Tomado' }],
    ['POST', '/api/usuarios', { nombre: 'X', email: 'x@taller-modelo.test', rol: 'dueno' }],
    ['GET', '/api/exportar'],
    ['GET', '/api/auditoria'],
    ['GET', '/api/taller'],
    ['POST', '/api/catalogos/servicios', { nombre: 'X', duracion: 60 }],
    ['DELETE', '/api/taller/logo']
  ];
  for (const [m, ruta, cuerpo] of acciones) assert.equal((await mecanico.pedir(m, ruta, cuerpo)).estado, 403, `${m} ${ruta}`);
});

test('Acceso revocado: desactivar a una persona corta su sesión abierta e impide volver a ingresar', async () => {
  const julian = await e.cliente('julian');
  assert.equal((await julian.pedir('GET', '/api/hoy')).estado, 200);
  const u = (await dueno.get('/api/usuarios')).usuarios.find((x) => x.email === 'julian@taller-modelo.test');
  await dueno.put(`/api/usuarios/${u.id}`, { version: u.version, activo: false });
  assert.equal((await julian.pedir('GET', '/api/hoy')).estado, 401);
  assert.equal((await julian.pedir('POST', '/api/proveedores', { nombre: 'Después de revocado' })).estado, 401);
  const { USUARIOS_PRUEBA, CLAVE_PRUEBA } = await import('../scripts/seed.js');
  assert.equal((await julian.pedir('POST', '/api/sesion/ingresar', { email: USUARIOS_PRUEBA.julian, clave: CLAVE_PRUEBA })).estado, 401);
});
