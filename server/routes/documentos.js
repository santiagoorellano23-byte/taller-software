// Documentos con marca: se guardan como copia fechada (snapshot). Cambiar precios, datos o logo del taller
// no reescribe documentos ya emitidos. No tienen validez fiscal.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { uno, todos, insertar, ejecutar, siguiente } from '../db.js';
import { exigir, puede } from '../permisos.js';
import { delTaller, cargarVisita } from '../datos.js';
import { falla, requerido, enLista, isoAhora, idEntero, normTexto, json, ErrorUsuario } from '../util.js';
import { respuestaDe, controlVigente, RESULTADOS, TIPOS_LINEA } from '../reglas.js';
import { carpetaArchivos, config } from '../config.js';
import { tokenNuevo } from '../auth.js';

const TIPOS = { presupuesto: 'Presupuesto', informe: 'Informe de trabajo', entrega: 'Resumen de entrega', venta: 'Comprobante de venta', recibo: 'Recibo de pago' };
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

function marcaDelTaller(db, taller) {
  const c = taller.config;
  let logo = null;
  if (c.logoAdjuntoId) {
    const a = uno(db, 'SELECT ruta, mime, bytes FROM adjuntos WHERE taller_id = ? AND id = ?', taller.id, c.logoAdjuntoId);
    if (a && a.bytes <= 400_000) {
      try { logo = `data:${a.mime};base64,${fs.readFileSync(path.join(carpetaArchivos(), a.ruta)).toString('base64')}`; } catch { logo = null; }
    }
  }
  return { nombre: taller.nombre, lema: c.lema || '', direccion: [c.direccion, c.localidad].filter(Boolean).join(', '), telefono: c.telefono || '', email: c.email || '', logo };
}

function contenidoVisita(db, taller, v, tipo, { incluirFotos = false } = {}) {
  const lineas = (v.presupuesto?.lineas || []);
  const vigentes = lineas.filter((l) => l.estado === 'vigente');
  const control = controlVigente(v);
  const base = {
    visita: { numero: v.numero, tipo: v.tipo === 'service' ? 'Service' : 'Revisión o reparación', motivo: v.motivo, ingreso: v.ingreso_at, responsable: v.responsable, autorizacionIngreso: v.autorizacion_ingreso },
    vehiculo: { patente: v.vehiculo.patente, marca: v.vehiculo.marca, modelo: v.vehiculo.modelo, version: v.vehiculo.version_txt, anio: v.vehiculo.anio },
    cliente: { nombre: v.contacto_nombre, telefono: v.contacto_telefono },
    km: v.lecturas[0] ? (v.lecturas[0].km == null ? 'No se pudo leer' : v.lecturas[0].km) : null
  };
  const linea = (l) => ({ tipo: TIPOS_LINEA[l.tipo], descripcion: l.descripcion, cantidad_m: l.cantidad_m, unidad: l.unidad, precio_unit: l.precio_unit, importe: l.importe, version: l.version_num, respuesta: respuestaDe(l), realizado: !!l.realizado_at, cambio: !!l.origen_linea_id });
  if (tipo === 'presupuesto') {
    const ultima = v.presupuesto?.versiones.at(-1);
    if (!ultima) falla('La visita todavía no tiene presupuesto.');
    return {
      ...base, version: ultima.numero, validez: ultima.validez_hasta, lineas: vigentes.map(linea),
      respuestas: vigentes.filter((l) => l.respuesta).map((l) => ({ descripcion: l.descripcion, respuesta: l.respuesta.respuesta, persona: l.respuesta.persona, canal: l.respuesta.canal, fecha: l.respuesta.fecha_respuesta })),
      totales: v.totales,
      diagnostico: v.revision ? (v.revision.estado === 'confirmado' ? v.revision.diagnostico : 'Sin diagnóstico confirmado') : null,
      recomendacion: v.revision?.recomendacion || null
    };
  }
  const realizados = vigentes.filter((l) => l.realizado_at).map(linea);
  const contenido = {
    ...base,
    hallazgos: (v.hallazgos||[]).map(h=>({observacion:h.observacion,gravedad:h.gravedad,propuesta:h.propuesta,version:h.version_num,por:h.por,fecha:h.creado_at})),
    revision: v.revision ? { relato: v.revision.relato, hallazgos: v.revision.hallazgos, pruebas: v.revision.pruebas, diagnostico: v.revision.estado === 'confirmado' ? v.revision.diagnostico : 'Sin diagnóstico confirmado', recomendacion: v.revision.recomendacion } : null,
    realizados,
    piezas: v.repuestos.filter((r) => r.etapa === 'colocado').map((r) => ({ descripcion: r.descripcion, cantidad_m: r.cantidad_m, unidad: r.unidad, origen: r.origen === 'cliente' ? 'Traída por el cliente' : 'Del taller' })),
    productos: v.productos.map((p) => ({ descripcion: p.descripcion, cantidad_m: p.cantidad_m, unidad: p.unidad })),
    tareas: v.tareas.map((t) => ({ descripcion: t.descripcion, estado: t.estado, explicacion: t.explicacion })),
    control: control ? { resultado: RESULTADOS[control.resultado], como: control.como, nota: control.nota, fecha: control.creado_at } : null,
    pendientes: vigentes.filter((l) => respuestaDe(l) === 'posterga').map((l) => ({ descripcion: l.descripcion, importe: l.importe })),
    proximo: v.seguimientos.filter((s) => s.tipo === 'service' && s.estado === 'pendiente').map((s) => ({ km: s.km_objetivo, fecha: s.fecha_objetivo, criterio: s.criterio }))[0] || null,
    totales: { autorizado: v.totales.autorizado, realizado: v.totales.realizado, liquidado: v.totales.liquidado, cobrado: v.totales.cobrado, saldo: v.totales.saldo }
  };
  if (incluirFotos) {
    let total = 0;
    for (let i=0;i<(v.hallazgos||[]).length;i++) {
      const h=v.hallazgos[i];
      if (!h.adjunto_id || h.foto_archivada) continue;
      const a=uno(db,'SELECT ruta,mime,bytes FROM adjuntos WHERE taller_id=? AND visita_id=? AND id=? AND archivado_at IS NULL',taller.id,v.id,h.adjunto_id);
      if(!a || !['image/jpeg','image/png','image/webp'].includes(a.mime))continue;
      total+=a.bytes;
      if(a.bytes>400_000 || total>4_000_000)falla('Las fotos son demasiado grandes para el informe. Agregalas desde Hallazgos para ajustarlas, o prepará el informe sin fotos.');
      try {contenido.hallazgos[i].foto=`data:${a.mime};base64,${fs.readFileSync(path.join(carpetaArchivos(),a.ruta)).toString('base64')}`;}
      catch {falla('No se pudo leer una foto del informe. Revisá el respaldo antes de emitirlo, o preparalo sin fotos.');}
    }
  }
  if (tipo === 'entrega') {
    if (!v.lista_at && !v.entregada_at) falla('El resumen de entrega se prepara cuando el auto está listo o entregado.');
    contenido.entrega = v.entregada_at ? { fecha: v.entregada_at, nota: v.entrega_nota } : null;
  }
  return contenido;
}

