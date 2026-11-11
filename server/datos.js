// Lecturas compuestas. Toda consulta filtra por taller_id: un id de otro taller no se encuentra.
import { uno, todos } from './db.js';
import { noEncontrado, json } from './util.js';
import { situacion, totales, resumenOperativo, dimensionesVisita } from './reglas.js';
import { leerHallazgos } from './hallazgos.js';

export function delTaller(db, tabla, tallerId, id, mensaje) {
  const fila = id ? uno(db, `SELECT * FROM ${tabla} WHERE taller_id = ? AND id = ?`, tallerId, id) : null;
  if (!fila) noEncontrado(mensaje);
  return fila;
}

export function nombreUsuario(db, tallerId, id) {
  if (!id) return null;
  return uno(db, 'SELECT nombre FROM usuarios WHERE taller_id = ? AND id = ?', tallerId, id)?.nombre ?? null;
}

export function cuentaVisita(db, tallerId, visitaId) {
  return todos(db, `SELECT m.*, a.tipo AS anula_tipo FROM cuenta_movimientos m LEFT JOIN cuenta_movimientos a ON a.id = m.anula_id
    WHERE m.taller_id = ? AND m.visita_id = ? ORDER BY m.id`, tallerId, visitaId);
}

export function cargarVisita(db, tallerId, id, { conDinero = true } = {}) {
  const v = delTaller(db, 'visitas', tallerId, id, 'No encontramos esa visita en este taller.');
  v.vehiculo = uno(db, 'SELECT * FROM vehiculos WHERE taller_id = ? AND id = ?', tallerId, v.vehiculo_id);
  v.responsable = nombreUsuario(db, tallerId, v.responsable_id);
  v.lecturas = todos(db, 'SELECT * FROM lecturas WHERE taller_id = ? AND visita_id = ? ORDER BY id', tallerId, id);
  const revs = todos(db, 'SELECT r.*, u.nombre AS por FROM revisiones r LEFT JOIN usuarios u ON u.id = r.creado_por WHERE r.taller_id = ? AND r.visita_id = ? ORDER BY r.version_num', tallerId, id);
  v.revision = revs.at(-1) || null;
  v.revisionesAnteriores = revs.slice(0, -1);
  v.hallazgos = leerHallazgos(db, tallerId, id);
  v.recepcion = v.recepcion_json ? JSON.parse(v.recepcion_json) : null;
  delete v.recepcion_json;
  const versiones = todos(db, 'SELECT pv.*, u.nombre AS por FROM presupuesto_versiones pv LEFT JOIN usuarios u ON u.id = pv.creado_por WHERE pv.taller_id = ? AND pv.visita_id = ? ORDER BY pv.numero', tallerId, id);
  const lineas = todos(db, `SELECT l.*, pv.numero AS version_num, u.nombre AS realizado_por_nombre FROM presupuesto_lineas l
    JOIN presupuesto_versiones pv ON pv.id = l.version_id LEFT JOIN usuarios u ON u.id = l.realizado_por
    WHERE l.taller_id = ? AND l.visita_id = ? ORDER BY l.id`, tallerId, id);
  const resp = todos(db, `SELECT r.*, u.nombre AS cargado_por_nombre FROM respuestas r LEFT JOIN usuarios u ON u.id = r.cargado_por
    WHERE r.taller_id = ? AND r.linea_id IN (SELECT id FROM presupuesto_lineas WHERE taller_id = ? AND visita_id = ?) ORDER BY r.id`, tallerId, tallerId, id);
  for (const l of lineas) {
    const rs = resp.filter((r) => r.linea_id === l.id);
    l.respuesta = rs.at(-1) || null;
    l.respuestasAnteriores = rs.slice(0, -1);
  }
  v.presupuesto = versiones.length ? { versiones, lineas } : null;
  v.repuestos = todos(db, `SELECT r.*, p.nombre AS proveedor, a.nombre AS articulo FROM repuestos r LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN articulos a ON a.id = r.articulo_id WHERE r.taller_id = ? AND r.visita_id = ? ORDER BY r.id`, tallerId, id);
  for (const r of v.repuestos) r.reserva = uno(db, "SELECT * FROM reservas WHERE taller_id = ? AND repuesto_id = ? AND estado IN ('activa','consumida')", tallerId, r.id);
  v.tareas = todos(db, 'SELECT t.*, u.nombre AS por FROM tareas_service t LEFT JOIN usuarios u ON u.id = t.actualizado_por WHERE t.taller_id = ? AND t.visita_id = ? ORDER BY t.orden', tallerId, id);
  v.productos = todos(db, 'SELECT p.*, u.nombre AS por FROM productos_usados p LEFT JOIN usuarios u ON u.id = p.creado_por WHERE p.taller_id = ? AND p.visita_id = ? AND p.anulado_at IS NULL ORDER BY p.id', tallerId, id);
  v.controles = todos(db, 'SELECT c.*, u.nombre AS por FROM controles c LEFT JOIN usuarios u ON u.id = c.creado_por WHERE c.taller_id = ? AND c.visita_id = ? ORDER BY c.id DESC', tallerId, id);
  v.adjuntos = todos(db, 'SELECT a.id, a.nombre_original, a.mime, a.bytes, a.descripcion, a.creado_at, u.nombre AS por FROM adjuntos a LEFT JOIN usuarios u ON u.id = a.creado_por WHERE a.taller_id = ? AND a.visita_id = ? AND a.archivado_at IS NULL ORDER BY a.id', tallerId, id);
  v.seguimientos = todos(db, 'SELECT * FROM seguimientos WHERE taller_id = ? AND visita_origen_id = ? ORDER BY id', tallerId, id);
  v.relacionada = v.relacionada_id ? uno(db, 'SELECT id, numero, motivo, ingreso_at FROM visitas WHERE taller_id = ? AND id = ?', tallerId, v.relacionada_id) : null;
  v.relacionadas = todos(db, 'SELECT id, numero, motivo, ingreso_at FROM visitas WHERE taller_id = ? AND relacionada_id = ?', tallerId, id);
  v.turno = v.turno_id ? uno(db, 'SELECT id, codigo, inicio FROM turnos WHERE taller_id = ? AND id = ?', tallerId, v.turno_id) : null;
  v.cuenta = cuentaVisita(db, tallerId, id);
  v.documentos = todos(db, "SELECT id, tipo, numero, creado_at, anulado_at FROM documentos WHERE taller_id = ? AND ref_tipo = 'visita' AND ref_id = ? ORDER BY id DESC", tallerId, id);
  v.actividad = todos(db, `SELECT a.accion, a.detalle, a.fecha, u.nombre AS por FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.taller_id = ? AND a.entidad = 'visita' AND a.entidad_id = ? ORDER BY a.id DESC LIMIT 60`, tallerId, id);
  v.situacion = situacion(v);
  v.totales = totales(v);
  v.operacion = resumenOperativo(v);
  v.dimensiones = dimensionesVisita(v,{conDinero});
  if (!conDinero) ocultarDinero(v);
  return v;
}

