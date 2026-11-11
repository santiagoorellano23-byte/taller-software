// Visita: cabecera, próximo paso, pestañas por área y columna de contexto (contacto y actividad).
import { get, post, put, claveDeEnvio } from '../api.js?v=0.1.0';
import { esc, icono, patente, nombreAuto, chipSituacion, chip, cuando, fecha, fechaHora, km, pesos, campo, alEnviar, toast, confirmar, aviso } from '../ui.js?v=0.1.0';
import { seccionRevision, seccionPresupuesto, seccionTrabajo, seccionControl, seccionCobros, seccionArchivos } from './visita-partes.js?v=0.1.0';
import {dimensionesHTML,resumenOrden,puedeOfrecerCobro} from '../orden-presentacion.js?v=0.1.0';
import {vistaEstadoIngreso} from '../estado-ingreso.js?v=0.1.0';

const resp = (l) => l.respuesta?.respuesta || (l.autorizada_ingreso ? 'autoriza' : null);
const SECCIONES = [
  ['resumen', 'Resumen'], ['revision', 'Revisión'], ['presupuesto', 'Presupuesto'], ['trabajo', 'Trabajos'], ['repuestos', 'Repuestos'], ['historial', 'Historial'], ['control', 'Control y entrega'], ['cobros', 'Cobros'], ['archivos', 'Archivos']
];

// Qué hacer ahora: texto del próximo paso + botón que lleva a la sección o hace la acción simple.
function proximoPaso(v, app) {
  const s = v.situacion;
  const ir = (sec, texto) => ({ texto, href: `#/visitas/${v.id}/${sec}` });
  const mapa = {
    revision: app.puede('revision.registrar') ? ir('revision', 'Registrar la revisión') : null,
    presupuesto: app.puede('presupuesto.preparar') ? ir('presupuesto', 'Preparar presupuesto') : null,
    autorizacion: app.puede('presupuesto.respuesta') ? ir('presupuesto', 'Registrar respuesta…') : null,
    repuesto: app.puede('repuestos.gestionar') ? ir('trabajo', 'Ver repuestos') : null,
    trabajo: app.puede('trabajo.ejecutar') ? ir('trabajo', 'Registrar avance') : null,
    control: app.puede('control.registrar') ? ir('control', 'Comprobar el resultado') : null,
    controlada: app.puede('visita.lista') ? { texto: 'Marcar listo para retirar', accion: 'lista' } : null,
    lista: /Liquidar|Cobrar/.test(s.paso) && app.puede('caja.registrar') ? ir('cobros', /Liquidar/.test(s.paso) ? 'Liquidar…' : 'Registrar pago…')
      : app.puede('visita.entregar') ? ir('control', 'Registrar entrega…') : null
  };
  return mapa[s.clave] || null;
}

function planificacion(v,app,usuarios) {
  if(!app.puede('visita.editar')||v.entregada_at||v.anulada_at)return '';
  return `<details class="mas"><summary>Cambiar responsable, retiro o prioridad</summary><div class="mas__cuerpo"><form class="form" id="f-cabecera" novalidate><div class="fila-campos">
      ${campo({ nombre: 'responsableId', etiqueta: 'Responsable', tipo: 'select', valor: v.responsable_id || '', opciones: [['', 'Sin asignar'], ...usuarios.filter((u) => u.activo).map((u) => [u.id, `${u.nombre} · ${u.rolTexto}`])] })}
      ${campo({ nombre: 'retiro', etiqueta: 'Retiro acordado', tipo: 'datetime-local', valor: v.retiro_acordado || '', ayuda: 'Vacío = a confirmar.' })}
      ${campo({ nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', valor: v.prioridad, opciones: [['normal', 'Normal'], ['alta', 'Alta']] })}</div>
      ${campo({ nombre: 'retiroNota', etiqueta: 'Nota sobre el retiro', valor: v.retiro_nota || '' })}
      <button class="btn btn-primario" type="submit">Guardar cambios</button></form></div></details>`;
}

