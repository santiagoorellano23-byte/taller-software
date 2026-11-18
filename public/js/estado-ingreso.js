import {api,get} from './api.js?v=0.1.0';
import {esc,fechaHora} from './ui.js?v=0.1.0';
import {ic} from './diseno.js?v=0.1.0';

export const NOMBRES_FOTO={tablero:'Tablero',exterior:'Exterior',detalle:'Detalle de daño previo'};
const falla=mensaje=>Object.assign(new Error(mensaje),{campo:'fotosIngreso'});

// Los originales van al almacenamiento privado; el borrador guarda referencias, nunca fotos en sessionStorage.
export function enlazarFotosIngreso(box,{clave,inicial=[],guardar}) {
  let fotos=inicial.map(f=>({id:f.id||null,tipo:f.tipo,descripcion:f.descripcion||'',token:f.token||crypto.randomUUID(),intentada:!!f.intentada||!!f.id}));
  const archivos=new Map(),ocupadas=new Set();
  let recuperando=!!fotos.length;
  const datos=()=>fotos.map(({id,tipo,descripcion,token,intentada})=>({id,tipo,descripcion,token,...(intentada?{intentada:true}:{})}));
  const cambio=()=>{if(box.isConnected)guardar();};
  // Estado visible de cada foto: elegida y subiendo, guardada, con error (con reintento) o pendiente.
  const estadoFoto=f=>ocupadas.has(f.token)?['cargando',f.previo?'Subiendo el reemplazo… la foto anterior sigue guardada':'Subiendo foto…']:f.error?['error',f.error+(f.id&&archivos.has(f.token)?' Se conserva la foto anterior.':'')]:f.id?['ok','Guardada en privado · pendiente de recibir el auto']:recuperando?['cargando','Comprobando foto guardada…']:['falta','Falta cargar esta foto'];
  const dibujar=()=>{
    if(!box.isConnected)return;
    const tipos=['tablero','exterior','detalle'];
    box.innerHTML=`<p class="nota">Mínimo: tablero legible y vista del exterior. Fotografiá de cerca cada daño previo. JPG, PNG o WEBP, hasta 15 MB por foto; se conserva el archivo original.</p>
      <div class="fotos-acc fila">${tipos.map(tipo=>{const lista=fotos.filter(f=>f.tipo===tipo);return `<section class="slot ${lista.some(f=>f.id)?'lleno':''} ${lista.some(f=>f.error)?'error':''}" aria-label="${esc(NOMBRES_FOTO[tipo])}"><div class="slot-h"><b>${esc(NOMBRES_FOTO[tipo])}</b>${tipo==='detalle'?'<span class="chip">Si hay daños</span>':`<span class="chip ${lista.some(f=>f.id)?'ok':'warn'}">${lista.some(f=>f.id)?'Cargada':'Obligatoria'}</span>`}</div>
        ${lista.map(f=>{const [estado,texto]=estadoFoto(f),ver=f.id||f.previo;return `<article class="rec-foto ft-f" data-foto="${f.token}">
          <div class="slot-f"><label class="ft ${estado==='cargando'?'cargando':''}">${ver?`<img src="/api/adjuntos/${ver}" alt="${esc(f.descripcion||NOMBRES_FOTO[f.tipo])}" width="76" height="76">`:`<span class="ft-add">${ic('add_a_photo')}<span>${f.error?'Volver a elegir':'Tomar o elegir'}</span></span>`}${estado==='cargando'?'<span class="ft-carga" aria-hidden="true"></span>':''}${f.id?`<span class="ft-ok" aria-hidden="true">${ic('check')}</span>`:''}<input type="file" class="sr" data-archivo accept="image/jpeg,image/png,image/webp" aria-label="${f.id||f.previo?'Reemplazar':'Tomar o elegir'} foto de ${esc(NOMBRES_FOTO[f.tipo].toLowerCase())}" ${ocupadas.has(f.token)||recuperando?'disabled':''}></label>
            <div class="ft-datos"><label class="campo"><span class="sr">Qué muestra esta foto</span><input type="text" data-descripcion maxlength="300" value="${esc(f.descripcion)}" placeholder="Qué muestra: ej. rayón en puerta derecha"></label>
              <p class="ft-estado ${estado}" role="status" data-foto-estado>${ic(estado==='ok'?'task_alt':estado==='error'?'error':estado==='cargando'?'hourglass_top':'photo_camera')}<span>${esc(texto)}</span></p>
              <div class="acciones">${archivos.has(f.token)&&!ocupadas.has(f.token)?`<button type="button" class="btn btn-chico" data-reintentar>${ic('refresh')}Reintentar</button>`:''}${f.id?`<a class="btn btn-chico btn-texto" href="/api/adjuntos/${f.id}" target="_blank" rel="noopener">${ic('zoom_in')}Ver</a>`:''}<button type="button" class="btn btn-chico btn-texto" data-quitar ${ocupadas.has(f.token)||recuperando?'disabled':''}>${ic('delete')}Quitar</button></div></div></div></article>`;}).join('')}
        <button type="button" class="btn btn-chico btn-texto" data-agregar="${tipo}">${ic('add')}${tipo==='detalle'?'Agregar detalle de daño':tipo==='tablero'?'Otra foto del tablero':'Otra vista del exterior'}</button></section>`;}).join('')}</div>
      <p class="nota">${ic('info')}Tomalas antes de mover el auto. Para cubrir el exterior, agregá vistas del frente, atrás y ambos laterales.</p>`;
    box.querySelectorAll('[data-foto]').forEach(row=>{
      const f=fotos.find(f=>f.token===row.dataset.foto);
      row.querySelector('[data-descripcion]').oninput=e=>{f.descripcion=e.target.value;cambio();};
      row.querySelector('[data-archivo]').onchange=e=>{
        const file=e.target.files[0];if(!file)return;
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024||!file.size){f.error='Elegí una foto JPG, PNG o WEBP de hasta 15 MB.';dibujar();return;}
        // Una nueva selección es una carga nueva. La foto anterior se conserva hasta que el reemplazo llegue al servidor.
        archivos.delete(f.token);if(f.id)f.previo=f.id;f.token=crypto.randomUUID();f.id=null;f.intentada=true;f.error='';archivos.set(f.token,file);cambio();subir(f);
      };
      row.querySelector('[data-quitar]').onclick=()=>{fotos=fotos.filter(x=>x!==f);archivos.delete(f.token);cambio();dibujar();box.querySelector('[data-agregar]')?.focus();};
      row.querySelector('[data-reintentar]')?.addEventListener('click',()=>subir(f));
    });
    box.querySelectorAll('[data-agregar]').forEach(b=>b.onclick=()=>{
      if(fotos.length>=12){box.querySelector('[data-foto-estado]')?.focus();return;}
      const tipo=b.dataset.agregar;fotos.push({id:null,tipo,descripcion:tipo==='tablero'?'Tablero al ingresar':tipo==='exterior'?'Vista exterior al ingresar':'',token:crypto.randomUUID()});cambio();dibujar();box.querySelector(`[data-foto="${fotos.at(-1).token}"] [data-descripcion]`)?.focus();
    });
    box.querySelectorAll('[data-agregar]').forEach(b=>b.disabled=fotos.length>=12||recuperando);
  };
  const subir=async f=>{
    if(ocupadas.has(f.token)||!archivos.has(f.token))return;
    const token=f.token;ocupadas.add(token);f.error='';dibujar();
    try{
      const file=archivos.get(token);
      const r=await api('POST',`/api/recepcion/fotos?clave=${encodeURIComponent(clave)}&tipo=${f.tipo}&token=${token}`,undefined,{archivo:file,idempotencia:token,cabeceras:{'X-Nombre-Archivo':encodeURIComponent(file.name)}});
      // Una respuesta tardía solo vale para la carga que la pidió: si la foto se quitó o se eligió otra, se descarta.
      if(fotos.includes(f)&&f.token===token){f.id=r.id;f.previo=null;}
      archivos.delete(token);
    }catch(e){if(f.token===token){f.error=e.message;if(f.previo){f.id=f.previo;f.previo=null;}}}finally{ocupadas.delete(token);if(fotos.includes(f)){cambio();dibujar();}}
  };
  if(!fotos.length)for(const tipo of ['tablero','exterior'])fotos.push({id:null,tipo,descripcion:tipo==='tablero'?'Tablero al ingresar':'Vista exterior al ingresar',token:crypto.randomUUID()});
  dibujar();
  const recuperadas=fotos;
  if(recuperando)get('/api/recepcion/fotos?clave='+encodeURIComponent(clave)).then(r=>{
    if(fotos!==recuperadas)return;
    for(const f of fotos){const guardada=r.fotos.find(a=>a.token===f.token&&a.tipo===f.tipo);f.id=guardada?.id||null;if(!f.id&&f.intentada)f.error='Esta foto no llegó al servidor. Volvé a elegirla.';}
    recuperando=false;cambio();dibujar();
  }).catch(()=>{if(fotos!==recuperadas)return;recuperando=false;for(const f of fotos){f.id=null;f.error='No se pudieron comprobar las fotos. Volvé a elegirlas cuando tengas conexión.';}cambio();dibujar();});
  return {datos,tieneFotos:()=>fotos.some(f=>f.id)||archivos.size>0||ocupadas.size>0,reiniciar(){fotos=['tablero','exterior'].map(tipo=>({id:null,tipo,descripcion:tipo==='tablero'?'Tablero al ingresar':'Vista exterior al ingresar',token:crypto.randomUUID()}));archivos.clear();ocupadas.clear();recuperando=false;cambio();dibujar();},validar(carroceria){
    if(recuperando||ocupadas.size)throw falla('Esperá a que termine la carga de las fotos.');
    if(fotos.some(f=>!f.id))throw falla('Cargá las fotos pendientes o quitá las que no vas a usar.');
    for(const tipo of ['tablero','exterior',...(carroceria==='con_danos'?['detalle']:[])])if(!fotos.some(f=>f.tipo===tipo&&f.id))throw falla('Falta una foto de '+NOMBRES_FOTO[tipo].toLowerCase()+'.');
    if(fotos.some(f=>!f.descripcion.trim()))throw falla('Describí qué muestra cada foto.');
  }};
}

