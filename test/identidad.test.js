// Identidad visual por taller: validación en servidor, aislamiento, persistencia, documentos históricos y paletas legibles.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './entorno.js';
import { PALETAS, MARCA_PRODUCTO, tokensApariencia, contraste, cssApariencia, problemaApariencia, CONTRASTE_TEXTO, CONTRASTE_ACENTO } from '../public/js/marca.js';

let e, dueno, recepcion, mecanico, norte;
before(async () => {
  e = await levantar();
  [dueno, recepcion, mecanico, norte] = await Promise.all(['dueno', 'recepcion', 'marcos', 'norte'].map(e.cliente));
});
after(async () => { await e.cerrar(); });

const version = async (c) => (await c.get('/api/taller')).taller.version;
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

test('Paletas sugeridas: el texto de marca se lee en claro y en oscuro, y el rojo de error no depende de la marca', () => {
  for (const p of [MARCA_PRODUCTO, ...PALETAS]) {
    assert.equal(problemaApariencia(p), null, p.nombre || 'producto');
    const { claro, oscuro } = tokensApariencia(p);
    assert.ok(contraste(claro.sobreMarca, claro.marca) >= CONTRASTE_TEXTO, `${p.clave}: botón claro`);
    assert.ok(contraste(oscuro.sobreMarca, oscuro.marca) >= CONTRASTE_TEXTO, `${p.clave}: botón oscuro`);
    assert.ok(contraste(claro.marcaTexto, '#f3f3f2') >= CONTRASTE_TEXTO, `${p.clave}: texto de marca en claro`);
    assert.ok(contraste(oscuro.marcaTexto, '#1d242c') >= CONTRASTE_TEXTO, `${p.clave}: texto de marca en oscuro`);
    assert.ok(contraste(oscuro.acento, '#1d242c') >= CONTRASTE_ACENTO, `${p.clave}: acento en oscuro`);
    assert.doesNotMatch(cssApariencia(p), /--red/, 'la marca nunca redefine el rojo semántico');
  }
  // La hoja generada solo contiene nombres de variable y colores calculados.
  assert.match(cssApariencia({ principal: '#14714a' }, '.vista-previa'), /^[:\w\s.()\-="#;{}[\]]+$/);
});

test('Colores: solo el dueño los cambia y el servidor rechaza valores ilegibles o que no son un color', async () => {
  const v = await version(dueno);
  assert.equal((await mecanico.pedir('PUT', '/api/taller/apariencia', { version: v, principal: '#14714a' })).estado, 403);
  assert.equal((await recepcion.pedir('PUT', '/api/taller/apariencia', { version: v, principal: '#14714a' })).estado, 403);
  for (const [principal, acento, campo] of [['verde', null, 'principal'], ['#ffff00', null, 'principal'], ['#14714a;}body{display:none', null, 'principal'],
    ['url(javascript:alert(1))', null, 'principal'], ['#14714a', '#fafafa', 'acento'], ['#14714a', 'expression(1)', 'acento']]) {
    const r = await dueno.pedir('PUT', '/api/taller/apariencia', { version: v, principal, acento });
    assert.equal(r.estado, 400, `${principal} / ${acento}`);
    assert.equal(r.datos.campo, campo);
  }
  assert.equal((await dueno.pedir('PUT', '/api/taller/apariencia', { version: v - 1, principal: '#14714a' })).estado, 409, 'versión vieja: no pisa cambios ajenos');
  assert.equal((await dueno.get('/api/sesion')).taller.apariencia.propia, false, 'nada quedó guardado');
});

test('Colores: persisten al volver a ingresar, se aplican solo a su taller y quedan en el registro', async () => {
  const r = await dueno.put('/api/taller/apariencia', { version: await version(dueno), principal: '#14714A', acento: '#1f9d63' });
  assert.deepEqual(r.apariencia, { principal: '#14714a', acento: '#1f9d63', propia: true });
  const nueva = await e.cliente('recepcion');
  assert.deepEqual((await nueva.get('/api/sesion')).taller.apariencia, r.apariencia, 'otra sesión del mismo taller ve los colores guardados');
  assert.deepEqual((await norte.get('/api/sesion')).taller.apariencia, { ...MARCA_PRODUCTO, propia: false }, 'el otro taller conserva los suyos');
  const reg = (await dueno.get('/api/auditoria')).acciones;
  assert.ok(reg.some((a) => a.accion === 'Colores del taller actualizados' && /#2e3bff → #14714a/.test(a.detalle) && a.por));

  // Tres talleres con tres paletas distintas a la vez.
  await norte.put('/api/taller/apariencia', { version: await version(norte), principal: '#b5400c', acento: '#e0662a' });
  assert.equal((await norte.get('/api/sesion')).taller.apariencia.principal, '#b5400c');
  assert.equal((await dueno.get('/api/sesion')).taller.apariencia.principal, '#14714a');
});

test('Documentos: los emitidos conservan los colores de su fecha; los nuevos usan los actuales', async () => {
  const visita = (await dueno.get('/api/hoy')).presentes[0];
  const antes = await dueno.post('/api/documentos', { tipo: 'presupuesto', refTipo: 'visita', refId: visita.id });
  const colorAntes = (await dueno.get(`/api/documentos/${antes.id}`)).documento.contenido.taller.color;
  assert.equal(colorAntes, (await dueno.get('/api/sesion')).taller.apariencia.principal);
  await dueno.put('/api/taller/apariencia', { version: await version(dueno), principal: '#0e6470', acento: '#13a3b5' });
  assert.equal((await dueno.get(`/api/documentos/${antes.id}`)).documento.contenido.taller.color, colorAntes, 'el documento emitido no cambió');
  const despues = await dueno.post('/api/documentos', { tipo: 'presupuesto', refTipo: 'visita', refId: visita.id });
  assert.equal((await dueno.get(`/api/documentos/${despues.id}`)).documento.contenido.taller.color, '#0e6470');
  // Un documento sin color copiado (emitido antes de esta función) conserva el rojo con que se emitió.
  const { renderDocumento } = await import('../public/js/documento.js');
  assert.match(renderDocumento({ titulo: 'x', taller: { nombre: 'Viejo' } }), /border-bottom-color:#AE040F/);
  assert.match(renderDocumento({ titulo: 'x', taller: { nombre: 'Nuevo', color: '#0e6470' } }), /border-bottom-color:#0e6470/);
  assert.match(renderDocumento({ titulo: 'x', taller: { nombre: 'Malo', color: 'red;}*{' } }), /border-bottom-color:#AE040F/, 'un color alterado no se inyecta');
});

test('Restaurar: vuelve a la marca del producto sin tocar los demás datos del taller', async () => {
  const antes = (await dueno.get('/api/taller')).taller;
  const r = await dueno.put('/api/taller/apariencia', { version: antes.version, restaurar: true });
  assert.deepEqual(r.apariencia, { ...MARCA_PRODUCTO, propia: false });
  const despues = (await dueno.get('/api/taller')).taller;
  assert.equal(despues.nombre, antes.nombre);
  assert.equal(despues.config.telefono, antes.config.telefono);
  assert.equal(despues.config.logoAdjuntoId, antes.config.logoAdjuntoId);
});

test('Logo: se valida el contenido real del archivo, no solo el tipo declarado; la página pública recibe los colores', async () => {
  const falso = await dueno.pedir('POST', '/api/taller/logo', undefined, { crudo: Buffer.from('<svg onload="alert(1)"></svg>'), cabeceras: { 'Content-Type': 'image/png', 'X-Nombre-Archivo': 'logo.png' } });
  assert.equal(falso.estado, 400);
  assert.equal((await dueno.pedir('POST', '/api/taller/logo', undefined, { crudo: PNG, cabeceras: { 'Content-Type': 'image/png', 'X-Nombre-Archivo': 'logo.png' } })).estado, 200);
  const slug = (await dueno.get('/api/sesion')).taller.slug;
  const anonimo = await e.cliente();
  const pub = await anonimo.get(`/api/publico/${slug}`);
  assert.deepEqual(Object.keys(pub.taller.apariencia).sort(), ['acento', 'principal', 'propia']);
});
