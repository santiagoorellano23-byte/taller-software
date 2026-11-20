import {api,get} from './api.js?v=0.1.0';
import {esc,fechaHora,toast,confirmar} from './ui.js?v=0.1.0';
import {ic} from './diseno.js?v=0.1.0';

export const NOMBRES_FOTO={tablero:'Tablero',exterior:'Exterior',detalle:'Detalle de daño previo'};
const falla=mensaje=>Object.assign(new Error(mensaje),{campo:'fotosIngreso'});
// Lo que admite el servidor (POST /api/recepcion/fotos): JPG, PNG o WEBP de hasta 15 MB. HEIC/HEIF no se admite.
const TIPOS=['image/jpeg','image/png','image/webp'],MAX=15*1024*1024,MAX_FOTOS=12;
export const FORMATOS='JPG, PNG o WEBP · hasta 15 MB';

// Paso 2 · «¿Cómo llega?»: tarjetas de tablero y exterior, más vistas del exterior y una tarjeta por daño con su texto
// y su foto. Los originales van al almacenamiento privado; el borrador guarda solo referencias. Cada carga se identifica
// por su token: una respuesta tardía de una carga cancelada, quitada o de otro auto (reiniciar) se descarta.
// Reemplazo seguro: la foto vigente sigue en `id` y el candidato vive en `nuevo` (solo en esta pantalla) hasta que el
// servidor lo confirma; si falla o se cancela, la anterior queda como estaba y no se pide de nuevo la verificación.
// `alCambio(motivo)` avisa los cambios efectivos (foto lista, cambiada o quitada; daño editado) y devuelve cómo deshacer
// el reinicio de la verificación; `guardar()` solo conserva el borrador.
export function enlazarFotosIngreso(box,{clave,inicial=[],guardar,danos=null,carroceria=()=>'',alDano=()=>{},alCambio=()=>()=>{},demo=false,faltas=()=>false,tablero=()=>''}) {
  let fotos=inicial.map(f=>({id:f.id||null,tipo:f.tipo,descripcion:f.descripcion||'',token:f.token||crypto.randomUUID(),intentada:!!f.intentada||!!f.id,...(f.demo?{demo:true}:{})}));
  const ocupadas=new Set();
  let recuperando=fotos.some(f=>f.intentada),enfocar='',nDemo=0;
  const datos=()=>fotos.map(({id,tipo,descripcion,token,intentada,demo:d})=>({id:id||null,tipo,descripcion,token,...(intentada?{intentada:true}:{}),...(d?{demo:true}:{})}));
  const cambio=()=>{if(box.isConnected)guardar();};
  const propuesta=(tipo,extra)=>tipo==='tablero'?'Tablero al ingresar':tipo==='exterior'?(extra?'Vista adicional del exterior':'Vista exterior al ingresar'):'';
  const deTipo=tipo=>fotos.filter(f=>f.tipo===tipo);
  const principal=tipo=>deTipo(tipo)[0];
  const extras=()=>fotos.filter(f=>(f.tipo==='exterior'||f.tipo==='tablero')&&f!==principal(f.tipo));
  const lista=f=>!!f.id;
  const subiendo=f=>f.carga?.estado==='up'||(recuperando&&f.intentada&&!f.carga);
  const fallida=f=>f.carga?.estado==='error';
  const ocupa=f=>!!(f.id||f.carga);
  const usadas=()=>fotos.filter(ocupa).length;
  const lugares=()=>['tablero','exterior'].map(tipo=>({id:null,tipo,descripcion:propuesta(tipo),token:crypto.randomUUID()}));
  const nomFoto=f=>f.tipo==='tablero'?(f===principal('tablero')?'del tablero':'adicional del tablero'):f.tipo==='exterior'?(f===principal('exterior')?'del exterior':'de la vista adicional'):`del daño ${deTipo('detalle').indexOf(f)+1}`;
  const src=(f,c)=>c?.vista||(f.id?`/api/adjuntos/${f.id}`:'');
  const insignia=x=>x?.demo?'<span class="p2-demo">DEMO</span>':'';
  const giro='<span class="p2-giro" aria-hidden="true"></span>';
  function problema(file){
    const n=file?.name||'archivo';
    if(!file?.size)return [ 'formato',`«${n}» está vacío. Elegí otra foto.`];
    if(/hei[cf]/i.test(file.type)||/\.hei[cf]$/i.test(n))return ['formato',`«${n}» está en formato HEIC/HEIF, que el sistema no admite. Elegí JPG, PNG o WEBP: en el iPhone, sacala con «Cámara» o exportala como JPG.`];
    if(!TIPOS.includes(file.type))return ['formato',`«${n}» no es una foto admitida. Elegí JPG, PNG o WEBP de hasta 15 MB.`];
    if(file.size>MAX)return ['tamano',`«${n}» pesa más de 15 MB. Elegí una foto más liviana.`];
    return null;
  }
  const liberar=c=>{if(c?.vista)try{URL.revokeObjectURL(c.vista);}catch{/* Sin vista previa local. */}};
  const vistaLocal=file=>{try{return URL.createObjectURL(file);}catch{return '';}};
  const candidato=(file,token=crypto.randomUUID())=>{const p=problema(file);return p?{token,estado:'error',errTipo:p[0],error:p[1],nombre:file?.name||''}:{token,estado:'up',archivo:file,nombre:file.name,vista:vistaLocal(file),demo:!!file.demo};};
  const acciones=(f,c,corto)=>`<span class="p2-acc">${c.errTipo==='subida'&&c.archivo?`<button type="button" class="p2-bt" data-reintentar="${f.token}">${ic('refresh')}Reintentar</button>`:`<button type="button" class="p2-bt" data-fuente="${f.token}">${ic('swap_horiz')}Elegir otra</button>`}${c===f.nuevo?`<button type="button" class="p2-bt" data-dejar="${f.token}">${corto?'Entendido':'Dejar la anterior'}</button>`:`<button type="button" class="p2-bt peligro" data-descartar="${f.token}" aria-label="Quitar el archivo con error">${ic('delete')}</button>`}</span>`;
  const avisoCambio=(f,corto)=>`<div class="p2-cambio" role="alert"><p><b>No se cambió la foto ${nomFoto(f)}.</b> ${esc(f.nuevo.error)} Se conserva la foto anterior.</p>${acciones(f,f.nuevo,corto)}</div>`;

  // Tarjeta de tablero o exterior: vacía, falta, subiendo, cargada, con error, cambiando o con cambio fallido.
  function tarjeta(tipo){
    const f=principal(tipo),titulo=tipo==='tablero'?'Tablero':'Exterior',falta=faltas()&&!lista(f)&&!subiendo(f);
    let area,pie,extra='',cls='';
    if(lista(f)){
      const n=f.nuevo;
      area=`<button type="button" class="p2-area img" data-ver="${f.token}" id="p2-f-${tipo}" aria-label="Foto ${nomFoto(f)} cargada${n?.estado==='up'?'. Cambiando por otra':''}. Ver o cambiar"><img src="${src(f)}" alt="">${insignia(f)}${n?.estado==='up'?`<span class="p2-capa" role="status">${giro}Cambiando…</span>`:`<span class="p2-chk">${ic('check')}</span><span class="p2-vercam">${ic('visibility')}<span>Ver o cambiar</span></span>`}</button>`;
      if(n?.estado==='up'){pie=`<p class="p2-pie carga">${ic('hourglass_top')}Cambiando · sigue la anterior</p>`;extra=`<span class="p2-acc"><button type="button" class="p2-bt" data-cancelar="${f.token}" aria-label="Cancelar el cambio de foto ${nomFoto(f)}">${ic('close')}Cancelar</button></span>`;}
      else if(n?.estado==='error'){pie=`<p class="p2-pie warn">${ic('warning')}No se cambió</p>`;cls='aviso';}
      else pie=`<p class="p2-pie ok">${ic('check_circle')}Cargada</p>`;
    }else if(subiendo(f)){
      const c=f.carga;
      area=`<div class="p2-area img" id="p2-f-${tipo}" tabindex="-1">${c?.vista?`<img src="${c.vista}" alt="">`:''}<span class="p2-capa" role="status">${giro}${c?'Subiendo…':'Comprobando…'}</span></div>`;
      pie=`<p class="p2-pie carga">${ic('hourglass_top')}${c?'Subiendo':'Comprobando'}</p>`;
      if(c)extra=`<span class="p2-acc"><button type="button" class="p2-bt" data-cancelar="${f.token}" aria-label="Cancelar la foto ${nomFoto(f)}">${ic('close')}Cancelar</button></span>`;
    }else if(fallida(f)){
      const c=f.carga;cls='error';
      area=`<button type="button" class="p2-area err" data-fuente="${f.token}" id="p2-f-${tipo}">${ic('error')}<b>${c.errTipo==='subida'?'No se subió':'Archivo no admitido'}</b></button>`;
      pie=`<p class="p2-msg" role="alert">${esc(c.error)}</p>`;extra=acciones(f,c);
    }else{
      cls=falta?'falta':'';
      area=`<button type="button" class="p2-area" data-fuente="${f.token}" id="p2-f-${tipo}">${ic('add_a_photo')}<span>Agregar foto<span class="sr"> ${nomFoto(f)}</span></span></button>`;
      pie=falta?`<p class="p2-pie err">${ic('error')}Falta · obligatoria</p>`:`<p class="p2-pie oblig">Obligatoria${tipo==='tablero'&&tablero()==='no_enciende'?', aunque no encienda':''}</p>`;
    }
    return `<div class="p2-ft ${cls}" data-tile="${tipo}"><p class="p2-ft-h">${ic(tipo==='tablero'?'speed':'directions_car')}<span>${titulo}</span></p>${area}${pie}${extra}</div>`;
  }
  function tiraExtra(f,i){
    const c=f.carga,et=`Vista adicional ${i+1}`;
    if(fallida(f))return `<div class="p2-tira err"><button type="button" data-fuente="${f.token}" aria-label="${esc(c.error)} Elegir otra">${ic('error')}${c.errTipo==='subida'?'No se subió':'No admitida'}</button></div>`;
    if(!lista(f))return `<div class="p2-tira">${c?.vista?`<img src="${c.vista}" alt="">`:''}<span class="p2-capa" role="status" aria-label="${et}: subiendo">${giro}</span>${c?`<button type="button" class="p2-tira-x" data-cancelar="${f.token}" aria-label="Cancelar ${et.toLowerCase()}">${ic('close')}</button>`:''}</div>`;
    const n=f.nuevo;
    return `<div class="p2-tira ${n?.estado==='error'?'aviso':''}"><button type="button" data-ver="${f.token}" aria-label="${et}${f.tipo==='tablero'?' del tablero':''}. Ver o cambiar"><img src="${src(f)}" alt="">${insignia(f)}${n?.estado==='up'?`<span class="p2-capa" role="status">${giro}</span>`:n?.estado==='error'?`<span class="p2-chk av">${ic('warning')}</span>`:`<span class="p2-chk">${ic('check')}</span>`}</button></div>`;
  }

  const dibujar=()=>{
    if(!box.isConnected)return;
    const X=extras(),okX=X.filter(lista).length,lleno=usadas()>=MAX_FOTOS,errX=X.find(fallida);
    box.innerHTML=`<div class="p2-fotos2" role="group" aria-label="Fotos obligatorias">${tarjeta('tablero')}${tarjeta('exterior')}</div>
      ${['tablero','exterior'].map(principal).filter(f=>f?.nuevo?.estado==='error').map(f=>avisoCambio(f)).join('')}
      <div class="p2-mas" role="group" aria-labelledby="p2-mas-t"><div class="p2-mas-h">${ic('photo_library')}<b id="p2-mas-t">Más vistas del exterior</b>${okX?`<span class="chip ok">${ic('check')}${okX} ${okX===1?'foto':'fotos'}</span>`:'<span class="chip">Recomendada</span>'}</div>
        <p>Frente, atrás y laterales ayudan, pero no son obligatorias.</p>
        <div class="p2-tiras">${X.map(tiraExtra).join('')}${lleno?'':`<button type="button" class="p2-tira-add" data-fuente-nueva="exterior">${ic('add_a_photo')}<span>${X.length?'Otra':'Agregar'}<span class="sr"> vista del exterior</span></span></button>`}</div>
        ${X.filter(f=>f.nuevo?.estado==='error').map(f=>avisoCambio(f,true)).join('')}
        ${errX?`<p class="p2-ayuda e">${ic('error')}<span>${esc(errX.carga.error)} Tocala para elegir otra.</span></p>`:''}
        ${lleno?`<p class="p2-ayuda">${ic('info')}<span>Llegaste al máximo de ${MAX_FOTOS} fotos para este ingreso.</span></p>`:''}</div>
      <p class="p2-nota">${ic('info')}<span>Las fotos se guardan con la orden recién al confirmar el ingreso.</span></p>
      <p class="sr" role="status" data-foto-estado aria-live="polite">${esc(resumenTexto())}</p>`;
    enlazar(box);
    dibujarDanos();
  };
  // Una tarjeta por daño: su descripción (obligatoria, hasta 300) y su foto 4:3.
  function dibujarDanos(){
    if(!danos?.isConnected)return;
    if(carroceria()!=='con_danos'){danos.innerHTML='';return;}
    const L=deTipo('detalle'),ver=faltas();
    // Redibujar no quita el foco ni mueve el cursor de quien está escribiendo.
    const act=document.activeElement,tok=enfocar||act?.dataset?.descripcion,sel=act?.dataset?.descripcion?[act.selectionStart,act.selectionEnd]:null;enfocar='';
    danos.innerHTML=`${L.map((f,i)=>{
      const ed=ver&&!f.descripcion.trim(),ef=ver&&!lista(f)&&!subiendo(f)&&!fallida(f),c=f.carga,n=f.nuevo;let area,st;
      if(lista(f)){area=`<button type="button" class="p2-area img" data-ver="${f.token}" id="p2-df-${f.token}" aria-label="Foto del daño ${i+1}${n?.estado==='up'?'. Cambiando por otra':''}. Ver o cambiar"><img src="${src(f)}" alt="">${insignia(f)}${n?.estado==='up'?`<span class="p2-capa" role="status">${giro}</span>`:`<span class="p2-chk">${ic('check')}</span>`}</button>`;
        st=n?.estado==='up'?`<b>Cambiando…</b><span class="p2-ayuda">Sigue la anterior hasta que termine</span><button type="button" class="p2-bt" data-cancelar="${f.token}">${ic('close')}Cancelar cambio</button>`:`<b class="p2-pie ok">${ic('check_circle')}Foto cargada</b><span class="p2-ayuda">Tocala para verla o cambiarla</span>`;}
      else if(subiendo(f)){area=`<div class="p2-area img" id="p2-df-${f.token}" tabindex="-1">${c?.vista?`<img src="${c.vista}" alt="">`:''}<span class="p2-capa" role="status">${giro}</span></div>`;st=`<b>${c?'Subiendo…':'Comprobando…'}</b>${c?`<button type="button" class="p2-bt" data-cancelar="${f.token}">${ic('close')}Cancelar</button>`:''}`;}
      else if(fallida(f)){area=`<button type="button" class="p2-area err" data-fuente="${f.token}" id="p2-df-${f.token}">${ic('error')}<b>${c.errTipo==='subida'?'No se subió':'No admitida'}</b></button>`;st=`<span class="p2-msg">${esc(c.error)}</span>${acciones(f,c)}`;}
      else{area=`<button type="button" class="p2-area" data-fuente="${f.token}" id="p2-df-${f.token}">${ic('add_a_photo')}<span>Agregar foto<span class="sr"> del daño ${i+1}</span></span></button>`;st=`<b>Foto del daño</b><span class="p2-ayuda${ef?' e':''}">${ef?ic('error')+'Falta · obligatoria':'Obligatoria'}</span>`;}
      const quitable=L.length>1||f.descripcion.trim()||ocupa(f);
      return `<div class="p2-dano ${ed||ef?'error':''}" data-dano="${f.token}"><div class="p2-dano-h"><b>Daño ${i+1}</b>${quitable?`<button type="button" class="p2-bt solo" data-quitar-dano="${f.token}" aria-label="Quitar el daño ${i+1}">${ic('delete')}</button>`:''}</div>
        <div class="p2-campo ${ed?'error':''}"><label for="dano-${f.token}">Descripción</label><input class="p2-inp" id="dano-${f.token}" data-descripcion="${f.token}" maxlength="300" value="${esc(f.descripcion)}" placeholder="Ej.: rayón en puerta delantera derecha" autocomplete="off" ${ed?`aria-invalid="true" aria-describedby="dano-e-${f.token}"`:''}>
          ${ed?`<p class="p2-ayuda e" id="dano-e-${f.token}">${ic('error')}Describí el daño ${i+1}.</p>`:`<p class="p2-ayuda" data-cont="${f.token}" ${f.descripcion.length>240?'':'hidden'}><span class="p2-cont">${f.descripcion.length}/300</span></p>`}</div>
        <div class="p2-dano-f">${area}<div class="p2-st">${st}</div></div>${n?.estado==='error'?avisoCambio(f):''}</div>`;}).join('')}
      <button type="button" class="btn p2-ancho" data-otro-dano ${usadas()>=MAX_FOTOS?'disabled':''}>${ic('add')}${L.length?'Agregar otro daño':'Agregar un daño'}</button>`;
    if(tok){const el=danos.querySelector(`[data-descripcion="${tok}"]`);if(el){el.focus({preventScroll:!!sel});if(sel)el.setSelectionRange(...sel);}}
    danos.querySelectorAll('[data-descripcion]').forEach(inp=>inp.oninput=()=>{const f=fotos.find(x=>x.token===inp.dataset.descripcion);if(!f)return;f.descripcion=inp.value;const k=danos.querySelector(`[data-cont="${f.token}"]`);if(k){k.hidden=inp.value.length<=240;k.firstChild.textContent=`${inp.value.length}/300`;}alCambio(`Cambiaste la descripción del daño ${deTipo('detalle').indexOf(f)+1}.`);cambio();});
    danos.querySelectorAll('[data-quitar-dano]').forEach(b=>b.onclick=()=>quitarDano(fotos.find(x=>x.token===b.dataset.quitarDano)));
    danos.querySelector('[data-otro-dano]')?.addEventListener('click',()=>{agregarDano();});
    enlazar(danos);
  }
  // Los mismos botones viven en las tarjetas, en las vistas adicionales y en los daños.
  function enlazar(raiz){
    const de=b=>fotos.find(f=>f.token===b);
    raiz.querySelectorAll('[data-fuente]').forEach(b=>b.onclick=()=>{const f=de(b.dataset.fuente);if(f)fuente(f.tipo,f,b);});
    raiz.querySelectorAll('[data-fuente-nueva]').forEach(b=>b.onclick=()=>fuente(b.dataset.fuenteNueva,null,b));
    raiz.querySelectorAll('[data-ver]').forEach(b=>b.onclick=()=>ver(de(b.dataset.ver),b));
    raiz.querySelectorAll('[data-reintentar]').forEach(b=>b.onclick=()=>{const f=de(b.dataset.reintentar);if(!f)return;const c=f.nuevo?.estado==='error'?f.nuevo:f.carga;if(c?.archivo)subir(f,c);});
    raiz.querySelectorAll('[data-cancelar]').forEach(b=>b.onclick=()=>cancelar(de(b.dataset.cancelar)));
    raiz.querySelectorAll('[data-dejar]').forEach(b=>b.onclick=()=>{const f=de(b.dataset.dejar);if(f){liberar(f.nuevo);delete f.nuevo;dibujar();box.querySelector(`[data-ver="${f.token}"]`)?.focus();}});
    raiz.querySelectorAll('[data-descartar]').forEach(b=>b.onclick=()=>{const f=de(b.dataset.descartar);if(f)descartar(f);});
  }
  function resumenTexto(){const t=deTipo('tablero').filter(lista).length,x=deTipo('exterior').filter(lista).length,up=fotos.filter(subiendo).length,faltan=['tablero','exterior'].filter(tipo=>!deTipo(tipo).some(f=>f.id||subiendo(f)));return `${t} del tablero, ${x} del exterior${up?`, ${up} subiendo`:''}.${faltan.length?` Falta cargar esta foto: ${faltan.join(' y ')}.`:''}`;}

  // Elegir archivos para un lugar (f) o para una vista nueva. Si el lugar ya tiene foto, es un reemplazo seguro.
  function elegir(tipo,f,files){
    files=[...files].filter(Boolean);if(!files.length)return;
    if(f&&lista(f)){
      liberar(f.nuevo);const c=candidato(files[0]);f.nuevo=c;dibujar();
      if(c.estado==='up')subir(f,c);else box.querySelector('.p2-cambio')?.focus?.();
      return;
    }
    for(const [i,file] of files.entries()){
      let destino=i===0?f:null;
      if(!destino&&usadas()>=MAX_FOTOS){toast(`Llegaste al máximo de ${MAX_FOTOS} fotos: no se agregaron todas.`,{error:true});break;}
      if(!destino){destino={id:null,tipo,descripcion:propuesta(tipo,true),token:crypto.randomUUID()};fotos.push(destino);}
      if(tipo==='detalle'&&carroceria()!=='con_danos')alDano(); // fotografiar un daño es declararlo
      liberar(destino.carga);destino.token=crypto.randomUUID();const c=candidato(file,destino.token);destino.carga=c;
      if(c.estado==='up'){destino.intentada=true;subir(destino,c);}
    }
    cambio();dibujar();
  }
  async function subir(f,c){
    if(ocupadas.has(c.token))return;
    ocupadas.add(c.token);c.estado='up';c.error='';c.errTipo='';dibujar();
    try{
      const r=await api('POST',`/api/recepcion/fotos?clave=${encodeURIComponent(clave)}&tipo=${f.tipo}&token=${c.token}`,undefined,{archivo:c.archivo,idempotencia:c.token,cabeceras:{'X-Nombre-Archivo':encodeURIComponent(c.nombre||'foto')}});
      // Una respuesta tardía solo vale para la carga que la pidió: si se canceló, se quitó o se eligió otra, se descarta.
      if(!fotos.includes(f))return;
      if(c===f.nuevo){f.id=r.id;f.token=c.token;f.intentada=true;if(c.demo)f.demo=true;else delete f.demo;liberar(f.vista);f.vista=c.vista;delete f.nuevo;alCambio(`Cambiaste la foto ${nomFoto(f)}.`);toast(`Foto ${nomFoto(f)} cambiada.`);}
      else if(c===f.carga){f.id=r.id;if(c.demo)f.demo=true;else delete f.demo;f.vista=c.vista;delete f.carga;alCambio(`Agregaste la foto ${nomFoto(f)}.`);}
    }catch(e){
      if(c===f.nuevo||c===f.carga){c.estado='error';c.errTipo='subida';c.error=e.datos?.sinConexion?'No se pudo subir por la conexión. Reintentá: si ya había llegado, no se duplica.':e.message||'No se pudo subir. Revisá la conexión y reintentá.';}
    }finally{ocupadas.delete(c.token);if(fotos.includes(f)){cambio();dibujar();}}
  }
  function cancelar(f){
    if(!f)return;
    if(f.nuevo){liberar(f.nuevo);delete f.nuevo;toast('Cambio cancelado. Se conserva la foto anterior.');dibujar();box.querySelector(`[data-ver="${f.token}"]`)?.focus();return;}
    if(f.carga){descartar(f);toast('Carga cancelada.');}
  }
  // Un archivo con error o una carga cancelada: el lugar obligatorio vuelve a quedar vacío; una vista adicional se quita.
  function descartar(f){
    liberar(f.carga);delete f.carga;
    if(f===principal(f.tipo)&&f.tipo!=='detalle'||f.tipo==='detalle'){f.token=crypto.randomUUID();f.intentada=false;f.id=null;}
    else fotos=fotos.filter(x=>x!==f);
    cambio();dibujar();
  }
  function quitar(f){
    if(!f)return;const i=fotos.indexOf(f),era={...f},obligatoria=f===principal(f.tipo)&&f.tipo!=='detalle';
    liberar(f.nuevo);delete f.nuevo;
    if(f.tipo==='detalle'||obligatoria){Object.assign(f,{id:null,token:crypto.randomUUID(),intentada:false});delete f.demo;delete f.vista;}
    else fotos=fotos.filter(x=>x!==f);
    const deshacer=alCambio(`Quitaste la foto ${nomFoto(era.tipo==='detalle'||obligatoria?f:era)}.`);
    cambio();dibujar();
    toast(`Foto ${nomFoto(f)} quitada${obligatoria?'. Hace falta otra para continuar':''}.`,{accion:{texto:'Deshacer',fn:()=>{if(fotos.includes(f)){if(f.id||f.carga)return toast('No se deshizo: ese lugar ya tiene otra foto.');Object.assign(f,era);}else fotos.splice(Math.min(i,fotos.length),0,Object.assign(f,era));deshacer();cambio();dibujar();}}});
  }
  async function quitarDano(f){
    if(!f)return;
    if((f.descripcion.trim()||ocupa(f))&&!(await confirmar({titulo:`¿Quitar el daño ${deTipo('detalle').indexOf(f)+1}?`,texto:'Se quitan su descripción y su foto del borrador.',aceptar:'Quitar',peligro:true})).ok)return;
    liberar(f.carga);liberar(f.nuevo);fotos=fotos.filter(x=>x!==f);alCambio('Quitaste un daño.');cambio();dibujar();
    danos?.querySelector('[data-otro-dano]')?.focus();
  }
  function agregarDano(){
    if(usadas()>=MAX_FOTOS)return;
    const f={id:null,tipo:'detalle',descripcion:'',token:crypto.randomUUID()};fotos.push(f);enfocar=f.token;
    alCambio('Agregaste un daño.');cambio();dibujar();
  }

  // Hoja para elegir el origen: cámara, galería (varias solo en vistas nuevas) y, solo en la demostración, foto de prueba.
  function fuente(tipo,f,origen){
    const reemplazo=f&&lista(f),varias=tipo==='exterior'&&!f;
    const nom={tablero:'del tablero',exterior:f&&f===principal('exterior')?'del exterior':'del exterior (vista adicional)',detalle:'del daño'}[tipo];
    const consejo={tablero:'Que se lean los testigos y los kilómetros. Si no enciende, sacala igual.',exterior:f===principal('exterior')&&f?'El auto completo, de frente o en diagonal.':'Frente, atrás y laterales. Podés elegir varias de la galería.',detalle:'De cerca, que se vea el daño y dónde está.'}[tipo];
    const d=document.createElement('dialog');d.className='hoja-dlg p2-hoja';d.setAttribute('aria-labelledby','p2-hoja-t');
    d.innerHTML=`<header><h2 id="p2-hoja-t">${reemplazo?'Cambiar foto':'Foto'} ${nom}</h2><button type="button" class="ibtn" data-cerrar aria-label="Cerrar">${ic('close')}</button></header><div class="hoja-c">
      <div class="p2-fuentes"><label class="p2-fuente">${ic('photo_camera')}<span>Cámara</span><small>Sacar ahora</small><input type="file" accept="${TIPOS.join(',')}" capture="environment" data-archivo></label>
        <label class="p2-fuente">${ic('photo_library')}<span>Galería</span><small>${varias?'Una o varias':'Elegir del teléfono'}</small><input type="file" accept="${TIPOS.join(',')}" ${varias?'multiple':''} data-archivo></label></div>
      ${reemplazo?`<p class="p2-aviso info">${ic('info')}<span>La foto actual se conserva hasta que la nueva esté lista.</span></p>`:''}
      <p class="p2-consejo">${ic('info')}<span>${consejo}<br><small>${FORMATOS}</small></span></p>
      ${demo?`<button type="button" class="p2-demo-b" data-demo><span class="p2-demo-tag">DEMO</span><span><b>Usar foto de prueba</b><small>Solo en la demostración. No es una foto real del auto.</small></span></button>`:''}</div>`;
    document.body.append(d);
    let elegido=null;
    d.querySelectorAll('[data-archivo]').forEach(inp=>inp.onchange=()=>{elegido=[...inp.files];d.close();});
    d.querySelector('[data-demo]')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;elegido=[await fotoDemo(tipo,++nDemo)];d.close();});
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-cerrar]'))d.close();});
    d.addEventListener('close',()=>{d.remove();if(elegido?.length){elegir(tipo,f&&fotos.includes(f)?f:null,elegido);}const destino=f&&(box.querySelector(`[data-ver="${f.token}"],[data-fuente="${f.token}"]`)||danos?.querySelector(`[data-ver="${f.token}"],[data-fuente="${f.token}"],#p2-df-${f.token}`));(destino||(origen?.isConnected?origen:box.querySelector('.p2-tira-add')))?.focus();},{once:true});
    d.showModal();
  }
  // Hoja de una foto: verla, corregir qué muestra (salvo daños, que se describen en su tarjeta), cambiarla o quitarla.
  function ver(f,origen){
    if(!f||!lista(f))return;
    const i=deTipo(f.tipo).indexOf(f),titulo=f.tipo==='detalle'?`Daño ${i+1}`:f===principal(f.tipo)?NOMBRES_FOTO[f.tipo]:f.tipo==='tablero'?'Vista adicional del tablero':'Vista adicional del exterior';
    const obligatoria=f.tipo==='detalle'||f===principal(f.tipo);
    const d=document.createElement('dialog');d.className='hoja-dlg p2-hoja';d.setAttribute('aria-labelledby','p2-ver-t');
    const pintar=(confirmar=false)=>{d.innerHTML=`<header><h2 id="p2-ver-t">${esc(titulo)}</h2><button type="button" class="ibtn" data-cerrar aria-label="Cerrar">${ic('close')}</button></header><div class="hoja-c">
      <img class="p2-grande" src="${src(f)}" alt="${esc(f.descripcion||titulo)}">
      <p class="p2-meta">${f.demo?'<span class="chip p2-chip-demo">DEMO · foto de prueba</span>':''}<span>Preparada para este ingreso · se guarda con la orden al confirmar</span></p>
      ${f.nuevo?.estado==='up'?`<p class="p2-aviso info">${ic('hourglass_top')}<span>Cambiando por otra foto. Esta sigue hasta que la nueva esté lista.</span></p>`:''}
      ${f.tipo!=='detalle'?`<label class="p2-campo"><span>Qué muestra esta foto</span><input class="p2-inp" type="text" data-desc maxlength="300" value="${esc(f.descripcion)}" placeholder="Ej.: frente y lateral derecho"></label>`:''}
      ${confirmar?`<div class="p2-conf-q" role="group" aria-labelledby="p2-cq"><p id="p2-cq"><b>¿Quitar esta foto?</b> ${obligatoria?'Es obligatoria: vas a tener que cargar otra para continuar.':'Se quita de este paso.'}</p><div class="p2-hoja-acc"><button type="button" class="btn" data-no-quitar>Cancelar</button><button type="button" class="btn btn-peligro" data-quitar-ya>${ic('delete')}Quitar</button></div></div>`
        :`<div class="p2-hoja-acc"><button type="button" class="btn" data-cambiar ${f.nuevo?.estado==='up'?'disabled':''}>${ic('swap_horiz')}Cambiar</button><button type="button" class="btn p2-rojo" data-quitar>${ic('delete')}Quitar</button><button type="button" class="btn btn-primario p2-ancho" data-cerrar>Listo</button></div>`}</div>`;
      d.querySelector('[data-desc]')?.addEventListener('change',e=>{const v=e.target.value;if(v!==f.descripcion){f.descripcion=v;alCambio(`Cambiaste la descripción de la foto ${nomFoto(f)}.`);cambio();}});
      d.querySelector('[data-desc]')?.addEventListener('input',e=>{f.descripcion=e.target.value;cambio();});
      d.querySelector('[data-quitar]')?.addEventListener('click',()=>{pintar(true);d.querySelector('[data-quitar-ya]').focus();});
      d.querySelector('[data-no-quitar]')?.addEventListener('click',()=>{pintar();d.querySelector('[data-quitar]').focus();});
      d.querySelector('[data-quitar-ya]')?.addEventListener('click',()=>{accion='quitar';d.close();});
      d.querySelector('[data-cambiar]')?.addEventListener('click',()=>{accion='cambiar';d.close();});
    };
    let accion='';pintar();
    document.body.append(d);
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-cerrar]'))d.close();});
    d.addEventListener('close',()=>{d.remove();
      if(accion==='quitar'){quitar(f);(box.querySelector(`[data-fuente="${f.token}"]`)||danos?.querySelector(`[data-fuente="${f.token}"]`)||box.querySelector('.p2-tira-add'))?.focus();return;}
      dibujar();if(accion==='cambiar'){fuente(f.tipo,f,origen);return;}
      (box.querySelector(`[data-ver="${f.token}"]`)||danos?.querySelector(`[data-ver="${f.token}"]`)||origen)?.focus?.();},{once:true});
    d.showModal();
  }

  if(!fotos.length)fotos=lugares();
  for(const tipo of ['tablero','exterior'])if(!principal(tipo))fotos.push({id:null,tipo,descripcion:propuesta(tipo),token:crypto.randomUUID()});
  dibujar();
  const recuperadas=fotos;
  if(recuperando)get('/api/recepcion/fotos?clave='+encodeURIComponent(clave)).then(r=>{
    if(fotos!==recuperadas)return;
    for(const f of fotos){const guardada=r.fotos.find(a=>a.token===f.token&&a.tipo===f.tipo);f.id=guardada?.id||null;if(!f.id&&f.intentada)f.carga={token:f.token,estado:'error',errTipo:'subida',error:'Esta foto no llegó al servidor. Volvé a elegirla.'};}
    recuperando=false;cambio();dibujar();
  }).catch(()=>{if(fotos!==recuperadas)return;recuperando=false;for(const f of fotos)if(f.intentada){f.id=null;f.carga={token:f.token,estado:'error',errTipo:'subida',error:'No se pudieron comprobar las fotos. Volvé a elegirlas cuando tengas conexión.'};}cambio();dibujar();});

  // Lo que falta del bloque de fotos y daños, con el mismo criterio que validar(): para el resumen y el contador.
  function pendientes(carro){
    const L=[];
    if(recuperando||fotos.some(f=>f.carga?.estado==='up'||f.nuevo?.estado==='up'))L.push({k:'fotos',msg:'Esperá a que terminen de cargar las fotos.',ir:'#p2-fotos'});
    else if(fotos.some(f=>fallida(f)&&f.tipo!=='detalle'))L.push({k:'fotos',msg:'Una foto no se cargó: reintentá o quitala.',ir:'#p2-fotos'});
    if(!deTipo('tablero').some(lista))L.push({k:'ftablero',msg:'Falta la foto del tablero (aunque no encienda).',ir:'#p2-f-tablero'});
    if(!deTipo('exterior').some(lista))L.push({k:'fexterior',msg:'Falta la foto del exterior.',ir:'#p2-f-exterior'});
    if(fotos.some(f=>f.tipo!=='detalle'&&lista(f)&&!f.descripcion.trim()))L.push({k:'fdesc',msg:'Describí qué muestra cada foto: tocala para completar el texto.',ir:'#p2-fotos'});
    if(carro==='con_danos'){
      const D=deTipo('detalle');if(!D.length)L.push({k:'danos',msg:'Agregá al menos un daño con su foto.',ir:'[data-otro-dano]'});
      D.forEach((f,i)=>{if(!f.descripcion.trim())L.push({k:'dano'+i,msg:`Describí el daño ${i+1}.`,ir:`#dano-${f.token}`});else if(!lista(f))L.push({k:'danof'+i,msg:fallida(f)?`La foto del daño ${i+1} no se cargó: reintentá o elegí otra.`:`Falta la foto del daño ${i+1}.`,ir:`#p2-df-${f.token}`});});
    }
    return L;
  }
  // Elegir archivos para un lugar (por token) o para una vista nueva, y cancelar: lo que hacen la hoja y los botones.
  const cargar=(tipo,files,token=null)=>elegir(tipo,token?fotos.find(f=>f.token===token)||null:null,files);
  return {datos,refrescar:dibujar,pendientes,cargar,cancelar:token=>cancelar(fotos.find(f=>f.token===token)),
    estado:()=>({tablero:deTipo('tablero').filter(lista).length,exterior:deTipo('exterior').filter(lista).length,detalle:deTipo('detalle').length,subiendo:fotos.filter(f=>subiendo(f)||f.nuevo?.estado==='up').length+(recuperando?1:0),fallidas:fotos.filter(fallida).map(f=>f.tipo),danosSinTexto:deTipo('detalle').filter(f=>!f.descripcion.trim()).length,danosSinFoto:deTipo('detalle').filter(f=>!lista(f)&&!subiendo(f)).length,miniaturas:fotos.filter(lista).map(f=>({src:src(f),demo:!!f.demo}))}),
    tieneFotos:()=>fotos.some(f=>f.id||f.carga||f.nuevo),
    tieneDanos:()=>deTipo('detalle').some(f=>f.descripcion.trim()||ocupa(f)),
    asegurarDano(){if(!deTipo('detalle').length){fotos.push({id:null,tipo:'detalle',descripcion:'',token:crypto.randomUUID()});cambio();}dibujar();},
    quitarDanos(){for(const f of deTipo('detalle')){liberar(f.carga);liberar(f.nuevo);}fotos=fotos.filter(f=>f.tipo!=='detalle');cambio();dibujar();},
    reiniciar(){for(const f of fotos){liberar(f.carga);liberar(f.nuevo);}fotos=lugares();ocupadas.clear();recuperando=false;cambio();dibujar();},
    validar(carroceria){
      if(recuperando||ocupadas.size)throw falla('Esperá a que termine la carga de las fotos.');
      const usar=fotos.filter(f=>f.tipo!=='detalle'||carroceria==='con_danos');
      if(usar.some(f=>!f.id))throw falla('Cargá las fotos pendientes o quitá las que no vas a usar.');
      for(const tipo of ['tablero','exterior',...(carroceria==='con_danos'?['detalle']:[])])if(!fotos.some(f=>f.tipo===tipo&&f.id))throw falla('Falta una foto de '+NOMBRES_FOTO[tipo].toLowerCase()+'.');
      if(usar.some(f=>!f.descripcion.trim()))throw falla(carroceria==='con_danos'&&fotos.some(f=>f.tipo==='detalle'&&!f.descripcion.trim())?'Escribí la ubicación y descripción de cada daño.':'Describí qué muestra cada foto.');
    }};
}

