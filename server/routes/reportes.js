// Reportes. Cada indicador define qué mide. Los números salen de los mismos movimientos que ve cada pantalla.
import { uno, todos } from '../db.js';
import { exigir } from '../permisos.js';
import { resumenVisita } from '../datos.js';
import { falla, fechaValida, aLocal, isoAhora, sumarDias } from '../util.js';
import { existencia } from './stock.js';
import { MEDIOS } from './caja.js';

function periodo(ctx) {
  const z = ctx.taller.config.zona_horaria || 'America/Argentina/Mendoza';
  const hoy = aLocal(isoAhora(), z).slice(0, 10);
  const desde = fechaValida(ctx.query.desde) ? ctx.query.desde : sumarDias(hoy, -29);
  const hasta = fechaValida(ctx.query.hasta) ? ctx.query.hasta : hoy;
  if (desde > hasta) falla('El período no es válido: «desde» es posterior a «hasta».');
  return { desde, hasta, z };
}

function cobros(ctx, p) {
  // Dinero recibido de clientes: pagos menos devoluciones y menos pagos anulados, por día local del taller.
  return todos(ctx.db, `SELECT m.*, a.tipo AS anula_tipo, c.nombre AS cliente FROM cuenta_movimientos m LEFT JOIN cuenta_movimientos a ON a.id = m.anula_id LEFT JOIN contactos c ON c.id = m.contacto_id
    WHERE m.taller_id = ? AND m.medio IS NOT NULL ORDER BY m.id`, ctx.taller.id)
    .map((m) => ({ ...m, dia: aLocal(m.fecha, p.z).slice(0, 10), dinero: m.tipo === 'pago' ? m.importe : m.tipo === 'devolucion_dinero' ? -m.importe : m.anula_tipo === 'pago' ? -m.importe : m.anula_tipo === 'devolucion_dinero' ? m.importe : 0 }))
    .filter((m) => m.dinero !== 0 && m.dia >= p.desde && m.dia <= p.hasta);
}

