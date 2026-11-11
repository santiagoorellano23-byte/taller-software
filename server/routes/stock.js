// Stock, proveedores y compras.
// Regla única de consumo: la existencia SOLO cambia por movimientos.
//   + recepción de compra (una vez por línea), ajuste, devolución de cliente, anulación de venta, reintegro.
//   - colocación de un repuesto del taller vinculado a un artículo, producto usado, venta, devolución a proveedor, ajuste.
// Pedir o registrar que llegó un repuesto NO mueve stock: la llegada física se registra con la recepción de la compra.
import { uno, todos, insertar, ejecutar, siguiente } from '../db.js';
import { exigir, puede } from '../permisos.js';
import { delTaller } from '../datos.js';
import {
  ErrorUsuario, falla, conflicto, requerido, opcional, texto, enLista, dinero, cantidad, parseCantidad, isoAhora, hoyLocal, fechaValida, idEntero
} from '../util.js';

const UNIDADES = ['u.', 'L', 'kg', 'm', 'juego', 'kit', 'par'];
const MEDIOS = ['efectivo', 'transferencia', 'debito', 'credito', 'cheque', 'otro'];
const zona = (ctx) => ctx.taller.config.zona_horaria || 'America/Argentina/Mendoza';
const cant = (m, u) => `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${u}`;

export function existencia(db, tallerId, articuloId) {
  const e = uno(db, 'SELECT COALESCE(SUM(cantidad_m), 0) AS n FROM movimientos_stock WHERE taller_id = ? AND articulo_id = ?', tallerId, articuloId).n;
  const r = uno(db, "SELECT COALESCE(SUM(cantidad_m), 0) AS n FROM reservas WHERE taller_id = ? AND articulo_id = ? AND estado = 'activa'", tallerId, articuloId).n;
  return { existencia: e, reservado: r, disponible: e - r };
}