// Foto de prueba de la demostración: se dibuja en el navegador, dice que no es un auto real y lleva un número para que
// el servidor no la tome como repetida. Se sube por el mismo camino que una foto real.
function fotoDemo(tipo,n){
  const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,480);
  if(tipo==='tablero'){g.addColorStop(0,'#24272d');g.addColorStop(1,'#0d0e11');x.fillStyle=g;x.fillRect(0,0,640,480);
    [[200,240],[440,240]].forEach(([cx,cy],i)=>{x.strokeStyle='#3a3f47';x.lineWidth=12;x.beginPath();x.arc(cx,cy,110,Math.PI*.75,Math.PI*2.25);x.stroke();const a=Math.PI*(i?1.05:1.35);x.strokeStyle='#ff6a3d';x.lineWidth=5;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a)*88,cy+Math.sin(a)*88);x.stroke();});}
  else if(tipo==='detalle'){g.addColorStop(0,'#8d96a3');g.addColorStop(1,'#5f6773');x.fillStyle=g;x.fillRect(0,0,640,480);x.strokeStyle='#eef0f2';x.lineWidth=4;x.beginPath();x.moveTo(150,300);for(let i=0;i<9;i++)x.lineTo(175+i*40,290-i*12+(i%2?12:-8));x.stroke();}
  else{g.addColorStop(0,'#dfe5ea');g.addColorStop(.62,'#c7ced5');g.addColorStop(.63,'#8f969d');g.addColorStop(1,'#6e757c');x.fillStyle=g;x.fillRect(0,0,640,480);
    x.fillStyle=['#9aa3ad','#4b6584','#b8463f','#5e6b52'][n%4];x.fillRect(90,230,460,100);x.fillRect(190,165,250,80);x.fillStyle='#1b1d21';[190,450].forEach(X=>{x.beginPath();x.arc(X,335,44,0,7);x.fill();});}
  x.fillStyle='rgba(17,18,20,.65)';x.fillRect(110,14,516,42);x.fillStyle='#fff';x.font='600 20px Geist, system-ui, sans-serif';x.fillText(`Foto de prueba · no es un auto real · ${n}`,124,42);
  x.font='12px system-ui';x.fillStyle='rgba(255,255,255,.5)';x.fillText(String(Date.now()),500,466);
  return new Promise(res=>c.toBlob(b=>{const file=new File([b],`foto-de-prueba-${n}.jpg`,{type:'image/jpeg'});file.demo=true;res(file);},'image/jpeg',.82));
}

