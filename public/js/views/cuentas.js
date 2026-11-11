// Cuentas de clientes: lo que debe cada uno (o tiene a favor) según sus movimientos.
import { get } from '../api.js?v=0.1.0';
import { esc, icono, pesos, fechaHora, chip, MEDIOS } from '../ui.js?v=0.1.0';

const TIPO = { cargo: 'Liquidación / venta', pago: 'Pago', devolucion_dinero: 'Devolución de dinero', nota_credito: 'Nota de crédito', anulacion: 'Anulación' };

export default async function cuentas({ params }) {
  if (!params.id) {
    const d = await get('/api/cuentas');
    return {
      titulo: 'Cuentas de clientes',
      html: `<div class="pagina">
        <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
        <div class="cab"><h1 tabindex="-1">Cuentas de clientes</h1></div>
        <div class="montos"><div class="monto"><span>Total que deben los clientes</span><b class="num">${pesos(d.total)}</b><small>${d.cuentas.filter((c) => c.saldo > 0).length} cliente(s) con saldo</small></div></div>
        ${d.cuentas.length ? `<div class="panel"><ul class="lista">${d.cuentas.map((c) => `<li><a class="fila" href="#/cuentas/${c.id}" style="text-decoration:none;color:inherit"><span><strong>${esc(c.nombre)}</strong><br><span class="muted small">${esc(c.telefono || '')} · último movimiento ${esc(fechaHora(c.ultimo))}</span></span>
          ${c.saldo > 0 ? `<strong class="num" style="color:var(--red)">Debe ${pesos(c.saldo)}</strong>` : `<strong class="num" style="color:var(--green)">A favor ${pesos(-c.saldo)}</strong>`}</a></li>`).join('')}</ul></div>` : '<div class="vacio"><p>No hay clientes con saldo.</p></div>'}
        <p class="muted small">El saldo sale de liquidaciones y ventas menos pagos, con sus correcciones. Lo presupuestado o postergado no forma parte del saldo. Un saldo a favor suele ser una seña de un trabajo todavía sin liquidar.</p>
      </div>`
    };
  }
  const d = await get(`/api/cuentas/${params.id}`);
  return {
    titulo: `Cuenta de ${d.contacto.nombre}`,
    html: `<div class="pagina">
      <a class="volver" href="#/cuentas">${icono('izq')}Cuentas de clientes</a>
      <div class="cab"><h1 tabindex="-1">${esc(d.contacto.nombre)}</h1>${d.saldo > 0 ? chip('Debe ' + pesos(d.saldo), 'rojo', 'dinero') : d.saldo < 0 ? chip('A favor ' + pesos(-d.saldo), 'verde', 'dinero') : chip('Sin saldo', 'verde', 'check')}</div>
      <div class="panel"><ul class="lista">${d.movimientos.map((m) => `<li><div class="fila"><span class="fila__izq"><strong>${esc(TIPO[m.tipo])}${m.tipo === 'anulacion' ? ' de ' + esc((TIPO[m.anula_tipo] || '').toLowerCase()) : ''}</strong>${m.anulado ? chip('Anulado', 'rojo', 'ban') : ''}</span>
        <strong class="num">${m.efecto > 0 ? '+' : '−'}${pesos(m.importe)}</strong></div>
        <p class="small muted">${esc(fechaHora(m.fecha))}${m.medio ? ' · ' + esc(MEDIOS[m.medio]) : ''}${m.visita_numero ? ` · <a href="#/visitas/${m.visita_id}">visita N.º ${esc(m.visita_numero)}</a>` : ''}${m.venta_numero ? ` · <a href="#/mostrador/${m.venta_id}">venta N.º ${esc(m.venta_numero)}</a>` : ''}${m.motivo ? ' · ' + esc(m.motivo) : ''} · ${esc(m.por || '')}</p></li>`).join('')}</ul></div>
      <p class="muted small">«+» suma a lo que debe; «−» lo reduce. Para cobrar, abrí la visita o la venta correspondiente.</p>
    </div>`
  };
}
