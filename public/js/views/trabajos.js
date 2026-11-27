// Taller (propuesta B): encabezado oscuro con la cifra real y el auto de la colección, búsqueda, conjunto de órdenes
// y filtro por etapa, y las órdenes agrupadas por etapa en una sola superficie. El conjunto, la etapa y la búsqueda
// quedan en el enlace (#/trabajos?ver=…&estado=…&q=…) para volver al mismo lugar.
import { get } from '../api.js?v=0.1.0';
import { esc, chipSituacion, fecha, cuando } from '../ui.js?v=0.1.0';
import { ic, placa, logoMarca, ibtn, vacioD } from '../diseno.js?v=0.1.0';

// Etapa del grupo (dimensión Trabajo); el estado específico de cada orden es su situación (p. ej. revisado y esperando autorización).
const estadoDe = (v) => v.anulada_at ? 'Anulada' : v.entregada_at ? 'Entregada' : v.dimensiones?.find(([k]) => k === 'Trabajo')?.[1] || v.situacion.texto;
// Patente sin espacios ni guiones; marca, modelo, cliente y número en minúsculas; teléfono solo con dígitos.
const claves = (v) => ({ p: (v.vehiculo.patente || '').replace(/\W/g, '').toLowerCase(), t: `${v.vehiculo.marca || ''} ${v.vehiculo.modelo || ''} ${v.contacto || ''} ${v.numero}`.toLowerCase(), d: (v.telefono || '').replace(/\D/g, '') });
const coincide = (k, s) => { const sp = s.replace(/\W/g, ''), sd = s.replace(/\D/g, ''); return !s || (sp && k.p.includes(sp)) || k.t.includes(s) || (sd.length >= 3 && k.d.includes(sd)); };

