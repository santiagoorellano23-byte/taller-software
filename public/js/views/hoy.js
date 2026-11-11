// Hoy en el taller: autos presentes, situación, responsable, retiro y próximo paso.
import { get } from '../api.js?v=0.1.0';
import {leerBorrador,borrarBorrador} from '../recepcion-modelo.js?v=0.1.0';
import {grupoHoy,estadoDimension} from '../orden-presentacion.js?v=0.1.0';
import { esc, icono, patente, nombreAuto, chipSituacion, cuando, fecha, hora, haceCuanto, hoyLocal, aLocal } from '../ui.js?v=0.1.0';

const GRUPOS = [
  ['todos', 'autos presentes', null],
  ['revision', 'En revisión', ['revision', 'presupuesto']],
  ['autorizacion', 'Esperando autorización', ['autorizacion']],
  ['repuesto', 'Esperando repuesto', ['repuesto']],
  ['trabajo', 'En trabajo', ['trabajo']],
  ['control', 'Falta comprobar', ['control', 'controlada']],
  ['lista', 'Listo para retirar', ['lista']]
];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function seccionAccion(v,app){if(v.situacion.clave==='lista'&&app.puede('ver.dinero')&&/Liquidar|Cobrar/.test(v.situacion.paso))return 'cobros';return ({revision:'revision',presupuesto:'presupuesto',autorizacion:'presupuesto',repuesto:'trabajo',trabajo:'trabajo',control:'control',controlada:'control',lista:'control'})[v.situacion.clave]||'trabajo';}
function accionCorta(v,app){if(v.situacion.clave==='lista'){if(app.puede('ver.dinero')&&/Liquidar|Cobrar/.test(v.situacion.paso))return /Liquidar/.test(v.situacion.paso)?'Liquidar':'Cobrar';if(!app.puede('visita.entregar'))return 'Ver control';}return ({revision:'Revisar',presupuesto:'Presupuestar',autorizacion:'Ver respuesta',repuesto:'Ver piezas',trabajo:'Continuar',control:'Comprobar',controlada:'Cerrar',lista:'Entregar'})[v.situacion.clave]||'Abrir orden';}
function retiroTexto(v) {
  if (!v.retiro_acordado) return '<span class="muted">Sin fecha</span><br><strong>A confirmar</strong>';
  const l = aLocal(v.retiro_acordado);
  const d = l.slice(0, 10) === hoyLocal() ? 'Hoy' : `${DIAS[new Date(l.slice(0, 10) + 'T12:00:00Z').getUTCDay()].slice(0, 3)} ${fecha(l).slice(0, 5)}`;
  return `<span class="muted">${d}</span><br><strong>${hora(l)}</strong>`;
}
function detalle(v) {
  if (v.situacion.clave === 'repuesto' && v.repuestosEsperando[0]) {
    const r = v.repuestosEsperando[0];
    return `${esc(r.descripcion)} ${r.etapa === 'pedido' ? (r.fecha_prevista ? '· llegada prevista ' + esc(fecha(r.fecha_prevista).slice(0, 5)) : '· sin fecha de llegada') : '· falta pedir'}`;
  }
  if (v.situacion.clave === 'autorizacion' && v.sinRespuestaDesde) return `Presupuesto enviado ${esc(haceCuanto(v.sinRespuestaDesde))}, sin respuesta`;
  return esc(v.motivo);
}