export function vistaEstadoIngreso(v) {
  const e=v.recepcion?.estadoIngreso;
  if(!e)return '<section class="bloque"><h2>Estado al ingresar</h2><p class="muted">Esta orden anterior no tiene registro fotográfico de ingreso. No se agregó información retroactiva.</p></section>';
  return `<section class="bloque estado-ingreso"><h2>Estado al ingresar</h2><p class="small muted">Registrado ${esc(fechaHora(e.registradoAt))} por ${esc(e.registradoPor)}. Se conserva el registro original.</p><dl class="resumen-kv"><div><dt>Carrocería e interior</dt><dd>${e.carroceria==='con_danos'?'Con daños previos observados':'Sin daños visibles observados'}</dd></div><div><dt>Tablero</dt><dd>${esc({sin_testigos:'Sin testigos de falla observados',con_testigos:'Con testigos encendidos',no_enciende:'No se pudo encender'}[e.tablero])}</dd></div></dl>${e.testigos?`<p><strong>Testigos / aclaración:</strong> ${esc(e.testigos)}</p>`:''}<p><strong>Observaciones al ingresar:</strong> ${esc(e.observaciones)}</p><div class="rec-fotos-lista">${e.fotos.map(f=>`<figure class="rec-foto"><a href="/api/adjuntos/${f.id}" target="_blank" rel="noopener"><img src="/api/adjuntos/${f.id}" alt="${esc(f.descripcion)}" width="320" height="200" loading="lazy"></a><figcaption><strong>${esc(NOMBRES_FOTO[f.tipo])}</strong><p>${esc(f.descripcion)}</p><small>Cargada ${esc(fechaHora(f.fecha))} · ${esc(f.por)}</small></figcaption></figure>`).join('')}</div><p class="small muted">Este registro describe lo observado al ingreso; no es un diagnóstico ni autoriza reparaciones. Las aclaraciones posteriores van en las notas del historial.</p></section>`;
}
