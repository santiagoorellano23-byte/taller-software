import { api, post, put, claveDeEnvio } from './api.js?v=0.1.0';
import { campo, alEnviar, esc, chip, icono, fechaHora, toast } from './ui.js?v=0.1.0';
export const GRAVEDAD = {informativo:['Informativo','azul','info'],recomendado:['Recomendado','ambar','llave'],prioritario:['Prioritario','rojo','alerta']};

function formulario(v,h={}) {
  const fotos=v.adjuntos.filter(a=>a.mime.startsWith('image/'));
  return `<form class="form hallazgo-form" data-hallazgo-form="${h.id||''}" novalidate>
    ${campo({nombre:'observacion',etiqueta:'Observación',tipo:'textarea',valor:h.observacion||'',requerido:true,attrs:'maxlength="2000"'})}
    ${campo({nombre:'gravedad',etiqueta:'Criterio del técnico',tipo:'select',valor:h.gravedad||'informativo',requerido:true,opciones:Object.entries(GRAVEDAD).map(([k,v])=>[k,v[0]]),ayuda:'La gravedad no autoriza ni cobra trabajos.'})}
    ${campo({nombre:'propuesta',etiqueta:'Reparación o revisión propuesta',tipo:'textarea',valor:h.propuesta||'',attrs:'maxlength="2000"'})}
    ${campo({nombre:'adjuntoId',etiqueta:'Foto ya guardada en esta orden',tipo:'select',valor:h.adjunto_id||'',opciones:[['','Sin foto'],...fotos.map(a=>[a.id,a.descripcion||a.nombre_original])]})}
    ${campo({nombre:'foto',etiqueta:'O elegir una foto nueva',tipo:'file',attrs:'accept="image/jpeg,image/png,image/webp"',ayuda:'Se ajusta para facilitar la consulta y la impresión. Una foto nueva reemplaza la selección de arriba.'})}
    ${h.id?campo({nombre:'motivoEdicion',etiqueta:'Motivo de la actualización',requerido:true,attrs:'maxlength="500"'}):''}
    <p class="muted small">Guardar este hallazgo no agrega líneas al presupuesto ni registra una autorización.</p>
    <button class="btn btn-primario" type="submit">${icono('check')}${h.id?'Guardar nueva versión del hallazgo':'Guardar hallazgo'}</button></form>`;
}
export function vistaHallazgos(v,app,editable) {
  const datos=v.hallazgos||[];
  const foto=h=>h.adjunto_id&&!h.foto_archivada?`<a href="/api/adjuntos/${h.adjunto_id}" target="_blank" rel="noopener"><img class="hallazgo-foto" src="/api/adjuntos/${h.adjunto_id}" alt="Foto del hallazgo: ${esc(h.observacion.slice(0,100))}" loading="lazy" width="280" height="210"></a>`:h.adjunto_id?'<p class="muted small">La foto está archivada; se conserva su referencia.</p>':'';
  return `<section class="hallazgos" aria-labelledby="t-hallazgos"><div class="bloque__cab"><h2 id="t-hallazgos">Hallazgos de inspección</h2><p>Observación, criterio del técnico y propuesta. No son trabajos autorizados.</p></div>
    ${datos.length?datos.map(h=>`<article class="hallazgo"><header>${chip(...GRAVEDAD[h.gravedad])}<span class="muted small">Versión ${h.version_num} · ${esc(h.por||'')} · ${esc(fechaHora(h.creado_at))}</span></header><p><strong>Observación:</strong> ${esc(h.observacion)}</p>${h.propuesta?`<p><strong>Propuesta:</strong> ${esc(h.propuesta)}</p>`:''}${foto(h)}
    ${h.anteriores.length?`<details class="mas hallazgo-historial"><summary>Versiones anteriores (${h.anteriores.length})</summary><div class="mas__cuerpo">${h.anteriores.map(a=>`<div><p><strong>Versión ${a.version_num}</strong> · ${esc(a.por||'')} · ${esc(fechaHora(a.creado_at))}</p>${chip(...GRAVEDAD[a.gravedad])}<p>${esc(a.observacion)}</p>${a.propuesta?`<p>Propuesta: ${esc(a.propuesta)}</p>`:''}${foto(a)}</div>`).join('')}<p class="muted small">Última actualización: ${esc(h.motivo_edicion||'')}</p></div></details>`:''}
    ${editable?`<details class="mas"><summary>Editar hallazgo (conserva la versión anterior)</summary><div class="mas__cuerpo">${formulario(v,h)}</div></details>`:''}</article>`).join(''):'<p class="muted">Todavía no se registraron hallazgos. La revisión general sigue disponible abajo.</p>'}
    ${editable?`<details class="mas"><summary>${icono('mas')}Agregar hallazgo</summary><div class="mas__cuerpo">${formulario(v)}</div></details>`:''}
    ${app.puede('documentos.emitir')&&datos.length?`<p><a class="btn" href="#/visitas/${v.id}/archivos">${icono('documento')}Preparar informe para el cliente</a></p>`:''}</section>`;
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
export function enlazarHallazgos(raiz,v,app) {
  raiz.querySelectorAll('[data-hallazgo-form]').forEach(f=>{
    const anterior=(v.hallazgos||[]).find(h=>h.id===Number(f.dataset.hallazgoForm));
    let fotoLista=null;
    f.querySelector('[name="foto"]').addEventListener('change',()=>{fotoLista=null;delete f.dataset.fotoCargada;delete f.dataset.claveFoto;});
    alEnviar(f,async d=>{
      if(!d.observacion.trim())throw Object.assign(new Error('Describí lo observado.'),{campo:'observacion'});
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
      await (anterior?put:post)(ruta,body,{idempotencia:claveDeEnvio(f)});
      delete f.dataset.sucio;
      toast('Hallazgo guardado. El presupuesto y la autorización no cambiaron.');
      app.ir(`#/visitas/${v.id}/revision`);
    });
  });
}