function contenidoVenta(db, tallerId, id) {
  const v = delTaller(db, 'ventas', tallerId, id, 'No encontramos esa venta.');
  const lineas = todos(db, 'SELECT descripcion, cantidad_m, precio_unit, importe FROM venta_lineas WHERE taller_id = ? AND venta_id = ?', tallerId, id);
  const movs = todos(db, 'SELECT tipo, importe, efecto, medio FROM cuenta_movimientos WHERE taller_id = ? AND venta_id = ?', tallerId, id);
  const c = v.contacto_id ? uno(db, 'SELECT nombre, telefono FROM contactos WHERE id = ?', v.contacto_id) : null;
  return {
    venta: { numero: v.numero, fecha: v.fecha, estado: v.estado }, cliente: { nombre: c?.nombre || v.cliente_nombre, telefono: c?.telefono || null },
    lineas, total: v.total, saldo: Math.max(0, movs.reduce((n, m) => n + m.efecto, 0)),
    cobros: movs.filter((m) => m.tipo === 'pago').map((m) => ({ importe: m.importe, medio: m.medio }))
  };
}

function contenidoRecibo(db, tallerId, id) {
  const m = delTaller(db, 'cuenta_movimientos', tallerId, id, 'No encontramos ese pago.');
  if (m.tipo !== 'pago') falla('El recibo se emite sobre un pago.');
  if (uno(db, 'SELECT id FROM cuenta_movimientos WHERE taller_id = ? AND anula_id = ?', tallerId, m.id)) falla('Ese pago está anulado.');
  const c = m.contacto_id ? uno(db, 'SELECT nombre FROM contactos WHERE id = ?', m.contacto_id) : null;
  const v = m.visita_id ? uno(db, 'SELECT numero FROM visitas WHERE id = ?', m.visita_id) : null;
  const ve = m.venta_id ? uno(db, 'SELECT numero FROM ventas WHERE id = ?', m.venta_id) : null;
  return { pago: { importe: m.importe, medio: m.medio, referencia: m.referencia, fecha: m.fecha, concepto: v ? `Visita N.º ${v.numero}` : ve ? `Venta N.º ${ve.numero}` : (m.motivo || 'Pago a cuenta') }, cliente: { nombre: c?.nombre || 'Cliente' } };
}

