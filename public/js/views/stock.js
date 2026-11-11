// Stock: existencias que cambian solo por movimientos (compras, colocaciones, ventas, devoluciones y ajustes).
import { get, post, put } from '../api.js?v=0.1.0';
import { esc, icono, pesos, cant, fechaHora, chip, campo, alEnviar, toast, aviso, aEntradaDinero, aEntradaCant } from '../ui.js?v=0.1.0';

const TIPOS = { inicial: 'Existencia inicial', compra: 'Compra recibida', devolucion_proveedor: 'Devolución al proveedor', venta: 'Venta de mostrador', anulacion_venta: 'Anulación de venta', devolucion_cliente: 'Devolución de cliente', consumo: 'Usado en un trabajo', reintegro_consumo: 'Reintegro por corrección', ajuste: 'Ajuste' };

export default async function stock({ params, app }) {
  if (params.id) return detalle(params.id, app);
  const { articulos } = await get('/api/articulos');
  const bajos = articulos.filter((a) => a.bajoMinimo);
  return {
    titulo: 'Stock',
    html: `<div class="pagina">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Stock</h1><div class="acciones"><button type="button" class="btn btn-chico btn-texto" data-ayuda="stock">${icono('ayuda')}¿Cómo hago…?</button>${app.puede('compras.gestionar') ? `<a class="btn" href="#/compras?nueva=1">${icono('camion')}Registrar compra</a>` : ''}</div></div>
      ${bajos.length ? aviso(`<strong>${bajos.length} artículo(s) en el mínimo o por debajo:</strong> ${bajos.map((a) => esc(a.nombre)).join(', ')}.`, 'ambar', 'alerta') : ''}
      <div class="buscador">${icono('buscar')}<label class="sr" for="st-q">Buscar artículo</label><input id="st-q" type="search" placeholder="Buscar por nombre o código"></div>
      <section class="panel">
        ${articulos.length ? `<ul class="lista">${articulos.map((a) => `<li data-texto="${esc((a.nombre + ' ' + (a.codigo || '')).toLowerCase())}"><a class="fila" href="#/stock/${a.id}" style="text-decoration:none;color:inherit"><span><strong>${esc(a.nombre)}</strong>${a.codigo ? ` <span class="muted small">${esc(a.codigo)}</span>` : ''}<br>
          <span class="small">Existencia <strong class="num">${esc(cant(a.existencia, a.unidad))}</strong>${a.reservado ? ` · reservado ${esc(cant(a.reservado, a.unidad))}` : ''} · disponible <strong class="num">${esc(cant(a.disponible, a.unidad))}</strong></span></span>
          ${a.bajoMinimo ? chip(`Mínimo ${cant(a.minimo_m, a.unidad)}`, 'rojo', 'alerta') : ''}</a></li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Todavía no hay artículos.</p></div>'}
      </section>
      ${app.puede('stock.articulos') ? `<details class="mas"><summary>Agregar un artículo</summary><div class="mas__cuerpo"><form class="form" id="f-art" novalidate>
        <div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, ayuda: 'Una lista no confirma compatibilidad: verificá la aplicación de cada repuesto.' })}${campo({ nombre: 'codigo', etiqueta: 'Código' })}${campo({ nombre: 'unidad', etiqueta: 'Se cuenta en', tipo: 'select', opciones: ['u.', 'L', 'kg', 'm', 'juego', 'kit', 'par'] })}</div>
        <div class="fila-campos">${campo({ nombre: 'minimo', etiqueta: 'Avisar cuando quede', attrs: 'inputmode="decimal"' })}${campo({ nombre: 'precioVenta', etiqueta: 'Precio de venta', attrs: 'inputmode="decimal"' })}${app.puede('stock.ajustar') ? campo({ nombre: 'existenciaInicial', etiqueta: 'Existencia contada hoy', attrs: 'inputmode="decimal"' }) : ''}</div>
        <button class="btn btn-primario" type="submit">Guardar artículo</button></form></div></details>` : ''}
    </div>`,
    despues(raiz) {
      raiz.querySelector('#st-q').addEventListener('input', (e) => { const t = e.target.value.trim().toLowerCase(); raiz.querySelectorAll('[data-texto]').forEach((li) => { li.hidden = t && !li.dataset.texto.includes(t); }); });
      const f = raiz.querySelector('#f-art');
      if (f) alEnviar(f, async (d) => { const r = await post('/api/articulos', d); toast('Artículo guardado.'); app.ir('#/stock/' + r.id); });
    }
  };
}