// El mecánico ve qué está autorizado y qué falta, sin importes ni cobros.
export function ocultarDinero(v) {
  if (v.presupuesto) for (const l of v.presupuesto.lineas) { l.precio_unit = null; l.importe = null; }
  v.cuenta = [];
  v.totales = null;
  for (const s of v.seguimientos || []) s.importe = null;
  v.entrega_saldo = null;
  if (v.situacion?.clave === 'lista') v.situacion = { ...v.situacion, paso: 'Avisar a recepción: lo entrega cuando el cliente lo retire.' };
  v.actividad = (v.actividad || []).filter((a) => !/pago|cobro|liquid|cargo|saldo|\$/i.test(a.accion + ' ' + (a.detalle || '')));
  return v;
}

export function resumenVisita(db, tallerId, v, { conDinero = true } = {}) {
  // Versión liviana para listas (Hoy, Trabajos): calcula situación con lo mínimo necesario.
  const completa = cargarVisita(db, tallerId, v.id, { conDinero });
  return {
    id: completa.id, numero: completa.numero, tipo: completa.tipo, motivo: completa.motivo,
    vehiculo: { id: completa.vehiculo.id, patente: completa.vehiculo.patente, marca: completa.vehiculo.marca, modelo: completa.vehiculo.modelo, version_txt: completa.vehiculo.version_txt },
    contacto: completa.contacto_nombre, responsable: completa.responsable, responsable_id: completa.responsable_id,
    retiro_acordado: completa.retiro_acordado, ingreso_at: completa.ingreso_at, prioridad: completa.prioridad,
    lista_at: completa.lista_at, entregada_at: completa.entregada_at, anulada_at: completa.anulada_at,
    situacion: completa.situacion,
    operacion: completa.operacion,
    dimensiones: completa.dimensiones,
    repuestosEsperando: completa.repuestos.filter((r) => r.etapa === 'falta_pedir' || r.etapa === 'pedido').map((r) => ({ descripcion: r.descripcion, etapa: r.etapa, fecha_prevista: r.fecha_prevista })),
    sinRespuestaDesde: completa.presupuesto ? completa.presupuesto.lineas.filter((l) => l.estado === 'vigente' && !l.respuesta && !l.autorizada_ingreso).map((l) => l.creado_at).sort()[0] || null : null
  };
}

export function tallerPublico(t) {
  const c = typeof t.config === 'string' ? json(t.config, {}) : t.config;
  return {
    slug: t.slug, nombre: t.nombre, descripcion: c.descripcion || '', telefono: c.telefono || '', whatsapp: c.whatsapp || '',
    direccion: c.direccion || '', localidad: c.localidad || '', horarios: c.horarios || '', servicios: c.serviciosPublicos || [],
    lema: c.lema || '', tieneLogo: !!c.logoAdjuntoId, mapa: c.mapa || ''
  };
}
