import { api, post, put, claveDeEnvio } from './api.js?v=0.1.0';
import { campo, alEnviar, esc, chip, icono, fechaHora, toast, confirmar } from './ui.js?v=0.1.0';
export const GRAVEDAD = {informativo:['Informativo','azul','info'],recomendado:['Recomendado','ambar','llave'],prioritario:['Prioritario','rojo','alerta']};

// Hallazgos de inspección (diseño de Revisión): tarjetas con observación, criterio del técnico (la gravedad) y propuesta,
// y una hoja inferior para cargar o editar cada uno. Cada hallazgo se guarda por separado y en versiones; no hay borrado.
function formulario(v,h={}) {
  const fotos=v.adjuntos.filter(a=>a.mime.startsWith('image/'));
  return `<form class="form hallazgo-form rv-hform" data-hallazgo-form="${h.id||''}" novalidate>
    <div class="hoja-c">
      <p class="rv-strip" data-rev-pendiente hidden>${icono('info')}<span>Este panel guarda solo el hallazgo. La revisión técnica tiene cambios sin guardar y no cambia.</span></p>
      ${campo({nombre:'observacion',etiqueta:'Qué observaste',tipo:'textarea',valor:h.observacion||'',requerido:true,attrs:'maxlength="2000" rows="3"',ayuda:'El hecho concreto: qué viste, dónde, cuánto midió.',placeholder:'Ej.: Bornes de la batería sulfatados'})}
      ${campo({nombre:'gravedad',etiqueta:'Criterio del técnico',tipo:'select',valor:h.gravedad||'informativo',requerido:true,opciones:Object.entries(GRAVEDAD).map(([k,v])=>[k,v[0]]),ayuda:'Qué tan importante te parece. La gravedad no autoriza ni cobra trabajos.'})}
      ${campo({nombre:'propuesta',etiqueta:'Qué proponés',tipo:'textarea',valor:h.propuesta||'',attrs:'maxlength="2000" rows="2"',ayuda:'La reparación o revisión que recomendarías. No queda autorizada.',placeholder:'Ej.: Limpiar bornes y ajustar terminales'})}
      ${campo({nombre:'adjuntoId',etiqueta:'Foto ya guardada en esta orden',tipo:'select',valor:h.adjunto_id||'',opciones:[['','Sin foto'],...fotos.map(a=>[a.id,a.descripcion||a.nombre_original])]})}
      ${campo({nombre:'foto',etiqueta:'O elegir una foto nueva',tipo:'file',attrs:'accept="image/jpeg,image/png,image/webp"',ayuda:'Se ajusta para facilitar la consulta y la impresión. Una foto nueva reemplaza la selección de arriba.'})}
      ${h.id?campo({nombre:'motivoEdicion',etiqueta:'Motivo de la actualización',requerido:true,attrs:'maxlength="500"',ayuda:'La versión anterior se conserva en el historial del hallazgo.'}):''}
      <p class="rv-nota">${icono('escudo','i-sm')}Guardar este hallazgo no agrega líneas al presupuesto ni registra una autorización.</p>
    </div>
    <footer class="rv-hpie"><button type="button" class="btn" data-cerrar-hallazgo>Cancelar</button><button class="btn btn-primario" type="submit">${icono('check')}${h.id?'Guardar nueva versión':'Guardar hallazgo'}</button></footer></form>`;
}
const hoja=(v,h,n)=>`<dialog class="hoja-dlg rv-hoja" data-hoja-hallazgo="${h?.id||'nuevo'}" aria-labelledby="rv-hh-${h?.id||'nuevo'}">
  <header><div><h2 id="rv-hh-${h?.id||'nuevo'}" tabindex="-1">${h?`Editar hallazgo ${n}`:'Nuevo hallazgo'}</h2><p class="rv-nota">Orden N.º ${esc(v.numero)} · queda como propuesta del técnico, sin autorizar.</p></div>
    <button type="button" class="ibtn" data-cerrar-hallazgo aria-label="Cerrar">${icono('x')}</button></header>
  ${formulario(v,h||{})}</dialog>`;