export default async function visita({ params, app }) {
  let sec = SECCIONES.find((s) => s[0] === params.seccion)?.[0] || 'resumen';
  const pedidos = [get(`/api/visitas/${params.id}`), get('/api/catalogos'), app.puede('stock.ver') ? get('/api/articulos') : Promise.resolve({ articulos: [] }), app.puede('stock.ver') ? get('/api/proveedores') : Promise.resolve({ proveedores: [] }), app.puede('avisos.preparar') ? get(`/api/avisos?visitaId=${params.id}`) : Promise.resolve({ avisos: [] }), get('/api/usuarios')];
  const [{ visita: v }, cat, { articulos }, { proveedores }, { avisos }, { usuarios }] = await Promise.all(pedidos);
  cat.proveedores = proveedores;
  const dinero = app.puede('ver.dinero');
  if(dinero&&app.puede('calculadora.usar')){const calculo=await get('/api/calculadora?horas=1');cat.valorHora=calculo.valorHora;}
  cat.articulos=articulos;
  const paso = proximoPaso(v, app);
  const ingreso = v.lecturas[0];
  let parte = null;
  if(sec==='resumen')parte=resumenOrden(v,app);
  else if (sec === 'revision') parte = seccionRevision(v, app);
  else if (sec === 'presupuesto') parte = seccionPresupuesto(v, app, cat);
  else if (sec === 'trabajo'||sec==='repuestos') parte = seccionTrabajo(v, app, cat, articulos.filter((a) => a.activo),{soloRepuestos:sec==='repuestos'});
  else if (sec === 'control') parte = seccionControl(v, app);
  else if (sec === 'cobros' && dinero) parte = seccionCobros(v, app);
  else if (sec === 'archivos') parte = seccionArchivos(v, app, avisos);
  else if(sec==='historial')parte={html:`${vistaEstadoIngreso(v)}<section class="bloque"><h2>Historial y notas del equipo</h2>${app.puede('adjuntos.subir')&&!v.entregada_at&&!v.anulada_at&&(app.sesion.usuario.rol!=='mecanico'||!v.responsable_id||v.responsable_id===app.sesion.usuario.id)?`<form class="form" id="f-nota" novalidate>${campo({nombre:'texto',etiqueta:'Nota interna',tipo:'textarea',requerido:true,attrs:'maxlength="1000"',ayuda:'Solo para el equipo del taller. No agrega trabajos, cargos ni autorizaciones.'})}<button class="btn btn-primario" type="submit">Guardar nota</button></form>`:''}</section>`,enlazar(raiz){const f=raiz.querySelector('#f-nota');if(f)alEnviar(f,async d=>{await post(`/api/visitas/${v.id}/notas`,d,{idempotencia:claveDeEnvio(f)});delete f.dataset.sucio;toast('Nota guardada en el historial.');app.recargar();});}};

  if(['control','archivos'].includes(sec)&&parte)parte.html=vistaEstadoIngreso(v)+parte.html;
  const principales=[['resumen','Resumen'],['revision','Revisión'],['trabajo','Trabajos'],['repuestos','Repuestos'],['historial','Historial']];
  const editar=planificacion(v,app,usuarios);
  const actividad=`<details class="mas"><summary>Actividad de la orden (${v.actividad.length})</summary><div class="mas__cuerpo"><ol class="actividad">${v.actividad.map(a=>`<li><div><time>${esc(cuando(a.fecha))} · ${esc(a.por||'')}</time><p>${esc(a.accion)}</p>${a.detalle?`<p class="small muted">${esc(a.detalle)}</p>`:''}</div></li>`).join('')}</ol></div></details>`;
  return {
    titulo: `${v.vehiculo.patente} · Orden ${v.numero}`,
    html: `<div class="pagina pagina--contexto orden">
      <div class="pagina__cuerpo">
        <div class="orden-cab">
          <a class="volver" href="#/trabajos">${icono('izq')}Taller</a><span class="muted small">Orden N.º ${esc(v.numero)} · ${v.tipo==='service'?'Service':'Revisión / reparación'}</span>
          <div class="orden-identidad">${patente(v.vehiculo.patente,true)}<h1 tabindex="-1">${nombreAuto(v.vehiculo)}</h1>${chipSituacion(v.situacion)}</div>
          <div class="orden-meta"><span>${esc(v.responsable||'Sin asignar')}</span><span>Retiro ${v.retiro_acordado?esc(cuando(v.retiro_acordado)):'a confirmar'}</span>${v.prioridad==='alta'?'<strong>Prioridad alta</strong>':''}</div>
        </div>
        ${v.anulada_at?aviso(`Orden anulada: ${esc(v.anulada_motivo)}. Solo consulta.`,'rojo','ban'):''}
        ${v.operacion?.bloqueos.length?`<details class="orden-bloqueos" ${v.operacion.bloqueos.length<=2?'open':''}><summary>${v.operacion.bloqueos.length} pendiente${v.operacion.bloqueos.length===1?'':'s'} para continuar esta orden</summary><ul>${v.operacion.bloqueos.map(b=>`<li>${esc(b.texto)} <a href="#/visitas/${v.id}/${b.seccion}">Ver ${b.seccion==='presupuesto'?'presupuesto':'trabajo'}</a></li>`).join('')}</ul></details>`:''}

        <nav class="pestanas orden-tabs" aria-label="Áreas de la orden">${principales.map(([k,t])=>`<a href="#/visitas/${v.id}/${k}" ${k===sec?'aria-current="page"':''}><strong>${t}</strong></a>`).join('')}</nav>
        ${dimensionesHTML(v)}
        <div class="orden-siguiente"><span>${esc(v.situacion.paso)}</span><div class="acciones">${dinero&&puedeOfrecerCobro(v)&&sec!=='cobros'?`<a class="btn btn-chico" href="#/visitas/${v.id}/cobros">${icono('dinero')}Cobrar</a>`:''}${paso&&paso.href&&!paso.href.endsWith('/'+sec)?`<a class="btn btn-chico btn-primario" href="${paso.href}">${esc(paso.texto)}</a>`:''}${paso?.accion?`<button class="btn btn-primario btn-chico" data-paso="${paso.accion}">${esc(paso.texto)}</button>`:''}</div></div>
        ${sec!=='resumen'?`<details class="mas orden-otras"><summary>Presupuesto, cierre y archivos</summary><nav class="orden-accesos" aria-label="Presupuesto, cierre y archivos"><a class="btn btn-chico" href="#/visitas/${v.id}/presupuesto" ${sec==='presupuesto'?'aria-current="page"':''}>Presupuesto y respuesta</a><a class="btn btn-chico" href="#/visitas/${v.id}/control" ${sec==='control'?'aria-current="page"':''}>Control y entrega</a>${dinero?`<a class="btn btn-chico" href="#/visitas/${v.id}/cobros" ${sec==='cobros'?'aria-current="page"':''}>Liquidación y cobros</a>`:''}<a class="btn btn-chico" href="#/visitas/${v.id}/archivos" ${sec==='archivos'?'aria-current="page"':''}>Archivos y mensajes</a></nav></details>`:''}
        <div data-seccion-cuerpo class="pagina__cuerpo">${parte?parte.html:''}${['archivos','historial'].includes(sec)?actividad:''}</div>
        <details class="mas orden-datos"><summary>Datos de ingreso y planificación</summary><div class="mas__cuerpo bloque"><p><strong>Motivo:</strong> ${esc(v.motivo)}</p><p class="small muted">Ingreso ${esc(fecha(v.ingreso_at))} · ${ingreso?esc(km(ingreso.km)):'Sin lectura'}</p>${v.autorizacion_ingreso?`<p>${esc(v.autorizacion_ingreso)}</p>`:''}${v.relacionada?`<a href="#/visitas/${v.relacionada.id}">Vuelve por la orden N.º ${esc(v.relacionada.numero)}. La garantía la decide el taller.</a>`:''}${v.relacionadas.map(x=>`<a href="#/visitas/${x.id}">Orden posterior vinculada N.º ${esc(x.numero)}</a>`).join('')}${v.turno?`<p>Turno ${esc(v.turno.codigo)}</p>`:''}${editar}</div></details>
        ${app.puede('visita.anular')&&!v.entregada_at&&!v.anulada_at?`<p><button class="btn btn-peligro btn-chico" data-anular>${icono('ban')}Anular orden</button></p>`:''}
      </div>
      <aside class="contexto" aria-label="Resumen de la orden"><details class="contexto-toggle" open><summary>Resumen y contacto ${icono('abajo')}</summary><div class="contexto-contenido">
        <section class="bloque"><h2>Esta orden</h2><p>${esc(v.motivo)}</p>${editar?'<button class="btn btn-chico" data-planificar>'+icono('lapiz')+'Responsable y retiro</button>':''}</section>
        ${dinero&&v.totales?`<section class="bloque"><h2>Importes</h2><dl class="resumen-kv"><div><dt>Autorizado</dt><dd>${pesos(v.totales.autorizado)}</dd></div><div><dt>Liquidado</dt><dd>${v.totales.liquidado?pesos(v.totales.liquidado):'Sin liquidar'}</dd></div><div><dt>${v.totales.liquidado?'Cobrado':'Anticipos'}</dt><dd>${pesos(v.totales.cobrado)}</dd></div><div><dt>${v.totales.aFavor?'A favor':!v.totales.liquidado?'Saldo final':'Saldo pendiente'}</dt><dd>${!v.totales.liquidado?'Por fijar':pesos(v.totales.aFavor||v.totales.saldo)}</dd></div></dl><p class="small muted">Cobrar no registra la entrega.</p></section>`:''}
        <section class="bloque"><h2>Contacto</h2><strong>${esc(v.contacto_nombre||'Sin contacto')}</strong>${v.contacto_telefono?`<a href="tel:${esc(v.contacto_telefono.replace(/[^\d+]/g,''))}">${icono('telefono')}${esc(v.contacto_telefono)}</a>`:'<p class="muted small">Sin teléfono registrado.</p>'}${app.puede('avisos.preparar')?`<a class="btn btn-chico" href="#/visitas/${v.id}/archivos#t-msj">${icono('mensaje')}Preparar mensaje</a>`:''}<a href="#/autos/${v.vehiculo.id}">Ficha e historial del vehículo</a></section>
        ${sec!=='archivos'?actividad:''}
      </div></details></aside>
      ${!v.entregada_at&&!v.anulada_at?`<footer class="orden-registrar"><button type="button" class="btn btn-primario" data-registrar>${icono('mas')}Registrar…</button></footer>`:''}
    </div>`,
    despues(raiz) {
      parte?.enlazar(raiz.querySelector('[data-seccion-cuerpo]'));
      raiz.querySelector('[data-registrar]')?.addEventListener('click',async()=>{
        const {hayCambiosSinGuardar}=await import('../ui.js?v=0.1.0');
        if(hayCambiosSinGuardar()){toast('Terminá o cancelá el formulario abierto antes de registrar otra cosa.',{error:true});return;}
        const d=document.createElement('dialog');d.className='dialogo';d.setAttribute('aria-labelledby','registrar-titulo');
        const opciones=[...(app.puede('revision.registrar')?[['revision','Hallazgo de revisión']]:[]),...(app.puede('repuestos.gestionar')?[['repuestos','Repuesto que falta']]:[]),...(app.puede('adjuntos.subir')?[['historial','Nota interna'],['archivos','Foto o archivo']]:[])];
        d.innerHTML=`<div class="dialogo__cuerpo bloque"><h2 id="registrar-titulo">¿Qué querés registrar?</h2>${opciones.map(([sec,t])=>`<a class="btn" href="#/visitas/${v.id}/${sec}">${t}${icono('der')}</a>`).join('')}<button class="btn btn-texto" type="button">Volver</button></div>`;
        document.body.append(d);d.querySelectorAll('a').forEach(a=>a.onclick=()=>d.close());d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>{d.remove();raiz.querySelector('[data-registrar]')?.focus();},{once:true});d.showModal();
      });
      raiz.querySelector('[data-paso="lista"]')?.addEventListener('click', async () => {
        try { await post(`/api/visitas/${v.id}/lista`, {}); toast('Listo para retirar. Sigue en Hoy hasta la entrega.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      });
      raiz.querySelector('[data-planificar]')?.addEventListener('click',()=>{const d=raiz.querySelector('.orden-datos');d.open=true;const form=raiz.querySelector('#f-cabecera');form?.closest('details').setAttribute('open','');form?.querySelector('select').focus();});
      const fc = raiz.querySelector('#f-cabecera');
      if (fc) alEnviar(fc, async (d) => { await put(`/api/visitas/${v.id}`, { ...d, responsableId: d.responsableId || null, retiro: d.retiro || null, version: v.version }); toast('Datos de la visita guardados.'); app.recargar(); });
      raiz.querySelector('[data-anular]')?.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Anular la visita', texto: 'La visita queda registrada como anulada y solo se puede consultar. No se borra nada.', efecto: 'No se puede anular si tiene cobros o piezas colocadas.', aceptar: 'Anular la visita', peligro: true, pedir: { etiqueta: 'Motivo de la anulación' } });
        if (!r.ok) return;
        try { await post(`/api/visitas/${v.id}/anular`, { motivo: r.valor }); toast('Visita anulada.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      });
      if (location.hash.includes('#t-msj')) raiz.querySelector('#t-msj')?.scrollIntoView();
    }
  };
}
