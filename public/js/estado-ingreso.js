import {api,get} from './api.js?v=0.1.0';
import {esc,fechaHora} from './ui.js?v=0.1.0';
import {ic} from './diseno.js?v=0.1.0';

export const NOMBRES_FOTO={tablero:'Tablero',exterior:'Exterior',detalle:'Detalle de daño previo'};
const falla=mensaje=>Object.assign(new Error(mensaje),{campo:'fotosIngreso'});

// Paso 2 · «Panel rápido»: tres controles de foto (tablero, exterior, daños) con cámara y galería, miniaturas por
// categoría y una tarjeta por daño con su texto y su foto. Los originales van al almacenamiento privado; el borrador
// guarda solo referencias. Una carga se identifica por su token: una respuesta tardía de una carga reemplazada,
// quitada o de otro auto (reiniciar) se descarta, y un reemplazo conserva la foto anterior hasta llegar.
export function enlazarFotosIngreso(box,{clave,inicial=[],guardar,danos=null,carroceria=()=>'',alDano=()=>{}}) {
  let fotos=inicial.map(f=>({id:f.id||null,tipo:f.tipo,descripcion:f.descripcion||'',token:f.token||crypto.randomUUID(),intentada:!!f.intentada||!!f.id}));
  const archivos=new Map(),ocupadas=new Set(),avisos={};
  let recuperando=!!fotos.length,enfocarDano='';
  const datos=()=>fotos.map(({id,previo,tipo,descripcion,token,intentada})=>({id:id||previo||null,tipo,descripcion,token,...(intentada?{intentada:true}:{})}));
  const cambio=()=>{if(box.isConnected)guardar();};
  const propuesta=tipo=>tipo==='tablero'?'Tablero al ingresar':tipo==='exterior'?'Vista exterior al ingresar':'';
  const valido=file=>['image/jpeg','image/png','image/webp'].includes(file?.type)&&file.size>0&&file.size<=15*1024*1024;
  const FORMATO='Elegí una foto JPG, PNG o WEBP de hasta 15 MB.';
  const deTipo=tipo=>fotos.filter(f=>f.tipo===tipo);
  const vacio=f=>!f.id&&!f.previo&&!f.intentada&&!f.error&&!archivos.has(f.token)&&!ocupadas.has(f.token);
  const visibles=tipo=>deTipo(tipo).filter(f=>!vacio(f)||f.tipo==='detalle');
  const lugares=()=>['tablero','exterior'].map(tipo=>({id:null,tipo,descripcion:propuesta(tipo),token:crypto.randomUUID()}));
  const lista=f=>!!f.id&&!ocupadas.has(f.token)&&!f.error;
  const estadoDe=f=>ocupadas.has(f.token)?'up':f.error?'err':f.id?'ok':recuperando&&f.intentada?'up':'falta';
  const nombreFoto=(f,i)=>f.tipo==='tablero'?'Foto del tablero':f.tipo==='exterior'?`Foto del exterior ${i+1}`:`Foto del daño ${i+1}`;
  const ICONO={tablero:'speed',exterior:'directions_car',detalle:'car_crash'};
  const NOMBRE={tablero:'Tablero',exterior:'Exterior',detalle:'Daños'};

  // Estado de cada control: obligatoria, opcional, subiendo, con fotos o con una carga fallida.
  function estadoTile(tipo){
    const L=deTipo(tipo),err=L.filter(f=>f.error).length,up=L.filter(f=>estadoDe(f)==='up').length,ok=L.filter(lista).length;
    if(avisos[tipo])return ['err',avisos[tipo]];
    if(err)return ['err',`${err} falló`];
    if(up)return ['up','Subiendo…'];
    if(ok)return ['ok',`${ok} foto${ok===1?'':'s'}`];
    return tipo==='detalle'?['opt',carroceria()==='con_danos'?'Obligatoria':'Si hay daños']:['req','Obligatoria'];
  }
  const subGrupo=tipo=>{const L=deTipo(tipo),ok=L.filter(lista).length,err=L.filter(f=>f.error).length;
    if(tipo==='tablero')return [ok?`${ok} foto${ok===1?'':'s'}`:'0 de 1',err?'err':ok?'ok':''];
    if(tipo==='exterior')return [err?`${ok} de ${L.length} subidas`:`${ok} de 4 vistas`,err?'err':ok?'ok':''];
    return [ok?`${ok} foto${ok===1?'':'s'}`:'Si hay',err?'err':ok?'ok':''];};
  const archivo=(attrs,etiqueta,camara)=>`<input type="file" class="sr" accept="image/jpeg,image/png,image/webp" ${camara?'capture="environment"':''} ${attrs} aria-label="${esc(etiqueta)}" ${recuperando?'disabled':''}>`;
  const miniatura=(f,i,tipo)=>{const st=estadoDe(f),ver=f.id||f.previo;return `<button type="button" class="p2-th ${st}" data-ver="${f.token}" aria-label="${esc(nombreFoto(f,i))}${st==='err'?'. No se pudo subir':st==='up'?'. Subiendo':''}. Tocá para ampliar, reemplazar o quitar">${ver?`<img src="/api/adjuntos/${ver}" alt="" width="52" height="52">`:`<span class="p2-th-ph">${ic(ICONO[tipo])}</span>`}${tipo==='detalle'?`<span class="p2-badge" aria-hidden="true">${i+1}</span>`:''}${st==='up'?'<span class="p2-th-capa" aria-hidden="true"><span class="p2-giro"></span></span>':''}${st==='err'?`<span class="p2-th-capa err" aria-hidden="true">${ic('warning')}</span>`:''}</button>`;};

  const dibujar=()=>{
    if(!box.isConnected)return;
    const lleno=fotos.length>=12;
    box.innerHTML=`<div class="p2-h"><h3>Fotos</h3><span>Tablero y exterior: obligatorias</span></div>
      <div class="p2-tiles">${['tablero','exterior','detalle'].map(tipo=>{const [st,txt]=estadoTile(tipo);return `<div class="p2-tile ${st==='err'?'err':''}" data-tile="${tipo}">
        <label class="p2-tile-b">${ic(ICONO[tipo],'p2-tile-ic')}<b>${NOMBRE[tipo]}</b><span class="p2-st ${st}">${st==='up'?'<span class="p2-giro chico" aria-hidden="true"></span>':st==='ok'?ic('check'):st==='err'?ic('warning'):st==='req'?'<span class="p2-aro" aria-hidden="true"></span>':''}${esc(txt)}</span>${archivo(`data-nueva="${tipo}" ${lleno?'disabled':''}`,`Tomar foto: ${NOMBRE[tipo]}. ${txt}`,true)}</label>
        <label class="p2-gal">${ic('photo_library')}Galería${archivo(`data-nueva="${tipo}" ${lleno?'disabled':''}`,`Elegir foto de ${NOMBRE[tipo].toLowerCase()} desde la galería`,false)}</label></div>`;}).join('')}</div>
      <div class="p2-grupos">${['tablero','exterior','detalle'].map(tipo=>{const L=visibles(tipo).filter(f=>tipo!=='detalle'||!vacio(f)),[sub,color]=subGrupo(tipo),fallida=L.find(f=>f.error);return `<div class="p2-g">
        <div class="p2-g-t"><b>${NOMBRE[tipo]}</b><small class="${color}">${esc(sub)}</small></div>
        <div class="p2-g-f">${L.map((f,i)=>miniatura(f,i,tipo)).join('')}${!L.length?`<span class="p2-vacio">${tipo==='tablero'?'Sin fotos':tipo==='exterior'?'Frente, atrás y laterales':'Solo si declarás daños'}</span>`:''}
          <label class="p2-mas" ${lleno?'aria-disabled="true"':''}>${ic('add')}${archivo(`data-nueva="${tipo}" ${lleno?'disabled':''}`,`Agregar otra foto: ${NOMBRE[tipo]}`,true)}</label></div>
        ${fallida?`<div class="p2-alerta" role="alert">${ic('warning')}<span>${esc(fallida.error)}${fallida.id&&archivos.has(fallida.token)?' Se conserva la foto anterior.':''}</span>${archivos.has(fallida.token)?`<button type="button" class="btn btn-chico" data-reintentar="${fallida.token}">${ic('refresh')}Reintentar</button>`:''}</div>`:''}</div>`;}).join('')}</div>
      ${lleno?'<p class="nota">Llegaste al máximo de 12 fotos para este ingreso.</p>':''}<p class="sr" role="status" data-foto-estado aria-live="polite">${esc(resumenTexto())}</p>`;
    box.querySelectorAll('[data-nueva]').forEach(inp=>inp.onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)nueva(inp.dataset.nueva,file);});
    box.querySelectorAll('[data-ver]').forEach(b=>b.onclick=()=>ampliar(fotos.find(f=>f.token===b.dataset.ver),b));
    box.querySelectorAll('[data-reintentar]').forEach(b=>b.onclick=()=>{const f=fotos.find(x=>x.token===b.dataset.reintentar);if(f)subir(f);});
    dibujarDanos();
  };
  // Una tarjeta por daño: su ubicación y descripción (obligatoria) y su foto.
  function dibujarDanos(){
    if(!danos?.isConnected)return;
    if(carroceria()!=='con_danos'){danos.innerHTML='';return;}
    const L=deTipo('detalle');
    // Redibujar no quita el foco ni mueve el cursor de quien está escribiendo la descripción de un daño.
    const act=document.activeElement,tok=enfocarDano||act?.dataset?.descripcion,sel=act?.dataset?.descripcion?[act.selectionStart,act.selectionEnd]:null;enfocarDano='';
    danos.innerHTML=`${L.map((f,i)=>{const st=estadoDe(f),ver=f.id||f.previo;return `<div class="p2-dano" data-dano="${f.token}">
      <div class="p2-dano-h"><label class="p2-dano-l" for="dano-${f.token}">Daño ${i+1} · ubicación y descripción</label><button type="button" class="ibtn" data-quitar-dano="${f.token}" aria-label="Quitar daño ${i+1}" title="Quitar daño">${ic('delete')}</button></div>
      <input class="p2-inp" id="dano-${f.token}" data-descripcion="${f.token}" maxlength="300" value="${esc(f.descripcion)}" placeholder="Ej.: rayón en puerta delantera derecha" autocomplete="off">
      <div class="p2-dano-f">${ver?`<button type="button" class="p2-th ${st} chico" data-ver="${f.token}" aria-label="Foto del daño ${i+1}. Tocá para ampliar, reemplazar o quitar"><img src="/api/adjuntos/${ver}" alt="" width="44" height="44">${st==='up'?'<span class="p2-th-capa" aria-hidden="true"><span class="p2-giro"></span></span>':''}</button>`:''}
        <span class="p2-st ${st==='ok'?'ok':st==='err'?'err':st==='up'?'up':'req'}">${st==='ok'?ic('check')+'1 foto':st==='up'?'<span class="p2-giro chico" aria-hidden="true"></span>Subiendo…':st==='err'?ic('warning')+'No se subió':'Falta la foto'}</span>
        <label class="btn btn-chico p2-dano-b">${ic('photo_camera')}${ver?'Reemplazar':'Agregar foto'}${archivo(`data-foto-dano="${f.token}"`,`${ver?'Reemplazar':'Agregar'} foto del daño ${i+1}`,true)}</label></div></div>`;}).join('')}
      <button type="button" class="btn btn-texto p2-otro" data-otro-dano ${fotos.length>=12?'disabled':''}>${ic('add')}${L.length?'Agregar otro daño':'Agregar un daño'}</button>`;
    if(tok){const el=danos.querySelector(`[data-descripcion="${tok}"]`);if(el){el.focus({preventScroll:!!sel});if(sel)el.setSelectionRange(...sel);}}
    danos.querySelectorAll('[data-descripcion]').forEach(inp=>inp.oninput=()=>{const f=fotos.find(x=>x.token===inp.dataset.descripcion);if(f){f.descripcion=inp.value;cambio();}});
    danos.querySelectorAll('[data-foto-dano]').forEach(inp=>inp.onchange=e=>{const file=e.target.files[0];e.target.value='';const f=fotos.find(x=>x.token===inp.dataset.fotoDano);if(f&&file)reemplazar(f,file);});
    danos.querySelectorAll('[data-quitar-dano]').forEach(b=>b.onclick=()=>quitar(fotos.find(x=>x.token===b.dataset.quitarDano)));
    danos.querySelectorAll('[data-ver]').forEach(b=>b.onclick=()=>ampliar(fotos.find(f=>f.token===b.dataset.ver),b));
    danos.querySelector('[data-otro-dano]')?.addEventListener('click',()=>{if(fotos.length>=12)return;const f={id:null,tipo:'detalle',descripcion:'',token:crypto.randomUUID()};fotos.push(f);enfocarDano=f.token;cambio();dibujar();});
  }
  function resumenTexto(){const t=deTipo('tablero').filter(lista).length,x=deTipo('exterior').filter(lista).length,up=ocupadas.size,faltan=['tablero','exterior'].filter(tipo=>!deTipo(tipo).some(f=>f.id||ocupadas.has(f.token)));return `${t} del tablero, ${x} del exterior${up?`, ${up} subiendo`:''}.${faltan.length?` Falta cargar esta foto: ${faltan.join(' y ')}.`:''}`;}
  function nueva(tipo,file){
    delete avisos[tipo];
    if(fotos.length>=12){avisos[tipo]='Máximo 12 fotos';dibujar();return;}
    if(!valido(file)){avisos[tipo]='Formato no válido';dibujar();box.querySelector('[data-foto-estado]')&&(box.querySelector('[data-foto-estado]').textContent=FORMATO);return;}
    if(tipo==='detalle'&&carroceria()!=='con_danos')alDano(); // fotografiar un daño es declararlo; queda visible y se puede cambiar
    let f=fotos.find(x=>x.tipo===tipo&&vacio(x));
    if(f){f.intentada=true;f.error='';}else{f={id:null,tipo,descripcion:propuesta(tipo),token:crypto.randomUUID(),intentada:true,error:''};fotos.push(f);}
    archivos.set(f.token,file);cambio();subir(f);
    if(tipo==='detalle'&&!f.descripcion){enfocarDano=f.token;dibujarDanos();}
  }
  function reemplazar(f,file){
    if(!valido(file)){f.error=FORMATO;dibujar();return;}
    archivos.delete(f.token);if(f.id)f.previo=f.id;f.token=crypto.randomUUID();f.id=null;f.intentada=true;f.error='';archivos.set(f.token,file);cambio();subir(f);
  }
  function quitar(f){if(!f)return;fotos=fotos.filter(x=>x!==f);archivos.delete(f.token);cambio();dibujar();}
  // Ampliar una foto: verla, corregir qué muestra, reemplazarla o quitarla. El foco vuelve a la miniatura.
  function ampliar(f,origen){
    if(!f)return;const i=deTipo(f.tipo).indexOf(f),ver=f.id||f.previo;
    const d=document.createElement('dialog');d.className='hoja-dlg p2-dlg';d.setAttribute('aria-labelledby','p2-dlg-t');
    d.innerHTML=`<header><h2 id="p2-dlg-t">${esc(nombreFoto(f,i))}</h2><button type="button" class="ibtn" data-cerrar aria-label="Cerrar">${ic('close')}</button></header><div class="hoja-c">
      ${ver?`<img class="p2-grande" src="/api/adjuntos/${ver}" alt="${esc(f.descripcion||nombreFoto(f,i))}">`:`<div class="vacio-d">${ic(ICONO[f.tipo])}<p class="vt">Todavía sin foto</p></div>`}
      <label class="campo"><span>Qué muestra esta foto</span><input type="text" data-desc maxlength="300" value="${esc(f.descripcion)}" placeholder="Ej.: rayón en puerta delantera derecha"></label>
      <div class="dos-b"><label class="btn">${ic('photo_camera')}Reemplazar${archivo('data-rep','Reemplazar con la cámara',true)}</label><label class="btn">${ic('photo_library')}Galería${archivo('data-rep','Reemplazar desde la galería',false)}</label></div>
      <button type="button" class="btn btn-peligro" data-quitar>${ic('delete')}Quitar esta foto</button><button type="button" class="btn btn-primario" data-cerrar>Listo</button></div>`;
    document.body.append(d);
    d.querySelector('[data-desc]').oninput=e=>{f.descripcion=e.target.value;cambio();};
    d.querySelectorAll('[data-rep]').forEach(inp=>inp.onchange=e=>{const file=e.target.files[0];if(file){reemplazar(f,file);d.close();}});
    d.querySelector('[data-quitar]').onclick=()=>{quitar(f);d.close();};
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-cerrar]'))d.close();});
    d.addEventListener('close',()=>{d.remove();dibujar();const destino=box.querySelector(`[data-ver="${f.token}"]`)||danos?.querySelector(`[data-ver="${f.token}"]`)||(origen?.isConnected?origen:box.querySelector(`[data-tile="${f.tipo}"] input`));destino?.focus();},{once:true});
    d.showModal();
  }
  const subir=async f=>{
    if(ocupadas.has(f.token)||!archivos.has(f.token))return;
    const token=f.token;ocupadas.add(token);f.error='';dibujar();
    try{
      const file=archivos.get(token);
      const r=await api('POST',`/api/recepcion/fotos?clave=${encodeURIComponent(clave)}&tipo=${f.tipo}&token=${token}`,undefined,{archivo:file,idempotencia:token,cabeceras:{'X-Nombre-Archivo':encodeURIComponent(file.name)}});
      // Una respuesta tardía solo vale para la carga que la pidió: si la foto se quitó o se eligió otra, se descarta.
      if(fotos.includes(f)&&f.token===token){f.id=r.id;f.previo=null;}
      archivos.delete(token);
    }catch(e){if(f.token===token){f.error=e.message||'No se pudo subir.';if(f.previo){f.id=f.previo;f.previo=null;}}}finally{ocupadas.delete(token);if(fotos.includes(f)){cambio();dibujar();}}
  };
  if(!fotos.length)fotos=lugares();
  dibujar();
  const recuperadas=fotos;
  if(recuperando)get('/api/recepcion/fotos?clave='+encodeURIComponent(clave)).then(r=>{
    if(fotos!==recuperadas)return;
    for(const f of fotos){const guardada=r.fotos.find(a=>a.token===f.token&&a.tipo===f.tipo);f.id=guardada?.id||null;if(!f.id&&f.intentada)f.error='Esta foto no llegó al servidor. Volvé a elegirla.';}
    recuperando=false;cambio();dibujar();
  }).catch(()=>{if(fotos!==recuperadas)return;recuperando=false;for(const f of fotos){f.id=null;f.error='No se pudieron comprobar las fotos. Volvé a elegirlas cuando tengas conexión.';}cambio();dibujar();});
  return {datos,refrescar:dibujar,
    estado:()=>({tablero:deTipo('tablero').filter(lista).length,exterior:deTipo('exterior').filter(lista).length,detalle:deTipo('detalle').length,subiendo:ocupadas.size+(recuperando?1:0),fallidas:fotos.filter(f=>f.error).map(f=>f.tipo),danosSinTexto:deTipo('detalle').filter(f=>!f.descripcion.trim()).length,danosSinFoto:deTipo('detalle').filter(f=>!f.id&&!ocupadas.has(f.token)).length}),
    tieneFotos:()=>fotos.some(f=>f.id)||archivos.size>0||ocupadas.size>0,
    reiniciar(){fotos=lugares();archivos.clear();ocupadas.clear();recuperando=false;cambio();dibujar();},
    validar(carroceria){
      if(recuperando||ocupadas.size)throw falla('Esperá a que termine la carga de las fotos.');
      if(fotos.some(f=>!f.id))throw falla('Cargá las fotos pendientes o quitá las que no vas a usar.');
      for(const tipo of ['tablero','exterior',...(carroceria==='con_danos'?['detalle']:[])])if(!fotos.some(f=>f.tipo===tipo&&f.id))throw falla('Falta una foto de '+NOMBRES_FOTO[tipo].toLowerCase()+'.');
      if(fotos.some(f=>!f.descripcion.trim()))throw falla(carroceria==='con_danos'&&fotos.some(f=>f.tipo==='detalle'&&!f.descripcion.trim())?'Escribí la ubicación y descripción de cada daño.':'Describí qué muestra cada foto.');
    }};
}