export function vistaHallazgos(v,app,editable) {
  const datos=v.hallazgos||[];
  const foto=h=>h.adjunto_id&&!h.foto_archivada?`<a class="rv-hfoto" href="/api/adjuntos/${h.adjunto_id}" target="_blank" rel="noopener"><img class="hallazgo-foto" src="/api/adjuntos/${h.adjunto_id}" alt="Foto del hallazgo: ${esc(h.observacion.slice(0,100))}" loading="lazy" width="280" height="210"></a>`:h.adjunto_id?'<p class="rv-nota">La foto está archivada; se conserva su referencia.</p>':'';
  const tarjeta=(h,i)=>{
    const largo=(h.observacion+(h.propuesta||'')).length>170;
    return `<li class="rv-hc" id="rv-h-${h.id}">
      <div class="rv-hc-top"><span class="rv-hn" aria-hidden="true">${i+1}</span><div class="rv-hc-obs"><span class="rv-lbl">${icono('buscar')}Observación<span class="sr"> del hallazgo ${i+1}</span></span><p class="rv-clamp3">${esc(h.observacion)}</p></div></div>
      <div class="rv-hc-rows">
        <div class="rv-hc-row"><span class="rv-lbl">${icono('alerta')}Criterio del técnico</span>${chip(...GRAVEDAD[h.gravedad])}</div>
        ${h.propuesta?`<div class="rv-hc-row"><span class="rv-lbl">${icono('der')}Propuesta del técnico</span><p class="rv-clamp2">${esc(h.propuesta)}</p></div>`:`<p class="rv-miss">${icono('info','i-sm')}<span>No se registró propuesta</span></p>`}
        ${foto(h)}
        <span class="rv-chip rv-chip-l">${icono('escudo')}No es un trabajo autorizado</span>
        <p class="rv-nota">Versión ${h.version_num} · ${esc(h.por||'')} · ${esc(fechaHora(h.creado_at))}</p>
        ${h.anteriores.length?`<details class="mas hallazgo-historial"><summary>Versiones anteriores (${h.anteriores.length})</summary><div class="mas__cuerpo">${h.anteriores.map(a=>`<div><p><strong>Versión ${a.version_num}</strong> · ${esc(a.por||'')} · ${esc(fechaHora(a.creado_at))}</p>${chip(...GRAVEDAD[a.gravedad])}<p>${esc(a.observacion)}</p>${a.propuesta?`<p>Propuesta: ${esc(a.propuesta)}</p>`:''}${foto(a)}</div>`).join('')}<p class="rv-nota">Última actualización: ${esc(h.motivo_edicion||'')}</p></div></details>`:''}
      </div>
      ${largo||editable?`<div class="rv-hc-pie">${largo?`<button type="button" class="rv-tb" data-ver-todo aria-expanded="false">Ver todo</button>`:''}
        ${editable?`<button type="button" class="rv-tb acc" data-editar-hallazgo="${h.id}" aria-label="Editar hallazgo ${i+1}" aria-haspopup="dialog">${icono('lapiz')}Editar</button>`:''}</div>`:''}
    </li>`;
  };
  return `<section class="rv-sec" id="rv-hall" aria-labelledby="t-hallazgos">
    <div class="rv-sec-h"><span class="rv-sec-ic">${icono('buscar')}</span><div><h2 class="rv-h2" id="t-hallazgos">Hallazgos de inspección ${datos.length?`<span class="rv-cnt">${datos.length}<span class="sr"> registrados</span></span>`:''}</h2><p class="rv-sub">Observación, criterio y propuesta del técnico. Cada uno se guarda por separado.</p></div></div>
    <p class="rv-strip">${icono('escudo')}<span>Un hallazgo no es un trabajo autorizado. La autorización del cliente se registra en Presupuesto.</span></p>
    ${datos.length?`<ol class="rv-hl">${datos.map(tarjeta).join('')}</ol>${editable?`<button type="button" class="rv-addh" data-nuevo-hallazgo aria-haspopup="dialog">${icono('mas')}Agregar otro hallazgo</button>`:''}`
      :`<div class="rv-vacio"><b>Todavía no hay hallazgos</b><p>Registrá por separado cada cosa que encuentres. Si no hay ninguno, la revisión técnica sigue disponible más abajo.</p>
        <p class="rv-anat" aria-label="Partes de un hallazgo"><span>${icono('buscar')}Observación</span><span>${icono('alerta')}Criterio</span><span>${icono('der')}Propuesta</span></p>
        ${editable?`<button type="button" class="btn btn-primario" data-nuevo-hallazgo aria-haspopup="dialog">${icono('mas')}Agregar el primer hallazgo</button>`:''}</div>`}
    ${app.puede('documentos.emitir')&&datos.length?`<p><a class="btn" href="#/visitas/${v.id}/archivos">${icono('documento')}Preparar informe para el cliente</a></p>`:''}
    ${editable?hoja(v,null)+datos.map((h,i)=>hoja(v,h,i+1)).join(''):''}</section>`;
}

