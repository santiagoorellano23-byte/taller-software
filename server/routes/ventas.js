// Ventas de mostrador: independientes de una visita. El stock se descuenta una vez al confirmar;
// anular o devolver corrige stock y dinero con movimientos nuevos, sin borrar los anteriores.
import { uno, todos, insertar, ejecutar, siguiente } from '../db.js';
import { exigir } from '../permisos.js';
import { delTaller } from '../datos.js';
import { ErrorUsuario, falla, requerido, opcional, texto, enLista, dinero, cantidad, importeLinea, isoAhora, hoyLocal, idEntero } from '../util.js';
import { existencia } from './stock.js';
import { registrarMovimiento, anularMovimiento, MEDIOS } from './caja.js';
import { crearContacto } from './vehiculos.js';

const zona = (ctx) => ctx.taller.config.zona_horaria || 'America/Argentina/Mendoza';
const cant = (m, u) => `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${u || ''}`.trim();

function cargarVenta(db, tallerId, id) {
  const v = delTaller(db, 'ventas', tallerId, id, 'No encontramos esa venta.');
  v.lineas = todos(db, 'SELECT l.*, a.unidad FROM venta_lineas l LEFT JOIN articulos a ON a.id = l.articulo_id WHERE l.taller_id = ? AND l.venta_id = ? ORDER BY l.id', tallerId, v.id);
  v.movimientos = todos(db, 'SELECT m.*, a.tipo AS anula_tipo FROM cuenta_movimientos m LEFT JOIN cuenta_movimientos a ON a.id = m.anula_id WHERE m.taller_id = ? AND m.venta_id = ? ORDER BY m.id', tallerId, v.id);
  const anulados = new Set(v.movimientos.filter((m) => m.anula_id).map((m) => m.anula_id));
  v.movimientos.forEach((m) => { m.anulado = anulados.has(m.id); });
  v.saldo = Math.max(0, v.movimientos.reduce((n, m) => n + m.efecto, 0));
  v.cobrado = v.movimientos.filter((m) => m.tipo === 'pago' && !m.anulado).reduce((n, m) => n + m.importe, 0)
    - v.movimientos.filter((m) => m.tipo === 'devolucion_dinero' && !m.anulado).reduce((n, m) => n + m.importe, 0);
  v.contacto = v.contacto_id ? uno(db, 'SELECT id, nombre, telefono FROM contactos WHERE id = ?', v.contacto_id) : null;
  v.documento = uno(db, "SELECT id, numero FROM documentos WHERE taller_id = ? AND tipo = 'venta' AND ref_id = ? AND anulado_at IS NULL ORDER BY id DESC LIMIT 1", tallerId, v.id);
  return v;
}