export function vistaEstadoIngreso(v) {
  const e=v.recepcion?.estadoIngreso;
  if(!e)return '<section class="bloque"><h2>Estado al ingresar</h2><p class="muted">Esta orden anterior no tiene registro fotográfico de ingreso. No se agregó información retroactiva.</p></section>';
  return `<section class="bloque estado-ingreso"><h2>Estado al ingresar</h2><p class="small muted">Registrado ${esc(fechaHora(e.registradoAt))} por ${esc(e.registradoPor)}. Se conserva el registro original.</p><dl class="resumen-kv"><div><dt>Carrocería e interior</dt><dd>${e.carroceria==='con_danos'?'Con daños previos observados':'Sin daños visibles observados'}</dd></div><div><dt>Tablero</dt><dd>${esc({sin_testigos:'Sin testigos de falla observados',con_testigos:'Con testigos encendidos',no_enciende:'No se pudo encender'}[e.tablero])}</dd></div></dl>${e.testigos?`<p><strong>Testigos / aclaración:</strong> ${esc(e.testigos)}</p>`:''}<p><strong>Observaciones al ingresar:</strong> ${esc(e.observaciones)}</p><div class="rec-fotos-lista">${e.fotos.map(f=>`<figure class="rec-foto"><a href="/api/adjuntos/${f.id}" target="_blank" rel="noopener"><img src="/api/adjuntos/${f.id}" alt="${esc(f.descripcion)}" width="320" height="200" loading="lazy"></a><figcaption><strong>${esc(NOMBRES_FOTO[f.tipo])}</strong><p>${esc(f.descripcion)}</p><small>Cargada ${esc(fechaHora(f.fecha))} · ${esc(f.por)}</small></figcaption></figure>`).join('')}</div><p class="small muted">Este registro describe lo observado al ingreso; no es un diagnóstico ni autoriza reparaciones. Las aclaraciones posteriores van en las notas del historial.</p></section>`;
}
