// Hoy en el taller (diseño final, A): encabezado con el taller y la fecha, resumen grafito, grupos de atención,
// alcance (todo el taller o asignado a mí) y una tarjeta por auto con su etapa, estados, responsable, retiro y
// próximo paso. Los datos, contadores y grupos los calcula el servidor (/api/hoy).
import { get } from '../api.js?v=0.1.0';
import { leerBorrador, borrarBorrador } from '../recepcion-modelo.js?v=0.1.0';
import { grupoHoy, estadoDimension } from '../orden-presentacion.js?v=0.1.0';
import { esc, pesos, cuando, fecha, hora, haceCuanto, aLocal } from '../ui.js?v=0.1.0';
import { ic, placa, logoMarca, etapas, ETAPAS_ORDEN, ibtn, vacioD } from '../diseno.js?v=0.1.0';
import { marcaTaller, lineaPlan } from '../app.js?v=0.1.0';

// Filtros heredados por enlace (#/hoy?ver=…): siguen funcionando aunque no tengan botón propio.
const GRUPOS = { revision: ['revision', 'presupuesto'], trabajo: ['trabajo'], control: ['control', 'controlada'], autorizacion: ['autorizacion'], repuesto: ['repuesto'], lista: ['lista'] };
const OPERATIVOS = [['autorizacion', 'Sin respuesta del cliente', 'sms'], ['repuestos', 'Piezas por resolver', 'inventory_2'], ['retiros', 'Retiros acordados hoy', 'schedule'], ['listas', 'Listos para retirar', 'task_alt']];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Etapa de la barra de cinco segmentos según la situación real (no adelanta pasos).
// Ilustraciones de la portada (estáticas): variante clara y oscura en la misma caja; el CSS muestra la del tema activo.
const ilus = (n, [w, h] = n.endsWith('chico') ? [24, 24] : [100, 78]) => ['claro', 'oscuro'].map((t) => `<img class="pt-${t}" src="/ilustraciones/hoy/${n}-${t}.svg" alt="" width="${w}" height="${h}" decoding="async">`).join('');
// Cifra del resumen: el tamaño se ajusta a su largo y al ancho de la columna, sin cortarla ni empujar la ilustración.
const dato = (ilu, valor, rotulo) => `<div class="pt-c"><span class="pt-ico pt-ico-${ilu.split('-')[0]}" aria-hidden="true">${ilus(ilu)}</span><dt>${rotulo}</dt><dd style="--ch:${Math.max(2, String(valor).length)}">${esc(valor)}</dd></div>`;
const ETAPA = { revision: 1, presupuesto: 2, autorizacion: 2, repuesto: 3, trabajo: 3, control: 3, controlada: 3, lista: 4 };

function seccionAccion(v, app) { if (v.situacion.clave === 'lista' && app.puede('ver.dinero') && /Liquidar|Cobrar/.test(v.situacion.paso)) return 'cobros'; return ({ revision: 'revision', presupuesto: 'presupuesto', autorizacion: 'presupuesto', repuesto: 'trabajo', trabajo: 'trabajo', control: 'control', controlada: 'control', lista: 'control' })[v.situacion.clave] || 'trabajo'; }
function accionCorta(v, app) { if (v.situacion.clave === 'lista') { if (app.puede('ver.dinero') && /Liquidar|Cobrar/.test(v.situacion.paso)) return /Liquidar/.test(v.situacion.paso) ? 'Liquidar' : 'Cobrar'; if (!app.puede('visita.entregar')) return 'Ver control'; } return ({ revision: 'Revisar', presupuesto: 'Presupuestar', autorizacion: 'Registrar respuesta', repuesto: 'Ver repuestos', trabajo: 'Continuar', control: 'Comprobar', controlada: 'Cerrar', lista: 'Entregar' })[v.situacion.clave] || 'Abrir orden'; }
const ICONO_ACCION = { revision: 'search', presupuesto: 'receipt_long', autorizacion: 'sms', repuesto: 'inventory_2', trabajo: 'build', control: 'checklist', controlada: 'task_alt', lista: 'directions_car' };
function detalle(v) {
  if (v.situacion.clave === 'repuesto' && v.repuestosEsperando[0]) {
    const r = v.repuestosEsperando[0];
    return `${esc(r.descripcion)} ${r.etapa === 'pedido' ? (r.fecha_prevista ? '· llegada prevista ' + esc(fecha(r.fecha_prevista).slice(0, 5)) : '· sin fecha de llegada') : '· falta pedir'}`;
  }
  if (v.situacion.clave === 'autorizacion' && v.sinRespuestaDesde) return `Presupuesto enviado ${esc(haceCuanto(v.sinRespuestaDesde))}, sin respuesta`;
  return esc(v.motivo);
}
const buscable = (v) => `data-patente="${esc(v.vehiculo.patente.replace(/\W/g, '').toLowerCase())}" data-texto="${esc((v.vehiculo.marca + ' ' + v.vehiculo.modelo + ' ' + (v.contacto || '')).toLowerCase())}" data-telefono="${esc((v.telefono || '').replace(/\D/g, ''))}"`;