export default async function trabajos({ app, query }) {
  const esMec = app.sesion.usuario.rol === 'mecanico';
  const ver = ['mias', 'abiertas', 'historial'].includes(query.ver) ? query.ver : (esMec ? 'mias' : 'abiertas');
  const { visitas } = await get(`/api/visitas?estado=${ver}`);
  const vistas = [...(esMec ? [['mias', 'Asignadas a mí']] : []), ['abiertas', 'En el taller'], ['historial', 'Entregadas y anuladas']];
  const estados = [...new Set(visitas.map(estadoDe))];
  const estado = estados.includes(query.estado) ? query.estado : '';
  const q0 = String(query.q || '').slice(0, 60);
  const lista = estado ? visitas.filter((v) => estadoDe(v) === estado) : visitas;
  const n = visitas.length;
  const cifra = ver === 'historial' ? (n === 1 ? 'entregada o anulada' : 'entregadas y anuladas') : ver === 'mias' ? (n === 1 ? 'asignada a mí' : 'asignadas a mí') : (n === 1 ? 'auto en el taller' : 'autos en el taller');
  const fila = (v) => {
    const auto = [v.vehiculo.marca, v.vehiculo.modelo].filter(Boolean).join(' ') || 'Vehículo sin datos';
    const meta = [`N.º ${v.numero}`, v.entregada_at ? 'entregado ' + fecha(v.entregada_at) : cuando(v.ingreso_at), v.responsable].filter(Boolean).map(esc).join(' · ');
    return `<a class="tb-ord" href="#/visitas/${v.id}" data-id="${v.id}" aria-label="${esc(`Abrir orden N.º ${v.numero}, ${auto}, ${v.vehiculo.patente ? 'patente ' + v.vehiculo.patente : 'sin patente'}, ${v.situacion.texto}.${v.motivo ? ' ' + v.motivo : ''}`)}">
      ${placa(v.vehiculo.patente)}<span class="tb-mod">${logoMarca(v.vehiculo.marca)}<b>${esc(auto)}</b></span>${ic('chevron_right', 'tb-chev')}
      <span class="tb-det">${chipSituacion(v.situacion)}${v.motivo ? `<span class="tb-mot">${esc(v.motivo)}</span>` : ''}<small>${meta}</small></span></a>`;
  };
  const grupos = ver === 'historial' ? [['Entregadas y anuladas', lista]] : estados.filter((e) => !estado || e === estado).map((e) => [e, lista.filter((v) => estadoDe(v) === e)]);
  const vacio = vacioD('garage', ver === 'mias' ? 'No tenés órdenes asignadas' : ver === 'abiertas' ? 'No hay autos en el taller' : 'Todavía no hay órdenes cerradas', '', ver !== 'historial' && app.puede('visita.recibir') ? `<a class="btn btn-primario" href="#/recibir">${ic('add')}Recibir un auto</a>` : '');
  return {
    titulo: 'Taller',
    // El auto es decorativo (alt vacío) y la cifra se lee como una sola frase.
    html: `<header class="tb-cab"><div class="tb-cab-t"><h1 tabindex="-1">Taller</h1><p class="tb-cifra${String(n).length > 2 ? ' larga' : ''}"><b>${n}</b><span>${cifra}</span></p></div>
      <img class="tb-auto" src="/ilustraciones/taller/auto-grafito.svg?v=0.1.0" width="176" height="102" alt="" decoding="async">
      ${ibtn('help', 'Ayuda: cómo leer el taller', { attrs: 'data-ayuda="guia"', cls: 'tb-ayuda' })}</header>
      ${n ? `<div class="buscador-d tb-busca">${ic('search')}<label class="sr" for="taller-q">Buscar orden por patente, modelo, cliente, teléfono o número</label><input id="taller-q" type="search" placeholder="Patente, cliente, teléfono o N.º" autocomplete="off" spellcheck="false" enterkeyhint="search" value="${esc(q0)}">
        <button type="button" class="tb-borrar" data-borrar ${q0 ? '' : 'hidden'} aria-label="Borrar búsqueda">${ic('close')}</button></div>` : ''}
      <nav class="tb-seg${vistas.length > 2 ? ' tres' : ''}" aria-label="Conjunto de órdenes">${vistas.map(([k, t]) => `<a href="#/trabajos?ver=${k}" data-ver="${k}" ${k === ver ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
      ${n ? `<nav class="tb-filtros" aria-label="Filtrar por etapa"><a class="tb-pill" href="#/trabajos?ver=${ver}" data-estado="" ${!estado ? 'aria-current="true"' : ''}><span>Todas<b data-n>${n}</b></span></a>${estados.map((e) => `<a class="tb-pill" href="#/trabajos?ver=${ver}&estado=${encodeURIComponent(e)}" data-estado="${esc(e)}" ${estado === e ? 'aria-current="true"' : ''}><span>${esc(e)}<b data-n>${visitas.filter((v) => estadoDe(v) === e).length}</b></span></a>`).join('')}</nav>` : ''}
      <p class="sr" aria-live="polite" data-cuenta></p>
      ${n ? `<section class="tb-lista" aria-label="Órdenes">${grupos.map(([t, G]) => `<div class="tb-grupo" data-grupo><h2>${esc(t)}<span data-gn>${G.length}</span></h2>${G.map(fila).join('')}</div>`).join('')}
        <div class="tb-sin" data-sin hidden></div></section>` : vacio}
      <ul class="lista-d"><li><a class="li-b" href="#/pendientes"><span class="li-ic">${ic('pending_actions')}</span><span class="li-t"><b>Services y trabajos postergados</b><small>Lo que el cliente dejó para más adelante</small></span>${ic('chevron_right')}</a></li></ul>`,
    despues(raiz) {
      if (!n) return;
      const q = raiz.querySelector('#taller-q');
      const datos = new Map(visitas.map((v) => [String(v.id), { v, k: claves(v), e: estadoDe(v) }]));
      const filas = [...raiz.querySelectorAll('.tb-ord')];
      const sin = raiz.querySelector('[data-sin]');
      // La etapa elegida queda a la vista aunque esté al final de la tira (sin mover la página).
      const tira = raiz.querySelector('.tb-filtros'), elegida = tira.querySelector('[aria-current]');
      if (elegida.offsetLeft + elegida.offsetWidth > tira.clientWidth) tira.scrollLeft = elegida.offsetLeft - 16;
      // El texto buscado viaja con los cambios de conjunto y de etapa.
      const conQ = (href, s) => href.replace(/&q=[^&]*/, '') + (s ? '&q=' + encodeURIComponent(s) : '');
      const aplicar = () => {
        const s = q.value.trim().toLowerCase();
        raiz.querySelector('[data-borrar]').hidden = !q.value;
        let vis = 0;
        filas.forEach((el) => { const ok = coincide(datos.get(el.dataset.id).k, s); el.hidden = !ok; if (ok) vis++; });
        raiz.querySelectorAll('[data-grupo]').forEach((g) => { const k = g.querySelectorAll('.tb-ord:not([hidden])').length; g.hidden = !k; g.querySelector('[data-gn]').textContent = k; });
        // Cantidades de cada etapa según la búsqueda, sobre todo el conjunto (no solo la etapa elegida).
        const todas = [...datos.values()].filter((d) => coincide(d.k, s));
        raiz.querySelectorAll('.tb-pill').forEach((a) => {
          const c = a.dataset.estado ? todas.filter((d) => d.e === a.dataset.estado).length : todas.length;
          a.querySelector('[data-n]').textContent = c; a.classList.toggle('cero', !c);
          a.href = conQ(a.getAttribute('href'), q.value.trim());
        });
        raiz.querySelectorAll('.tb-seg a').forEach((a) => { a.href = conQ(a.getAttribute('href'), q.value.trim()); });
        sin.hidden = vis > 0;
        if (!vis) {
          const otras = [...new Set(todas.map((d) => d.e))];
          sin.innerHTML = `<p class="vt">${estado ? 'Sin coincidencias en esta etapa' : 'Sin coincidencias'}</p><p class="vx">${otras.length ? `«${esc(q.value.trim())}» está en ${otras.map(esc).join(', ')}.` : `Ninguna orden ${ver === 'historial' ? 'entregada o anulada' : 'de este conjunto'} coincide con «${esc(q.value.trim())}».`}</p>
            ${otras.length ? `<a class="btn tb-sin-b" href="${conQ(`#/trabajos?ver=${ver}`, q.value.trim())}">Ver en todas las etapas</a>` : `<button type="button" class="btn tb-sin-b" data-borrar>Borrar búsqueda</button>`}`;
        }
        raiz.querySelector('[data-cuenta]').textContent = s ? `${vis} ${vis === 1 ? 'orden' : 'órdenes'}` : '';
      };
      q.addEventListener('input', aplicar);
      // Enter: con una sola orden a la vista la abre; si no, cierra el teclado para ver la lista.
      q.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const vis = filas.filter((el) => !el.hidden);
        if (q.value.trim() && vis.length === 1) vis[0].click(); else q.blur();
      });
      raiz.addEventListener('click', (e) => {
        if (!e.target.closest('[data-borrar]')) return;
        q.value = ''; aplicar(); q.focus();
      });
      if (q0) aplicar();
    }
  };
}