function mover(ctx, articuloId, tipo, cantidadM, { costo = null, refTipo = null, refId = null, motivo = null } = {}) {
  return insertar(ctx.db, 'INSERT INTO movimientos_stock (taller_id, articulo_id, tipo, cantidad_m, costo_unit, ref_tipo, ref_id, motivo, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.taller.id, articuloId, tipo, cantidadM, costo, refTipo, refId, motivo, ctx.usuario.id, isoAhora());
}
function exigirDisponible(ctx, a, cantidadM, incluyeReservaPropia = 0) {
  const e = existencia(ctx.db, ctx.taller.id, a.id);
  if (e.disponible + incluyeReservaPropia < cantidadM) {
    throw new ErrorUsuario(409, `No hay existencias suficientes de «${a.nombre}»: disponibles ${cant(e.disponible + incluyeReservaPropia, a.unidad)}${e.reservado ? ` (además hay ${cant(e.reservado, a.unidad)} reservadas para otros trabajos)` : ''}. Registrá la recepción de la compra o corregí el stock antes de continuar.`);
  }
}

// Llamado al marcar un repuesto como colocado.
export function consumirRepuesto(ctx, rp) {
  if (rp.origen !== 'taller' || !rp.articulo_id) return;
  const a = delTaller(ctx.db, 'articulos', ctx.taller.id, rp.articulo_id);
  let reserva = uno(ctx.db, "SELECT * FROM reservas WHERE taller_id = ? AND repuesto_id = ? AND estado = 'activa'", ctx.taller.id, rp.id);
  if (reserva) {
    if (reserva.cantidad_m !== rp.cantidad_m) falla('La reserva no coincide con la cantidad del repuesto. Liberala y reservá de nuevo.');
    exigirDisponible(ctx, a, rp.cantidad_m, reserva.cantidad_m);
    ejecutar(ctx.db, "UPDATE reservas SET estado = 'consumida' WHERE id = ?", reserva.id);
  } else {
    exigirDisponible(ctx, a, rp.cantidad_m);
    const id = insertar(ctx.db, "INSERT INTO reservas (taller_id, articulo_id, repuesto_id, cantidad_m, estado, motivo, creado_por, creado_at) VALUES (?, ?, ?, ?, 'consumida', 'Colocado sin reserva previa', ?, ?)",
      ctx.taller.id, a.id, rp.id, rp.cantidad_m, ctx.usuario.id, isoAhora());
    reserva = { id };
  }
  mover(ctx, a.id, 'consumo', -rp.cantidad_m, { refTipo: 'reserva', refId: reserva.id, motivo: `Colocado: ${rp.descripcion} (visita ${rp.visita_id})` });
}
export function reintegrarRepuesto(ctx, rp, motivo) {
  const reserva = uno(ctx.db, "SELECT * FROM reservas WHERE taller_id = ? AND repuesto_id = ? AND estado = 'consumida'", ctx.taller.id, rp.id);
  if (!reserva) return;
  mover(ctx, reserva.articulo_id, 'reintegro_consumo', reserva.cantidad_m, { refTipo: 'reserva', refId: reserva.id, motivo: `Corrección: ${motivo}` });
  ejecutar(ctx.db, "UPDATE reservas SET estado = 'liberada', motivo = ? WHERE id = ?", `Reintegro por corrección: ${motivo}`, reserva.id);
}
export function consumirProducto(ctx, p) {
  const a = delTaller(ctx.db, 'articulos', ctx.taller.id, p.articulo_id);
  exigirDisponible(ctx, a, p.cantidad_m);
  mover(ctx, a.id, 'consumo', -p.cantidad_m, { refTipo: 'producto_usado', refId: p.id, motivo: `Usado en la visita ${p.visita_id}: ${p.descripcion}` });
}
export function reintegrarProducto(ctx, p, motivo) {
  mover(ctx, p.articulo_id, 'reintegro_consumo', p.cantidad_m, { refTipo: 'producto_usado', refId: p.id, motivo: `Anulado: ${motivo}` });
}

function articuloConStock(db, tallerId, a) {
  const e = existencia(db, tallerId, a.id);
  return { ...a, ...e, bajoMinimo: a.minimo_m > 0 && e.existencia <= a.minimo_m };
}

function datosArticulo(b) {
  const nombre = requerido(b.nombre, 'Escribí el nombre del artículo.', 'nombre', 160);
  const unidad = enLista(texto(b.unidad) || 'u.', UNIDADES, 'Elegí la unidad en que se cuenta.', 'unidad');
  const minimo = b.minimo == null || String(b.minimo).trim() === '' ? 0 : parseCantidad(b.minimo);
  if (minimo === null) falla('El mínimo debe ser un número.', 'minimo');
  const precio = b.precioVenta == null || String(b.precioVenta).trim() === '' ? null : dinero(b.precioVenta, 'El precio de venta debe escribirse con números.', 'precioVenta', { cero: true });
  return { nombre, unidad, minimo_m: minimo, codigo: opcional(b.codigo, 60), precio_venta: precio };
}

export default function rutas(r) {
  // ----- Artículos y existencias -----
  r.get('/api/articulos', (ctx) => {
    exigir(ctx.usuario, 'stock.ver');
    const filas = todos(ctx.db, 'SELECT * FROM articulos WHERE taller_id = ? AND activo = ? ORDER BY nombre', ctx.taller.id, ctx.query.inactivos === '1' ? 0 : 1)
      .map((a) => articuloConStock(ctx.db, ctx.taller.id, a));
    if (!puede(ctx.usuario, 'ver.dinero')) filas.forEach((a) => { a.costo_ultimo = null; a.precio_venta = null; });
    return { articulos: filas };
  });

  r.get('/api/articulos/:id', (ctx) => {
    exigir(ctx.usuario, 'stock.ver');
    const a = articuloConStock(ctx.db, ctx.taller.id, delTaller(ctx.db, 'articulos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese artículo.'));
    a.movimientos = todos(ctx.db, 'SELECT m.*, u.nombre AS por FROM movimientos_stock m LEFT JOIN usuarios u ON u.id = m.creado_por WHERE m.taller_id = ? AND m.articulo_id = ? ORDER BY m.id DESC LIMIT 200', ctx.taller.id, a.id);
    a.reservas = todos(ctx.db, `SELECT rs.*, rp.descripcion, rp.visita_id, v.numero AS visita_numero FROM reservas rs JOIN repuestos rp ON rp.id = rs.repuesto_id JOIN visitas v ON v.id = rp.visita_id
      WHERE rs.taller_id = ? AND rs.articulo_id = ? AND rs.estado = 'activa'`, ctx.taller.id, a.id);
    if (!puede(ctx.usuario, 'ver.dinero')) { a.costo_ultimo = null; a.precio_venta = null; a.movimientos.forEach((m) => { m.costo_unit = null; }); }
    return { articulo: a };
  });

  r.post('/api/articulos', (ctx) => {
    exigir(ctx.usuario, 'stock.articulos');
    const d = datosArticulo(ctx.cuerpo);
    if (todos(ctx.db, 'SELECT nombre FROM articulos WHERE taller_id = ? AND activo = 1', ctx.taller.id).some((x) => x.nombre.toLowerCase() === d.nombre.toLowerCase())) falla('Ya existe un artículo con ese nombre.', 'nombre');
    const id = insertar(ctx.db, 'INSERT INTO articulos (taller_id, codigo, nombre, unidad, minimo_m, precio_venta) VALUES (?, ?, ?, ?, ?, ?)', ctx.taller.id, d.codigo, d.nombre, d.unidad, d.minimo_m, d.precio_venta);
    const inicial = ctx.cuerpo.existenciaInicial != null && String(ctx.cuerpo.existenciaInicial).trim() !== '' ? parseCantidad(ctx.cuerpo.existenciaInicial) : 0;
    if (inicial === null) falla('La existencia inicial debe ser un número.', 'existenciaInicial');
    if (inicial > 0) {
      exigir(ctx.usuario, 'stock.ajustar', 'Solo el dueño carga existencias iniciales. Creá el artículo sin existencia y registrá la compra.');
      mover(ctx, id, 'inicial', inicial, { motivo: 'Existencia inicial contada' });
    }
    ctx.auditar('Artículo creado', 'articulo', id, d.nombre);
    return { id };
  });

  r.put('/api/articulos/:id', (ctx) => {
    exigir(ctx.usuario, 'stock.articulos');
    const a = delTaller(ctx.db, 'articulos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese artículo.');
    if (Number(ctx.cuerpo.version) !== a.version) conflicto();
    const d = datosArticulo({ ...a, precioVenta: a.precio_venta == null ? null : String(a.precio_venta / 100).replace('.', ','), minimo: String(a.minimo_m / 1000), ...ctx.cuerpo });
    if (d.unidad !== a.unidad && uno(ctx.db, 'SELECT id FROM movimientos_stock WHERE articulo_id = ?', a.id)) falla('El artículo ya tiene movimientos: no se cambia su unidad. Creá otro artículo.', 'unidad');
    const activo = ctx.cuerpo.activo === undefined ? a.activo : (ctx.cuerpo.activo ? 1 : 0);
    ejecutar(ctx.db, 'UPDATE articulos SET codigo = ?, nombre = ?, unidad = ?, minimo_m = ?, precio_venta = ?, activo = ?, version = version + 1 WHERE id = ?', d.codigo, d.nombre, d.unidad, d.minimo_m, d.precio_venta, activo, a.id);
    ctx.auditar('Artículo actualizado', 'articulo', a.id, d.nombre);
    return { ok: true };
  });

  // Ajuste con motivo (conteo físico, rotura, pérdida). No reemplaza la existencia: agrega un movimiento.
  r.post('/api/articulos/:id/ajuste', (ctx) => {
    exigir(ctx.usuario, 'stock.ajustar', 'Solo el dueño corrige existencias.');
    const a = delTaller(ctx.db, 'articulos', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese artículo.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Explicá el motivo del ajuste (por ejemplo: conteo físico).', 'motivo', 300);
    const sentido = enLista(ctx.cuerpo.sentido, ['entrada', 'salida'], 'Elegí si suma o resta.', 'sentido');
    const c = cantidad(ctx.cuerpo.cantidad, 'Escribí la cantidad del ajuste.', 'cantidad');
    if (sentido === 'salida') exigirDisponible(ctx, a, c);
    mover(ctx, a.id, 'ajuste', sentido === 'entrada' ? c : -c, { motivo });
    ctx.auditar('Ajuste de stock', 'articulo', a.id, `${sentido === 'entrada' ? '+' : '-'}${cant(c, a.unidad)} · ${motivo}`);
    return { ok: true };
  });

  // Reserva para un repuesto de una visita: debe coincidir artículo, unidad y cantidad.
  r.post('/api/repuestos/:rid/reservar', (ctx) => {
    exigir(ctx.usuario, 'stock.reservar');
    const rp = delTaller(ctx.db, 'repuestos', ctx.taller.id, idEntero(ctx.params.rid), 'No encontramos ese repuesto.');
    const v = delTaller(ctx.db, 'visitas', ctx.taller.id, rp.visita_id);
    if (v.entregada_at || v.anulada_at) falla('La visita está cerrada.');
    if (rp.origen !== 'taller') falla('Ese repuesto lo trae el cliente: no se reserva stock del taller.');
    if (rp.etapa === 'colocado') falla('El repuesto ya está colocado.');
    const a = delTaller(ctx.db, 'articulos', ctx.taller.id, idEntero(ctx.cuerpo.articuloId), 'Elegí un artículo de stock.');
    if (a.unidad !== rp.unidad) falla(`El artículo se cuenta en «${a.unidad}» y el repuesto en «${rp.unidad}».`);
    if (uno(ctx.db, "SELECT id FROM reservas WHERE taller_id = ? AND repuesto_id = ? AND estado IN ('activa','consumida')", ctx.taller.id, rp.id)) falla('Este repuesto ya tiene una reserva.');
    exigirDisponible(ctx, a, rp.cantidad_m);
    insertar(ctx.db, "INSERT INTO reservas (taller_id, articulo_id, repuesto_id, cantidad_m, estado, creado_por, creado_at) VALUES (?, ?, ?, ?, 'activa', ?, ?)", ctx.taller.id, a.id, rp.id, rp.cantidad_m, ctx.usuario.id, isoAhora());
    ejecutar(ctx.db, 'UPDATE repuestos SET articulo_id = ?, version = version + 1 WHERE id = ?', a.id, rp.id);
    ctx.auditar('Stock reservado para un repuesto (todavía no se descuenta)', 'visita', v.id, `${rp.descripcion} · ${a.nombre}`);
    return { ok: true };
  });

  r.post('/api/reservas/:id/liberar', (ctx) => {
    exigir(ctx.usuario, 'stock.reservar');
    const rs = delTaller(ctx.db, 'reservas', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos esa reserva.');
    if (rs.estado !== 'activa') falla('Solo se libera una reserva vigente.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí por qué se libera la reserva.', 'motivo', 300);
    ejecutar(ctx.db, "UPDATE reservas SET estado = 'liberada', motivo = ? WHERE id = ?", motivo, rs.id);
    const rp = uno(ctx.db, 'SELECT visita_id, descripcion FROM repuestos WHERE id = ?', rs.repuesto_id);
    ctx.auditar('Reserva de stock liberada', 'visita', rp.visita_id, `${rp.descripcion} · ${motivo}`);
    return { ok: true };
  });

  // ----- Proveedores -----
  r.get('/api/proveedores', (ctx) => {
    exigir(ctx.usuario, 'stock.ver');
    return { proveedores: todos(ctx.db, 'SELECT * FROM proveedores WHERE taller_id = ? AND activo = 1 ORDER BY nombre', ctx.taller.id) };
  });
  r.post('/api/proveedores', (ctx) => {
    exigir(ctx.usuario, 'proveedores.gestionar');
    const nombre = requerido(ctx.cuerpo.nombre, 'Escribí el nombre del proveedor.', 'nombre', 120);
    const id = insertar(ctx.db, 'INSERT INTO proveedores (taller_id, nombre, telefono, email, notas) VALUES (?, ?, ?, ?, ?)', ctx.taller.id, nombre, opcional(ctx.cuerpo.telefono, 40), opcional(ctx.cuerpo.email, 160), opcional(ctx.cuerpo.notas, 1000));
    ctx.auditar('Proveedor creado', 'proveedor', id, nombre);
    return { id };
  });
  r.put('/api/proveedores/:id', (ctx) => {
    exigir(ctx.usuario, 'proveedores.gestionar');
    const p = delTaller(ctx.db, 'proveedores', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese proveedor.');
    const nombre = requerido(ctx.cuerpo.nombre ?? p.nombre, 'Escribí el nombre del proveedor.', 'nombre', 120);
    ejecutar(ctx.db, 'UPDATE proveedores SET nombre = ?, telefono = ?, email = ?, notas = ?, activo = ? WHERE id = ?', nombre,
      opcional(ctx.cuerpo.telefono ?? p.telefono, 40), opcional(ctx.cuerpo.email ?? p.email, 160), opcional(ctx.cuerpo.notas ?? p.notas, 1000), ctx.cuerpo.activo === false ? 0 : 1, p.id);
    ctx.auditar('Proveedor actualizado', 'proveedor', p.id, nombre);
    return { ok: true };
  });

  // ----- Compras -----
  function cargarCompra(db, tallerId, id) {
    const c = delTaller(db, 'compras', tallerId, id, 'No encontramos esa compra.');
    c.proveedor = uno(db, 'SELECT id, nombre, telefono FROM proveedores WHERE id = ?', c.proveedor_id);
    c.lineas = todos(db, 'SELECT l.*, a.nombre AS articulo, a.unidad FROM compra_lineas l JOIN articulos a ON a.id = l.articulo_id WHERE l.taller_id = ? AND l.compra_id = ? ORDER BY l.id', tallerId, c.id);
    c.total = c.lineas.reduce((n, l) => n + Math.round((l.cantidad_m * l.costo_unit) / 1000), 0);
    c.documentos = todos(db, 'SELECT * FROM compra_documentos WHERE taller_id = ? AND compra_id = ? ORDER BY id', tallerId, c.id);
    c.pagos = todos(db, 'SELECT * FROM pagos_proveedor WHERE taller_id = ? AND compra_id = ? ORDER BY id', tallerId, c.id);
    c.pagado = c.pagos.filter((p) => !p.anulado_at).reduce((n, p) => n + p.importe, 0);
    c.saldoProveedor = Math.max(0, c.total - c.pagado);
    return c;
  }

  r.get('/api/compras', (ctx) => {
    exigir(ctx.usuario, 'compras.gestionar');
    const filas = todos(ctx.db, 'SELECT id FROM compras WHERE taller_id = ? ORDER BY id DESC LIMIT 200', ctx.taller.id).map((x) => cargarCompra(ctx.db, ctx.taller.id, x.id));
    return { compras: filas };
  });
  r.get('/api/compras/:id', (ctx) => {
    exigir(ctx.usuario, 'compras.gestionar');
    return { compra: cargarCompra(ctx.db, ctx.taller.id, idEntero(ctx.params.id)) };
  });

  function agregarDocumento(ctx, compra, d) {
    const tipo = enLista(d.tipo, ['remito', 'factura', 'otro'], 'Elegí el tipo de documento del proveedor.', 'docTipo');
    const numero = requerido(d.numero, 'Escribí el número del documento.', 'docNumero', 60).toUpperCase().replace(/\s+/g, '');
    const previo = uno(ctx.db, 'SELECT d.compra_id, c.numero FROM compra_documentos d JOIN compras c ON c.id = d.compra_id WHERE d.taller_id = ? AND d.proveedor_id = ? AND d.tipo = ? AND d.numero = ?', ctx.taller.id, compra.proveedor_id, tipo, numero);
    if (previo) throw new ErrorUsuario(409, `Ese ${tipo} ya está cargado en la compra N.º ${previo.numero}. No se ingresa dos veces.`, 'docNumero', { compraId: previo.compra_id });
    if (d.fecha && !fechaValida(d.fecha)) falla('La fecha del documento no es válida.', 'docFecha');
    const importe = d.importe != null && String(d.importe).trim() !== '' ? dinero(d.importe, 'El importe del documento debe escribirse con números.', 'docImporte', { cero: true }) : null;
    insertar(ctx.db, 'INSERT INTO compra_documentos (taller_id, compra_id, proveedor_id, tipo, numero, fecha, importe, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ctx.taller.id, compra.id, compra.proveedor_id, tipo, numero, d.fecha || null, importe, ctx.usuario.id, isoAhora());
    return `${tipo} ${numero}`;
  }

  function recibir(ctx, c) {
    if (c.estado === 'recibida') throw new ErrorUsuario(409, 'Esta compra ya se recibió. La mercadería no se ingresa dos veces.');
    if (c.estado === 'anulada') falla('La compra está anulada.');
    for (const l of c.lineas) {
      mover(ctx, l.articulo_id, 'compra', l.cantidad_m, { costo: l.costo_unit, refTipo: 'compra_linea', refId: l.id, motivo: `Compra N.º ${c.numero} · ${c.proveedor.nombre}` });
      ejecutar(ctx.db, 'UPDATE articulos SET costo_ultimo = ? WHERE id = ?', l.costo_unit, l.articulo_id);
    }
    ejecutar(ctx.db, "UPDATE compras SET estado = 'recibida', recibida_at = ?, recibida_por = ?, version = version + 1 WHERE id = ?", isoAhora(), ctx.usuario.id, c.id);
    ctx.auditar('Compra recibida: ingresa al stock una sola vez', 'compra', c.id, c.lineas.map((l) => `${l.articulo} +${cant(l.cantidad_m, l.unidad)}`).join('; '));
  }

  r.post('/api/compras', (ctx) => {
    exigir(ctx.usuario, 'compras.gestionar');
    const b = ctx.cuerpo;
    const prov = delTaller(ctx.db, 'proveedores', ctx.taller.id, idEntero(b.proveedorId), 'Elegí un proveedor de la lista o creá uno nuevo.');
    const fecha = b.fecha && fechaValida(b.fecha) ? b.fecha : hoyLocal(zona(ctx));
    const lineas = Array.isArray(b.lineas) ? b.lineas : [];
    if (!lineas.length) falla('Agregá al menos un artículo a la compra.');
    const datos = lineas.map((l, i) => {
      let articuloId = idEntero(l.articuloId);
      if (!articuloId && l.nuevoArticulo) {
        exigir(ctx.usuario, 'stock.articulos');
        const d = datosArticulo(l.nuevoArticulo);
        articuloId = insertar(ctx.db, 'INSERT INTO articulos (taller_id, codigo, nombre, unidad, minimo_m, precio_venta) VALUES (?, ?, ?, ?, ?, ?)', ctx.taller.id, d.codigo, d.nombre, d.unidad, d.minimo_m, d.precio_venta);
      }
      delTaller(ctx.db, 'articulos', ctx.taller.id, articuloId, `Elegí el artículo de la línea ${i + 1}.`);
      return {
        articuloId,
        cantidad_m: cantidad(l.cantidad, `La cantidad de la línea ${i + 1} debe ser mayor que cero.`, `lineas.${i}.cantidad`),
        costo: dinero(l.costo, `Escribí el costo unitario de la línea ${i + 1}.`, `lineas.${i}.costo`, { cero: true })
      };
    });
    const numero = siguiente(ctx.db, ctx.taller.id, 'compra');
    const id = insertar(ctx.db, "INSERT INTO compras (taller_id, numero, proveedor_id, fecha, estado, nota, creado_por, creado_at) VALUES (?, ?, ?, ?, 'borrador', ?, ?, ?)",
      ctx.taller.id, numero, prov.id, fecha, opcional(b.nota, 500), ctx.usuario.id, isoAhora());
    for (const d of datos) insertar(ctx.db, 'INSERT INTO compra_lineas (taller_id, compra_id, articulo_id, cantidad_m, costo_unit) VALUES (?, ?, ?, ?, ?)', ctx.taller.id, id, d.articuloId, d.cantidad_m, d.costo);
    let doc = null;
    if (b.documento && texto(b.documento.numero)) doc = agregarDocumento(ctx, { id, proveedor_id: prov.id }, b.documento);
    ctx.auditar('Compra registrada', 'compra', id, `N.º ${numero} · ${prov.nombre}${doc ? ' · ' + doc : ''}`);
    if (b.recibir) recibir(ctx, cargarCompra(ctx.db, ctx.taller.id, id));
    return { id, compra: cargarCompra(ctx.db, ctx.taller.id, id) };
  });

  r.post('/api/compras/:id/recibir', (ctx) => {
    exigir(ctx.usuario, 'compras.gestionar');
    const c = cargarCompra(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    recibir(ctx, c);
    return { compra: cargarCompra(ctx.db, ctx.taller.id, c.id) };
  });

  // Agregar la factura de un remito ya recibido: queda vinculada, no vuelve a ingresar mercadería.
  r.post('/api/compras/:id/documentos', (ctx) => {
    exigir(ctx.usuario, 'compras.gestionar');
    const c = cargarCompra(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    const doc = agregarDocumento(ctx, c, ctx.cuerpo);
    ctx.auditar('Documento del proveedor vinculado (no mueve stock)', 'compra', c.id, doc);
    return { compra: cargarCompra(ctx.db, ctx.taller.id, c.id) };
  });

  r.post('/api/compras/:id/devolver', (ctx) => {
    exigir(ctx.usuario, 'compras.gestionar');
    const c = cargarCompra(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    if (c.estado !== 'recibida') falla('Solo se devuelve mercadería de una compra recibida.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Explicá el motivo de la devolución.', 'motivo', 300);
    const items = Array.isArray(ctx.cuerpo.lineas) ? ctx.cuerpo.lineas.filter((x) => x && String(x.cantidad ?? '').trim()) : [];
    if (!items.length) falla('Indicá qué cantidad se devuelve.');
    for (const it of items) {
      const l = c.lineas.find((x) => x.id === idEntero(it.lineaId));
      if (!l) falla('Una línea no corresponde a esta compra.');
      const q = cantidad(it.cantidad, 'La cantidad a devolver debe ser mayor que cero.', 'cantidad');
      if (l.devuelto_m + q > l.cantidad_m) falla(`No se puede devolver más de lo comprado de «${l.articulo}».`);
      exigirDisponible(ctx, { id: l.articulo_id, nombre: l.articulo, unidad: l.unidad }, q);
      mover(ctx, l.articulo_id, 'devolucion_proveedor', -q, { costo: l.costo_unit, motivo: `Devolución de la compra N.º ${c.numero}: ${motivo}` });
      ejecutar(ctx.db, 'UPDATE compra_lineas SET devuelto_m = devuelto_m + ? WHERE id = ?', q, l.id);
    }
    ctx.auditar('Devolución al proveedor', 'compra', c.id, motivo);
    return { compra: cargarCompra(ctx.db, ctx.taller.id, c.id) };
  });

  r.post('/api/compras/:id/anular', (ctx) => {
    exigir(ctx.usuario, 'compras.anular', 'Solo el dueño anula compras.');
    const c = cargarCompra(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    if (c.estado === 'anulada') falla('La compra ya está anulada.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí el motivo de la anulación.', 'motivo', 300);
    if (c.pagos.some((p) => !p.anulado_at)) falla('La compra tiene pagos registrados. Anulá los pagos antes.');
    if (c.estado === 'recibida') {
      for (const l of c.lineas) {
        const resto = l.cantidad_m - l.devuelto_m;
        if (resto <= 0) continue;
        exigirDisponible(ctx, { id: l.articulo_id, nombre: l.articulo, unidad: l.unidad }, resto);
        mover(ctx, l.articulo_id, 'devolucion_proveedor', -resto, { costo: l.costo_unit, motivo: `Anulación de la compra N.º ${c.numero}: ${motivo}` });
        ejecutar(ctx.db, 'UPDATE compra_lineas SET devuelto_m = cantidad_m WHERE id = ?', l.id);
      }
    }
    ejecutar(ctx.db, "UPDATE compras SET estado = 'anulada', anulada_motivo = ?, version = version + 1 WHERE id = ?", motivo, c.id);
    ctx.auditar('Compra anulada (se conservan sus movimientos)', 'compra', c.id, motivo);
    return { compra: cargarCompra(ctx.db, ctx.taller.id, c.id) };
  });

  // Pago al proveedor: separado de la compra. La clave de idempotencia evita duplicarlo por reintento.
  r.post('/api/compras/:id/pagos', (ctx) => {
    exigir(ctx.usuario, 'compras.pagar', 'Solo el dueño registra pagos a proveedores.');
    const c = cargarCompra(ctx.db, ctx.taller.id, idEntero(ctx.params.id));
    if (c.estado === 'anulada') falla('La compra está anulada.');
    const importe = dinero(ctx.cuerpo.importe, 'Escribí el importe pagado.', 'importe');
    if (importe > c.saldoProveedor) falla(`El pago supera el saldo con el proveedor (${(c.saldoProveedor / 100).toLocaleString('es-AR')}).`, 'importe');
    const medio = enLista(ctx.cuerpo.medio, MEDIOS, 'Elegí el medio de pago.', 'medio');
    insertar(ctx.db, 'INSERT INTO pagos_proveedor (taller_id, compra_id, importe, medio, fecha, nota, creado_por, creado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ctx.taller.id, c.id, importe, medio, hoyLocal(zona(ctx)), opcional(ctx.cuerpo.nota, 300), ctx.usuario.id, isoAhora());
    ctx.auditar('Pago a proveedor registrado', 'compra', c.id, `${importe / 100} · ${medio}`);
    return { compra: cargarCompra(ctx.db, ctx.taller.id, c.id) };
  });

  r.post('/api/pagos-proveedor/:id/anular', (ctx) => {
    exigir(ctx.usuario, 'compras.pagar');
    const p = delTaller(ctx.db, 'pagos_proveedor', ctx.taller.id, idEntero(ctx.params.id), 'No encontramos ese pago.');
    if (p.anulado_at) falla('El pago ya está anulado.');
    const motivo = requerido(ctx.cuerpo.motivo, 'Escribí el motivo.', 'motivo', 300);
    ejecutar(ctx.db, 'UPDATE pagos_proveedor SET anulado_at = ?, anulado_motivo = ? WHERE id = ?', isoAhora(), motivo, p.id);
    ctx.auditar('Pago a proveedor anulado (se conserva el registro)', 'compra', p.compra_id, motivo);
    return { compra: cargarCompra(ctx.db, ctx.taller.id, p.compra_id) };
  });
}
