import {api,get} from './api.js?v=0.1.0';
import {esc,fechaHora} from './ui.js?v=0.1.0';

export const NOMBRES_FOTO={tablero:'Tablero',exterior:'Exterior',detalle:'Detalle de daño previo'};
const falla=mensaje=>Object.assign(new Error(mensaje),{campo:'fotosIngreso'});

// Los originales van al almacenamiento privado; el borrador guarda referencias, nunca fotos en sessionStorage.
export function enlazarFotosIngreso(box,{clave,inicial=[],guardar}) {
  let fotos=inicial.map(f=>({id:f.id||null,tipo:f.tipo,descripcion:f.descripcion||'',token:f.token||crypto.randomUUID(),intentada:!!f.intentada||!!f.id}));
  const archivos=new Map(),ocupadas=new Set();
  let recuperando=!!fotos.length;
  const datos=()=>fotos.map(({id,tipo,descripcion,token,intentada})=>({id,tipo,descripcion,token,...(intentada?{intentada:true}:{})}));
  const cambio=()=>{if(box.isConnected)guardar();};
  const dibujar=()=>{
    if(!box.isConnected)return;
    box.innerHTML=`<p class="small muted">Mínimo: tablero legible y vista del exterior. Fotografíá de cerca cada daño previo. JPG, PNG o WEBP, hasta 15 MB por foto; se conserva el archivo original.</p><div class="rec-fotos-lista">${fotos.map(f=>`<article class="rec-foto" data-foto="${f.token}"><h3>${esc(NOMBRES_FOTO[f.tipo])}</h3>${f.id?`<a href="/api/adjuntos/${f.id}" target="_blank" rel="noopener"><img src="/api/adjuntos/${f.id}" alt="${esc(f.descripcion||NOMBRES_FOTO[f.tipo])}" width="320" height="200"></a>`:''}<label class="campo"><span>Qué muestra esta foto</span><input data-descripcion maxlength="300" value="${esc(f.descripcion)}" placeholder="Ej.: rayón en puerta delantera derecha"></label><label class="campo"><span>${f.id?'Reemplazar foto':'Tomar o elegir foto'}</span><input type="file" data-archivo accept="image/jpeg,image/png,image/webp" ${ocupadas.has(f.token)||recuperando?'disabled':''}></label><p class="small" role="status" data-foto-estado>${ocupadas.has(f.token)?'Subiendo foto…':f.id?'Foto guardada en privado · pendiente de recibir el auto.':f.error?esc(f.error):recuperando?'Comprobando foto guardada…':'Falta cargar esta foto.'}</p>${archivos.has(f.token)&&!ocupadas.has(f.token)?'<button type="button" class="btn btn-chico" data-reintentar>Reintentar subir</button>':''}<button type="button" class="btn btn-chico btn-texto" data-quitar ${ocupadas.has(f.token)||recuperando?'disabled':''}>Quitar esta foto</button></article>`).join('')}</div><div class="acciones"><button type="button" class="btn" data-agregar="tablero">Agregar tablero</button><button type="button" class="btn" data-agregar="exterior">Agregar exterior</button><button type="button" class="btn" data-agregar="detalle">Agregar detalle de daño</button></div><p class="small muted">Tomalas antes de mover el auto. Para cubrir el exterior, agregá vistas del frente, atrás y ambos laterales.</p>`;
    box.querySelectorAll('[data-foto]').forEach(row=>{
      const f=fotos.find(f=>f.token===row.dataset.foto);
      row.querySelector('[data-descripcion]').oninput=e=>{f.descripcion=e.target.value;cambio();};
      row.querySelector('[data-archivo]').onchange=e=>{
        const file=e.target.files[0];if(!file)return;
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024||!file.size){f.error='Elegí una foto JPG, PNG o WEBP de hasta 15 MB.';dibujar();return;}
        // Una nueva selección es una carga nueva, incluso si la anterior perdió su respuesta.
        archivos.delete(f.token);f.token=crypto.randomUUID();f.id=null;f.intentada=true;f.error='';archivos.set(f.token,file);cambio();subir(f);
      };
      row.querySelector('[data-quitar]').onclick=()=>{fotos=fotos.filter(x=>x!==f);archivos.delete(f.token);cambio();dibujar();box.querySelector('[data-agregar]')?.focus();};
      row.querySelector('[data-reintentar]')?.addEventListener('click',()=>subir(f));
    });
    box.querySelectorAll('[data-agregar]').forEach(b=>b.onclick=()=>{
      if(fotos.length>=12){box.querySelector('[data-foto-estado]')?.focus();return;}
      const tipo=b.dataset.agregar;fotos.push({id:null,tipo,descripcion:tipo==='tablero'?'Tablero al ingresar':tipo==='exterior'?'Vista exterior al ingresar':'',token:crypto.randomUUID()});cambio();dibujar();box.querySelector('.rec-foto:last-child input')?.focus();
    });
    box.querySelectorAll('[data-agregar]').forEach(b=>b.disabled=fotos.length>=12||recuperando);
  };
  const subir=async f=>{
    if(ocupadas.has(f.token)||!archivos.has(f.token))return;
    const token=f.token;ocupadas.add(token);f.error='';dibujar();
    try{
      const file=archivos.get(token);
      const r=await api('POST',`/api/recepcion/fotos?clave=${encodeURIComponent(clave)}&tipo=${f.tipo}&token=${token}`,undefined,{archivo:file,idempotencia:token,cabeceras:{'X-Nombre-Archivo':encodeURIComponent(file.name)}});
      f.id=r.id;archivos.delete(token);
    }catch(e){f.error=e.message;}finally{ocupadas.delete(token);if(fotos.includes(f)){cambio();dibujar();}}
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
