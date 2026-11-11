// Cobros, cuenta corriente y caja. Valores distintos: presupuestado, autorizado, realizado, liquidado, cobrado y adeudado.
// Los movimientos no se modifican: una corrección es otro movimiento (anulación o devolución) con motivo.
import { uno, todos, insertar, ejecutar } from '../db.js';
import { exigir } from '../permisos.js';
import { delTaller, cargarVisita } from '../datos.js';
import { falla, requerido, opcional, enLista, dinero, isoAhora, aLocal, fechaValida, idEntero } from '../util.js';
import { controlVigente, respuestaDe } from '../reglas.js';

export const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Tarjeta de débito', credito: 'Tarjeta de crédito', cheque: 'Cheque', otro: 'Otro' };
const pesos = (c) => '$' + (c / 100).toLocaleString('es-AR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });

export function registrarMovimiento(ctx, m) {
  const efecto = { cargo: m.importe, pago: -m.importe, devolucion_dinero: m.importe, nota_credito: -m.importe }[m.tipo];
  return insertar(ctx.db, `INSERT INTO cuenta_movimientos (taller_id, contacto_id, visita_id, venta_id, tipo, importe, efecto, medio, referencia, fecha, motivo, creado_por, creado_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ctx.taller.id, m.contactoId ?? null, m.visitaId ?? null, m.ventaId ?? null, m.tipo, m.importe, efecto,
  m.medio ?? null, m.referencia ?? null, isoAhora(), m.motivo ?? null, ctx.usuario.id, isoAhora());
}

export function anularMovimiento(ctx, mov, motivo) {
  if (mov.tipo === 'anulacion') falla('Una anulación no se anula. Registrá el movimiento correcto.');
  if (uno(ctx.db, 'SELECT id FROM cuenta_movimientos WHERE taller_id = ? AND anula_id = ?', ctx.taller.id, mov.id)) falla('Ese movimiento ya está anulado.');
  insertar(ctx.db, `INSERT INTO cuenta_movimientos (taller_id, contacto_id, visita_id, venta_id, tipo, importe, efecto, medio, referencia, fecha, motivo, anula_id, creado_por, creado_at)
    VALUES (?, ?, ?, ?, 'anulacion', ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ctx.taller.id, mov.contacto_id, mov.visita_id, mov.venta_id, mov.importe, -mov.efecto, mov.medio, mov.referencia,
  isoAhora(), motivo, mov.id, ctx.usuario.id, isoAhora());
  if (mov.tipo === 'cargo' && mov.visita_id) ejecutar(ctx.db, 'UPDATE presupuesto_lineas SET cargo_id = NULL WHERE taller_id = ? AND cargo_id = ?', ctx.taller.id, mov.id);
}

function saldoContacto(db, tallerId, contactoId) {
  return uno(db, 'SELECT COALESCE(SUM(efecto), 0) AS n FROM cuenta_movimientos WHERE taller_id = ? AND contacto_id = ?', tallerId, contactoId).n;
}

export default function rutas(r) {
  // Liquidar: fija el importe a cobrar con lo autorizado Y realizado que todavía no se liquidó.
  // Lo postergado o rechazado nunca se suma.
  r.post('/api/visitas/:id/liquidar', (ctx) => {
    exigir(ctx.usuario, 'visita.liquidar');
    const v = cargarVisita(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    if (v.anulada_at) falla('La visita está anulada.');
    if (!controlVigente(v) && !v.entregada_at) falla('Primero comprobá el resultado. La liquidación se hace sobre lo realizado y controlado.');
    const lineas = (v.presupuesto?.lineas || []).filter((l) => l.estado === 'vigente' && respuestaDe(l) === 'autoriza' && l.realizado_at && !l.cargo_id);
    if (!lineas.length) falla('No hay trabajos realizados sin liquidar. Los autorizados que no se realizaron no se cobran.');
    const total = lineas.reduce((n, l) => n + l.importe, 0);
    if (total <= 0) falla('Los trabajos realizados no tienen importe. Revisá el presupuesto.');
    const id = registrarMovimiento(ctx, { tipo: 'cargo', importe: total, contactoId: v.contacto_id, visitaId: v.id, motivo: `Liquidación de la visita ${v.numero} (no fiscal): ${lineas.map((l) => l.descripcion).join(', ')}` });
    for (const l of lineas) ejecutar(ctx.db, 'UPDATE presupuesto_lineas SET cargo_id = ? WHERE id = ?', id, l.id);
    ctx.auditar('Liquidación creada (sobre trabajos realizados)', 'visita', v.id, pesos(total));
    return { visita: cargarVisita(ctx.db, ctx.taller.id, v.id) };
  });

  // Pago de un cliente sobre una visita: seña (antes de liquidar, hasta lo autorizado) o pago parcial/total.
  r.post('/api/visitas/:id/pagos', (ctx) => {
    exigir(ctx.usuario, 'caja.registrar');
    const v = cargarVisita(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    if (v.anulada_at) falla('La visita está anulada.');
    const importe = dinero(ctx.cuerpo.importe, 'Escribí el importe recibido con números.', 'importe');
    const medio = enLista(ctx.cuerpo.medio, Object.keys(MEDIOS), 'Elegí cómo pagó.', 'medio');
    const t = v.totales;
    const tope = Math.max(t.liquidado, t.autorizado);
    if (tope <= 0) falla('Todavía no hay importes autorizados en esta visita. Registrá primero la respuesta del cliente.');
    if (t.cobrado + importe > tope) falla(`El pago supera lo ${t.liquidado ? 'liquidado' : 'autorizado'} (${pesos(tope)}; ya cobrado ${pesos(t.cobrado)}). Revisá el importe.`, 'importe');
    registrarMovimiento(ctx, { tipo: 'pago', importe, medio, referencia: opcional(ctx.cuerpo.referencia, 120), contactoId: v.contacto_id, visitaId: v.id, motivo: opcional(ctx.cuerpo.nota, 300) || (t.liquidado ? 'Pago' : 'Seña / anticipo') });
    ctx.auditar(t.liquidado ? 'Pago registrado' : 'Seña registrada', 'visita', v.id, `${pesos(importe)} · ${MEDIOS[medio]}`);
    return { visita: cargarVisita(ctx.db, ctx.taller.id, v.id) };
  });

  r.post('/api/visitas/:id/devolucion', (ctx) => {
    exigir(ctx.usuario, 'caja.anular', 'Solo el dueño registra devoluciones de dinero.');
    const v = cargarVisita(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    const importe = dinero(ctx.cuerpo.importe, 'Escribí el importe devuelto.', 'importe');
    if (importe > v.totales.cobrado) falla('No se puede devolver más de lo cobrado.', 'importe');
    const medio = enLista(ctx.cuerpo.medio, Object.keys(MEDIOS), 'Elegí cómo se devolvió.', 'medio');
    const motivo = requerido(ctx.cuerpo.motivo, 'Explicá el motivo de la devolución.', 'motivo', 300);
    registrarMovimiento(ctx, { tipo: 'devolucion_dinero', importe, medio, contactoId: v.contacto_id, visitaId: v.id, motivo });
    ctx.auditar('Devolución de dinero al cliente', 'visita', v.id, `${pesos(importe)} · ${motivo}`);
    return { visita: cargarVisita(ctx.db, ctx.taller.id, v.id) };
  });

  r.post('/api/movimientos/:id/anular', (ctx) => {
    exigir(ctx.usuario, 'caja.anular', 'Solo el dueño anula movimientos de dinero.');
    const mov = delTaller(ctx.db, 'cuenta_movimientos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese movimiento.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Explicá por qué se anula.', 'motivo', 300);
    anularMovimiento(ctx, mov, motivo);
    if (mov.visita_id) ctx.auditar(`Movimiento anulado (${mov.tipo}); se conserva el original`, 'visita', mov.visita_id, `${pesos(mov.importe)} · ${motivo}`);
    else ctx.auditar('Movimiento anulado', 'movimiento', mov.id, motivo);
    return { ok: true };
  });

  // Cuenta corriente por cliente
  r.get('/api/cuentas', (ctx) => {
    exigir(ctx.usuario, 'ver.dinero');
    const filas = todos(ctx.db, `SELECT c.id, c.nombre, c.telefono, SUM(m.efecto) AS saldo, MAX(m.creado_at) AS ultimo
      FROM cuenta_movimientos m JOIN contactos c ON c.id = m.contacto_id WHERE m.taller_id = ? GROUP BY c.id HAVING SUM(m.efecto) <> 0 ORDER BY saldo DESC`, ctx.taller.id);
    return { cuentas: filas, total: filas.reduce((n, f) => n + Math.max(0, f.saldo), 0) };
  });

  r.get('/api/cuentas/:contactoId', (ctx) => {
    exigir(ctx.usuario, 'ver.dinero');
    const c = delTaller(ctx.db, 'contactos', ctx.taller.id, idEntero(ctx.params.contactoId), 'No encontramos ese cliente.');
    const movimientos = todos(ctx.db, `SELECT m.*, v.numero AS visita_numero, ve.numero AS venta_numero, u.nombre AS por, a.tipo AS anula_tipo
      FROM cuenta_movimientos m LEFT JOIN visitas v ON v.id = m.visita_id LEFT JOIN ventas ve ON ve.id = m.venta_id LEFT JOIN usuarios u ON u.id = m.creado_por
      LEFT JOIN cuenta_movimientos a ON a.id = m.anula_id WHERE m.taller_id = ? AND m.contacto_id = ? ORDER BY m.id`, ctx.taller.id, c.id);
    const anulados = new Set(movimientos.filter((m) => m.anula_id).map((m) => m.anula_id));
    movimientos.forEach((m) => { m.anulado = anulados.has(m.id); });
    return { contacto: { id: c.id, nombre: c.nombre, telefono: c.telefono }, movimientos, saldo: saldoContacto(ctx.db, ctx.taller.id, c.id) };
  });

  // Caja: dinero que entró o salió por medio de pago en un período (hora del taller).
  r.get('/api/caja', (ctx) => {
    exigir(ctx.usuario, 'ver.dinero');
    const z = ctx.taller.config.zona_horaria || 'America/Argentina/Mendoza';
    const desde = fechaValida(ctx.query.desde) ? ctx.query.desde : aLocal(isoAhora(), z).slice(0, 10);
    const hasta = fechaValida(ctx.query.hasta) ? ctx.query.hasta : desde;
    if (desde > hasta) falla('El período no es válido: «desde» es posterior a «hasta».');
    const movs = todos(ctx.db, `SELECT m.*, c.nombre AS cliente, v.numero AS visita_numero, ve.numero AS venta_numero, u.nombre AS por, a.tipo AS anula_tipo
      FROM cuenta_movimientos m LEFT JOIN contactos c ON c.id = m.contacto_id LEFT JOIN visitas v ON v.id = m.visita_id LEFT JOIN ventas ve ON ve.id = m.venta_id
      LEFT JOIN usuarios u ON u.id = m.creado_por LEFT JOIN cuenta_movimientos a ON a.id = m.anula_id
      WHERE m.taller_id = ? AND m.medio IS NOT NULL ORDER BY m.id`, ctx.taller.id)
      .map((m) => ({ ...m, dia: aLocal(m.fecha, z).slice(0, 10) }))
      .filter((m) => m.dia >= desde && m.dia <= hasta)
      // Dinero: pago = entra; devolución = sale; anulación de pago = sale; anulación de devolución = entra.
      .map((m) => ({ ...m, dinero: m.tipo === 'pago' ? m.importe : m.tipo === 'devolucion_dinero' ? -m.importe : m.anula_tipo === 'pago' ? -m.importe : m.anula_tipo === 'devolucion_dinero' ? m.importe : 0 }))
      .filter((m) => m.dinero !== 0);
    const proveedores = todos(ctx.db, 'SELECT p.*, c.numero AS compra_numero, pr.nombre AS proveedor FROM pagos_proveedor p JOIN compras c ON c.id = p.compra_id JOIN proveedores pr ON pr.id = c.proveedor_id WHERE p.taller_id = ? AND p.fecha BETWEEN ? AND ? AND p.anulado_at IS NULL ORDER BY p.id', ctx.taller.id, desde, hasta);
    const porMedio = Object.keys(MEDIOS).map((k) => ({
      medio: k, texto: MEDIOS[k],
      entra: movs.filter((m) => m.medio === k && m.dinero > 0).reduce((n, m) => n + m.dinero, 0),
      sale: -movs.filter((m) => m.medio === k && m.dinero < 0).reduce((n, m) => n + m.dinero, 0) + proveedores.filter((p) => p.medio === k).reduce((n, p) => n + p.importe, 0)
    }));
    return { desde, hasta, movimientos: movs, pagosProveedores: proveedores, porMedio, totalEntra: porMedio.reduce((n, x) => n + x.entra, 0), totalSale: porMedio.reduce((n, x) => n + x.sale, 0) };
  });
}