async function detalle(id, app) {
  const { articulo: a } = await get(`/api/articulos/${id}`);
  return {
    titulo: a.nombre,
    html: `<div class="pagina" style="max-width:960px">
      <a class="volver" href="#/stock">${icono('izq')}Stock</a>
      <div class="cab"><h1 tabindex="-1">${esc(a.nombre)}</h1>${a.bajoMinimo ? chip('En el mínimo o por debajo', 'rojo', 'alerta') : ''}</div>
      <div class="montos">
        <div class="monto"><span>Existencia</span><b class="num">${esc(cant(a.existencia, a.unidad))}</b><small>Suma de todos los movimientos</small></div>
        <div class="monto"><span>Reservado</span><b class="num">${esc(cant(a.reservado, a.unidad))}</b><small>Apartado para trabajos, sin colocar</small></div>
        <div class="monto"><span>Disponible</span><b class="num">${esc(cant(a.disponible, a.unidad))}</b></div>
        ${a.costo_ultimo != null ? `<div class="monto"><span>Último costo</span><b class="num">${pesos(a.costo_ultimo)}</b></div>` : ''}
      </div>
      ${a.reservas.length ? `<section class="panel"><div class="panel__cab"><h2>Reservado para</h2></div><ul class="lista">${a.reservas.map((r) => `<li class="fila"><a href="#/visitas/${r.visita_id}">Visita N.º ${esc(r.visita_numero)}: ${esc(r.descripcion)}</a><span class="num">${esc(cant(r.cantidad_m, a.unidad))}</span></li>`).join('')}</ul></section>` : ''}
      <section class="panel"><div class="panel__cab"><h2>Movimientos</h2></div>
        ${a.movimientos.length ? `<ul class="lista">${a.movimientos.map((m) => `<li><div class="fila"><span><strong>${esc(TIPOS[m.tipo])}</strong> <span class="muted small">${esc(fechaHora(m.creado_at))} · ${esc(m.por || '')}</span></span><strong class="num" style="color:${m.cantidad_m > 0 ? 'var(--green)' : 'var(--red)'}">${m.cantidad_m > 0 ? '+' : '−'}${esc(cant(Math.abs(m.cantidad_m), a.unidad))}</strong></div>${m.motivo ? `<p class="small muted">${esc(m.motivo)}</p>` : ''}</li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Sin movimientos.</p></div>'}</section>
      ${app.puede('stock.ajustar') ? `<details class="mas"><summary>Ajustar existencia (conteo, rotura, pérdida)</summary><div class="mas__cuerpo"><form class="form" id="f-ajuste" novalidate>
        <div class="fila-campos">${campo({ nombre: 'sentido', etiqueta: 'Tipo', tipo: 'select', opciones: [['salida', 'Resta'], ['entrada', 'Suma']] })}${campo({ nombre: 'cantidad', etiqueta: 'Cantidad', requerido: true, attrs: 'inputmode="decimal"' })}</div>
        ${campo({ nombre: 'motivo', etiqueta: 'Motivo', requerido: true, placeholder: 'Ej.: conteo físico del viernes' })}
        <p class="muted small">El ajuste se agrega como movimiento: no borra la historia.</p><button class="btn" type="submit">Guardar ajuste</button></form></div></details>` : ''}
      ${app.puede('stock.articulos') ? `<details class="mas"><summary>Editar datos del artículo</summary><div class="mas__cuerpo"><form class="form" id="f-edit" novalidate>
        <div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: a.nombre })}${campo({ nombre: 'codigo', etiqueta: 'Código', valor: a.codigo || '' })}${campo({ nombre: 'minimo', etiqueta: 'Mínimo', valor: aEntradaCant(a.minimo_m) })}${app.puede('ver.dinero') ? campo({ nombre: 'precioVenta', etiqueta: 'Precio de venta', valor: aEntradaDinero(a.precio_venta) }) : ''}</div>
        <button class="btn" type="submit">Guardar</button></form></div></details>` : ''}
    </div>`,
    despues(raiz) {
      const fa = raiz.querySelector('#f-ajuste');
      if (fa) alEnviar(fa, async (d) => { await post(`/api/articulos/${a.id}/ajuste`, d); toast('Ajuste guardado.'); app.recargar(); });
      const fe = raiz.querySelector('#f-edit');
      if (fe) alEnviar(fe, async (d) => { await put(`/api/articulos/${a.id}`, { ...d, version: a.version }); toast('Artículo actualizado.'); app.recargar(); });
    }
  };
}
