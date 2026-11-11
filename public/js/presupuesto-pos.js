import {esc,icono,pesos,aEntradaDinero} from './ui.js?v=0.1.0';
import {opcionesPresupuesto,categoriasPresentes,categoriaDe,normalizar} from './seleccion-rapida.js?v=0.1.0';

export function catalogoPresupuesto(cat) {
  const items=opcionesPresupuesto(cat),categorias=categoriasPresentes(items);
  return `<section class="catalogo-presupuesto bloque" aria-label="Catálogo para el presupuesto">
    <div class="fila"><h3>Elegir del catálogo</h3><button class="btn btn-chico" type="button" data-combinar aria-pressed="false">${icono('lista')}Combinar servicios</button></div>
    <div class="buscador">${icono('buscar')}<label for="pre-catalogo-q" class="sr">Buscar en el catálogo</label><input type="search" id="pre-catalogo-q" placeholder="Buscar servicio, tiempo o repuesto" autocomplete="off"></div>
    <div class="categorias-pos" aria-label="Categorías del presupuesto"><button type="button" class="categoria-pos" data-pre-categoria="todos" aria-pressed="true">${icono('lista')}Todos</button>${categorias.map(c=>`<button type="button" class="categoria-pos" data-pre-categoria="${c.id}" aria-pressed="false">${icono(c.icono)}${c.nombre}</button>`).join('')}</div>
    <p data-combinar-ayuda class="small muted" hidden>Elegí servicios para agregarlos juntos. Las líneas quedan editables; el presupuesto todavía no se guarda ni se autoriza.</p>
    <div class="catalogo-pos" data-pre-items>${items.map(x=>`<article class="catalogo-item" data-pre-item="${x.clave}" data-categoria="${categoriaDe(x.nombre).id}" data-fuente="${x.clave.split('-')[0]}" data-texto="${esc(normalizar(x.nombre+' '+x.fuente))}">
      <span class="catalogo-item__icono">${icono(categoriaDe(x.nombre).icono)}</span><div class="catalogo-item__datos"><strong>${esc(x.nombre)}</strong><small>${esc(x.fuente)}</small><span class="num">${x.precio==null?'Completar precio':pesos(Math.round(x.precio*Number(x.cantidad.replace(',','.'))))}${x.unidad==='h'?` <small>· ${esc(x.cantidad)} h × ${x.precio==null?'tarifa pendiente':pesos(x.precio)}</small>`:''}</span></div>
      <button class="btn btn-chico" type="button" data-pre-agregar="${x.clave}" aria-label="Agregar ${esc(x.nombre)}">${icono('mas')}Agregar</button>${x.clave.startsWith('servicio-')?`<label class="catalogo-eleccion" hidden><input type="checkbox" data-pre-seleccionar="${x.clave}"><span>Elegir ${esc(x.nombre)}</span></label>`:''}</article>`).join('')}</div>
    <div data-pre-vacio ${items.length?'hidden':''}><p class="small muted">${items.length?'Sin coincidencias para estos filtros.':'El taller todavía no tiene servicios, tiempos ni repuestos configurados. Usá las líneas manuales de abajo.'}</p>${items.length?'<button type="button" class="enlace small" data-pre-limpiar>Ver catálogo sin filtros</button>':''}</div>
    <div data-combinar-pie class="combinacion-pie" hidden><div><span data-combinar-cantidad class="small" tabindex="-1" aria-live="polite">0 servicios elegidos</span><ul data-combinar-nombres class="seleccion-pos"></ul></div><button class="btn btn-oscuro" type="button" data-pre-lote disabled>Agregar selección</button></div>
    <p data-pre-estado class="small muted" role="status">Elegir agrega al borrador. Guardar y autorizar son pasos separados.</p>
  </section>`;
}

export function enlazarCatalogoPresupuesto(f,cat,agregar) {
  const items=opcionesPresupuesto(cat),box=f.querySelector('.catalogo-presupuesto'),q=box.querySelector('#pre-catalogo-q');
  let categoria='todos',combinando=false,ocupado=false;
  const filtrar=()=>{
    let n=0;const texto=normalizar(q.value.trim());
    box.querySelectorAll('[data-pre-item]').forEach(el=>{el.hidden=(combinando&&el.dataset.fuente!=='servicio')||(categoria!=='todos'&&categoria!==el.dataset.categoria)||(texto&&!el.dataset.texto.includes(texto));if(!el.hidden)n++;});
    box.querySelector('[data-pre-vacio]').hidden=n>0;
  };
  const seleccion=()=>[...box.querySelectorAll('[data-pre-seleccionar]:checked')].map(c=>items.find(x=>x.clave===c.dataset.preSeleccionar));
  const contar=()=>{const elegidos=seleccion(),n=elegidos.length;box.querySelector('[data-combinar-cantidad]').textContent=`${n} servicio${n===1?'':'s'} elegido${n===1?'':'s'}`;box.querySelector('[data-pre-lote]').disabled=!n||ocupado;const lista=box.querySelector('[data-combinar-nombres]');lista.innerHTML=elegidos.map(x=>`<li><span>${esc(x.nombre)}</span><button type="button" class="enlace" data-pre-desmarcar="${x.clave}" aria-label="Quitar ${esc(x.nombre)} de la selección">${icono('x')}</button></li>`).join('');lista.querySelectorAll('[data-pre-desmarcar]').forEach(b=>b.onclick=()=>{const c=box.querySelector(`[data-pre-seleccionar="${b.dataset.preDesmarcar}"]`);c.checked=false;contar();box.querySelector('[data-combinar-cantidad]').focus();});};
  const insertar=async elegidos=>{
    if(ocupado)return;ocupado=true;contar();
    try{
      const ok=await agregar(elegidos.map(x=>({...x,descripcion:x.nombre,precio:x.precio==null?'':aEntradaDinero(x.precio)})));
      if(ok){box.querySelectorAll('[data-pre-seleccionar]').forEach(c=>{c.checked=false;});box.querySelector('[data-pre-estado]').textContent=`${elegidos.length} línea${elegidos.length===1?'':'s'} agregada${elegidos.length===1?'':'s'} al borrador.${elegidos.some(x=>x.precio==null)?' Falta completar un precio.':''} Revisá antes de guardar.`;}
    }finally{ocupado=false;contar();}
  };
  q.oninput=filtrar;
  box.querySelector('[data-pre-limpiar]')?.addEventListener('click',()=>{q.value='';categoria='todos';box.querySelectorAll('[data-pre-categoria]').forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.preCategoria==='todos')));filtrar();q.focus();});
  box.querySelectorAll('[data-pre-categoria]').forEach(b=>b.onclick=()=>{categoria=b.dataset.preCategoria;box.querySelectorAll('[data-pre-categoria]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));filtrar();});
  box.querySelector('[data-combinar]').onclick=e=>{combinando=!combinando;e.currentTarget.setAttribute('aria-pressed',String(combinando));box.querySelector('[data-combinar-ayuda]').hidden=!combinando;box.querySelector('[data-combinar-pie]').hidden=!combinando;box.querySelectorAll('.catalogo-eleccion').forEach(c=>{c.hidden=!combinando;});box.querySelectorAll('[data-pre-agregar]').forEach(c=>{c.hidden=combinando;});filtrar();};
  box.querySelectorAll('[data-pre-seleccionar]').forEach(c=>c.onchange=contar);
  box.querySelectorAll('[data-pre-agregar]').forEach(b=>b.onclick=()=>insertar([items.find(x=>x.clave===b.dataset.preAgregar)]));
  box.querySelector('[data-pre-lote]').onclick=()=>insertar(seleccion());
}
