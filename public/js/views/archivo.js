// Archivo de documentos emitidos: búsqueda por patente, cliente, número o visita.
import { get } from '../api.js?v=0.1.0';
import { esc, icono, fechaHora, chip } from '../ui.js?v=0.1.0';

export default async function archivo({ query, app }) {
  const q = new URLSearchParams();
  if (query.q) q.set('q', query.q);
  if (query.tipo) q.set('tipo', query.tipo);
  const { documentos } = await get('/api/documentos?' + q);
  const TIPOS = [['', 'Todos'], ['presupuesto', 'Presupuestos'], ['informe', 'Informes'], ['entrega', 'Resúmenes de entrega'], ['venta', 'Comprobantes de venta'], ['recibo', 'Recibos']];
  return {
    titulo: 'Archivo de documentos',
    html: `<div class="pagina">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Archivo de documentos</h1><button type="button" class="btn btn-chico btn-texto" data-ayuda="documentos">${icono('ayuda')}¿Cómo hago…?</button></div>
      <form class="form" id="f-arch" data-sin-aviso><div class="fila-campos"><div class="buscador">${icono('buscar')}<label class="sr" for="arch-q">Buscar documentos</label><input id="arch-q" name="q" type="search" value="${esc(query.q || '')}" placeholder="Patente, cliente, número o visita"></div>
        <div class="campo"><label class="sr" for="arch-t">Tipo</label><select id="arch-t" name="tipo">${TIPOS.map(([v, t]) => `<option value="${v}" ${v === (query.tipo || '') ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div></form>
      ${documentos.length ? `<div class="panel"><ul class="lista">${documentos.map((d) => `<li><a class="fila" href="#/documentos/${d.id}" style="text-decoration:none;color:inherit"><span><strong>${esc(d.titulo)} N.º ${esc(d.numero)}</strong>${d.patente ? ` · <span translate="no">${esc(d.patente)}</span>` : ''}<br><span class="muted small">${esc(d.cliente || '')}${d.vehiculo ? ' · ' + esc(d.vehiculo) : ''}${d.visita ? ' · visita N.º ' + esc(d.visita) : ''} · ${esc(fechaHora(d.fecha))} · ${esc(d.por || '')}</span></span>${d.anulado ? chip('Anulado', 'rojo', 'ban') : ''}</a></li>`).join('')}</ul></div>` : '<div class="vacio"><p>No hay documentos que coincidan.</p></div>'}
      <p class="muted small">Cada documento es una copia fechada: cambiar precios, datos o el logo del taller no lo modifica.</p>
    </div>`,
    despues(raiz) {
      const f = raiz.querySelector('#f-arch');
      let t;
      const ir = () => { if(f.isConnected)app.ir(`#/archivo?q=${encodeURIComponent(f.q.value.trim())}&tipo=${f.tipo.value}`); };
      f.addEventListener('submit', (e) => { e.preventDefault(); ir(); });
      f.q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(ir, 450); });
      f.tipo.addEventListener('change', ir);
      if (query.q) { f.q.focus(); f.q.setSelectionRange(f.q.value.length, f.q.value.length); }
    }
  };
}