export default function rutas(r) {
  r.get('/api/reportes', (ctx) => {
    exigir(ctx.usuario, 'reportes.ver', 'Los reportes los ve el dueño o administración.');
    const p = periodo(ctx), tid = ctx.taller.id, db = ctx.db;
    const abiertas = todos(db, 'SELECT * FROM visitas WHERE taller_id = ? AND entregada_at IS NULL AND anulada_at IS NULL', tid).map((v) => resumenVisita(db, tid, v));
    const enCurso = {};
    for (const v of abiertas) enCurso[v.situacion.texto] = (enCurso[v.situacion.texto] || 0) + 1;
    const entregadas = todos(db, 'SELECT entregada_at FROM visitas WHERE taller_id = ? AND entregada_at IS NOT NULL', tid).filter((v) => { const d = aLocal(v.entregada_at, p.z).slice(0, 10); return d >= p.desde && d <= p.hasta; }).length;
    const sinResp = todos(db, `SELECT l.importe FROM presupuesto_lineas l JOIN visitas v ON v.id = l.visita_id WHERE l.taller_id = ? AND l.estado = 'vigente' AND l.autorizada_ingreso = 0
      AND NOT EXISTS (SELECT 1 FROM respuestas r WHERE r.linea_id = l.id) AND v.entregada_at IS NULL AND v.anulada_at IS NULL`, tid);
    const movs = cobros(ctx, p);
    const porMedio = Object.keys(MEDIOS).map((k) => ({ medio: MEDIOS[k], importe: movs.filter((m) => m.medio === k).reduce((n, m) => n + m.dinero, 0) })).filter((x) => x.importe !== 0);
    const dias = [];
    for (let d = p.desde; d <= p.hasta && dias.length < 92; d = sumarDias(d, 1)) dias.push({ dia: d, importe: movs.filter((m) => m.dia === d).reduce((n, m) => n + m.dinero, 0) });
    const saldos = todos(db, 'SELECT contacto_id, SUM(efecto) AS s FROM cuenta_movimientos WHERE taller_id = ? AND contacto_id IS NOT NULL GROUP BY contacto_id HAVING SUM(efecto) > 0', tid);
    const liquidado = todos(db, `SELECT m.importe, m.fecha, a.id AS anulado FROM cuenta_movimientos m LEFT JOIN cuenta_movimientos a ON a.anula_id = m.id WHERE m.taller_id = ? AND m.tipo = 'cargo' AND m.visita_id IS NOT NULL`, tid)
      .filter((m) => !m.anulado).filter((m) => { const d = aLocal(m.fecha, p.z).slice(0, 10); return d >= p.desde && d <= p.hasta; }).reduce((n, m) => n + m.importe, 0);
    const ventas = todos(db, "SELECT id, total, fecha FROM ventas WHERE taller_id = ? AND estado = 'confirmada' AND fecha BETWEEN ? AND ?", tid, p.desde, p.hasta);
    // Margen de mostrador: solo líneas con artículo y costo conocido al momento de la venta.
    const lineasVenta = todos(db, `SELECT l.importe, l.cantidad_m, l.devuelto_m, ms.costo_unit FROM venta_lineas l JOIN ventas v ON v.id = l.venta_id
      LEFT JOIN movimientos_stock ms ON ms.ref_tipo = 'venta_linea' AND ms.ref_id = l.id AND ms.tipo = 'venta'
      WHERE l.taller_id = ? AND v.estado = 'confirmada' AND v.fecha BETWEEN ? AND ?`, tid, p.desde, p.hasta);
    const conCosto = lineasVenta.filter((l) => l.costo_unit != null && l.devuelto_m === 0);
    const margen = conCosto.length ? {
      ventas: conCosto.reduce((n, l) => n + l.importe, 0),
      costo: conCosto.reduce((n, l) => n + Math.round((l.cantidad_m * l.costo_unit) / 1000), 0),
      lineasSinCosto: lineasVenta.length - conCosto.length
    } : null;
    const articulos = todos(db, 'SELECT * FROM articulos WHERE taller_id = ? AND activo = 1', tid).map((a) => ({ ...a, ...existencia(db, tid, a.id) }));
    const stockBajo = articulos.filter((a) => a.minimo_m > 0 && a.existencia <= a.minimo_m).map((a) => ({ id: a.id, nombre: a.nombre, unidad: a.unidad, existencia: a.existencia, minimo: a.minimo_m }));
    const movStock = todos(db, 'SELECT tipo, cantidad_m, creado_at FROM movimientos_stock WHERE taller_id = ?', tid).filter((m) => { const d = aLocal(m.creado_at, p.z).slice(0, 10); return d >= p.desde && d <= p.hasta; });
    const porTipoStock = {};
    for (const m of movStock) porTipoStock[m.tipo] = (porTipoStock[m.tipo] || 0) + 1;
    const turnos = uno(db, "SELECT COUNT(*) AS n FROM turnos WHERE taller_id = ? AND substr(inicio, 1, 10) BETWEEN ? AND ? AND estado IN ('confirmado','ingresado')", tid, p.desde, p.hasta).n;
    return {
      desde: p.desde, hasta: p.hasta,
      indicadores: [
        { clave: 'enCurso', titulo: 'Autos en el taller', valor: abiertas.length, tipo: 'numero', define: 'Visitas recibidas que todavía no se entregaron ni anularon (hoy, no depende del período).' },
        { clave: 'listos', titulo: 'Listos sin retirar', valor: abiertas.filter((v) => v.lista_at).length, tipo: 'numero', define: 'Autos marcados listos que siguen en el taller.' },
        { clave: 'entregadas', titulo: 'Entregas del período', valor: entregadas, tipo: 'numero', define: 'Visitas con entrega registrada entre las fechas elegidas.' },
        { clave: 'presupuestos', titulo: 'Presupuesto sin respuesta', valor: sinResp.reduce((n, l) => n + l.importe, 0), extra: `${sinResp.length} línea(s)`, tipo: 'dinero', define: 'Importe de líneas vigentes sin respuesta del cliente en visitas abiertas. No es dinero a cobrar.' },
        { clave: 'liquidado', titulo: 'Liquidado en el período', valor: liquidado, tipo: 'dinero', define: 'Liquidaciones de visitas (trabajo realizado) emitidas en el período, sin las anuladas.' },
        { clave: 'cobrado', titulo: 'Cobrado en el período', valor: movs.reduce((n, m) => n + m.dinero, 0), tipo: 'dinero', define: 'Dinero recibido de clientes (visitas y mostrador) menos devoluciones y cobros anulados.' },
        { clave: 'adeudado', titulo: 'Saldos de clientes', valor: saldos.reduce((n, s) => n + s.s, 0), extra: `${saldos.length} cliente(s)`, tipo: 'dinero', define: 'Suma de lo que los clientes deben hoy según su cuenta corriente.' },
        { clave: 'ventas', titulo: 'Ventas de mostrador', valor: ventas.reduce((n, v) => n + v.total, 0), extra: `${ventas.length} venta(s)`, tipo: 'dinero', define: 'Total de ventas confirmadas en el período (sin anuladas). No descuenta devoluciones parciales.' },
        { clave: 'turnos', titulo: 'Turnos del período', valor: turnos, tipo: 'numero', define: 'Turnos confirmados o ya ingresados con fecha en el período.' }
      ],
      enCurso, porMedio, dias, margen, stockBajo, porTipoStock,
      notaMargen: margen ? 'Margen bruto de mostrador = ventas − costo de compra registrado. Solo incluye líneas con costo conocido y sin devoluciones. No es dinero disponible.' : 'No hay ventas con costo registrado en el período: no se muestra margen.'
    };
  });

  r.get('/api/reportes/csv', (ctx) => {
    exigir(ctx.usuario, 'reportes.ver');
    const p = periodo(ctx);
    const tipo = ctx.query.tipo === 'stock' ? 'stock' : 'cobros';
    let cols, filas;
    if (tipo === 'cobros') {
      cols = ['dia', 'cliente', 'tipo', 'medio', 'referencia', 'importe'];
      filas = cobros(ctx, p).map((m) => ({ dia: m.dia, cliente: m.cliente || '', tipo: m.tipo === 'anulacion' ? 'anulación de ' + m.anula_tipo : m.tipo, medio: MEDIOS[m.medio] || m.medio, referencia: m.referencia || '', importe: (m.dinero / 100).toFixed(2).replace('.', ',') }));
    } else {
      cols = ['articulo', 'unidad', 'existencia', 'reservado', 'disponible', 'minimo'];
      filas = todos(ctx.db, 'SELECT * FROM articulos WHERE taller_id = ? AND activo = 1 ORDER BY nombre', ctx.taller.id).map((a) => {
        const e = existencia(ctx.db, ctx.taller.id, a.id);
        const n = (m) => (m / 1000).toString().replace('.', ',');
        return { articulo: a.nombre, unidad: a.unidad, existencia: n(e.existencia), reservado: n(e.reservado), disponible: n(e.disponible), minimo: n(a.minimo_m) };
      });
    }
    // Protege contra fórmulas en planillas sin alterar números negativos.
    const celda = (v) => { const s = String(v ?? ''); if (/^-?\d+(,\d+)?$/.test(s)) return s; return /[";\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"' : s; };
    const csv = '﻿' + [cols.join(';'), ...filas.map((f) => cols.map((c) => celda(f[c])).join(';'))].join('\r\n');
    ctx.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${tipo}-${p.desde}-${p.hasta}.csv"`, 'Cache-Control': 'no-store' });
    ctx.res.end(csv);
    return undefined;
  });
}