function tarjeta(v, app) {
  const e = ETAPA[v.situacion.clave] ?? 1;
  const auto = [v.vehiculo.marca, v.vehiculo.modelo].filter(Boolean).join(' ') || 'Vehículo sin datos';
  // Las dimensiones sin novedad («Sin pedidos», «En taller»…) no se repiten en la tarjeta; Trabajo siempre se muestra.
  const estados = (v.dimensiones || []).filter(([k, t]) => k === 'Trabajo' || !['Sin pedir', 'Sin pedidos', 'Sin movimientos', 'En taller'].includes(t)).map(([k, t]) => estadoDimension(k, t)).join('');
  const resp = v.responsable ? v.responsable.split(/\s+/)[0] : '';
  return `<article class="tarjeta" ${buscable(v)}>
    <a class="t-cab" href="#/visitas/${v.id}" aria-label="Abrir orden ${v.numero}, ${esc(auto)}, patente ${esc(v.vehiculo.patente || 'sin patente')}">${logoMarca(v.vehiculo.marca)}<span class="t-id">${placa(v.vehiculo.patente)}<span class="t-mod"><b>${esc(auto)}</b><small>${esc(v.contacto || 'Sin cliente')} · N.º ${v.numero}</small></span></span>${v.prioridad === 'alta' ? `<span class="urg" title="Urgente">${ic('priority_high')}<span class="sr">Urgente</span></span>` : ''}${ic('chevron_right', 'chev')}</a>
    <div class="t-etapa"><span class="lbl">${ETAPAS_ORDEN[e]}</span>${etapas(e)}</div>
    <div class="t-chips">${estados}</div>
    ${v.situacion.clave === 'repuesto' || v.situacion.clave === 'autorizacion' ? `<p class="t-det">${detalle(v)}</p>` : ''}
    <div class="t-pie"><span class="t-meta">${resp ? `<span class="av chico" aria-hidden="true">${esc(resp.slice(0, 1))}</span>${esc(resp)}` : '<span class="sindato">Sin responsable</span>'}<span class="sep" aria-hidden="true">·</span>${v.retiro_acordado ? `<span>${ic('schedule')}Retiro ${esc(cuando(v.retiro_acordado))}</span>` : '<span class="sindato">Retiro a confirmar</span>'}</span>
      <a class="btn btn-sig" href="#/visitas/${v.id}/${seccionAccion(v, app)}">${ic(ICONO_ACCION[v.situacion.clave] || 'arrow_forward')}<span>${esc(accionCorta(v, app))}</span></a></div>
  </article>`;
}

