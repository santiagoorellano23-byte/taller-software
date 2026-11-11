// Trabajos: visitas abiertas, asignadas a la persona y historial.
import { get } from '../api.js?v=0.1.0';
import { esc, icono, patente, nombreAuto, chipSituacion, fecha, cuando } from '../ui.js?v=0.1.0';

export default async function trabajos({ app, query }) {
  const esMec = app.sesion.usuario.rol === 'mecanico';
  const ver = query.ver || (esMec ? 'mias' : 'abiertas');
  const { visitas } = await get(`/api/visitas?estado=${ver}`);
  const pestanas = [...(esMec ? [['mias', 'Asignadas a mí']] : []), ['abiertas', 'En el taller'], ['historial', 'Entregadas y anuladas']];
  const grupos=ver==='historial'?[['Historial',visitas]]:[...new Set(visitas.map(v=>v.dimensiones?.find(([k])=>k==='Trabajo')?.[1]||v.situacion.texto))].map(t=>[t,visitas.filter(v=>(v.dimensiones?.find(([k])=>k==='Trabajo')?.[1]||v.situacion.texto)===t)]);
  return {
    titulo: 'Taller',
    html: `<div class="pagina">
      <div class="cab"><h1 tabindex="-1">Órdenes del taller</h1>${app.puede('visita.recibir') ? `<a class="btn btn-primario" href="#/recibir">${icono('mas')}Recibir un auto</a>` : ''}</div>
      <nav class="pestanas" aria-label="Filtrar visitas">${pestanas.map(([k, t]) => `<a href="#/trabajos?ver=${k}" ${k === ver ? 'aria-current="page"' : ''}><strong>${t}</strong></a>`).join('')}</nav>
      ${visitas.length ? `<div class="taller-etapas">${grupos.map(([t,lista])=>`<section><header class="fila"><h2>${esc(t)}</h2><span class="muted">${lista.length}</span></header><div class="panel"><ul class="lista">${lista.map((v) => `<li><div class="fila"><span class="fila__izq">${patente(v.vehiculo.patente)}<strong>${nombreAuto(v.vehiculo)}</strong><span class="muted small">N.º ${esc(v.numero)} · ${esc(fecha(v.ingreso_at))}</span></span>${chipSituacion(v.situacion)}</div>
        <p>${esc(v.motivo)}</p><div class="fila"><span class="muted small">${esc(v.responsable || 'Sin asignar')}${v.retiro_acordado && !v.entregada_at ? ' · retiro ' + esc(cuando(v.retiro_acordado)) : ''}${v.entregada_at ? ' · entregado ' + esc(fecha(v.entregada_at)) : ''}</span>
        <a class="btn btn-chico" href="#/visitas/${v.id}">Abrir orden ${icono('der', 'i-sm')}</a></div></li>`).join('')}</ul></div></section>`).join('')}</div>`
        : `<div class="vacio"><p>${ver === 'mias' ? 'No tenés visitas asignadas en este momento.' : ver === 'abiertas' ? 'No hay autos en el taller.' : 'Todavía no hay visitas cerradas.'}</p></div>`}
    </div>`
  };
}