export function emitir(ctx, tipo, refTipo, refId) {
  let contenido;
  if (refTipo === 'visita') {
    const v = cargarVisita(ctx.db, ctx.taller.id, refId);
    if (!['presupuesto', 'informe', 'entrega'].includes(tipo)) falla('Tipo de documento no válido para una visita.');
    contenido = contenidoVisita(ctx.db, ctx.taller, v, tipo, {incluirFotos:ctx.cuerpo.incluirFotos===true});
  } else if (refTipo === 'venta') {
    if (tipo !== 'venta') falla('Tipo de documento no válido para una venta.');
    contenido = contenidoVenta(ctx.db, ctx.taller.id, refId);
  } else if (refTipo === 'movimiento') {
    if (tipo !== 'recibo') falla('Tipo de documento no válido para un pago.');
    contenido = contenidoRecibo(ctx.db, ctx.taller.id, refId);
  } else falla('Referencia de documento no válida.');
  const numero = siguiente(ctx.db, ctx.taller.id, 'doc_' + tipo);
  const doc = { tipo, titulo: TIPOS[tipo], numero, emitido: isoAhora(), emitidoPor: ctx.usuario.nombre, taller: marcaDelTaller(ctx.db, ctx.taller), leyenda: 'Documento interno del taller. No es una factura ni tiene validez fiscal.', ...contenido };
  const id = insertar(ctx.db, 'INSERT INTO documentos (taller_id, tipo, ref_tipo, ref_id, numero, contenido, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.taller.id, tipo, refTipo, refId, numero, JSON.stringify(doc), ctx.usuario.id, isoAhora());
  ctx.auditar(`${TIPOS[tipo]} N.º ${numero} emitido`, refTipo === 'visita' ? 'visita' : 'documento', refTipo === 'visita' ? refId : id, null);
  return id;
}

export default function rutas(r) {
  r.get('/api/documentos', (ctx) => {
    exigir(ctx.usuario, 'documentos.emitir');
    const q = normTexto(ctx.query.q || '');
    const tipo = ctx.query.tipo && TIPOS[ctx.query.tipo] ? ctx.query.tipo : null;
    const filas = todos(ctx.db, `SELECT d.id, d.tipo, d.ref_tipo, d.ref_id, d.numero, d.contenido, d.anulado_at, d.creado_at, u.nombre AS por FROM documentos d LEFT JOIN usuarios u ON u.id = d.creado_por
      WHERE d.taller_id = ? ${tipo ? 'AND d.tipo = ?' : ''} ORDER BY d.id DESC LIMIT 500`, ...(tipo ? [ctx.taller.id, tipo] : [ctx.taller.id]));
    const res = [];
    for (const f of filas) {
      const c = json(f.contenido, {});
      const resumen = { patente: c.vehiculo?.patente || null, cliente: c.cliente?.nombre || null, vehiculo: [c.vehiculo?.marca, c.vehiculo?.modelo].filter(Boolean).join(' ') || null, visita: c.visita?.numero || null };
      if (q && !normTexto([f.numero, TIPOS[f.tipo], resumen.patente, resumen.cliente, resumen.vehiculo, resumen.visita ? 'visita ' + resumen.visita : ''].join(' ')).replace(/\s/g, '').includes(q.replace(/\s/g, ''))) continue;
      res.push({ id: f.id, tipo: f.tipo, titulo: TIPOS[f.tipo], numero: f.numero, refTipo: f.ref_tipo, refId: f.ref_id, anulado: !!f.anulado_at, fecha: f.creado_at, por: f.por, ...resumen });
      if (res.length >= 100) break;
    }
    return { documentos: res };
  });

  r.post('/api/documentos', (ctx) => {
    exigir(ctx.usuario, 'documentos.emitir');
    const tipo = enLista(ctx.cuerpo.tipo, Object.keys(TIPOS), 'Elegí el tipo de documento.', 'tipo');
    const refTipo = enLista(ctx.cuerpo.refTipo, ['visita', 'venta', 'movimiento'], 'Referencia no válida.');
    const id = emitir(ctx, tipo, refTipo, idEntero(ctx.cuerpo.refId));
    return { id };
  });

  r.get('/api/documentos/:id', (ctx) => {
    exigir(ctx.usuario, 'ver.taller');
    const d = delTaller(ctx.db, 'documentos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese documento.');
    if (!puede(ctx.usuario, 'documentos.emitir') && d.tipo !== 'informe') throw new ErrorUsuario(403, 'Tu usuario no puede ver este documento.');
    const contenido = json(d.contenido, {});
    const enlaces = puede(ctx.usuario, 'documentos.compartir') ? todos(ctx.db, 'SELECT id, expira, revocado_at, accesos, creado_at FROM enlaces_publicos WHERE taller_id = ? AND documento_id = ? ORDER BY id DESC', ctx.taller.id, d.id) : [];
    if (!puede(ctx.usuario, 'ver.dinero')) quitarImportes(contenido);
    return { documento: { id: d.id, tipo: d.tipo, numero: d.numero, anulado_at: d.anulado_at, anulado_motivo: d.anulado_motivo, contenido, enlaces, refTipo: d.ref_tipo, refId: d.ref_id } };
  });

  r.post('/api/documentos/:id/anular', (ctx) => {
    exigir(ctx.usuario, 'documentos.anular', 'Solo el dueño anula documentos.');
    const d = delTaller(ctx.db, 'documentos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese documento.');
    if (d.anulado_at) falla('El documento ya está anulado.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí el motivo de la anulación.', 'motivo', 300);
    ejecutar(ctx.db, 'UPDATE documentos SET anulado_at = ?, anulado_motivo = ? WHERE id = ?', isoAhora(), motivo, d.id);
    ejecutar(ctx.db, 'UPDATE enlaces_publicos SET revocado_at = ? WHERE documento_id = ? AND revocado_at IS NULL', isoAhora(), d.id);
    ctx.auditar(`${TIPOS[d.tipo]} N.º ${d.numero} anulado (se conserva)`, d.ref_tipo === 'visita' ? 'visita' : 'documento', d.ref_tipo === 'visita' ? d.ref_id : d.id, motivo);
    return { ok: true };
  });

  // Enlace público de UN documento: alcance limitado a esa copia, vigencia acotada y revocable.
  r.post('/api/documentos/:id/enlace', (ctx) => {
    exigir(ctx.usuario, 'documentos.compartir');
    const d = delTaller(ctx.db, 'documentos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese documento.');
    if (d.anulado_at) falla('El documento está anulado: no se comparte.');
    const dias = Number(ctx.cuerpo.dias || 7);
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) falla('La vigencia debe ser de 1 a 30 días.', 'dias');
    const token = tokenNuevo();
    const expira = new Date(Date.now() + dias * 86400e3).toISOString();
    insertar(ctx.db, 'INSERT INTO enlaces_publicos (taller_id, documento_id, token_hash, expira, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?)', ctx.taller.id, d.id, sha(token), expira, ctx.usuario.id, isoAhora());
    ctx.auditar(`Enlace para compartir creado (${dias} días)`, d.ref_tipo === 'visita' ? 'visita' : 'documento', d.ref_tipo === 'visita' ? d.ref_id : d.id, `${TIPOS[d.tipo]} N.º ${d.numero}`);
    const base = config.urlPublica || '';
    return { ruta: `/d/${token}`, url: base ? `${base}/d/${token}` : null, expira };
  });

  r.post('/api/enlaces/:id/revocar', (ctx) => {
    exigir(ctx.usuario, 'documentos.compartir');
    const e = delTaller(ctx.db, 'enlaces_publicos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese enlace.');
    if (e.revocado_at) falla('El enlace ya estaba desactivado.');
    ejecutar(ctx.db, 'UPDATE enlaces_publicos SET revocado_at = ? WHERE id = ?', isoAhora(), e.id);
    ctx.auditar('Enlace para compartir desactivado', 'documento', e.documento_id, null);
    return { ok: true };
  });
}

export function quitarImportes(c) {
  const limpiar = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (['importe', 'precio_unit', 'total', 'saldo', 'totales', 'cobros', 'autorizado', 'realizado', 'liquidado', 'cobrado'].includes(k)) delete o[k];
      else limpiar(o[k]);
    }
  };
  limpiar(c);
  return c;
}

// Vista pública de un enlace compartido (sin sesión): solo esa copia del documento.
export function documentoPublico(db, token) {
  const e = uno(db, 'SELECT * FROM enlaces_publicos WHERE token_hash = ?', sha(String(token || '')));
  if (!e || e.revocado_at || e.expira < new Date().toISOString()) return null;
  const d = uno(db, 'SELECT * FROM documentos WHERE id = ? AND taller_id = ?', e.documento_id, e.taller_id);
  if (!d || d.anulado_at) return null;
  ejecutar(db, 'UPDATE enlaces_publicos SET accesos = accesos + 1 WHERE id = ?', e.id);
  return { contenido: json(d.contenido, {}), expira: e.expira };
}