export default function rutas(r) {
  r.get('/api/ventas', (ctx) => {
    exigir(ctx.usuario, 'ventas.registrar');
    return { ventas: todos(ctx.db, 'SELECT id FROM ventas WHERE taller_id = ? ORDER BY id DESC LIMIT 200', ctx.taller.id).map((x) => cargarVenta(ctx.db, ctx.taller.id, x.id)) };
  });
  r.get('/api/ventas/:id', (ctx) => {
    exigir(ctx.usuario, 'ventas.registrar');
    return { venta: cargarVenta(ctx.db, ctx.taller.id, idEntero(ctx.params.id)) };
  });

  r.post('/api/ventas', (ctx) => {
    exigir(ctx.usuario, 'ventas.registrar');
    const b = ctx.cuerpo;
    let contactoId = idEntero(b.contactoId);
    if (contactoId) delTaller(ctx.db, 'contactos', ctx.taller.id, contactoId, 'Ese cliente no es de este taller.');
    else if (b.contacto && texto(b.contacto.nombre)) contactoId = crearContacto(ctx, b.contacto);
    const lineas = Array.isArray(b.lineas) ? b.lineas : [];
    if (!lineas.length) falla('Agregá al menos un artículo a la venta.');
    const datos = lineas.map((l, i) => {
      const articuloId = idEntero(l.articuloId);
      const a = articuloId ? delTaller(ctx.db, 'articulos', ctx.taller.id, articuloId, `El artículo de la línea ${i + 1} no es de este taller.`) : null;
      const descripcion = a ? a.nombre : requerido(l.descripcion, `Escribí qué se vende en la línea ${i + 1}.`, `lineas.${i}.descripcion`, 200);
      const q = cantidad(l.cantidad ?? '1', `La cantidad de la línea ${i + 1} debe ser mayor que cero.`, `lineas.${i}.cantidad`);
      const precio = dinero(l.precio ?? (a?.precio_venta != null ? String(a.precio_venta / 100).replace('.', ',') : ''), `Escribí el precio de la línea ${i + 1}.`, `lineas.${i}.precio`, { cero: true });
      return { a, descripcion, cantidad_m: q, precio_unit: precio, importe: importeLinea(q, precio) };
    });
    // Controlar existencias antes de grabar (sumando líneas del mismo artículo).
    const porArticulo = new Map();
    for (const d of datos) if (d.a) porArticulo.set(d.a.id, (porArticulo.get(d.a.id) || 0) + d.cantidad_m);
    for (const [aid, q] of porArticulo) {
      const e = existencia(ctx.db, ctx.taller.id, aid);
      const a = datos.find((d) => d.a?.id === aid).a;
      if (e.disponible < q) throw new ErrorUsuario(409, `No hay existencias suficientes de «${a.nombre}»: disponibles ${cant(e.disponible, a.unidad)}.`);
    }
    const total = datos.reduce((n, d) => n + d.importe, 0);
    let cobro = null;
    if (b.cobro && String(b.cobro.importe ?? '').trim() !== '') {
      cobro = {
        importe: dinero(b.cobro.importe, 'Escribí el importe cobrado.', 'cobroImporte'),
        medio: enLista(b.cobro.medio, Object.keys(MEDIOS), 'Elegí cómo pagó.', 'cobroMedio'),
        referencia: opcional(b.cobro.referencia, 120)
      };
      if (cobro.importe > total) falla('El cobro supera el total de la venta. Si sobra cambio, registrá solo el total.', 'cobroImporte');
    }
    if (!contactoId && (!cobro || cobro.importe < total)) falla('Para dejar saldo pendiente, elegí o creá el cliente. Si es un consumidor sin datos, cobrá el total.', 'cliente');

    const numero = siguiente(ctx.db, ctx.taller.id, 'venta');
    const id = insertar(ctx.db, "INSERT INTO ventas (taller_id, numero, contacto_id, cliente_nombre, fecha, estado, total, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, 'confirmada', ?, ?, ?)",
      ctx.taller.id, numero, contactoId, contactoId ? null : (opcional(b.clienteNombre, 120) || 'Consumidor sin datos'), hoyLocal(zona(ctx)), total, ctx.usuario.id, isoAhora());
    for (const d of datos) {
      const lid = insertar(ctx.db, 'INSERT INTO venta_lineas (taller_id, venta_id, articulo_id, descripcion, cantidad_m, precio_unit, importe) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ctx.taller.id, id, d.a?.id ?? null, d.descripcion, d.cantidad_m, d.precio_unit, d.importe);
      if (d.a) insertar(ctx.db, "INSERT INTO movimientos_stock (taller_id, articulo_id, tipo, cantidad_m, costo_unit, ref_tipo, ref_id, motivo, creado_por, creado_at) VALUES (?, ?, 'venta', ?, ?, 'venta_linea', ?, ?, ?, ?)",
        ctx.taller.id, d.a.id, -d.cantidad_m, d.a.costo_ultimo, lid, `Venta de mostrador N.º ${numero}`, ctx.usuario.id, isoAhora());
    }
    if (total > 0) registrarMovimiento(ctx, { tipo: 'cargo', importe: total, contactoId, ventaId: id, motivo: `Venta de mostrador N.º ${numero} (no fiscal)` });
    if (cobro) registrarMovimiento(ctx, { tipo: 'pago', importe: cobro.importe, medio: cobro.medio, referencia: cobro.referencia, contactoId, ventaId: id, motivo: 'Cobro de venta de mostrador' });
    ctx.auditar('Venta de mostrador registrada', 'venta', id, `N.º ${numero} · total ${total / 100}`);
    return { id, venta: cargarVenta(ctx.db, ctx.taller.id, id) };
  });

  r.post('/api/ventas/:id/pagos', (ctx) => {
    exigir(ctx.usuario, 'caja.registrar');
    const v = cargarVenta(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    if (v.estado === 'anulada') falla('La venta está anulada.');
    const importe = dinero(ctx.cuerpo.importe, 'Escribí el importe cobrado.', 'importe');
    if (importe > v.saldo) falla('El cobro supera el saldo de la venta.', 'importe');
    const medio = enLista(ctx.cuerpo.medio, Object.keys(MEDIOS), 'Elegí cómo pagó.', 'medio');
    registrarMovimiento(ctx, { tipo: 'pago', importe, medio, referencia: opcional(ctx.cuerpo.referencia, 120), contactoId: v.contacto_id, ventaId: v.id, motivo: 'Cobro de saldo de venta' });
    ctx.auditar('Cobro de venta registrado', 'venta', v.id, String(importe / 100));
    return { venta: cargarVenta(ctx.db, ctx.taller.id, v.id) };
  });

  // Anulación completa: repone el stock no devuelto y anula cargo y cobros (los cobros anulados figuran como salida de caja).
  r.post('/api/ventas/:id/anular', (ctx) => {
    exigir(ctx.usuario, 'ventas.anular', 'Solo el dueño anula ventas.');
    const v = cargarVenta(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    if (v.estado === 'anulada') falla('La venta ya está anulada.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí el motivo de la anulación.', 'motivo', 300);
    for (const l of v.lineas) {
      const resto = l.cantidad_m - l.devuelto_m;
      if (l.articulo_id && resto > 0) insertar(ctx.db, "INSERT INTO movimientos_stock (taller_id, articulo_id, tipo, cantidad_m, ref_tipo, ref_id, motivo, creado_por, creado_at) VALUES (?, ?, 'anulacion_venta', ?, 'venta_linea', ?, ?, ?, ?)",
        ctx.taller.id, l.articulo_id, resto, l.id, `Anulación de la venta N.º ${v.numero}: ${motivo}`, ctx.usuario.id, isoAhora());
      ejecutar(ctx.db, 'UPDATE venta_lineas SET devuelto_m = cantidad_m WHERE id = ?', l.id);
    }
    for (const m of v.movimientos.filter((m) => m.tipo !== 'anulacion' && !m.anulado)) anularMovimiento(ctx, m, `Anulación de la venta: ${motivo}`);
    ejecutar(ctx.db, "UPDATE ventas SET estado = 'anulada', anulada_motivo = ?, version = version + 1 WHERE id = ?", motivo, v.id);
    if (v.documento) ejecutar(ctx.db, 'UPDATE documentos SET anulado_at = ?, anulado_motivo = ? WHERE id = ?', isoAhora(), `Venta anulada: ${motivo}`, v.documento.id);
    ctx.auditar('Venta anulada (stock y dinero corregidos con movimientos)', 'venta', v.id, motivo);
    return { venta: cargarVenta(ctx.db, ctx.taller.id, v.id) };
  });

  // Devolución parcial de artículos: vuelve al stock, nota de crédito y, si corresponde, reintegro de dinero.
  r.post('/api/ventas/:id/devolucion', (ctx) => {
    exigir(ctx.usuario, 'ventas.registrar');
    const v = cargarVenta(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    if (v.estado === 'anulada') falla('La venta está anulada.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí el motivo de la devolución.', 'motivo', 300);
    const items = Array.isArray(ctx.cuerpo.lineas) ? ctx.cuerpo.lineas.filter((x) => x && String(x.cantidad ?? '').trim()) : [];
    if (!items.length) falla('Indicá qué cantidad devuelve el cliente.');
    let valor = 0;
    for (const it of items) {
      const l = v.lineas.find((x) => x.id === idEntero(it.lineaId));
      if (!l) falla('Una línea no corresponde a esta venta.');
      const q = cantidad(it.cantidad, 'La cantidad devuelta debe ser mayor que cero.', 'cantidad');
      if (l.devuelto_m + q > l.cantidad_m) falla(`No se puede devolver más de lo vendido de «${l.descripcion}».`);
      if (l.articulo_id) insertar(ctx.db, "INSERT INTO movimientos_stock (taller_id, articulo_id, tipo, cantidad_m, ref_tipo, motivo, creado_por, creado_at) VALUES (?, ?, 'devolucion_cliente', ?, 'venta_linea_devolucion', ?, ?, ?)",
        ctx.taller.id, l.articulo_id, q, `Devolución de la venta N.º ${v.numero}: ${motivo}`, ctx.usuario.id, isoAhora());
      ejecutar(ctx.db, 'UPDATE venta_lineas SET devuelto_m = devuelto_m + ? WHERE id = ?', q, l.id);
      valor += importeLinea(q, l.precio_unit);
    }
    if (valor > 0) registrarMovimiento(ctx, { tipo: 'nota_credito', importe: valor, contactoId: v.contacto_id, ventaId: v.id, motivo: `Devolución de artículos: ${motivo}` });
    const reintegro = ctx.cuerpo.reintegro;
    if (reintegro && String(reintegro.importe ?? '').trim() !== '') {
      const imp = dinero(reintegro.importe, 'Escribí el dinero devuelto.', 'reintegroImporte');
      if (imp > Math.min(valor, v.cobrado)) falla('El dinero devuelto no puede superar el valor devuelto ni lo cobrado.', 'reintegroImporte');
      registrarMovimiento(ctx, { tipo: 'devolucion_dinero', importe: imp, medio: enLista(reintegro.medio, Object.keys(MEDIOS), 'Elegí cómo se devolvió el dinero.', 'reintegroMedio'), contactoId: v.contacto_id, ventaId: v.id, motivo });
    }
    ctx.auditar('Devolución de mostrador', 'venta', v.id, motivo);
    return { venta: cargarVenta(ctx.db, ctx.taller.id, v.id) };
  });
}