export function vistaEstadoIngreso(v) {
  const e=v.recepcion?.estadoIngreso;
  if(!e)return '<section class="bloque"><h2>Estado al ingresar</h2><p class="muted">Esta orden anterior no tiene registro fotográfico de ingreso. No se agregó información retroactiva.</p></section>';
  return `<section class="bloque estado-ingreso"><h2>Estado al ingresar</h2><p class="small muted">Registrado ${esc(fechaHora(e.registradoAt))} por ${esc(e.registradoPor)}. Se conserva el registro original.</p><dl class="resumen-kv"><div><dt>Carrocería e interior</dt><dd>${e.carroceria==='con_danos'?'Con daños previos observados':'Sin daños visibles observados'}</dd></div><div><dt>Tablero</dt><dd>${esc({sin_testigos:'Sin testigos de falla observados',con_testigos:'Con testigos encendidos',no_enciende:'No se pudo encender'}[e.tablero])}</dd></div></dl>${e.testigos?`<p><strong>Testigos / aclaración:</strong> ${esc(e.testigos)}</p>`:''}<p><strong>Observaciones al ingresar:</strong> ${esc(e.observaciones)}</p><div class="rec-fotos-lista">${e.fotos.map(f=>`<figure class="rec-foto"><a href="/api/adjuntos/${f.id}" target="_blank" rel="noopener"><img src="/api/adjuntos/${f.id}" alt="${esc(f.descripcion)}" width="320" height="200" loading="lazy"></a><figcaption><strong>${esc(NOMBRES_FOTO[f.tipo])}</strong><p>${esc(f.descripcion)}</p><small>Cargada ${esc(fechaHora(f.fecha))} · ${esc(f.por)}</small></figcaption></figure>`).join('')}</div><p class="small muted">Este registro describe lo observado al ingreso; no es un diagnóstico ni autoriza reparaciones. Las aclaraciones posteriores van en las notas del historial.</p></section>`;
}
