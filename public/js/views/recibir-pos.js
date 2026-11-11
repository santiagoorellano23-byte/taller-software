import {get,post,claveDeEnvio} from '../api.js?v=0.1.0';
import {esc,icono,patente,nombreAuto,fecha,campo,opcionesRadio,casilla,alEnviar,toast,aviso} from '../ui.js?v=0.1.0';
import {camposVehiculo,enlazarModelos} from './autos.js?v=0.1.0';
import {MOTIVOS_RAPIDOS,anexarMotivo,normalizar} from '../seleccion-rapida.js?v=0.1.0';

function tarjeta(v,{elegida=false}={}) {
  const abierta=v.visitaAbierta||v.visitas?.find(x=>!x.entregada_at&&!x.anulada_at);
  const ultima=v.ultima_visita||v.visitas?.[0]?.ingreso_at;
  const contacto=typeof v.contacto==='object'?v.contacto?.nombre:v.contacto;
  return `<article class="vehiculo-pos ${elegida?'vehiculo-pos--elegido':''}"><span class="vehiculo-pos__dibujo" title="Silueta ilustrativa, no es una foto">${icono('silueta')}</span><div class="vehiculo-pos__datos">${patente(v.patente)}<strong>${nombreAuto(v)}</strong><span>${esc(contacto||'Sin contacto')}</span><small>Última visita: ${ultima?esc(fecha(ultima)):'Sin visitas'}</small></div><div class="vehiculo-pos__accion">${abierta?`<span class="small muted">Ya está en el taller</span><a class="btn btn-chico" href="#/visitas/${abierta.id}">Abrir orden N.º ${esc(abierta.numero)}</a>`:elegida?`<span class="estado estado--verde">${icono('check')}Elegido</span>`:`<button class="btn btn-chico" type="button" data-elegir-id="${v.id}">Elegir auto</button>`}</div></article>`;
}

