// Cambiar precios del catálogo no altera presupuestos ni documentos ya preparados: las líneas copian el precio.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';

let e, dueno;
before(async () => { e = await levantar(); dueno = await e.cliente('dueno'); });
after(async () => { await e.cerrar(); });

test('Catálogo: subir el precio de un servicio no cambia presupuestos ni documentos anteriores', async () => {
  await dueno.post('/api/catalogos/servicios', { nombre: 'Alineación (prueba)', duracion: 60, precio: '5000' });
  const servicio = (await dueno.get('/api/catalogos')).servicios.find((s) => s.nombre === 'Alineación (prueba)');
  const visita = (await dueno.get('/api/hoy')).presentes.find((v) => !v.entregada_at);
  const { visita: v } = await dueno.post(`/api/visitas/${visita.id}/presupuesto`, { lineas: [{ tipo: 'mano_obra', descripcion: servicio.nombre, precio: String(servicio.precio / 100) }] });
  const linea = v.presupuesto.lineas.find((l) => l.descripcion === 'Alineación (prueba)');
  assert.equal(linea.precio_unit, 500000);
  const doc = await dueno.post('/api/documentos', { tipo: 'presupuesto', refTipo: 'visita', refId: visita.id });
  const antes = JSON.stringify((await dueno.get(`/api/documentos/${doc.id}`)).documento.contenido);

  await dueno.post('/api/catalogos/servicios', { id: servicio.id, nombre: servicio.nombre, duracion: 60, precio: '9000' });
  assert.equal((await dueno.get('/api/catalogos')).servicios.find((s) => s.id === servicio.id).precio, 900000);
  const despues = (await dueno.get(`/api/visitas/${visita.id}`)).visita.presupuesto.lineas.find((l) => l.id === linea.id);
  assert.equal(despues.precio_unit, 500000, 'la línea conserva el precio con que se presupuestó');
  assert.equal(despues.importe, linea.importe);
  assert.equal(JSON.stringify((await dueno.get(`/api/documentos/${doc.id}`)).documento.contenido), antes);
});
