// Caja: dinero que entró y salió por medio de pago en un período. No es contabilidad ni tiene validez fiscal.
import { get } from '../api.js?v=0.1.0';
import { esc, icono, pesos, fechaHora, hora, campo, MEDIOS, hoyLocal } from '../ui.js?v=0.1.0';

export default async function caja({ query, app }) {
  const desde = query.desde || hoyLocal(), hasta = query.hasta || desde;
  const d = await get(`/api/caja?desde=${desde}&hasta=${hasta}`);
  const conMov = d.porMedio.filter((m) => m.entra || m.sale);
  return {
    titulo: 'Caja',
    html: `<div class="pagina">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Caja</h1><div class="acciones no-imprimir"><button type="button" class="btn btn-chico" data-imprimir>${icono('imprimir')}Imprimir</button></div></div>
      <form class="form panel panel__cuerpo no-imprimir" id="f-periodo" data-sin-aviso><div class="fila-campos">${campo({ nombre: 'desde', etiqueta: 'Desde', tipo: 'date', valor: d.desde })}${campo({ nombre: 'hasta', etiqueta: 'Hasta', tipo: 'date', valor: d.hasta })}</div>
        <div class="acciones"><button class="btn btn-oscuro btn-chico" type="submit">Ver período</button><a class="btn btn-chico" href="#/caja">Hoy</a></div></form>
      <div class="montos">
        <div class="monto"><span style="color:var(--green)">Entró</span><b class="num">${pesos(d.totalEntra)}</b><small>Cobros a clientes</small></div>
        <div class="monto"><span style="color:var(--red)">Salió</span><b class="num">${pesos(d.totalSale)}</b><small>Devoluciones, anulaciones y pagos a proveedores</small></div>
        <div class="monto"><span>Diferencia</span><b class="num">${pesos(d.totalEntra - d.totalSale)}</b><small>Del ${esc(d.desde.split('-').reverse().join('/'))} al ${esc(d.hasta.split('-').reverse().join('/'))}</small></div>
      </div>
      <section class="panel"><div class="panel__cab"><h2>Por medio de pago</h2></div>
        ${conMov.length ? `<ul class="lista">${conMov.map((m) => `<li class="fila"><strong>${esc(m.texto)}</strong><span class="num">Entró ${pesos(m.entra)} · Salió ${pesos(m.sale)}</span></li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Sin movimientos de dinero en el período.</p></div>'}</section>
      <section class="panel"><div class="panel__cab"><h2>Movimientos de clientes</h2></div>
        ${d.movimientos.length ? `<ul class="lista">${d.movimientos.map((m) => `<li><div class="fila"><span class="fila__izq"><strong class="num">${esc(d.desde === d.hasta ? hora(m.fecha) : fechaHora(m.fecha))}</strong><span>${esc(m.cliente || 'Consumidor sin datos')}</span></span><strong class="num" style="color:${m.dinero > 0 ? 'var(--green)' : 'var(--red)'}">${m.dinero > 0 ? '+' : '−'}${pesos(Math.abs(m.dinero))}</strong></div>
          <p class="small muted">${esc({ pago: 'Pago', devolucion_dinero: 'Devolución', anulacion: 'Anulación de ' + (m.anula_tipo === 'pago' ? 'pago' : 'devolución') }[m.tipo] || m.tipo)} · ${esc(MEDIOS[m.medio] || m.medio)}${m.visita_numero ? ` · <a href="#/visitas/${m.visita_id}">visita N.º ${esc(m.visita_numero)}</a>` : ''}${m.venta_numero ? ` · <a href="#/mostrador/${m.venta_id}">venta N.º ${esc(m.venta_numero)}</a>` : ''}${m.referencia ? ' · ' + esc(m.referencia) : ''} · ${esc(m.por || '')}</p></li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Sin cobros en el período.</p></div>'}</section>
      ${d.pagosProveedores.length ? `<section class="panel"><div class="panel__cab"><h2>Pagos a proveedores</h2></div><ul class="lista">${d.pagosProveedores.map((p) => `<li class="fila"><span>${esc(p.proveedor)} · <a href="#/compras/${p.compra_id}">compra N.º ${esc(p.compra_numero)}</a> · ${esc(MEDIOS[p.medio] || p.medio)}</span><strong class="num" style="color:var(--red)">−${pesos(p.importe)}</strong></li>`).join('')}</ul></section>` : ''}
      <p class="muted small">Resumen interno del taller. No reemplaza la contabilidad ni tiene validez fiscal.</p>
    </div>`,
    despues(raiz) {
      raiz.querySelector('#f-periodo').addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; app.ir(`#/caja?desde=${f.desde.value}&hasta=${f.hasta.value}`); });
      raiz.querySelector('[data-imprimir]').onclick = () => window.print();
    }
  };
}
