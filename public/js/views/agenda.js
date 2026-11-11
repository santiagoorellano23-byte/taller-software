// Agenda: solicitudes online por confirmar, turnos de la semana por día y alta de turnos.
import { get, post, claveDeEnvio } from '../api.js?v=0.1.0';
import { esc, icono, chip, fecha, campo, alEnviar, toast, confirmar, aviso, hoyLocal, casilla } from '../ui.js?v=0.1.0';
import { qrSVG } from '../qr-util.js?v=0.1.0';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const EST = { solicitado: ['Sin confirmar', 'violeta', 'reloj'], confirmado: ['Confirmado', 'verde', 'check'], cancelado: ['Cancelado', '', 'ban'], no_asistio: ['No vino', 'rojo', 'alerta'], ingresado: ['Auto recibido', 'teal', 'llave'] };
const sumar = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lunes = (f) => { const d = new Date(f + 'T12:00:00Z'); const w = d.getUTCDay(); return sumar(f, w === 0 ? -6 : 1 - w); };

export default async function agenda({ app, query }) {
  const desde = query.desde || lunes(hoyLocal());
  const hasta = sumar(desde, 6);
  const vista=(query.vista|| (matchMedia('(max-width:719px)').matches?'dia':'semana'))==='dia'?'dia':'semana', dia=query.dia||hoyLocal();
  const d = await get(`/api/agenda?desde=${desde}&hasta=${hasta}`);
  const gestiona = app.puede('agenda.gestionar');
  const t = app.sesion.taller;
  const urlPublica = `${location.origin}/t/${t.slug}`;
  const turnoHTML = (x) => `<li data-turno="${x.id}" id="turno-${x.id}"><div class="fila"><span class="fila__izq"><strong class="num">${esc(x.inicio.slice(11))}</strong><span class="muted small">${x.duracion_min} min${x.puesto ? ' · ' + esc(x.puesto) : ''}</span>${x.origen === 'online' ? chip('Pedido online', 'azul', 'enlace') : ''}</span>${chip(...EST[x.estado])}</div>
    <p><strong>${esc(x.nombre)}</strong> · ${esc(x.telefono)}${x.patente ? ' · ' + esc(x.patente) : ''}${x.vehiculo_texto ? ' · ' + esc(x.vehiculo_texto) : ''}</p>
    ${x.servicio || x.motivo ? `<p class="small muted">${esc([x.servicio, x.motivo].filter(Boolean).join(' · '))}</p>` : ''}${x.motivo_cierre ? `<p class="small muted">Motivo: ${esc(x.motivo_cierre)}</p>` : ''}
    ${x.visita_id ? `<a class="small" href="#/visitas/${x.visita_id}">Abrir visita N.º ${esc(x.visita_numero)}</a>` : ''}
    ${gestiona && ['solicitado', 'confirmado'].includes(x.estado) ? `<div class="acciones">
      ${x.estado === 'confirmado' && app.puede('visita.recibir') ? `<a class="btn btn-chico btn-primario" href="#/recibir?turno=${x.id}">${icono('llave')}Recibir este auto</a>` : ''}
      <button type="button" class="btn btn-chico" data-mover="${x.id}">${icono('calendario')}${x.estado === 'solicitado' ? 'Confirmar o cambiar hora' : 'Mover'}</button>
      <button type="button" class="btn btn-chico btn-texto" data-cerrar="${x.id}" data-e="cancelado">Cancelar</button>
      ${x.inicio < d.ahora ? `<button type="button" class="btn btn-chico btn-texto" data-cerrar="${x.id}" data-e="no_asistio">No vino</button>` : ''}</div><div data-mover-form="${x.id}" hidden></div>` : ''}</li>`;
  const porDia = [];
  for (let i = 0; i < 7; i++) { const f = sumar(desde, i); porDia.push([f, d.turnos.filter((x) => x.inicio.slice(0, 10) === f && x.estado !== 'solicitado')]); }
  return {
    titulo: 'Agenda',
    html: `<div class="pagina">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Agenda de turnos</h1><div class="acciones"><button type="button" class="btn btn-chico btn-texto" data-ayuda="turnos">${icono('ayuda')}¿Cómo hago…?</button>${gestiona ? `<a class="btn btn-primario" href="#nuevo-turno" data-nuevo>${icono('mas')}Nuevo turno</a>` : ''}</div></div>
      ${d.solicitudes.length ? `<details class="mas agenda-solicitudes"><summary>${d.solicitudes.length} ${d.solicitudes.length===1?'solicitud':'solicitudes'} sin confirmar</summary><section class="bloque mas__cuerpo" aria-labelledby="t-sol"><div class="bloque__cab"><h2 id="t-sol">Solicitudes por confirmar (${d.solicitudes.length})</h2><p>Llegaron desde la página pública. No son turnos hasta que se confirman.</p></div>
        <div class="panel"><ul class="lista">${d.solicitudes.map((x) => turnoHTML({ ...x, puesto: null })).join('')}</ul></div></section></details>` : ''}
      <div class="agenda-toolbar"><a class="btn btn-chico" href="#/agenda?desde=${vista==='dia'?lunes(sumar(dia,-1)):sumar(desde,-7)}&vista=${vista}&dia=${sumar(dia,-1)}">${icono('izq')}Anterior</a><a class="btn btn-chico" href="#/agenda?vista=${vista}">Hoy</a><a class="btn btn-chico" href="#/agenda?desde=${vista==='dia'?lunes(sumar(dia,1)):sumar(desde,7)}&vista=${vista}&dia=${sumar(dia,1)}">Siguiente ${icono('der')}</a><a class="btn btn-chico ${vista==='dia'?'btn-oscuro':''}" href="#/agenda?desde=${desde}&dia=${dia}&vista=dia">Día</a><a class="btn btn-chico ${vista==='semana'?'btn-oscuro':''}" href="#/agenda?desde=${desde}&vista=semana">Semana</a><span class="small muted">${vista==='dia'?fecha(dia):fecha(desde)+' al '+fecha(hasta)}</span></div>
      ${vista==='semana'?`<div class="agenda-dias" aria-label="Semana">${porDia.map(([f,l])=>`<section class="agenda-dia" ${f===hoyLocal()?'aria-current="date"':''}><h2>${DIAS[new Date(f+'T12:00:00Z').getUTCDay()].slice(0,3)} ${fecha(f).slice(0,5)}</h2>${l.filter(x=>x.estado==='confirmado'||x.estado==='ingresado').map(x=>`<a href="#/agenda?desde=${desde}&dia=${f}&vista=dia"><strong>${esc(x.inicio.slice(11))}</strong><br>${esc(x.patente||x.nombre)}<br>${esc(x.puesto||'Sin puesto')}</a>`).join('')||'<span>Sin turnos</span>'}<button type="button" data-dia="${f}">Ver día ${icono('der','i-sm')}</button></section>`).join('')}</div>`:''}
      <p class="small muted">Horario: ${esc(d.agenda.desde)} a ${esc(d.agenda.pausaDesde||d.agenda.hasta)}${d.agenda.pausaDesde&&d.agenda.pausaHasta?' y '+esc(d.agenda.pausaHasta)+' a '+esc(d.agenda.hasta):''}. Los turnos no autorizan reparaciones.</p>
      <div class="bloque turnos-lista">${porDia.filter(([f,l])=>vista==='dia'?f===dia:l.length>0).map(([f,l])=>`<section class="panel"><div class="panel__cab"><h2>${DIAS[new Date(f+'T12:00:00Z').getUTCDay()]} ${fecha(f).slice(0,5)}</h2><span class="small muted">${l.length} ${l.length===1?'turno':'turnos'}</span></div><ul class="lista">${l.map(turnoHTML).join('')||'<li class="muted">Sin turnos para este día.</li>'}</ul></section>`).join('')||'<p class="muted">No hay turnos en este período.</p>'}</div>
      ${gestiona ? `<section hidden class="panel panel__cuerpo bloque agenda-form-panel" id="nuevo-turno" aria-labelledby="t-nt"><h2 id="t-nt">Nuevo turno</h2>
        <form class="form" id="f-turno" novalidate>
          <div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true })}${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', requerido: true })}${campo({ nombre: 'inicio', etiqueta: 'Día y hora', tipo: 'datetime-local', requerido: true, attrs: `step="${d.agenda.paso * 60}"` })}</div>
          <div class="fila-campos">${campo({ nombre: 'servicioId', etiqueta: 'Servicio', tipo: 'select', opciones: [['', 'Sin indicar (60 min)'], ...d.servicios.map((s) => [s.id, `${s.nombre} · ${s.duracion_min} min`])] })}
            ${campo({ nombre: 'puestoId', etiqueta: 'Puesto', tipo: 'select', opciones: [['', 'Sin puesto (no controla superposición)'], ...d.puestos.map((p) => [p.id, p.nombre])], valor: d.puestos[0]?.id || '' })}</div>
          <details class="mas"><summary>Auto y motivo (opcional)</summary><div class="mas__cuerpo"><div class="fila-campos">${campo({ nombre: 'patente', etiqueta: 'Patente' })}${campo({ nombre: 'vehiculo', etiqueta: 'Auto', placeholder: 'Marca y modelo' })}</div>${campo({ nombre: 'motivo', etiqueta: 'Motivo' })}
            ${casilla('aceptaAvisos', 'Acepta que le recordemos el turno')}</div></details>
          <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Guardar turno</button><button class="btn" type="button" data-cancelar-nuevo>Cancelar</button></div></form></section>` : ''}
      ${t.publico ? `<details class="mas"><summary>Código QR para pedir turnos online</summary><div class="mas__cuerpo">
        <div class="qr-caja">${qrSVG(urlPublica)}<p class="small">${esc(urlPublica)}</p></div>
        <p class="muted small">Imprimilo para el mostrador. Lleva a la página pública del taller, donde se pide un turno que después confirmás acá. No muestra datos de clientes.</p></div></details>` : ''}
    </div>`,
    despues(raiz) {
      const abrirNuevo=(e)=>{e?.preventDefault();const panel=raiz.querySelector('#nuevo-turno');panel.hidden=false;const base=raiz.querySelector('.agenda-toolbar');base.after(panel);raiz.querySelector('#f-turno input').focus();};
      raiz.querySelector('[data-nuevo]')?.addEventListener('click',abrirNuevo);
      raiz.querySelectorAll('[data-dia]').forEach(b=>b.onclick=()=>app.ir(`#/agenda?desde=${desde}&dia=${b.dataset.dia}&vista=dia`));
      raiz.querySelector('[data-cancelar-nuevo]')?.addEventListener('click',async()=>{const panel=raiz.querySelector('#nuevo-turno'),f=raiz.querySelector('#f-turno');if(f.dataset.sucio){const r=await confirmar({titulo:'Descartar este turno sin guardar',texto:'Los datos de este formulario se perderán.',aceptar:'Descartar borrador'});if(!r.ok)return;}f.reset();delete f.dataset.sucio;panel.hidden=true;raiz.querySelector('[data-nuevo]').focus();});
      const f = raiz.querySelector('#f-turno');
      if (f) alEnviar(f, async (x) => { await post('/api/turnos', x, { idempotencia: claveDeEnvio(f) }); toast('Turno guardado y confirmado.'); app.recargar(); });
      const todos = [...d.turnos, ...d.solicitudes];
      raiz.querySelectorAll('[data-mover]').forEach((b) => b.addEventListener('click', () => {
        const x = todos.find((y) => y.id === Number(b.dataset.mover));
        const cont = raiz.querySelector(`[data-mover-form="${x.id}"]`);
        cont.hidden = false;
        cont.innerHTML = `<form class="form panel panel__cuerpo" novalidate><div class="fila-campos">${campo({ nombre: 'inicio', etiqueta: 'Día y hora', tipo: 'datetime-local', valor: x.inicio, requerido: true, attrs: `step="${d.agenda.paso * 60}"` })}
          ${campo({ nombre: 'puestoId', etiqueta: 'Puesto', tipo: 'select', valor: x.puesto_id || d.puestos[0]?.id || '', opciones: [['', 'Sin puesto'], ...d.puestos.map((p) => [p.id, p.nombre])] })}
          ${campo({ nombre: 'duracion', etiqueta: 'Duración (min)', valor: x.duracion_min, attrs: 'inputmode="numeric"' })}</div>
          <div class="form-pie"><button class="btn btn-primario" type="submit">${x.estado === 'solicitado' ? 'Confirmar turno' : 'Guardar cambio'}</button><button type="button" class="btn" data-x>Cancelar</button></div></form>`;
        const fm = cont.querySelector('form');
        fm.querySelector('[data-x]').onclick = () => { cont.hidden = true; cont.innerHTML = ''; };
        alEnviar(fm, async (v) => { await post(`/api/turnos/${x.id}/confirmar`, { ...v, version: x.version }); toast(x.estado === 'solicitado' ? 'Solicitud confirmada como turno.' : 'Turno movido.'); app.recargar(); });
      }));
      raiz.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: b.dataset.e === 'cancelado' ? 'Cancelar el turno' : 'El cliente no vino', aceptar: b.dataset.e === 'cancelado' ? 'Cancelar turno' : 'Registrar', peligro: true, pedir: { etiqueta: 'Motivo' } });
        if (!r.ok) return;
        try { await post(`/api/turnos/${b.dataset.cerrar}/cerrar`, { estado: b.dataset.e, motivo: r.valor }); toast('Turno actualizado.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      }));
      void aviso;
    }
  };
}
