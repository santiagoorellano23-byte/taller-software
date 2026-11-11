// Reportes: indicadores con definición visible, gráficos solo donde explican algo y exportación coherente.
import { get } from '../api.js?v=0.1.0';
import { esc, icono, pesos, cant, campo, chip, aviso, fecha } from '../ui.js?v=0.1.0';

export default async function reportes({ query, app }) {
  const q = new URLSearchParams();
  if (query.desde) q.set('desde', query.desde);
  if (query.hasta) q.set('hasta', query.hasta);
  const d = await get('/api/reportes?' + q);
  const max = Math.max(1, ...d.dias.map((x) => x.importe));
  const maxMedio = Math.max(1, ...d.porMedio.map((x) => x.importe));
  const valor = (i) => i.tipo === 'dinero' ? pesos(i.valor) : String(i.valor);
  const TIPO_STOCK = { inicial: 'Existencia inicial', compra: 'Compras recibidas', devolucion_proveedor: 'Devoluciones a proveedor', venta: 'Ventas', anulacion_venta: 'Anulaciones de venta', devolucion_cliente: 'Devoluciones de clientes', consumo: 'Usado en trabajos', reintegro_consumo: 'Reintegros', ajuste: 'Ajustes' };
  return {
    titulo: 'Reportes',
    html: `<div class="pagina">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Reportes</h1><div class="acciones"><a class="btn btn-chico" href="/api/reportes/csv?tipo=cobros&desde=${d.desde}&hasta=${d.hasta}">${icono('descargar')}Cobros (CSV)</a><a class="btn btn-chico" href="/api/reportes/csv?tipo=stock">${icono('descargar')}Stock (CSV)</a></div></div>
      <form class="form panel panel__cuerpo" id="f-per" data-sin-aviso><div class="fila-campos">${campo({ nombre: 'desde', etiqueta: 'Desde', tipo: 'date', valor: d.desde })}${campo({ nombre: 'hasta', etiqueta: 'Hasta', tipo: 'date', valor: d.hasta })}</div><div class="acciones"><button class="btn btn-oscuro btn-chico" type="submit">Ver período</button></div></form>
      <div class="grupos" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))">${d.indicadores.map((i) => `<section class="panel panel__cuerpo bloque" style="gap:6px"><h2 style="font-size:15.5px">${esc(i.titulo)}</h2><b class="num" style="font-family:var(--fc);font-size:32px;font-weight:600;line-height:1">${esc(valor(i))}</b>${i.extra ? `<span class="small muted">${esc(i.extra)}</span>` : ''}<p class="xs muted">${esc(i.define)}</p></section>`).join('')}</div>
      <section class="panel panel__cuerpo bloque" aria-labelledby="t-cd"><div class="bloque__cab"><h2 id="t-cd">Cobrado por día</h2><p>Dinero recibido menos devoluciones y cobros anulados</p></div>
        ${d.dias.some((x) => x.importe) ? `<div class="barras" role="img" aria-label="Gráfico de barras del cobrado por día; los valores están en la tabla">${d.dias.map((x) => `<div style="height:${Math.max(x.importe > 0 ? 2 : 0, Math.round((Math.max(0, x.importe) / max) * 100))}%" title="${esc(fecha(x.dia))}: ${esc(pesos(x.importe))}"></div>`).join('')}</div>
          <div class="barras-ejes"><span>${esc(fecha(d.desde).slice(0, 5))}</span><span>Máximo ${esc(pesos(max))}</span><span>${esc(fecha(d.hasta).slice(0, 5))}</span></div>
          <details class="mas"><summary>Ver como tabla</summary><div class="mas__cuerpo"><table class="tabla-autos"><thead><tr><th scope="col">Día</th><th scope="col" style="text-align:right">Cobrado</th></tr></thead><tbody>${d.dias.filter((x) => x.importe).map((x) => `<tr><td>${esc(fecha(x.dia))}</td><td class="n num" style="text-align:right">${esc(pesos(x.importe))}</td></tr>`).join('')}</tbody></table></div></details>` : '<p class="muted">Sin cobros en el período.</p>'}</section>
      <div class="grupos">
        <section class="panel panel__cuerpo bloque"><h2>Cobrado por medio de pago</h2>
          ${d.porMedio.length ? d.porMedio.map((m) => `<div class="barra-h"><span>${esc(m.medio)}</span><i style="width:${Math.round((Math.max(0, m.importe) / maxMedio) * 100)}%" title="${esc(m.medio)}: ${esc(pesos(m.importe))}"></i><strong class="num">${esc(pesos(m.importe))}</strong></div>`).join('') : '<p class="muted">Sin cobros.</p>'}</section>
        <section class="panel panel__cuerpo bloque"><h2>Trabajo en curso (hoy)</h2>
          ${Object.keys(d.enCurso).length ? `<ul class="lista">${Object.entries(d.enCurso).map(([k, n]) => `<li class="fila"><span>${esc(k)}</span><strong class="num">${n}</strong></li>`).join('')}</ul>` : '<p class="muted">No hay autos en el taller.</p>'}</section>
        <section class="panel panel__cuerpo bloque"><h2>Stock bajo</h2>
          ${d.stockBajo.length ? `<ul class="lista">${d.stockBajo.map((a) => `<li class="fila"><a href="#/stock/${a.id}">${esc(a.nombre)}</a><span class="num">${esc(cant(a.existencia, a.unidad))} / mín. ${esc(cant(a.minimo, a.unidad))}</span></li>`).join('')}</ul>` : '<p class="muted">Ningún artículo en el mínimo.</p>'}</section>
        <section class="panel panel__cuerpo bloque"><h2>Movimientos de stock del período</h2>
          ${Object.keys(d.porTipoStock).length ? `<ul class="lista">${Object.entries(d.porTipoStock).map(([k, n]) => `<li class="fila"><span>${esc(TIPO_STOCK[k] || k)}</span><strong class="num">${n}</strong></li>`).join('')}</ul>` : '<p class="muted">Sin movimientos.</p>'}</section>
      </div>
      <section class="panel panel__cuerpo bloque"><h2>Margen de mostrador</h2>
        ${d.margen ? `<div class="datos"><div class="dato"><span>Ventas con costo conocido</span><strong class="num">${pesos(d.margen.ventas)}</strong></div><div class="dato"><span>Costo de compra</span><strong class="num">${pesos(d.margen.costo)}</strong></div><div class="dato"><span>Margen bruto</span><strong class="num">${pesos(d.margen.ventas - d.margen.costo)}</strong></div></div>${d.margen.lineasSinCosto ? `<p class="small muted">${d.margen.lineasSinCosto} línea(s) sin costo conocido o con devoluciones no se incluyen.</p>` : ''}` : ''}
        <p class="small muted">${esc(d.notaMargen)}</p></section>
      ${aviso('Los reportes salen de los mismos movimientos que ven las demás pantallas. No son contabilidad ni tienen validez fiscal.', 'gris')}
    </div>`,
    despues(raiz) {
      raiz.querySelector('#f-per').addEventListener('submit', (e) => { e.preventDefault(); app.ir(`#/reportes?desde=${e.target.desde.value}&hasta=${e.target.hasta.value}`); });
      void chip;
    }
  };
}