export default async function hoy({ app, query }) {
  const d = await get('/api/hoy');
  const esMecanico = app.sesion.usuario.rol === 'mecanico';
  const filtro = query.ver || (esMecanico && d.mias?.length ? 'mias' : 'todos');
  const grupo = GRUPOS.find((g) => g[0] === filtro);
  const pendientes = d.pendientes || {};
  const idsFiltro = pendientes[filtro] ? new Set(pendientes[filtro]) : null;
  let presentes = filtro === 'mias' ? d.presentes.filter((v) => (d.mias||[]).includes(v.id)) : idsFiltro ? d.presentes.filter(v=>idsFiltro.has(v.id)) : grupo?.[2] ? d.presentes.filter((v) => grupo[2].includes(v.situacion.clave)) : d.presentes;
  presentes=presentes.slice().sort((a,b)=>{const aa=d.atencion.some(x=>x.visitaId===a.id),bb=d.atencion.some(x=>x.visitaId===b.id);return Number(bb)-Number(aa)||(a.retiro_acordado||'z').localeCompare(b.retiro_acordado||'z');});
  const conteo = (g) => g[2] ? d.presentes.filter((v) => g[2].includes(v.situacion.clave)).length : d.presentes.length;
  const ahora = aLocal(d.ahora);
  const operativos = [['autorizacion','Sin respuesta del cliente','mensaje'],['repuestos','Piezas por resolver','stock'],['retiros','Retiros acordados hoy','calendario'],['listas','Listos para retirar','check']];
  const responsables = new Map();
  for (const v of d.presentes) responsables.set(v.responsable||'Sin asignar',(responsables.get(v.responsable||'Sin asignar')||0)+1);
  const guiaClave = `guia-vista-${app.sesion.usuario.id}`;
  let guiaVista = true;
  try { guiaVista = localStorage.getItem(guiaClave) === '1'; } catch { guiaVista = true; }

  const fila = (v) => `
    <tr data-patente="${esc(v.vehiculo.patente.replace(/\W/g, '').toLowerCase())}" data-texto="${esc((v.vehiculo.marca + ' ' + v.vehiculo.modelo + ' ' + (v.contacto || '')).toLowerCase())}">
      <td>${patente(v.vehiculo.patente)}<span class="auto-nombre">${nombreAuto(v.vehiculo)}</span><span class="fila-sub">N.º ${v.numero} · ${esc(v.responsable||'Sin asignar')}</span><span class="fila-sub">Retiro ${v.retiro_acordado?esc(cuando(v.retiro_acordado)):'a confirmar'}</span></td>
      ${(v.dimensiones||[]).map(([k,t])=>`<td>${estadoDimension(k,t)}</td>`).join('')}
      
      <td><a class="btn btn-chico" href="#/visitas/${v.id}/${seccionAccion(v,app)}">${esc(accionCorta(v,app))} ${icono('der', 'i-sm')}</a></td>
    </tr>`;
  const gruposHoy=[['hacer','Para hacer'],['bloqueadas','Bloqueados'],['listas','Listos para retirar']];
  const filas=gruposHoy.map(([k,t])=>{const lista=presentes.filter(v=>grupoHoy(v)===k);return `<tbody data-grupo-tabla="${k}"><tr class="hoy-grupo-tabla"><th colspan="${app.puede('ver.dinero')?7:6}" scope="rowgroup">${t} <span class="small muted">${lista.length} auto${lista.length===1?'':'s'}</span></th></tr>${lista.length?lista.map(fila).join(''):`<tr><td colspan="${app.puede('ver.dinero')?7:6}" class="muted">No hay autos en este grupo.</td></tr>`}</tbody>`;}).join('');
  const tarjeta = (v) => `
    <article class="tarjeta-auto" data-patente="${esc(v.vehiculo.patente.replace(/\W/g, '').toLowerCase())}" data-texto="${esc((v.vehiculo.marca + ' ' + v.vehiculo.modelo + ' ' + (v.contacto || '')).toLowerCase())}">
      <div class="tarjeta-auto__cab">${patente(v.vehiculo.patente)}<strong class="auto-nombre" style="margin:0">${nombreAuto(v.vehiculo)}</strong></div>
      <div class="hoy-estados">${(v.dimensiones||[]).filter(([k,t])=>k==='Trabajo'||!['Sin pedir','Sin pedidos','Sin movimientos','En taller'].includes(t)).map(([k,t])=>estadoDimension(k,t)).join('')}</div>
      <p class="muted small">${detalle(v)}</p>
      
      <div class="tarjeta-auto__pie"><span>${esc(v.responsable || 'Sin asignar')} · Retiro ${v.retiro_acordado ? '<strong>' + esc(cuando(v.retiro_acordado)) + '</strong>' : 'a confirmar'}</span>
        <a class="btn btn-chico" href="#/visitas/${v.id}/${seccionAccion(v,app)}">${esc(accionCorta(v,app))} ${icono('der', 'i-sm')}</a></div>
    </article>`;
  const tarjetas=gruposHoy.map(([k,t])=>{const lista=presentes.filter(v=>grupoHoy(v)===k);return `<section class="hoy-grupo" data-grupo-hoy="${k}"><header><h2>${t}</h2><span class="small muted">${lista.length} auto${lista.length===1?'':'s'}</span></header><div class="tarjetas">${lista.length?lista.map(tarjeta).join(''):'<p class="small muted">No hay autos en este grupo.</p>'}</div></section>`;}).join('');
  const borrador=app.puede('visita.recibir')?leerBorrador(app):null;

  const retiros = d.retiros.length ? `<ul class="lista">${d.retiros.map((v) => `<li><div class="fila"><strong class="num">${esc(hora(v.retiro_acordado))}</strong>${patente(v.vehiculo.patente)}</div>
      <span>${nombreAuto(v.vehiculo)}</span><a href="#/visitas/${v.id}" class="small">${v.lista_at ? icono('check', 'i-sm') + ' Listo para entregar' : icono('der', 'i-sm') + ' ' + esc(v.situacion.texto)}</a></li>`).join('')}</ul>` : '<p class="muted">No hay retiros acordados para hoy.</p>';
  const atencion = d.atencion.length ? `<ul class="lista">${d.atencion.map((a) => `<li>${patente(a.vehiculo.patente)} <span class="small">${nombreAuto(a.vehiculo)}</span><strong style="color:var(--red)">${esc(a.titulo)}</strong><p class="muted small">${esc(a.detalle)}</p><a class="btn btn-chico" href="#/visitas/${a.visitaId}/${a.tipo === 'autorizacion' ? 'presupuesto' : a.tipo === 'repuesto' ? 'trabajo' : ''}">${esc(a.accion)}</a></li>`).join('')}</ul>` : '<p class="muted">Nada urgente por ahora.</p>';
  const turnos = d.turnos.length ? `<ul class="lista">${d.turnos.map((t) => `<li><div class="fila"><strong class="num">${esc(t.inicio.slice(11))}</strong>${t.estado === 'solicitado' ? '<span class="estado estado--violeta">Sin confirmar</span>' : ''}</div><span>${esc(t.nombre)} · ${esc(t.vehiculo_texto || t.patente || '')}</span></li>`).join('')}</ul>` : '<p class="muted">Sin turnos para hoy.</p>';

  return {
    titulo: 'Hoy',
    html: `<div class="pagina pagina--contexto pagina-hoy">
      <div class="pagina__cuerpo">
        <div class="cab">
          <div class="cab__titulo"><h1 tabindex="-1">Hoy en el taller</h1><span class="cab__meta">${esc(DIAS[new Date(ahora.slice(0, 10) + 'T12:00:00Z').getUTCDay()])} ${esc(fecha(ahora))} · ${esc(ahora.slice(11))}</span></div>
          <div class="acciones">
            <button type="button" class="btn btn-chico btn-texto" data-ayuda="guia">${icono('ayuda')}¿Cómo hago…?</button>
            ${app.puede('visita.recibir') ? `<a class="btn btn-primario" href="#/recibir">${icono('mas')}Recibir un auto</a>` : ''}
          </div>
        </div>
        ${borrador?`<section class="borrador-recepcion"><h2>Recepción sin terminar</h2><p>${esc(borrador.campos?.patente||'Auto en preparación')}. Es un borrador: todavía no cuenta como recibido.</p><div class="acciones"><a class="btn" href="#/recibir">Continuar</a>${!borrador.pendiente?'<button type="button" class="btn btn-texto" data-descartar-borrador>Descartar</button>':''}</div></section>`:''}
        <nav class="hoy-segmentos" aria-label="Alcance de Hoy">
          ${[['todos','Todo el taller',d.presentes.length],['mias','Asignado a mí',d.mias?.length||0]].map(([ver,nombre,cantidad])=>`<a href="#/hoy?ver=${ver}" ${filtro===ver?'aria-current="page"':''}><span class="hoy-segmento__texto"><strong>${nombre}</strong><span>${cantidad} vehículo${cantidad===1?'':'s'}</span></span><span class="hoy-segmento__indicador" aria-hidden="true"></span></a>`).join('')}
        </nav>
        <section class="prioridades-hoy" aria-label="Pendientes operativos">
          ${operativos.map(([k,t,i])=>`<a href="#/hoy?ver=${k}" ${filtro===k?'aria-current="true"':''}><span>${icono(i)}${t}</span><strong>${pendientes[k]?.length||0}</strong></a>`).join('')}
          <p>Órdenes abiertas; una orden puede aparecer en más de un grupo. Hoy corresponde al horario del taller (${esc((d.zona||'America/Argentina/Mendoza').split('/').at(-1).replaceAll('_',' '))}).</p>
        </section>
        <div class="tira" role="group" aria-label="Filtrar autos por situación">
          ${esMecanico ? `<button type="button" data-ver="mias" aria-pressed="${filtro === 'mias'}"><b>${d.mias?.length || 0}</b><span>asignados a vos</span></button>` : ''}
          ${GRUPOS.filter(g=>!['autorizacion','repuesto','lista'].includes(g[0])&&(g[0]==='todos'||conteo(g)>0||g[0]===filtro)).map((g) => `<button type="button" data-ver="${g[0]}" aria-pressed="${filtro === g[0]}"><b>${conteo(g)}</b><span>${g[1]}</span></button>`).join('')}
        </div>
        <section class="panel" aria-labelledby="t-lista">
          <h2 id="t-lista" class="sr">Autos ${filtro === 'todos' ? 'presentes' : 'filtrados'}</h2>
          <div class="panel__cab">
            <div class="buscador" style="flex:1 1 280px;max-width:440px">${icono('buscar')}<label class="sr" for="hoy-q">Buscar por patente, modelo o cliente</label><input id="hoy-q" type="search" placeholder="Patente, modelo o cliente" autocomplete="off"></div>
            <span class="muted small" data-cuenta>${presentes.length} de ${d.presentes.length} autos${operativos.find(x=>x[0]===filtro)?' · '+esc(operativos.find(x=>x[0]===filtro)[1]):''}</span>
          </div>
          <div data-sin-resultados hidden class="panel__cuerpo"><p class="muted">Ninguno de los autos presentes coincide. <button type="button" class="enlace" data-buscar-todos>Buscar en todos los autos del taller</button></p></div>
          ${presentes.length ? `<div class="hoy-tabla solo-escritorio"><table class="tabla-autos" style="margin-top:12px"><thead><tr><th scope="col">Vehículo</th>${['Trabajo','Autorización','Repuestos',...(app.puede('ver.dinero')?['Dinero']:[]),'Vehículo'].map(t=>`<th scope="col">${t}</th>`).join('')}<th scope="col"><span class="sr">Acción</span></th></tr></thead>${filas}</table></div>
            <div class="hoy-grupos solo-telefono">${tarjetas}</div>` : `<div class="panel__cuerpo">${filtro==='mias'?'<p><strong>No tenés vehículos asignados</strong></p><p class="muted">Podés ver los autos presentes en «Todo el taller».</p>':`<p class="muted">${filtro === 'todos' ? 'No hay autos en el taller en este momento.' : 'No hay autos en esta situación.'}</p>`}</div>`}
        </section>
        ${d.configurar?.some(x=>!x.hecho)?`<details class="setup-compact"><summary>${icono('ajustes')} Configuración pendiente · ${d.configurar.filter(x=>!x.hecho).length} ${icono('abajo')}</summary><ol class="pasos-inicio">${d.configurar.map(x=>`<li class="${x.hecho?'hecho':''}">${x.hecho?esc(x.texto):`<a href="#/${x.ruta}">${esc(x.texto)}</a>`}</li>`).join('')}</ol></details>`:''}
        ${responsables.size?`<details class="mas"><summary>Órdenes abiertas por responsable</summary><div class="mas__cuerpo"><p class="muted small">Cantidad de órdenes; no representa horas ni capacidad disponible.</p><dl class="responsables-hoy">${[...responsables].map(([nombre,n])=>`<div><dt>${esc(nombre)}</dt><dd>${n}</dd></div>`).join('')}</dl></div></details>`:''}
      </div>
      <aside class="contexto" aria-label="Resumen del día"><details class="contexto-toggle" open><summary>Atención, retiros y turnos ${icono('abajo')}</summary><div class="contexto-contenido">
        <section class="bloque"><h2>Retiros de hoy <span class="etiqueta-prueba">${d.retiros.length}</span></h2>${retiros}</section>
        <section class="bloque"><h2>Atención requerida</h2>${atencion}</section>
        ${d.solicitudes && app.puede('agenda.gestionar') ? `<div class="aviso">${icono('calendario')}<div><strong>${d.solicitudes} solicitud${d.solicitudes > 1 ? 'es' : ''} de turno sin confirmar.</strong> <a href="#/agenda">Revisar en la agenda</a></div></div>` : ''}
        ${app.puede('agenda.ver') ? `<section class="bloque"><h2>Turnos de hoy</h2>${turnos}<a href="#/agenda" class="small">Ver agenda completa</a></section>` : ''}
      </div></details></aside>
    </div>`,
    despues(raiz) {
      raiz.querySelector('[data-descartar-borrador]')?.addEventListener('click',()=>{borrarBorrador(app);app.recargar();});
      raiz.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => app.ir(`#/hoy?ver=${b.dataset.ver}`)));
      const q = raiz.querySelector('#hoy-q');
      const items = raiz.querySelectorAll('[data-patente]');
      q.addEventListener('input', () => {
        const t = q.value.trim().toLowerCase(), tp = t.replace(/\W/g, '');
        let vis = 0;
        items.forEach((el) => { const ok = !t || el.dataset.patente.includes(tp) || el.dataset.texto.includes(t); el.hidden = !ok; if (ok) vis++; });
        raiz.querySelectorAll('[data-grupo-tabla],[data-grupo-hoy]').forEach(g=>g.hidden=!!t&&!g.querySelector('[data-patente]:not([hidden])'));
        const n = raiz.querySelectorAll('tr[data-patente]:not([hidden])').length || raiz.querySelectorAll('article[data-patente]:not([hidden])').length;
        raiz.querySelector('[data-cuenta]').textContent = `${t ? n : presentes.length} de ${d.presentes.length} autos`;
        raiz.querySelector('[data-sin-resultados]').hidden = !(t && vis === 0);
      });
      raiz.querySelector('[data-buscar-todos]')?.addEventListener('click', (e) => { e.preventDefault(); app.ir('#/autos?q=' + encodeURIComponent(q.value.trim())); });
      raiz.querySelector('[data-guia-ok]')?.addEventListener('click', () => { try { localStorage.setItem(guiaClave, '1'); } catch { /* sin almacenamiento */ } raiz.querySelector('[data-guia]').remove(); });
    }
  };
}
