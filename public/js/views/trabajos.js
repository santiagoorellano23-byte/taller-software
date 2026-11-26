// Taller (diseño final, A): órdenes abiertas agrupadas por estado del trabajo, búsqueda, filtro por estado y las
// entregadas y anuladas. El filtro queda en el enlace (#/trabajos?ver=…&estado=…) para volver al mismo lugar.
import { get } from '../api.js?v=0.1.0';
import { esc, chipSituacion, fecha, cuando } from '../ui.js?v=0.1.0';
import { ic, placa, logoMarca, ibtn, vacioD } from '../diseno.js?v=0.1.0';

const estadoDe = (v) => v.anulada_at ? 'Anulada' : v.entregada_at ? 'Entregada' : v.dimensiones?.find(([k]) => k === 'Trabajo')?.[1] || v.situacion.texto;
const buscable = (v) => `data-patente="${esc((v.vehiculo.patente || '').replace(/\W/g, '').toLowerCase())}" data-texto="${esc((v.vehiculo.marca + ' ' + v.vehiculo.modelo + ' ' + (v.contacto || '') + ' ' + v.numero).toLowerCase())}" data-telefono="${esc((v.telefono || '').replace(/\D/g, ''))}"`;

export default async function trabajos({ app, query }) {
  const esMec = app.sesion.usuario.rol === 'mecanico';
  const ver = ['mias', 'abiertas', 'historial'].includes(query.ver) ? query.ver : (esMec ? 'mias' : 'abiertas');
  const { visitas } = await get(`/api/visitas?estado=${ver}`);
  const vistas = [...(esMec ? [['mias', 'Asignadas a mí']] : []), ['abiertas', 'En el taller'], ['historial', 'Entregadas y anuladas']];
  const estados = [...new Set(visitas.map(estadoDe))];
  const estado = estados.includes(query.estado) ? query.estado : '';
  const lista = estado ? visitas.filter((v) => estadoDe(v) === estado) : visitas;
  const enlace = (e) => `#/trabajos?ver=${ver}${e ? '&estado=' + encodeURIComponent(e) : ''}`;
  const fila = (v) => {
    const auto = [v.vehiculo.marca, v.vehiculo.modelo].filter(Boolean).join(' ') || 'Vehículo sin datos';
    return `<a class="orden-f" href="#/visitas/${v.id}" ${buscable(v)}>${logoMarca(v.vehiculo.marca)}<span class="t-id">${placa(v.vehiculo.patente)}<span class="t-mod"><b>${esc(auto)}</b><small>N.º ${esc(v.numero)} · ${esc(v.entregada_at ? 'entregado ' + fecha(v.entregada_at) : cuando(v.ingreso_at))}${v.responsable ? ' · ' + esc(v.responsable) : ''}</small></span></span>
      <span class="of-r">${chipSituacion(v.situacion)}<small>${esc(v.motivo || '')}</small></span>${ic('chevron_right', 'chev')}</a>`;
  };
  return {
    titulo: 'Taller',
    // Encabezado con la cifra del listado elegido y el auto de la colección (decorativo: fuera de la lectura asistida).
    html: `<header class="a-cab tl-cab"><div class="tl-tit"><h1 tabindex="-1">Taller</h1><p class="tl-cifra"><b>${visitas.length}</b> ${ver === 'historial' ? (visitas.length === 1 ? 'entregada o anulada' : 'entregadas y anuladas') : ver === 'mias' ? (visitas.length === 1 ? 'asignada a mí' : 'asignadas a mí') : (visitas.length === 1 ? 'auto en el taller' : 'autos en el taller')}</p></div>
      <img class="tl-auto" src="/ilustraciones/taller/auto-hatchback-320.webp?v=0.1.0" srcset="/ilustraciones/taller/auto-hatchback-160.webp?v=0.1.0 160w, /ilustraciones/taller/auto-hatchback-320.webp?v=0.1.0 320w" sizes="148px" width="148" height="83" alt="" decoding="async">
      <div class="a-cab-acc">${ibtn('help', 'Ayuda', { attrs: 'data-ayuda="guia"' })}</div></header>
      <div class="buscador-d">${ic('search')}<label class="sr" for="taller-q">Buscar orden por patente, cliente, teléfono o número</label><input id="taller-q" type="search" placeholder="Patente, cliente, teléfono o N.º" autocomplete="off" enterkeyhint="search"></div>
      <nav class="seg" aria-label="Órdenes">${vistas.map(([k, t]) => `<a href="#/trabajos?ver=${k}" ${k === ver ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
      ${visitas.length ? `<nav class="filtros" aria-label="Filtrar por estado"><a class="filtro" href="${enlace('')}" ${!estado ? 'aria-current="true"' : ''}><span>Todas</span><b>${visitas.length}</b></a>${estados.map((e) => `<a class="filtro" href="${enlace(e)}" ${estado === e ? 'aria-current="true"' : ''}><span>${esc(e)}</span><b>${visitas.filter((v) => estadoDe(v) === e).length}</b></a>`).join('')}</nav>` : ''}
      <p class="sr" aria-live="polite" data-cuenta>${lista.length} órdenes</p>
      <div data-sin-resultados hidden>${vacioD('search', 'Sin órdenes', 'Ninguna orden coincide con la búsqueda.')}</div>
      ${lista.length ? (ver === 'historial' ? [['Entregadas y anuladas', lista]] : estados.filter((e) => !estado || e === estado).map((e) => [e, lista.filter((v) => estadoDe(v) === e)]))
        .map(([t, G]) => `<section class="grupo-o" data-grupo><h2>${esc(t)}<span>${G.length}</span></h2>${G.map(fila).join('')}</section>`).join('')
        : vacioD('garage', ver === 'mias' ? 'No tenés órdenes asignadas' : ver === 'abiertas' ? 'No hay autos en el taller' : 'Todavía no hay órdenes cerradas', '', ver !== 'historial' && app.puede('visita.recibir') ? `<a class="btn btn-primario" href="#/recibir">${ic('add')}Recibir un auto</a>` : '')}
      <ul class="lista-d"><li><a class="li-b" href="#/pendientes"><span class="li-ic">${ic('pending_actions')}</span><span class="li-t"><b>Services y trabajos postergados</b><small>Lo que el cliente dejó para más adelante</small></span>${ic('chevron_right')}</a></li></ul>`,
    despues(raiz) {
      const q = raiz.querySelector('#taller-q');
      const items = raiz.querySelectorAll('.orden-f');
      q.addEventListener('input', () => {
        const s = q.value.trim().toLowerCase(), sp = s.replace(/\W/g, ''), sd = s.replace(/\D/g, '');
        let vis = 0;
        items.forEach((el) => { const ok = !s || (sp && el.dataset.patente.includes(sp)) || el.dataset.texto.includes(s) || (sd.length >= 3 && el.dataset.telefono.includes(sd)); el.hidden = !ok; if (ok) vis++; });
        raiz.querySelectorAll('[data-grupo]').forEach((g) => { g.hidden = !!s && !g.querySelector('.orden-f:not([hidden])'); });
        raiz.querySelector('[data-cuenta]').textContent = `${vis} órdenes`;
        raiz.querySelector('[data-sin-resultados]').hidden = !(s && !vis);
      });
    }
  };
}