export default async function recibir({app,query}) {
  const [{usuarios},cat]=await Promise.all([get('/api/usuarios'),get('/api/catalogos')]);
  let seleccionado=query.vehiculo?(await get('/api/vehiculos/'+query.vehiculo)).vehiculo:null;
  const relacionada=seleccionado?.visitas.find(x=>String(x.id)===query.relacionada)||null;
  let turno=null;
  if(query.turno)turno=(await get('/api/agenda?desde=2000-01-01&hasta=2100-01-01')).turnos.find(t=>String(t.id)===query.turno)||null;
  const plantilla=cat.plantillas.filter(p=>p.activo),motivos=window.TALLERES_CATALOGOS?.motivos||[];
  const mas=motivos.filter(x=>!MOTIVOS_RAPIDOS.some(m=>m.texto===x));
  return {titulo:'Recibir un auto',html:`<div class="pagina recepcion-pos">
    <div class="cab"><div><a class="volver" href="#/hoy">${icono('izq')}Hoy</a><h1 tabindex="-1">Recibir un auto</h1></div><button class="btn btn-texto" data-ayuda="recibir">${icono('ayuda')}Ayuda</button></div>
    ${relacionada?aviso(`Vuelve por el mismo problema de la orden N.º ${esc(relacionada.numero)}. Se conserva la anterior y la garantía la decide el taller.`,'ambar','historial'):''}
    ${turno?aviso(`Turno de <strong>${esc(turno.nombre)}</strong>. Los datos se reutilizan; el turno no autoriza trabajos.`,'gris','calendario'):''}
    <form id="f-recibir" class="recepcion-layout" novalidate>
      <div class="recepcion-cuerpo">
        <section class="bloque" aria-labelledby="t-vehiculo"><div class="bloque__cab"><h2 id="t-vehiculo">Vehículo</h2><button class="btn" type="button" data-nuevo-auto>${icono('mas')}Nuevo vehículo</button></div>
          <div class="buscador">${icono('buscar')}<label class="sr" for="rec-q">Buscar patente, cliente o teléfono</label><input id="rec-q" type="search" placeholder="Buscar patente, cliente o teléfono" value="${esc(query.patente||turno?.patente||'')}" autocomplete="off"></div>
          <div data-elegido>${seleccionado?tarjeta(seleccionado,{elegida:true}):''}</div><input type="hidden" name="vehiculoId" value="${seleccionado?.id||''}"><input type="hidden" name="nuevo" value="">
          <div data-resultados class="vehiculos-pos" aria-live="polite"></div>
          <div class="acciones"><button type="button" class="enlace small" data-recientes>${icono('historial')}Ver últimos vehículos</button><span class="small muted">Las siluetas son ilustrativas.</span></div>
          <div data-lista-recientes class="vehiculos-pos" hidden></div>
          <section data-nuevo class="panel panel__cuerpo bloque" hidden aria-label="Nuevo vehículo"><div class="fila"><h3>Alta dentro de esta recepción</h3><button class="btn btn-texto btn-chico" type="button" data-cancelar-nuevo>Cerrar alta</button></div>
            ${camposVehiculo({patente:query.patente||turno?.patente||''})}
            <div class="bloque"><h3>Contacto</h3><div class="buscador">${icono('buscar')}<label class="sr" for="rec-contacto-q">Buscar contacto existente</label><input type="search" id="rec-contacto-q" placeholder="Reutilizar contacto por nombre o teléfono"></div><div data-contactos class="resultados" aria-live="polite"></div><input type="hidden" name="contactoId">
              <div data-contacto-elegido class="small" hidden></div><div class="fila-campos">${campo({nombre:'cnombre',etiqueta:'Nombre del contacto',requerido:true,valor:turno?.nombre||''})}${campo({nombre:'ctelefono',etiqueta:'Teléfono',tipo:'tel',valor:turno?.telefono||''})}</div>
            </div>
          </section>
        </section>
        <section class="bloque" aria-labelledby="t-motivo"><div class="bloque__cab"><h2 id="t-motivo">¿Por qué viene?</h2><span class="small muted">El relato del cliente</span></div>
          <div class="motivos-pos" aria-label="Motivos rápidos">${MOTIVOS_RAPIDOS.map(m=>`<button type="button" class="motivo-pos" data-motivo-rapido="${m.id}">${icono(m.icono)}<strong>${m.nombre}</strong></button>`).join('')}</div>
          <details class="mas"><summary>Ver más motivos</summary><div class="mas__cuerpo sugerencias">${mas.map(m=>`<button type="button" data-motivo="${esc(m)}">${esc(m)}</button>`).join('')}</div></details>
          <div class="campo" data-campo="motivo"><label for="rec-motivo">Motivo y notas</label><textarea id="rec-motivo" name="motivo" required placeholder="Elegí un motivo o escribí lo que cuenta el cliente">${esc(relacionada?'Vuelve por: '+relacionada.motivo:turno?.motivo||'')}</textarea><p class="ayuda">Las selecciones agregan texto editable. No son un diagnóstico ni autorizan trabajos.</p></div><p class="small muted" data-motivo-estado role="status"></p>
        </section>
        <section class="bloque recepcion-km" aria-labelledby="t-km"><h2 id="t-km">Kilometraje actual</h2><div class="lectura-km">${campo({nombre:'km',etiqueta:'Lectura del tablero (km)',requerido:true,attrs:'inputmode="numeric" maxlength="7"',placeholder:'Ej.: 84150'})}${casilla('sinKm','Sin lectura')}</div><div data-km-exp hidden>${campo({nombre:'kmExplicacion',etiqueta:'La lectura es menor que la anterior: ¿por qué?',tipo:'textarea'})}</div></section>
        <details class="mas"><summary>Atención y autorización al ingreso</summary><div class="mas__cuerpo bloque">
          ${opcionesRadio('tipo',[['revision','Revisión o reparación','buscar'],['service','Service ya autorizado','service']],query.tipo||'revision','Atención a registrar')}
          <p class="small muted">Elegir el motivo Service no autoriza el trabajo. Registrá acá la autorización si ya la tenés.</p>
          <div data-service hidden class="bloque"><div class="fila-campos">${campo({nombre:'autPersona',etiqueta:'¿Quién autorizó el service?'})}${campo({nombre:'autImporte',etiqueta:'Importe acordado',attrs:'inputmode="decimal"',ayuda:'Solo si ya se acordó; se puede cargar después.'})}</div>${plantilla.length?campo({nombre:'plantillaId',etiqueta:'Plantilla de tareas',tipo:'select',opciones:[['','Sin plantilla'],...plantilla.map(p=>[p.id,p.nombre])],ayuda:'Propone tareas, no las marca como hechas.'}):''}</div>
          <div data-revision class="bloque">${casilla('revisionConCosto','El cliente autorizó una revisión con costo (no reparaciones)')}<div data-rev-costo hidden class="fila-campos">${campo({nombre:'revPersona',etiqueta:'¿Quién autorizó la revisión?'})}${campo({nombre:'revImporte',etiqueta:'Costo de la revisión',attrs:'inputmode="decimal"'})}</div></div>
        </div></details>
        <details class="mas"><summary>Responsable, retiro y otros datos</summary><div class="mas__cuerpo bloque"><div class="fila-campos">${campo({nombre:'responsableId',etiqueta:'Responsable',tipo:'select',valor:relacionada?.responsable_id||'',opciones:[['','Sin asignar'],...usuarios.filter(u=>u.activo).map(u=>[u.id,u.nombre])]})}${campo({nombre:'retiro',etiqueta:'Retiro acordado',tipo:'datetime-local'})}${campo({nombre:'prioridad',etiqueta:'Prioridad',tipo:'select',opciones:[['normal','Normal'],['alta','Alta']]})}</div>${campo({nombre:'retiroNota',etiqueta:'Nota de retiro'})}<div class="fila-campos">${campo({nombre:'dejaNombre',etiqueta:'Quién deja el auto, si es otra persona'})}${campo({nombre:'dejaTelefono',etiqueta:'Su teléfono',tipo:'tel'})}</div></div></details>
      </div>
      <aside class="recepcion-resumen" aria-label="Resumen de recepción"><div class="recepcion-resumen__datos"><h2>Recepción en preparación</h2><div class="resumen-vehiculo" data-resumen-auto>Elegí un vehículo</div><dl class="resumen-kv"><div><dt>Contacto</dt><dd data-resumen-contacto>Por indicar</dd></div><div><dt>Kilometraje</dt><dd data-resumen-km>Por indicar</dd></div></dl><p data-resumen-motivo class="small muted">Agregá el motivo del cliente.</p><p class="small muted" data-resumen-estado>Se abrirá una orden nueva. El diagnóstico, presupuesto y cobro se registran aparte.</p></div><div class="recepcion-confirmar"><span class="small" data-confirmar-auto>Sin vehículo elegido</span><button class="btn btn-primario" type="submit">${icono('check')}Recibir auto</button></div></aside>
    </form>
  </div>`,despues(raiz) {
    const f=raiz.querySelector('#f-recibir'),q=f.querySelector('#rec-q'),cont=f.querySelector('[data-resultados]'),nuevo=f.querySelector('[data-nuevo]'),elegido=f.querySelector('[data-elegido]'),motivo=f.elements.motivo;
    enlazarModelos(nuevo);let modo=seleccionado?'conocido':'buscar',busqueda=0,timer,contactoConsulta=0,ctimer;
    const sucio=()=>{f.dataset.sucio='1';};
    const resumen=()=>{
      const placa=modo==='nuevo'?f.elements.patente.value:seleccionado?.patente;
      const abierta=modo==='conocido'&&seleccionado?.visitas?.find(v=>!v.entregada_at&&!v.anulada_at);
      f.querySelector('[type=submit]').disabled=!!abierta;
      f.querySelector('[data-resumen-estado]').textContent=abierta?'Este auto ya tiene una orden abierta. Usá Abrir orden para continuarla.':'Se abrirá una orden nueva. El diagnóstico, presupuesto y cobro se registran aparte.';
      f.querySelector('[data-resumen-auto]').textContent=placa||'Elegí un vehículo';f.querySelector('[data-confirmar-auto]').textContent=placa||'Sin vehículo elegido';
      f.querySelector('[data-resumen-contacto]').textContent=modo==='nuevo'?f.elements.cnombre.value||'Por indicar':seleccionado?.contacto?.nombre||'Por indicar';
      f.querySelector('[data-resumen-km]').textContent=f.elements.sinKm.checked?'Sin lectura':f.elements.km.value?f.elements.km.value+' km':'Por indicar';f.querySelector('[data-resumen-motivo]').textContent=motivo.value||'Agregá el motivo del cliente.';
      f.querySelectorAll('[data-motivo-rapido]').forEach(b=>{const m=MOTIVOS_RAPIDOS.find(x=>x.id===b.dataset.motivoRapido);const incluido=!!m.texto&&normalizar(motivo.value).includes(normalizar(m.texto));b.classList.toggle('incluido',incluido);if(m.texto)b.setAttribute('aria-pressed',String(incluido));});
    };
    const establecerModo=(m)=>{modo=m;f.elements.nuevo.value=m==='nuevo'?'1':'';nuevo.hidden=m!=='nuevo';elegido.hidden=m!=='conocido';f.querySelector('[data-nuevo-auto]').setAttribute('aria-expanded',String(m==='nuevo'));resumen();};
    const elegir=async id=>{
      const actual=++busqueda;
      try{const {vehiculo:v}=await get('/api/vehiculos/'+id);if(actual!==busqueda||!f.isConnected)return;
        const abierta=v.visitas.find(x=>!x.entregada_at&&!x.anulada_at);if(abierta){cont.innerHTML=aviso(`Este auto ya tiene una <a href="#/visitas/${abierta.id}">orden abierta N.º ${esc(abierta.numero)}</a>.`,'ambar');return;}
        seleccionado=v;f.elements.vehiculoId.value=v.id;elegido.innerHTML=tarjeta(v,{elegida:true});cont.innerHTML='';f.querySelector('[data-lista-recientes]').hidden=true;establecerModo('conocido');sucio();
      }catch(e){toast(e.message,{error:true});}
    };
    const enlazarLista=box=>box.querySelectorAll('[data-elegir-id]').forEach(b=>b.onclick=()=>elegir(b.dataset.elegirId));
    const buscar=async()=>{const actual=++busqueda,texto=q.value.trim();if(texto.length<2){cont.innerHTML='';return;}try{const r=await get('/api/buscar?q='+encodeURIComponent(texto));if(actual!==busqueda||!f.isConnected)return;cont.innerHTML=r.vehiculos.length?r.vehiculos.map(x=>tarjeta(x)).join(''):`<p class="small muted">Sin coincidencias. Usá Nuevo vehículo si todavía no está cargado.</p>`;enlazarLista(cont);}catch(e){if(actual===busqueda)cont.innerHTML=`<p role="alert" class="small">${esc(e.message)}. Volvé a buscar cuando haya conexión.</p>`;}};
    q.addEventListener('input',()=>{++busqueda;clearTimeout(timer);timer=setTimeout(buscar,220);});
    f.querySelector('[data-nuevo-auto]').onclick=()=>{++busqueda;clearTimeout(timer);establecerModo('nuevo');if(!f.elements.patente.value&&q.value.trim())f.elements.patente.value=q.value.trim().toUpperCase();cont.innerHTML='';resumen();f.elements.patente.focus();};
    f.querySelector('[data-cancelar-nuevo]').onclick=()=>{establecerModo(seleccionado?'conocido':'buscar');q.focus();};
    f.querySelector('[data-recientes]').onclick=async()=>{const box=f.querySelector('[data-lista-recientes]');if(box.dataset.cargado){box.hidden=!box.hidden;return;}try{const r=await get('/api/vehiculos');box.innerHTML=r.vehiculos.filter(v=>!v.archivado).slice(0,6).map(x=>tarjeta(x)).join('')||'<p class="small muted">Todavía no hay vehículos.</p>';box.hidden=false;box.dataset.cargado='1';enlazarLista(box);}catch(e){toast(e.message,{error:true});}};
    const agregarMotivo=texto=>{const anterior=motivo.value;motivo.value=anexarMotivo(anterior,texto);if(motivo.value!==anterior)sucio();f.querySelector('[data-motivo-estado]').textContent=texto?(motivo.value===anterior?'Ese motivo ya está en las notas.':'Motivo agregado al borrador. Podés editarlo.'):'Escribí el motivo con las palabras del cliente.';resumen();};
    f.querySelectorAll('[data-motivo-rapido]').forEach(b=>b.onclick=()=>{const m=MOTIVOS_RAPIDOS.find(x=>x.id===b.dataset.motivoRapido);agregarMotivo(m.texto);if(!m.texto)motivo.focus();});
    f.querySelectorAll('[data-motivo]').forEach(b=>b.onclick=()=>agregarMotivo(b.dataset.motivo));
    f.elements.sinKm.onchange=()=>{
      const sinLectura=f.elements.sinKm.checked;
      // Deshabilitar excluye el borrador del envío sin borrar lo que el usuario escribió.
      f.elements.km.disabled=sinLectura;
      f.elements.km.required=!sinLectura;
      f.elements.km.setAttribute('aria-required',String(!sinLectura));
      f.querySelector('[data-km-exp]').hidden=sinLectura||!f.elements.kmExplicacion.value;
      sucio();resumen();
    };
    const tipo=()=>{const service=f.querySelector('[name=tipo]:checked').value==='service';f.querySelector('[data-service]').hidden=!service;f.querySelector('[data-revision]').hidden=service;};f.querySelectorAll('[name=tipo]').forEach(b=>b.onchange=tipo);tipo();
    f.elements.revisionConCosto.onchange=()=>{f.querySelector('[data-rev-costo]').hidden=!f.elements.revisionConCosto.checked;};
    const cq=f.querySelector('#rec-contacto-q'),cc=f.querySelector('[data-contactos]'),ce=f.querySelector('[data-contacto-elegido]');
    const liberarContacto=()=>{f.elements.contactoId.value='';f.elements.cnombre.readOnly=false;f.elements.ctelefono.readOnly=false;f.elements.cnombre.value='';f.elements.ctelefono.value='';cq.value='';ce.hidden=true;resumen();cq.focus();};
    cq.oninput=()=>{const actual=++contactoConsulta;clearTimeout(ctimer);ctimer=setTimeout(async()=>{if(cq.value.trim().length<2){cc.innerHTML='';return;}try{const r=await get('/api/contactos?q='+encodeURIComponent(cq.value));if(actual!==contactoConsulta||!f.isConnected)return;cc.innerHTML=r.contactos.slice(0,5).map(c=>`<button class="resultado" type="button" data-contacto="${c.id}"><strong>${esc(c.nombre)}</strong><span>${esc(c.telefono||'Sin teléfono')}</span><span>Elegir contacto</span></button>`).join('')||'<p class="small muted">Sin coincidencias. Completá los datos de abajo.</p>';cc.querySelectorAll('[data-contacto]').forEach(b=>b.onclick=()=>{const c=r.contactos.find(x=>x.id===Number(b.dataset.contacto));f.elements.contactoId.value=c.id;f.elements.cnombre.value=c.nombre;f.elements.ctelefono.value=c.telefono||'';f.elements.cnombre.readOnly=true;f.elements.ctelefono.readOnly=true;cc.innerHTML='';ce.hidden=false;ce.innerHTML=`${icono('check')}Contacto existente seleccionado <button class="enlace" type="button" data-liberar-contacto>Usar otro</button>`;ce.querySelector('button').onclick=liberarContacto;sucio();resumen();});}catch(e){cc.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}},220);};
    f.addEventListener('input',resumen);establecerModo(modo);if(q.value)buscar();
    alEnviar(f,async d=>{
      const cuerpo={tipo:d.tipo||'revision',motivo:d.motivo,km:d.sinKm?'':d.km,sinKm:!!d.sinKm,kmExplicacion:d.kmExplicacion,responsableId:d.responsableId||null,retiro:d.retiro||null,retiroNota:d.retiroNota,prioridad:d.prioridad,relacionadaId:relacionada?.id||null,turnoId:turno?.id||null,plantillaId:d.tipo==='service'?d.plantillaId||null:null,autorizacion:d.tipo==='service'?{persona:d.autPersona,importe:d.autImporte}:d.revisionConCosto?{revisionConCosto:true,persona:d.revPersona,importe:d.revImporte}:{}};
      if(modo==='conocido'&&seleccionado){cuerpo.vehiculoId=seleccionado.id;if(d.dejaNombre)cuerpo.contacto={nombre:d.dejaNombre,telefono:d.dejaTelefono};}
      else if(modo==='nuevo'){cuerpo.vehiculo=Object.fromEntries(['patente','marca','modelo','version_txt','anio','combustible','color','vin','notas'].map(k=>[k,d[k]]));if(d.contactoId)cuerpo.contactoId=Number(d.contactoId);else cuerpo.contacto={nombre:d.cnombre,telefono:d.ctelefono};}
      else throw Object.assign(new Error('Elegí un auto de la búsqueda o usá Nuevo vehículo.'),{campo:'vehiculoId'});
      try{const r=await post('/api/visitas',cuerpo,{idempotencia:claveDeEnvio(f)});delete f.dataset.sucio;toast(`Auto recibido. Orden N.º ${r.visita.numero}.`);app.ir('#/visitas/'+r.id);}catch(e){
        if(e.campo==='kmExplicacion')f.querySelector('[data-km-exp]').hidden=false;
        if(e.campo==='autPersona'||e.campo==='autImporte'){if(d.tipo!=='service')e.campo=e.campo==='autPersona'?'revPersona':'revImporte';f.querySelector('[name=tipo]').closest('details').open=true;}
        if(e.datos?.visitaAbierta)toast(e.message,{error:true,accion:{texto:'Abrir orden',fn:()=>app.ir('#/visitas/'+e.datos.visitaAbierta.id)}});
        throw e;
      }
    });
  }};
}