async function fotoParaInforme(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw Object.assign(new Error('Elegí una foto JPG, PNG o WEBP de hasta 15 MB.'),{campo:'foto'});
  let imagen;
  try {imagen=await createImageBitmap(file);} catch {throw Object.assign(new Error('No se pudo leer la foto. Probá exportarla como JPG.'),{campo:'foto'});}
  try {
    if(imagen.width*imagen.height>50_000_000)throw new Error('La foto es demasiado grande. Elegí una versión más pequeña.');
    const canvas=document.createElement('canvas');
    const escala=Math.min(1,1400/Math.max(imagen.width,imagen.height));
    canvas.width=Math.max(1,Math.round(imagen.width*escala));canvas.height=Math.max(1,Math.round(imagen.height*escala));
    const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(imagen,0,0,canvas.width,canvas.height);
    let calidad=.85,blob;
    do {blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',calidad));calidad-=.15;} while(blob?.size>400_000&&calidad>=.25);
    if(!blob||blob.size>400_000)throw new Error('La foto sigue siendo demasiado grande. Elegí una versión más pequeña.');
    return blob;
  } catch(e) {throw Object.assign(e,{campo:'foto'});} finally {imagen.close();}
}
// revisionPendiente(): true si la revisión técnica tiene cambios sin guardar; antesDeRecargar() la conserva en pantalla.
export function enlazarHallazgos(raiz,v,app,{revisionPendiente=()=>false,antesDeRecargar=()=>{}}={}) {
  raiz.querySelectorAll('[data-ver-todo]').forEach(b=>b.addEventListener('click',()=>{
    const abierta=b.closest('.rv-hc').classList.toggle('abierta');
    b.setAttribute('aria-expanded',String(abierta));b.textContent=abierta?'Ver menos':'Ver todo';
  }));
  raiz.querySelectorAll('[data-hoja-hallazgo]').forEach(d=>{
    const f=d.querySelector('form');
    // Cerrar con cambios pide confirmación: lo escrito no queda guardado en ningún lado si se descarta.
    const cerrar=async()=>{
      if(f.dataset.enviando)return;
      if(f.dataset.sucio){
        const r=await confirmar({titulo:'¿Descartar el hallazgo sin guardar?',texto:'Lo que escribiste en este hallazgo todavía no se guardó.',efecto:'Los hallazgos ya guardados y la revisión técnica no cambian.',aceptar:'Descartar lo escrito',peligro:true});
        if(!r.ok)return;
        f.reset();delete f.dataset.sucio;delete f.dataset.clave;delete f.dataset.fotoCargada;delete f.dataset.claveFoto;
        f.querySelectorAll('.campo__error,.resumen-errores').forEach(x=>x.remove());
      }
      d.close();
    };
    d.querySelectorAll('[data-cerrar-hallazgo]').forEach(b=>b.addEventListener('click',cerrar));
    d.addEventListener('cancel',e=>{e.preventDefault();cerrar();});
  });
  const abrir=(id,origen)=>{
    const d=raiz.querySelector(`[data-hoja-hallazgo="${id}"]`);
    if(!d)return;
    d.querySelector('[data-rev-pendiente]').hidden=!revisionPendiente();
    d.showModal();d.querySelector('h2').focus();
    d.addEventListener('close',()=>{if(origen?.isConnected)origen.focus();},{once:true});
  };
  raiz.querySelectorAll('[data-nuevo-hallazgo]').forEach(b=>b.addEventListener('click',()=>abrir('nuevo',b)));
  raiz.querySelectorAll('[data-editar-hallazgo]').forEach(b=>b.addEventListener('click',()=>abrir(b.dataset.editarHallazgo,b)));
  raiz.querySelectorAll('[data-hallazgo-form]').forEach(f=>{
    const anterior=(v.hallazgos||[]).find(h=>h.id===Number(f.dataset.hallazgoForm));
    let fotoLista=null;
    f.querySelector('[name="foto"]').addEventListener('change',()=>{fotoLista=null;delete f.dataset.fotoCargada;delete f.dataset.claveFoto;});
    alEnviar(f,async d=>{
      if(!d.observacion.trim())throw Object.assign(new Error('Escribí qué observaste para poder guardarlo.'),{campo:'observacion'});
      if(anterior&&!d.motivoEdicion.trim())throw Object.assign(new Error('Explicá por qué actualizás el hallazgo.'),{campo:'motivoEdicion'});
      const file=f.querySelector('[name="foto"]').files[0];
      let adjuntoId=Number(d.adjuntoId)||null;
      if(file){
        fotoLista ||= await fotoParaInforme(file);
        if(!f.dataset.fotoCargada){
          const r=await api('POST',`/api/adjuntos?ambito=visita&visitaId=${v.id}&descripcion=${encodeURIComponent('Foto de hallazgo: '+d.observacion.slice(0,200))}`,undefined,{archivo:fotoLista,idempotencia:f.dataset.claveFoto ||= crypto.randomUUID(),cabeceras:{'X-Nombre-Archivo':encodeURIComponent('hallazgo-'+file.name.replace(/\.[^.]+$/,'')+'.jpg')}});
          f.dataset.fotoCargada=String(r.id);
        }
        adjuntoId=Number(f.dataset.fotoCargada);
      }
      const body={observacion:d.observacion,gravedad:d.gravedad,propuesta:d.propuesta,adjuntoId,motivoEdicion:d.motivoEdicion,versionActual:anterior?.version_num};
      const ruta=`/api/visitas/${v.id}/hallazgos${anterior?'/'+anterior.id:''}`;
      const r=await (anterior?put:post)(ruta,body,{idempotencia:claveDeEnvio(f)});
      delete f.dataset.sucio;
      const pendiente=revisionPendiente();
      antesDeRecargar();
      f.closest('dialog')?.close();
      toast(`${r.repetido?'El hallazgo ya estaba guardado; no se registró dos veces.':anterior?'Hallazgo actualizado; la versión anterior se conserva.':'Hallazgo guardado.'} El presupuesto y la autorización no cambiaron.${pendiente?' La revisión técnica sigue sin guardar.':''}`);
      app.recargar();
    });
  });
}
