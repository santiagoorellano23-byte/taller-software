// Mostrador: ventas sin visita. El stock se descuenta una vez; anular o devolver corrige stock y dinero con movimientos.
import { get, post } from '../api.js?v=0.1.0';
import {entrada} from '../movimiento.js?v=0.1.0';
import {categoriaDe,categoriasPresentes,normalizar} from '../seleccion-rapida.js?v=0.1.0';
import { esc, icono, pesos, cant, fecha, fechaHora, chip, campo, alEnviar, toast, confirmar, aviso, MEDIOS, aEntradaDinero, numeroEntrada, revisarPago } from '../ui.js?v=0.1.0';

export default async function mostrador({ params, app, query }) {
  if(params.id)return detalle(params.id,app);
  const [{ventas},{articulos}]=await Promise.all([get('/api/ventas'),get('/api/articulos')]);
  const activos=articulos.filter(a=>a.activo),categorias=categoriasPresentes(activos);
  const vendidos=new Map();
  ventas.filter(v=>v.estado!=='anulada').forEach(v=>v.lineas.forEach(l=>{if(l.articulo_id&&l.cantidad_m>l.devuelto_m)vendidos.set(l.articulo_id,(vendidos.get(l.articulo_id)||0)+1);}));
  const frecuentes=new Set([...vendidos].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id])=>id));
  const clave=crypto.randomUUID?crypto.randomUUID():String(Date.now());
  return {titulo:'Mostrador',html:`<div class="pagina">
    <div class="cab"><div><h1 tabindex="-1">Mostrador</h1><p class="small muted">Repuestos sin orden de trabajo · comprobante interno</p></div><button class="btn btn-texto" data-ayuda="venta">${icono('ayuda')}Ayuda</button></div>
    <form class="pos-form" id="f-venta" novalidate data-clave="${clave}">
      <div class="pos-mobile-tabs" role="group" aria-label="Mostrador"><button class="btn" type="button" data-pos-panel="articulos" aria-pressed="true">Artículos</button><button class="btn" type="button" data-pos-panel="venta" aria-pressed="false" data-pos-venta>Venta · 0</button></div><div class="pos-catalogo">
        <div class="buscador">${icono('buscar')}<label class="sr" for="pos-q">Buscar artículo</label><input id="pos-q" type="search" placeholder="Buscar nombre, marca o código" autocomplete="off"></div>
        <div class="categorias-pos" aria-label="Categorías de artículos"><button class="categoria-pos" type="button" data-pos-categoria="todos" aria-pressed="true">${icono('lista')}Todos</button>${categorias.map(c=>`<button class="categoria-pos" type="button" data-pos-categoria="${c.id}" aria-pressed="false">${icono(c.icono)}${c.nombre}</button>`).join('')}<button class="categoria-pos" type="button" data-pos-categoria="frecuentes" aria-pressed="false">${icono('historial')}Frecuentes</button></div>
        <div class="fila"><span class="small muted" data-pos-resultados>${activos.length} artículos</span><div class="acciones" role="group" aria-label="Vista del catálogo"><button class="btn btn-texto btn-chico" type="button" data-pos-vista="grilla" aria-pressed="true">Grilla</button><button class="btn btn-texto btn-chico" type="button" data-pos-vista="lista" aria-pressed="false">Lista</button></div></div>
        <div class="pos-productos pos-productos--visual" data-vista="grilla" data-productos>${activos.map(a=>`<button type="button" class="pos-producto" data-agregar="${a.id}" ${a.disponible<=0?'disabled aria-disabled="true"':''} data-categoria="${categoriaDe(a.nombre).id}" data-frecuente="${frecuentes.has(a.id)?'1':''}" data-texto="${esc(normalizar([a.nombre,a.marca,a.codigo].filter(Boolean).join(' ')))}"><span class="pos-producto__icono">${icono(categoriaDe(a.nombre).icono)}</span><span class="pos-producto__datos"><strong>${esc(a.nombre)}</strong><span class="small">${esc([a.marca,a.codigo].filter(Boolean).join(' · ')||'Sin código')}${a.disponible<=0?' · Sin disponibilidad':` · ${cant(a.disponible,a.unidad)} disponibles`}</span></span><span class="pos-precio">${a.precio_venta==null?'Completar precio':pesos(a.precio_venta)}</span><span class="pos-producto__agregar" aria-hidden="true">${icono('mas')}Agregar</span></button>`).join('')||'<p class="panel__cuerpo muted">No hay artículos cargados. Podés vender una línea manual.</p>'}</div>
        <p data-no-productos class="muted small" hidden>No hay coincidencias. Probá otro nombre o agregá una línea manual.</p>
        <p class="small muted">Los iconos identifican categorías. Frecuentes usa artículos vendidos en las últimas ${ventas.length} ventas, excluyendo anulaciones y devoluciones completas.</p>
        <details class="mas"><summary>Agregar un artículo o servicio manual</summary><div class="mas__cuerpo bloque"><div class="fila-campos">${campo({nombre:'manualDetalle',etiqueta:'Detalle'})}${campo({nombre:'manualPrecio',etiqueta:'Precio unitario',attrs:'inputmode="decimal"'})}</div><button class="btn" type="button" data-manual>Agregar a la venta</button><p class="small muted" data-manual-error role="alert">La línea manual no descuenta artículos del inventario.</p></div></details>
      </div>
      <aside class="pos-resumen" aria-label="Resumen de venta"><div class="fila"><h2>Venta en preparación</h2><span class="muted small" data-n-lineas>0 líneas</span></div>
        <div class="pos-carrito" data-lineas><p class="small muted" data-carrito-vacio>Elegí artículos de la lista para comenzar.</p></div>
        <div class="fila-campos">${campo({nombre:'cliente',etiqueta:'Cliente',placeholder:'Buscar o escribir un nombre',attrs:'list="dl-clientes"',ayuda:'Necesario si queda saldo.'})}</div><datalist id="dl-clientes"></datalist><input type="hidden" name="contactoId">
        <details class="mas"><summary>Teléfono del cliente nuevo</summary><div class="mas__cuerpo">${campo({nombre:'telefono',etiqueta:'Teléfono',tipo:'tel'})}</div></details>
        <div class="fila-campos">${campo({nombre:'cobroImporte',etiqueta:'Cobrado ahora',attrs:'inputmode="decimal"',placeholder:'0'})}${campo({nombre:'cobroMedio',etiqueta:'Medio de pago',tipo:'select',opciones:[['','Elegí si cobrás ahora'],...Object.entries(MEDIOS)]})}</div>
        <details class="mas"><summary>Referencia del pago</summary><div class="mas__cuerpo">${campo({nombre:'cobroReferencia',etiqueta:'Referencia'})}</div></details>
        <div data-total><strong>Total $0</strong><span class="small muted">Todavía sin registrar</span></div>
        <button class="btn btn-primario" type="submit">Revisar y registrar venta</button><p class="small muted">Se descuenta stock al confirmar. Sin validez fiscal.</p>
      </aside>
    </form>
    <details class="mas"><summary>Ventas recientes (${ventas.length})</summary><div class="mas__cuerpo">${ventas.length?`<ul class="lista">${ventas.map(v=>`<li><a class="fila" href="#/mostrador/${v.id}"><span><strong>Venta N.º ${esc(v.numero)}</strong> · ${esc(v.contacto?.nombre||v.cliente_nombre)}<br><span class="small muted">${esc(fecha(v.fecha))}</span></span><span class="num">${pesos(v.total)}${v.estado==='anulada'?' · Anulada':v.saldo?' · Saldo '+pesos(v.saldo):' · Cobrada'}</span></a></li>`).join('')}</ul>`:'<p class="muted">Sin ventas registradas.</p>'}</div></details>
  </div>`,despues(raiz){
    const f=raiz.querySelector('#f-venta'),cont=f.querySelector('[data-lineas]');
    const mostrarPanel=panel=>{f.dataset.panel=panel;f.querySelectorAll('[data-pos-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.posPanel===panel)));};
    mostrarPanel('articulos');f.querySelectorAll('[data-pos-panel]').forEach(b=>b.onclick=()=>mostrarPanel(b.dataset.posPanel));
    const leer=()=>[...cont.querySelectorAll('[data-linea]')].map(x=>({articuloId:x.dataset.articulo||'',descripcion:x.dataset.descripcion,cantidad:x.querySelector('[name=cantidad]').value,precio:x.querySelector('[name=precio]').value}));
    const total=()=>{
      const lineas=leer();const t=lineas.reduce((n,l)=>n+Math.round(Math.round((numeroEntrada(l.cantidad)||0)*1000)*Math.round((numeroEntrada(l.precio)||0)*100)/1000),0);
      const pagado=Math.round((numeroEntrada(f.elements.cobroImporte.value)||0)*100);
      f.querySelector('[data-total]').innerHTML=`<div class="fila"><span>Total</span><strong class="num">${pesos(t)}</strong></div><div class="fila small"><span>Cobrado ahora</span><span class="num">${pesos(pagado)}</span></div><div class="fila small"><span>${pagado>t?'Pago a revisar':'Saldo pendiente'}</span><strong class="num">${pesos(Math.max(0,t-pagado))}</strong></div>`;
      f.querySelector('[data-n-lineas]').textContent=`${lineas.length} línea${lineas.length===1?'':'s'}`;f.querySelector('[data-pos-venta]').textContent=`Venta · ${lineas.length} · ${pesos(t)}`;return {t,pagado};
    };
    const agregar=(a,manual)=>{
      const existente=a?[...cont.querySelectorAll('[data-linea]')].find(x=>x.dataset.articulo===String(a.id)):null;
      if(existente){const q=existente.querySelector('[name=cantidad]');q.value=String((numeroEntrada(q.value)||0)+1).replace('.',',');total();f.dataset.sucio='1';return;}
      cont.querySelector('[data-carrito-vacio]')?.remove();const nombre=a?.nombre||manual.detalle;
      cont.insertAdjacentHTML('beforeend',`<div class="pos-linea" data-linea data-articulo="${a?.id||''}" data-descripcion="${esc(nombre)}"><h3>${esc(nombre)}</h3><div class="fila-campos">${campo({nombre:'cantidad',etiqueta:a?.unidad?`Cant. (${a.unidad})`:'Cantidad',valor:'1',attrs:'inputmode="decimal"'})}${campo({nombre:'precio',etiqueta:'Precio unitario',valor:a?aEntradaDinero(a.precio_venta):manual.precio,attrs:'inputmode="decimal"'})}<button class="btn btn-texto" type="button" data-quitar aria-label="Quitar ${esc(nombre)}">${icono('x')}</button></div></div>`);
      const fila=cont.lastElementChild;fila.querySelector('[data-quitar]').onclick=()=>{fila.remove();total();f.dataset.sucio='1';if(!cont.children.length)cont.innerHTML='<p class="small muted" data-carrito-vacio>Elegí artículos de la lista para comenzar.</p>';};
      total();f.dataset.sucio='1';
      entrada(fila.querySelector('h3'));
    };
    f.querySelectorAll('[data-agregar]').forEach(b=>b.onclick=()=>agregar(activos.find(a=>a.id===Number(b.dataset.agregar))));
    f.querySelector('[data-manual]').onclick=()=>{const detalle=f.elements.manualDetalle.value.trim(),precio=f.elements.manualPrecio.value;if(!detalle||!Number.isFinite(numeroEntrada(precio))||numeroEntrada(precio)<=0){f.querySelector('[data-manual-error]').textContent='Completá el detalle y un precio mayor a cero.';return;}agregar(null,{detalle,precio});f.elements.manualDetalle.value='';f.elements.manualPrecio.value='';};
    let categoria='todos';const productos=f.querySelector('[data-productos]');
    const filtrar=()=>{const q=normalizar(f.querySelector('#pos-q').value.trim());let n=0;f.querySelectorAll('[data-agregar]').forEach(b=>{b.hidden=(!!q&&!b.dataset.texto.includes(q))||(categoria==='frecuentes'?!b.dataset.frecuente:categoria!=='todos'&&categoria!==b.dataset.categoria);if(!b.hidden)n++;});f.querySelector('[data-pos-resultados]').textContent=`${n} artículo${n===1?'':'s'}`;const vacio=f.querySelector('[data-no-productos]');vacio.hidden=n>0||!activos.length;vacio.textContent=categoria==='frecuentes'&&!frecuentes.size?'Todavía no hay ventas de artículos para mostrar frecuentes. Elegí otra categoría.':'No hay coincidencias para estos filtros. Probá otro nombre o agregá una línea manual.';};
    f.querySelector('#pos-q').addEventListener('input',filtrar);
    f.querySelectorAll('[data-pos-categoria]').forEach(b=>b.onclick=()=>{categoria=b.dataset.posCategoria;f.querySelectorAll('[data-pos-categoria]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));filtrar();});
    f.querySelectorAll('[data-pos-vista]').forEach(b=>b.onclick=()=>{productos.dataset.vista=b.dataset.posVista;f.querySelectorAll('[data-pos-vista]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));});
    f.addEventListener('input',total);f.addEventListener('change',total);
    const cli=f.elements.cliente,dl=f.querySelector('#dl-clientes');let mapa=new Map(),timer,consulta=0;
    cli.addEventListener('input',()=>{clearTimeout(timer);f.elements.contactoId.value=mapa.get(cli.value)||'';const n=++consulta;timer=setTimeout(async()=>{if(cli.value.trim().length<2)return;try{const r=await get('/api/contactos?q='+encodeURIComponent(cli.value));if(n!==consulta)return;mapa=new Map(r.contactos.map(c=>[`${c.nombre}${c.telefono?' · '+c.telefono:''}`,c.id]));dl.innerHTML=[...mapa.keys()].map(k=>`<option value="${esc(k)}">`).join('');f.elements.contactoId.value=mapa.get(cli.value)||'';}catch{dl.innerHTML='';}},220);});
    alEnviar(f,async d=>{
      const lineas=leer();if(!lineas.length)throw new Error('Agregá al menos un artículo a la venta.');
      for(const l of lineas)if(!Number.isFinite(numeroEntrada(l.cantidad))||numeroEntrada(l.cantidad)<=0||!Number.isFinite(numeroEntrada(l.precio))||numeroEntrada(l.precio)<=0)throw new Error('Revisá la cantidad y el precio de cada línea.');
      const {t,pagado}=total();if(d.cobroImporte.trim()&&!Number.isFinite(numeroEntrada(d.cobroImporte)))throw Object.assign(new Error('Revisá el importe cobrado.'),{campo:'cobroImporte'});if(pagado<0||pagado>t)throw Object.assign(new Error('El cobro debe estar entre cero y el total de la venta.'),{campo:'cobroImporte'});
      if(pagado>0&&!MEDIOS[d.cobroMedio])throw Object.assign(new Error('Elegí el medio de pago.'),{campo:'cobroMedio'});
      if(pagado<t&&!d.cliente.trim())throw Object.assign(new Error('Elegí o escribí el cliente para registrar una venta con saldo.'),{campo:'cliente'});
      const r=await confirmar({titulo:'Revisar venta',texto:`${lineas.length} línea(s) · <strong>${pesos(t)}</strong><br>Cliente: ${esc(d.cliente.trim()||'Consumidor de mostrador')}<br>Cobrado: ${pesos(pagado)}${pagado?' · '+esc(MEDIOS[d.cobroMedio]):''}<br>Saldo: ${pesos(t-pagado)}`,efecto:'Registra la venta y descuenta los artículos del stock. El comprobante es interno, sin validez fiscal.',aceptar:'Confirmar venta'});
      if(!r.ok)return false;
      const cuerpo={lineas,cobro:pagado?{importe:d.cobroImporte,medio:d.cobroMedio,referencia:d.cobroReferencia}:null};
      if(d.contactoId)cuerpo.contactoId=Number(d.contactoId);else if(d.cliente.trim())cuerpo.contacto={nombre:d.cliente.trim(),telefono:d.telefono};
      const guardada=await post('/api/ventas',cuerpo,{idempotencia:f.dataset.clave});toast(`Venta N.º ${guardada.venta.numero} registrada.`);delete f.dataset.sucio;app.ir('#/mostrador/'+guardada.id);
    });
  }};
}

async function detalle(id, app) {
  const { venta: v } = await get(`/api/ventas/${id}`);
  const TIPO = { cargo: 'Venta', pago: 'Cobro', devolucion_dinero: 'Dinero devuelto', nota_credito: 'Nota de crédito por devolución', anulacion: 'Anulación' };
  return {
    titulo: `Venta ${v.numero}`,
    html: `<div class="pagina" style="max-width:900px">
      <a class="volver" href="#/mostrador">${icono('izq')}Mostrador</a>
      <div class="cab"><div class="cab__titulo"><h1 tabindex="-1">Venta N.º ${esc(v.numero)}</h1>${v.estado === 'anulada' ? chip('Anulada', 'rojo', 'ban') : v.saldo ? chip('Saldo ' + pesos(v.saldo), 'ambar', 'dinero') : chip('Cobrada', 'verde', 'check')}</div>
        <div class="acciones">${app.puede('documentos.emitir') && v.estado !== 'anulada' ? `<button type="button" class="btn" data-comprobante>${icono('documento')}${v.documento ? 'Ver comprobante' : 'Comprobante'}</button>` : ''}</div></div>
      <p>${esc(v.contacto?.nombre || v.cliente_nombre)} · ${esc(fecha(v.fecha))}</p>
      ${v.anulada_motivo ? aviso(`Anulada: ${esc(v.anulada_motivo)}`, 'rojo', 'ban') : ''}
      <div class="panel"><ul class="lista">${v.lineas.map((l) => `<li><div class="fila"><span><strong>${esc(l.descripcion)}</strong> × ${esc(cant(l.cantidad_m, l.unidad || ''))}${l.devuelto_m ? ` <span class="muted small">(devuelto ${esc(cant(l.devuelto_m, l.unidad || ''))})</span>` : ''}</span><strong class="num">${pesos(l.importe)}</strong></div></li>`).join('')}
        <li class="fila"><strong>Total</strong><strong class="num">${pesos(v.total)}</strong></li></ul></div>
      <section class="panel"><div class="panel__cab"><h2>Movimientos de dinero</h2></div><ul class="lista">${v.movimientos.map((m) => `<li class="fila"><span>${esc(TIPO[m.tipo])}${m.medio ? ' · ' + esc(MEDIOS[m.medio]) : ''} · <span class="muted small">${esc(fechaHora(m.fecha))}</span>${m.anulado ? ' ' + chip('Anulado', 'rojo', 'ban') : ''}</span><strong class="num">${pesos(m.importe)}</strong></li>`).join('') || '<li class="muted">Sin movimientos.</li>'}</ul></section>
      ${v.estado !== 'anulada' && v.saldo && app.puede('caja.registrar') ? `<form class="form panel panel__cuerpo" id="f-cobro" novalidate data-clave="${crypto.randomUUID ? crypto.randomUUID() : Date.now()}"><h2>Cobrar saldo</h2><div class="fila-campos">${campo({ nombre: 'importe', etiqueta: 'Importe', valor: aEntradaDinero(v.saldo), requerido: true, attrs: 'inputmode="decimal"' })}${campo({ nombre: 'medio', etiqueta: 'Medio', tipo: 'select', opciones: Object.entries(MEDIOS) })}${campo({ nombre: 'referencia', etiqueta: 'Referencia' })}</div><button class="btn btn-primario" type="submit">Registrar cobro</button></form>` : ''}
      ${v.estado !== 'anulada' && v.lineas.some((l) => l.devuelto_m < l.cantidad_m) ? `<details class="mas"><summary>Devolución de artículos</summary><div class="mas__cuerpo"><form class="form" id="f-dev" novalidate>
        ${v.lineas.filter((l) => l.devuelto_m < l.cantidad_m).map((l) => `<div data-linea-dev="${l.id}">${campo({ nombre: 'd-' + l.id, etiqueta: `${l.descripcion}: cantidad que devuelve (máx. ${cant(l.cantidad_m - l.devuelto_m, '')})`, attrs: 'inputmode="decimal"' })}</div>`).join('')}
        ${campo({ nombre: 'motivo', etiqueta: 'Motivo', requerido: true })}
        <div class="fila-campos">${campo({ nombre: 'reintegro', etiqueta: 'Dinero devuelto (si corresponde)', attrs: 'inputmode="decimal"' })}${campo({ nombre: 'medio', etiqueta: 'Cómo se devolvió', tipo: 'select', opciones: Object.entries(MEDIOS) })}</div>
        <p class="muted small">Lo devuelto vuelve al stock con un movimiento. La venta original no se modifica.</p>
        <button class="btn" type="submit">Registrar devolución</button></form></div></details>` : ''}
      ${v.estado !== 'anulada' && app.puede('ventas.anular') ? `<p><button type="button" class="btn btn-peligro btn-chico" data-anular>${icono('ban')}Anular la venta</button></p>` : ''}
    </div>`,
    despues(raiz) {
      raiz.querySelector('[data-comprobante]')?.addEventListener('click', async () => {
        if (v.documento) return app.ir('#/documentos/' + v.documento.id);
        try { const r = await post('/api/documentos', { tipo: 'venta', refTipo: 'venta', refId: v.id }); app.ir('#/documentos/' + r.id); } catch (e) { toast(e.message, { error: true }); }
      });
      const fc = raiz.querySelector('#f-cobro');
      if (fc) alEnviar(fc, async (d) => { if(!await revisarPago({importe:d.importe,medio:d.medio,destino:`Venta N.º ${v.numero} · ${v.contacto?.nombre||v.cliente_nombre}`,efecto:'Registra el cobro de esta venta en Caja y reduce su saldo.'}))return false; await post(`/api/ventas/${v.id}/pagos`, d, { idempotencia: fc.dataset.clave }); toast('Cobro registrado.'); app.recargar(); });
      const fd = raiz.querySelector('#f-dev');
      if (fd) alEnviar(fd, async (d) => { await post(`/api/ventas/${v.id}/devolucion`, { motivo: d.motivo, lineas: v.lineas.map((l) => ({ lineaId: l.id, cantidad: d['d-' + l.id] })).filter((x) => x.cantidad), reintegro: d.reintegro ? { importe: d.reintegro, medio: d.medio } : null }); toast('Devolución registrada.'); app.recargar(); });
      raiz.querySelector('[data-anular]')?.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Anular la venta', texto: 'Se repone el stock no devuelto y se anulan el cargo y los cobros con movimientos nuevos.', efecto: 'Los cobros anulados figuran como salida de caja (dinero devuelto).', aceptar: 'Anular venta', peligro: true, pedir: { etiqueta: 'Motivo' } });
        if (!r.ok) return;
        try { await post(`/api/ventas/${v.id}/anular`, { motivo: r.valor }); toast('Venta anulada.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      });
    }
  };
}