export default async function hoy({ app, query }) {
  const [d, cuentas] = await Promise.all([get('/api/hoy'), app.puede('ver.dinero') ? get('/api/cuentas').catch(() => null) : null]);
  const esMecanico = app.sesion.usuario.rol === 'mecanico';
  const filtro = query.ver || (esMecanico && d.mias?.length ? 'mias' : 'todos');
  const pendientes = d.pendientes || {};
  const idsFiltro = pendientes[filtro] ? new Set(pendientes[filtro]) : null;
  let presentes = filtro === 'mias' ? d.presentes.filter((v) => (d.mias || []).includes(v.id)) : idsFiltro ? d.presentes.filter((v) => idsFiltro.has(v.id)) : GRUPOS[filtro] ? d.presentes.filter((v) => GRUPOS[filtro].includes(v.situacion.clave)) : d.presentes;
  presentes = presentes.slice().sort((a, b) => { const aa = d.atencion.some((x) => x.visitaId === a.id), bb = d.atencion.some((x) => x.visitaId === b.id); return Number(bb) - Number(aa) || (a.retiro_acordado || 'z').localeCompare(b.retiro_acordado || 'z'); });
  const ahora = aLocal(d.ahora);
  const t = app.sesion.taller;
  const borrador = app.puede('visita.recibir') ? leerBorrador(app) : null;
  const responsables = new Map();
  for (const v of d.presentes) responsables.set(v.responsable || 'Sin asignar', (responsables.get(v.responsable || 'Sin asignar') || 0) + 1);
  const operativo = OPERATIVOS.find((x) => x[0] === filtro);
  const grupos = [['hacer', 'Para hacer'], ['bloqueadas', 'Bloqueados'], ['listas', 'Listos para retirar']];
  const listos = d.presentes.filter((v) => v.lista_at).length;

  const listaRetiros = d.retiros.length ? `<ul class="lista-d densa">${d.retiros.map((v) => `<li><a class="li-b" href="#/visitas/${v.id}"><span class="monto-d">${esc(hora(v.retiro_acordado))}</span>${placa(v.vehiculo.patente)}<span class="li-t"><b>${esc([v.vehiculo.marca, v.vehiculo.modelo].join(' '))}</b><small>${v.lista_at ? 'Listo para entregar' : esc(v.situacion.texto)}</small></span>${ic('chevron_right')}</a></li>`).join('')}</ul>` : '<p class="nota">No hay retiros acordados para hoy.</p>';
  const listaAtencion = d.atencion.length ? `<ul class="lista-d densa">${d.atencion.map((a) => `<li><a class="li-b" href="#/visitas/${a.visitaId}/${a.tipo === 'autorizacion' ? 'presupuesto' : a.tipo === 'repuesto' ? 'trabajo' : ''}">${placa(a.vehiculo.patente)}<span class="li-t"><b>${esc(a.titulo)}</b><small>${esc(a.detalle)}</small></span>${ic('chevron_right')}</a></li>`).join('')}</ul>` : '<p class="nota">Nada urgente por ahora.</p>';
  const listaTurnos = d.turnos.length ? `<ul class="lista-d densa">${d.turnos.map((x) => `<li><span class="monto-d">${esc(x.inicio.slice(11))}</span><span class="li-t"><b>${esc(x.nombre)}</b><small>${esc(x.vehiculo_texto || x.patente || '')}</small></span>${x.estado === 'solicitado' ? '<span class="chip neutro">Sin confirmar</span>' : ''}</li>`).join('')}</ul>` : '<p class="nota">Sin turnos para hoy.</p>';

  return {
    titulo: 'Hoy',
    html: `<header class="a-cab pt-cab"><div class="a-marca">${marcaTaller(t)}<span class="pt-id"><span class="pt-taller"><span translate="no">${esc(t.nombre)}</span>${t.demo ? '<span class="chip demo" title="Personas, autos e importes inventados para mostrar el sistema">DEMO</span>' : ''}</span><span class="pt-tit"><h1 tabindex="-1">Hoy</h1><span class="pt-fecha">${esc(DIAS[new Date(ahora.slice(0, 10) + 'T12:00:00Z').getUTCDay()])} ${esc(fecha(ahora).slice(0, 5))}</span></span></span></div>
      <div class="a-cab-acc">${ibtn('help', 'Ayuda', { attrs: 'data-ayuda="guia"' })}<button type="button" class="av-b" data-sesion aria-label="Tu sesión: ${esc(app.sesion.usuario.nombre)}">${esc(app.sesion.usuario.nombre.slice(0, 1).toUpperCase())}</button></div></header>
      ${lineaPlan()}
      <div class="buscador-d pt-busca">${ic('search')}<label class="sr" for="hoy-q">Buscar por patente, cliente o teléfono</label><input id="hoy-q" type="search" placeholder="Patente, cliente o teléfono" autocomplete="off" enterkeyhint="search"></div>
      <dl class="resumen-a pt-res${cuentas ? ' con-din' : ''}${cuentas && pesos(cuentas.total || 0).length >= 10 ? ' din-largo' : ''}" aria-label="Resumen del día">${dato('taller-grande', d.presentes.length, 'En el taller')}${dato('calendario-grande', d.retiros.length, 'Retiros hoy')}${cuentas ? dato('dinero-grande', pesos(cuentas.total || 0), 'Saldo por cobrar') : dato('listos-grande', listos, 'Listos')}</dl>
      ${borrador ? `<section class="aviso-in warn" aria-label="Recepción sin terminar">${ic('edit_note')}<span><b>Recepción sin terminar.</b> ${esc(borrador.campos?.patente || 'Auto en preparación')}: es un borrador, todavía no cuenta como recibido. <a href="#/recibir">Continuar</a>${!borrador.pendiente ? ' · <button type="button" class="enlace" data-descartar-borrador>Descartar</button>' : ''}</span></section>` : ''}
      <div class="pt-fw" data-ini="1" data-fin="1"><nav class="filtros pt-filtros" aria-label="Grupos de atención">${OPERATIVOS.map(([k, txt, i]) => { const n = pendientes[k]?.length || 0; return `<a class="filtro${n ? '' : ' cero'}" href="#/hoy?ver=${filtro === k ? 'todos' : k}" ${filtro === k ? 'aria-current="true"' : ''}>${ic(i)}<span>${txt}</span><b>${n}</b></a>`; }).join('')}</nav><button type="button" class="pt-fmas" data-filtros-mas tabindex="-1" aria-hidden="true">${ic('chevron_right')}</button></div>
      ${operativo ? `<p class="nota">${ic('info')}Órdenes abiertas; una orden puede aparecer en más de un grupo. Hoy corresponde al horario del taller (${esc((d.zona || 'America/Argentina/Mendoza').split('/').at(-1).replaceAll('_', ' '))}).</p>` : ''}
      <nav class="seg pt-seg" aria-label="Qué autos ver">${[['todos', 'Todo el taller', d.presentes.length], ['mias', 'Asignado a mí', d.mias?.length || 0]].map(([ver, nombre, n]) => `<a href="#/hoy?ver=${ver}" ${filtro === ver ? 'aria-current="page"' : ''}>${ver === 'todos' ? `<span class="pt-sel" aria-hidden="true">${ilus('taller-chico')}</span>` : ''}<span class="pt-seg-t">${nombre}</span> <b>${n}<span class="sr"> vehículo${n === 1 ? '' : 's'}</span></b></a>`).join('')}</nav>
      <p class="sr" aria-live="polite" data-cuenta>${presentes.length} de ${d.presentes.length} autos${operativo ? ' · ' + esc(operativo[1]) : ''}</p>
      <div data-sin-resultados hidden>${vacioD('search', 'Ninguno de los autos presentes coincide', '', '<button type="button" class="btn" data-buscar-todos>Buscar en todos los autos del taller</button>')}</div>
      ${!d.presentes.length ? vacioD('garage', 'No hay autos en el taller', 'Cuando recibas un auto, aparece acá con su próxima acción.', app.puede('visita.recibir') ? `<a class="btn btn-primario" href="#/recibir">${ic('add')}Recibir un auto</a>` : '')
        : !presentes.length ? vacioD('search', filtro === 'mias' ? 'No tenés autos asignados' : 'Ningún auto en este grupo', filtro === 'mias' ? 'Podés ver los autos presentes en «Todo el taller».' : '', '<a class="btn" href="#/hoy?ver=todos">Ver todo el taller</a>')
        : grupos.map(([k, txt]) => { const G = presentes.filter((v) => grupoHoy(v) === k); return G.length ? `<section class="grupo-o" data-grupo-hoy="${k}" aria-labelledby="g-${k}"><h2 id="g-${k}">${txt}<span>${G.length}</span></h2>${G.map((v) => tarjeta(v, app)).join('')}</section>` : ''; }).join('')}
      ${d.configurar?.some((x) => !x.hecho) ? `<details class="desp"><summary>${ic('settings')}Configuración pendiente · ${d.configurar.filter((x) => !x.hecho).length}</summary><div class="desp-c"><ol class="lista-d densa">${d.configurar.map((x) => `<li>${x.hecho ? `${ic('check')}<span class="li-t"><small>${esc(x.texto)}</small></span>` : `<a class="li-b" href="#/${x.ruta}"><span class="li-t"><b>${esc(x.texto)}</b></span>${ic('chevron_right')}</a>`}</li>`).join('')}</ol></div></details>` : ''}
      <details class="desp" data-contexto-hoy><summary>${ic('event_available')}Atención, retiros y turnos</summary><div class="desp-c">
        <div class="sec-h"><h2>Atención requerida</h2></div>${listaAtencion}
        <div class="sec-h"><h2>Retiros de hoy</h2><span class="monto-d">${d.retiros.length}</span></div>${listaRetiros}
        ${d.solicitudes && app.puede('agenda.gestionar') ? `<p class="aviso-in">${ic('calendar_month')}<span><b>${d.solicitudes} solicitud${d.solicitudes > 1 ? 'es' : ''} de turno sin confirmar.</b> <a href="#/agenda">Revisar en la agenda</a></span></p>` : ''}
        ${app.puede('agenda.ver') ? `<div class="sec-h"><h2>Turnos de hoy</h2><a href="#/agenda">Ver agenda</a></div>${listaTurnos}` : ''}
      </div></details>
      ${responsables.size ? `<details class="desp"><summary>${ic('group')}Órdenes abiertas por responsable</summary><div class="desp-c"><p class="nota">Cantidad de órdenes; no representa horas ni capacidad disponible.</p><ul class="lista-d densa">${[...responsables].map(([nombre, n]) => `<li><span class="li-t"><b>${esc(nombre)}</b></span><span class="monto-d">${n}</span></li>`).join('')}</ul></div></details>` : ''}`,
    despues(raiz) {
      // Filtros: degradado y flecha solo hacia el lado con opciones fuera de la vista; la opción elegida queda visible.
      const sc = raiz.querySelector('.pt-filtros'), fw = sc.parentElement;
      const bordes = () => { fw.dataset.ini = sc.scrollLeft <= 2 ? '1' : '0'; fw.dataset.fin = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 2 ? '1' : '0'; };
      const elegido = sc.querySelector('[aria-current]');
      if (elegido && elegido.offsetLeft + elegido.offsetWidth + 48 > sc.clientWidth) sc.scrollLeft = elegido.offsetLeft - 16;
      sc.addEventListener('scroll', bordes, { passive: true });
      new ResizeObserver(bordes).observe(sc);
      fw.querySelector('[data-filtros-mas]').addEventListener('click', () => sc.scrollBy({ left: Math.round(sc.clientWidth * 0.7), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
      raiz.querySelector('[data-descartar-borrador]')?.addEventListener('click', () => { borrarBorrador(app); app.recargar(); });
      const q = raiz.querySelector('#hoy-q');
      const items = raiz.querySelectorAll('article[data-patente]');
      q.addEventListener('input', () => {
        const s = q.value.trim().toLowerCase(), sp = s.replace(/\W/g, ''), sd = s.replace(/\D/g, '');
        let vis = 0;
        items.forEach((el) => { const ok = !s || el.dataset.patente.includes(sp) || el.dataset.texto.includes(s) || (sd.length >= 3 && el.dataset.telefono.includes(sd)); el.hidden = !ok; if (ok) vis++; });
        raiz.querySelectorAll('[data-grupo-hoy]').forEach((g) => { g.hidden = !!s && !g.querySelector('article:not([hidden])'); });
        raiz.querySelector('[data-cuenta]').textContent = `${s ? vis : presentes.length} de ${d.presentes.length} autos`;
        raiz.querySelector('[data-sin-resultados]').hidden = !(s && vis === 0);
      });
      raiz.querySelector('[data-buscar-todos]')?.addEventListener('click', () => app.ir('#/autos?q=' + encodeURIComponent(q.value.trim())));
    }
  };
}
