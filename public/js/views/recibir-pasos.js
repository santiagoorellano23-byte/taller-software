import {get,post,claveDeEnvio} from '../api.js?v=0.1.0';
import {esc,icono,patente,nombreAuto,fecha,campo,casilla,opcionesRadio,leerForm,alEnviar,mostrarError,limpiarErrores,toast} from '../ui.js?v=0.1.0';
import {enlazarModelos} from './autos.js?v=0.1.0';
import {entrada,detenerMovimiento} from '../movimiento.js?v=0.1.0';
import {MARCAS,MOTIVOS,material,resumenMotivos,leerBorrador,guardarBorrador,borrarBorrador,borradorPara,ultimaLectura,visitaRelacionada} from '../recepcion-modelo.js?v=0.1.0';
import {enlazarFotosIngreso} from '../estado-ingreso.js?v=0.1.0';

const PASOS=['Auto','Estado al ingresar','Motivo','Kilometraje','Autorización','Datos opcionales','Revisión'];
const falla=(message,campo)=>Object.assign(new Error(message),{campo});
function resultado(v){
  const abierta=v.visitaAbierta||v.visitas?.find(x=>!x.entregada_at&&!x.anulada_at);
  const cliente=typeof v.contacto==='object'?v.contacto?.nombre:v.contacto;
  return `<article class="rec-auto"><div>${patente(v.patente)}<strong>${nombreAuto(v)}</strong><span>${esc(cliente||'Sin contacto')}</span></div>${abierta?`<div class="rec-auto-abierta"><p>Ya está en el taller · orden N.º ${esc(abierta.numero)}</p><a class="btn" href="#/visitas/${abierta.id}">Continuar esa orden ${icono('der')}</a></div>`:`<button type="button" class="btn" data-elegir="${v.id}">Elegir ${icono('der')}</button>`}</article>`;
}
export default async function recibir({app,query}){
  const [{usuarios},cat]=await Promise.all([get('/api/usuarios'),get('/api/catalogos')]);
  const draft=borradorPara(query,leerBorrador(app));
  if(draft?.pendiente)query={};
  // Consumir el destino una vez permite recuperar el borrador después de recargar.
  if(location.hash.includes('?'))history.replaceState(history.state,'',location.pathname+location.search+'#/recibir');
  let elegido=query.vehiculo?(await get('/api/vehiculos/'+query.vehiculo)).vehiculo:null;
  if(!elegido&&draft?.vehiculoId&&!query.turno&&!query.patente){try{elegido=(await get('/api/vehiculos/'+draft.vehiculoId)).vehiculo;}catch{/* El servidor validará la selección vigente. */}}
  let relacionada=visitaRelacionada(elegido,query.relacionada||draft?.relacionadaId);
  const turnoId=query.turno||draft?.turnoId;
  const turno=turnoId?(await get('/api/agenda?desde=2000-01-01&hasta=2100-01-01')).turnos.find(x=>String(x.id)===String(turnoId)):null;
  return {titulo:'Recibir un auto',html:`<div class="pagina rec-pasos">
    <header class="rec-cab"><button class="btn btn-texto" type="button" data-atras aria-label="Volver al paso anterior">${icono('izq')}</button><h1 tabindex="-1">Recibir un auto</h1><a class="btn btn-texto" href="#/hoy">Salir</a></header>
    <div class="rec-progreso" role="progressbar" aria-label="Progreso de recepción" aria-valuemin="1" aria-valuemax="7" aria-valuenow="1">${PASOS.map((_,i)=>`<span data-progreso="${i}"></span>`).join('')}</div>
    <p class="rec-paso-label" data-paso-label>Paso 1 de 7 · Auto</p>
    <form id="f-recibir" class="rec-layout" novalidate>
      <div class="rec-contenido">
        <section data-paso="0" class="rec-etapa">
          <div data-buscar-auto><h2 tabindex="-1">¿Qué auto es?</h2><p class="rec-explica">Escribí la patente como venga: con o sin espacios ni guiones.</p>
            <div class="buscador">${icono('buscar')}<label class="sr" for="rec-q">Patente, cliente o teléfono</label><input id="rec-q" type="search" autocomplete="off" placeholder="Patente, cliente o teléfono" value="${esc(query.patente||turno?.patente||'')}"></div>
            <div data-elegido></div><div data-resultados aria-live="polite"></div>
            <div class="rec-crear"><button class="btn" type="button" data-nuevo>${icono('mas')}Auto nuevo</button><button class="btn" type="button" data-sin-patente>Sin patente visible</button></div>
            <div data-recientes><h3>Últimos autos</h3><div data-lista-recientes><p class="muted">Cargando vehículos…</p></div></div>
          </div>
          <div data-nuevo-auto hidden><h2 tabindex="-1">Auto nuevo</h2><p class="rec-explica">Solo lo necesario para identificarlo y avisar al cliente. El resto se completa en la ficha.</p>
            <button class="btn btn-texto" type="button" data-volver-busqueda>${icono('izq')}Buscar uno existente</button>
            ${campo({nombre:'patente',etiqueta:'Patente',requerido:true,attrs:'maxlength="20" autocapitalize="characters" spellcheck="false"',placeholder:'AB 123 CD'})}
            ${casilla('sinPatente','No tiene patente o no se puede leer')}
            <fieldset class="rec-marcas campo" data-campo="marca"><legend>Marca</legend><div class="rec-marcas-grid">${MARCAS.map((m,i)=>`<label class="rec-marca"><input type="radio" name="marcaOpcion" value="${m}"><span>${m==='Otra'?'<strong>Otra</strong>':`<img src="/marcas/${m.toLowerCase()}.${['Chevrolet','Ford'].includes(m)?'png':'svg'}" alt="${m}" width="64" height="40">`}<span class="rec-marca-check" aria-hidden="true">${icono('check')}</span></span></label>`).join('')}</div><p class="ayuda" data-marca-estado aria-live="polite">Elegí una marca.</p></fieldset>
            <div data-otra-marca hidden>${campo({nombre:'marcaOtra',etiqueta:'Nombre de la marca',requerido:true,attrs:'maxlength="60"'})}</div><input type="hidden" name="marca"><datalist id="dl-modelos"></datalist>
            <div class="fila-campos">${campo({nombre:'modelo',etiqueta:'Modelo',requerido:true,attrs:'list="dl-modelos" maxlength="80"',placeholder:'Ej.: Cronos 1.3'})}${campo({nombre:'anio',etiqueta:'Año',attrs:'inputmode="numeric" maxlength="4"',placeholder:'Ej.: 2022'})}</div>
            <h3>Cliente</h3><div class="buscador">${icono('buscar')}<label class="sr" for="rec-contacto-q">Reutilizar contacto existente</label><input id="rec-contacto-q" type="search" placeholder="Buscar nombre o teléfono" autocomplete="off"></div><div data-contactos aria-live="polite"></div><input type="hidden" name="contactoId"><p data-contacto-elegido hidden></p>
            ${campo({nombre:'cnombre',etiqueta:'Nombre del cliente',requerido:true,attrs:'maxlength="120"'})}${campo({nombre:'ctelefono',etiqueta:'Teléfono',tipo:'tel',requerido:true,attrs:'maxlength="40" inputmode="tel"'})}
          </div>
        </section>
        <section data-paso="1" class="rec-etapa" hidden><h2 tabindex="-1">Estado al ingresar</h2><p class="rec-explica">Antes de mover o reparar el auto, registrá cómo llegó. Las fotos del tablero y del exterior son obligatorias.</p>
          <div class="campo" data-campo="fotosIngreso"><div data-fotos-ingreso></div></div>
          ${opcionesRadio('tableroEstado',[['sin_testigos','Sin testigos de falla observados'],['con_testigos','Hay testigos encendidos'],['no_enciende','No se puede encender el tablero']],'','Estado del tablero')}
          ${campo({nombre:'ingresoTestigos',etiqueta:'Testigos encendidos o aclaración',tipo:'textarea',attrs:'maxlength="1000" rows="2"',ayuda:'Indicá cuáles se ven y si el motor está encendido, solo en contacto o no arranca. Si no enciende, fotografiá igualmente el tablero y explicalo.'})}
          ${opcionesRadio('carroceria',[['sin_danos','Sin daños visibles observados'],['con_danos','Hay daños previos']],'','Carrocería e interior')}
          ${campo({nombre:'ingresoObservaciones',etiqueta:'Estado visible y detalles al ingresar',tipo:'textarea',requerido:true,attrs:'maxlength="2000" rows="3"',placeholder:'Ej.: rayón en puerta delantera derecha, paragolpes trasero golpeado.',ayuda:'Revisá carrocería, vidrios e interior. Ubicá cada daño y agregá una foto de detalle. Si no observás daños, dejalo escrito. Lo no revisado debe quedar aclarado.'})}
          ${casilla('ingresoConfirmado','Revisé las fotos: corresponden a este auto y muestran el estado de este ingreso')}
        </section>
        <section data-paso="2" class="rec-etapa" hidden><h2 tabindex="-1">¿Por qué viene?</h2><p class="rec-explica">Marcá lo que cuenta el cliente. Podés marcar varios. No es un diagnóstico.</p>
          ${turno?.motivo?`<p class="aviso">En el turno dijo: ${esc(turno.motivo)}. Revisalo con el cliente.</p>`:''}
          <div class="rec-motivos" data-campo="motivos">${MOTIVOS.slice(0,6).map(m=>`<button type="button" class="rec-motivo" data-motivo="${m.id}" aria-pressed="false">${material(m.icono)}<strong>${m.nombre}</strong><span class="rec-check" aria-hidden="true">${icono('check')}</span></button>`).join('')}</div>
          <details class="rec-mas"><summary>Ver más motivos</summary><div class="rec-motivos">${MOTIVOS.slice(6).map(m=>`<button type="button" class="rec-motivo" data-motivo="${m.id}" aria-pressed="false">${material(m.icono)}<strong>${m.nombre}</strong><span class="rec-check" aria-hidden="true">${icono('check')}</span></button>`).join('')}</div></details>
          <div data-detalles></div><div data-otro hidden>${campo({nombre:'otro',etiqueta:'Otro motivo',requerido:true,attrs:'maxlength="200"'})}</div>
          ${campo({nombre:'relato',etiqueta:'En palabras del cliente',tipo:'textarea',attrs:'maxlength="1000" rows="3"',ayuda:'Se guarda aparte de los botones: desmarcar un motivo no borra este texto.',valor:relacionada?'Vuelve por: '+relacionada.motivo:turno?.motivo||'',placeholder:'Ej.: chilla al frenar en bajada'})}
        </section>
        <section data-paso="3" class="rec-etapa" hidden><h2 tabindex="-1">Kilometraje</h2><p class="rec-explica">Lo que marca el tablero al ingresar.</p>
          ${campo({nombre:'km',etiqueta:'Lectura del tablero (km)',requerido:true,attrs:'inputmode="numeric" maxlength="9"',placeholder:'Ej.: 84150'})}${casilla('sinKm','Sin lectura')}
          <div data-explicacion-km>${campo({nombre:'kmExplicacion',etiqueta:'Aclaración de la lectura',tipo:'textarea',attrs:'maxlength="500"',ayuda:'Si la lectura es menor que la anterior, explicá la diferencia. Si no se puede leer, podés indicar por qué.'})}</div>
        </section>
        <section data-paso="4" class="rec-etapa" hidden><h2 tabindex="-1">¿Qué autoriza hoy el cliente?</h2><p class="rec-explica">Registrá lo acordado. Un motivo no es una autorización.</p>
          ${opcionesRadio('tipo',[['revision','Revisión y presupuesto','buscar'],['service','Service ya autorizado','service']],'','Qué autoriza')}
          <p class="small muted">Revisión y presupuesto no autoriza reparar. Service registra solo lo acordado al ingresar; los adicionales requieren su propia respuesta.</p>
          <div data-revision hidden>${opcionesRadio('revisionCosto',[['si','Sí, con costo'],['no','Sin costo']],'','¿La revisión tiene costo para el cliente?')}</div>
          <div data-autorizado hidden class="bloque"><div class="fila-campos">${campo({nombre:'autPersona',etiqueta:'Quién autorizó',requerido:true,attrs:'maxlength="120"'})}${campo({nombre:'autImporte',etiqueta:'Importe acordado',attrs:'inputmode="decimal"',ayuda:'Solo si ya se acordó. Cero significa sin cargo.'})}</div></div>
          <div data-service hidden>${campo({nombre:'plantillaId',etiqueta:'Plantilla de tareas',tipo:'select',opciones:[['','Sin plantilla'],...cat.plantillas.filter(p=>p.activo).map(p=>[p.id,p.nombre])],ayuda:'Propone tareas; no las marca hechas ni agrega cargos.'})}</div>
        </section>
        <section data-paso="5" class="rec-etapa" hidden><h2 tabindex="-1">Antes de terminar</h2><p class="rec-explica">Todo opcional. Si no se sabe ahora, se completa después en la ficha.</p>
          ${opcionesRadio('quien',[['cliente','El cliente'],['otra','Otra persona']],'cliente','¿Quién trae el auto?',{requerido:false})}<div data-otra-persona hidden>${campo({nombre:'dejaNombre',etiqueta:'Nombre de quien lo deja',requerido:true,attrs:'maxlength="120"'})}${campo({nombre:'dejaTelefono',etiqueta:'Su teléfono',tipo:'tel',attrs:'maxlength="40"'})}</div>
          ${campo({nombre:'responsableId',etiqueta:'Responsable',tipo:'select',opciones:[['','Sin asignar'],...usuarios.filter(u=>u.activo).map(u=>[u.id,u.nombre])],valor:relacionada?.responsable_id||''})}
          ${campo({nombre:'retiro',etiqueta:'Retiro acordado',tipo:'datetime-local',ayuda:'Vacío significa a confirmar.'})}${casilla('urgente','Marcar como urgente')}${campo({nombre:'retiroNota',etiqueta:'Nota de retiro',attrs:'maxlength="300"',placeholder:'Ej.: lo retira la hija'})}
        </section>
        <section data-paso="6" class="rec-etapa" hidden><h2 tabindex="-1">Revisá y recibí</h2><p class="rec-explica">El auto queda recibido recién cuando tocás Recibir. Podés cambiar cualquier dato.</p><div class="rec-revision" data-revision-final></div></section>
      </div>
      <aside class="rec-contexto"><h2>Recepción en preparación</h2><div data-resumen></div><ol>${PASOS.map((p,i)=>`<li data-indice="${i}">${p}</li>`).join('')}</ol><p class="small muted">Todavía no es una orden. Revisión, autorización, cobro y entrega son registros distintos.</p></aside>
      <footer class="rec-action"><p data-estado-borrador role="status">Completá los datos para continuar.</p><div class="acciones"><button type="button" class="btn btn-texto" data-omitir hidden>Omitir</button><button type="submit" class="btn btn-primario" data-continuar>Continuar ${icono('der')}</button></div></footer>
    </form>
  </div>`,despues(raiz){
    const f=raiz.querySelector('#f-recibir'),q=f.querySelector('#rec-q'),resultados=f.querySelector('[data-resultados]');
    let modo=elegido?'conocido':'buscar',paso=0,volverRevision=false,motivos=[],consulta=0,consultaContacto=0,timer,ctimer,pendiente=null;
    let fotosIngreso;
    const campos=()=>leerForm(f);
    if(draft&&!query.vehiculo&&!query.turno&&!query.patente){
      for(const [k,v] of Object.entries(draft.campos||{})){const es=[...f.elements].filter(e=>e.name===k);for(const e of es){if(e.type==='checkbox')e.checked=!!v;else if(e.type==='radio')e.checked=e.value===v;else e.value=v??'';}}
      modo=draft.modo||modo;paso=draft.fotosVersion===1?Math.min(6,Math.max(0,draft.paso||0)):0;motivos=draft.motivos||[];pendiente=draft.pendiente||null;f.dataset.clave=draft.clave||crypto.randomUUID();
    }else{f.elements.cnombre.value=turno?.nombre||'';f.elements.ctelefono.value=turno?.telefono||'';}
    claveDeEnvio(f);
    const guardar=()=>{
      f.dataset.sucio='1';
      const ok=guardarBorrador(app,{fotosVersion:1,fotos:fotosIngreso?.datos()||draft?.fotos||[],campos:campos(),vehiculoId:modo==='conocido'?elegido?.id:null,modo,paso,motivos,clave:f.dataset.clave,pendiente,turnoId:turno?.id,relacionadaId:relacionada?.id});
      f.toggleAttribute('data-sin-aviso',ok);f.querySelector('[data-estado-borrador]').textContent=pendiente?'Guardado sin confirmar. Reintentá sin cambiar los datos.':ok?'Borrador en esta pestaña · no cuenta como recibido.':'No se pudo conservar el borrador. No cierres esta pantalla.';
    };
    fotosIngreso=enlazarFotosIngreso(f.querySelector('[data-fotos-ingreso]'),{clave:claveDeEnvio(f),inicial:draft?.fotos||[],guardar:()=>{f.elements.ingresoConfirmado.checked=false;guardar();}});
    const marca=()=>{const d=campos();f.elements.marca.value=d.marcaOpcion==='Otra'?d.marcaOtra:d.marcaOpcion||'';f.querySelector('[data-otra-marca]').hidden=d.marcaOpcion!=='Otra';f.querySelector('[data-marca-estado]').textContent=d.marcaOpcion?`Marca elegida: ${f.elements.marca.value||'Otra (completá el nombre)'}`:'Elegí una marca.';f.elements.marca.dispatchEvent(new Event('input'));};
    enlazarModelos(f);
    const vistaDatos=()=>{
      const d=campos();f.querySelector('[data-nuevo-auto]').hidden=modo!=='nuevo';f.querySelector('[data-buscar-auto]').hidden=modo==='nuevo';
      f.elements.patente.disabled=!!d.sinPatente;f.elements.km.disabled=!!d.sinKm;
      const exigeTestigos=['con_testigos','no_enciende'].includes(d.tableroEstado);
      f.elements.ingresoTestigos.required=exigeTestigos;f.elements.ingresoTestigos.setAttribute('aria-required',String(exigeTestigos));
      f.querySelector('[data-campo="ingresoTestigos"] label span').hidden=exigeTestigos;
      f.querySelector('[data-revision]').hidden=d.tipo!=='revision';f.querySelector('[data-autorizado]').hidden=!(d.tipo==='service'||d.tipo==='revision'&&d.revisionCosto==='si');f.querySelector('[data-service]').hidden=d.tipo!=='service';f.querySelector('[data-otra-persona]').hidden=d.quien!=='otra';
      const abierta=elegido?.visitas?.find(x=>!x.entregada_at&&!x.anulada_at);
      f.querySelector('[data-elegido]').innerHTML=modo==='conocido'&&elegido?`<div class="rec-elegido">${resultado(elegido)}${!abierta?'<p>'+icono('check')+' Auto elegido. Podés continuar o buscar otro.</p>':''}</div>`:'';
      const placa=modo==='nuevo'?(d.sinPatente?'Sin patente visible':d.patente):elegido?.patente;
      const modelo=modo==='nuevo'?[d.marca,d.modelo,d.anio].filter(Boolean).join(' '):elegido?[elegido.marca,elegido.modelo].filter(Boolean).join(' '):'';
      f.querySelector('[data-resumen]').innerHTML=`${placa?patente(placa):'<p>Elegí un auto.</p>'}<p>${esc(modelo)}</p><p>${esc(resumenMotivos(motivos,d.otro)||d.relato||'Motivo por indicar')}</p>`;
    };
    const detalleMotivos=()=>{
      f.querySelectorAll('[data-motivo]').forEach(b=>b.setAttribute('aria-pressed',String(motivos.some(m=>m.id===b.dataset.motivo))));
      f.querySelector('[data-otro]').hidden=!motivos.some(m=>m.id==='otro');
      f.querySelector('[data-detalles]').innerHTML=motivos.map(x=>{const m=MOTIVOS.find(m=>m.id===x.id);return !m?.detalles.length?'':`<fieldset class="rec-detalles"><legend>${esc(m.pregunta)}</legend><div>${m.detalles.map(d=>`<button type="button" class="btn" data-detalle="${m.id}" data-valor="${esc(d)}" aria-pressed="${x.detalles.includes(d)}">${esc(d)}</button>`).join('')}</div></fieldset>`;}).join('');
      f.querySelectorAll('[data-detalle]').forEach(b=>b.onclick=()=>{const x=motivos.find(x=>x.id===b.dataset.detalle),v=b.dataset.valor;x.detalles=x.detalles.includes(v)?x.detalles.filter(d=>d!==v):[...x.detalles,v];detalleMotivos();guardar();vistaDatos();f.querySelector(`[data-detalle="${b.dataset.detalle}"][data-valor="${CSS.escape(v)}"]`)?.focus();});
    };
    const validar=i=>{
      const d=campos();
      if(i===0){if(modo==='nuevo'){
        if(!d.sinPatente&&d.patente.trim().replace(/\W/g,'').length<3)throw falla('Escribí la patente o indicá que no se puede leer.','patente');
        if(!d.marca.trim())throw falla('Elegí una marca o completá Otra.','marca');
        if(!d.modelo.trim())throw falla('Escribí el modelo del auto.','modelo');
        if(d.anio&&(!/^\d{4}$/.test(d.anio)||+d.anio<1900||+d.anio>2100))throw falla('Revisá el año o dejalo vacío.','anio');
        if(!d.cnombre.trim())throw falla('Escribí el nombre del cliente.','cnombre');
        if(!d.contactoId&&d.ctelefono.replace(/\D/g,'').length<6)throw falla('Revisá el teléfono del cliente.','ctelefono');
      }else if(!elegido||modo!=='conocido')throw falla('Elegí un auto o cargá uno nuevo.','vehiculoId');
      else if(elegido.visitas?.some(x=>!x.entregada_at&&!x.anulada_at))throw falla('Este auto ya tiene una orden abierta. Continuá esa orden.','vehiculoId');}
      if(i===1){fotosIngreso.validar(d.carroceria);if(!d.tableroEstado)throw falla('Indicá el estado del tablero.','tableroEstado');if(d.tableroEstado!=='sin_testigos'&&!d.ingresoTestigos.trim())throw falla('Detallá los testigos o por qué no enciende.','ingresoTestigos');if(!d.carroceria)throw falla('Indicá si observás daños previos.','carroceria');if(!d.ingresoObservaciones.trim())throw falla('Describí el estado visible al ingresar.','ingresoObservaciones');if(!d.ingresoConfirmado)throw falla('Confirmá que revisaste las fotos y el estado al ingresar.','ingresoConfirmado');}
      if(i===2){if(!motivos.length&&!d.relato.trim())throw falla('Elegí un motivo o escribí lo que cuenta el cliente.','relato');if(motivos.some(m=>m.id==='otro')&&!d.otro.trim())throw falla('Contá el otro motivo.','otro');}
      if(i===3&&!d.sinKm){const n=d.km.replace(/[.\s]/g,'');if(!/^\d+$/.test(n)||+n>9999999)throw falla('Escribí los kilómetros o marcá Sin lectura.','km');const ultima=ultimaLectura(elegido?.lecturas);if(modo==='conocido'&&ultima&&+n<ultima.km&&!d.kmExplicacion.trim())throw falla(`La lectura anterior es ${ultima.km} km. Explicá la diferencia.`,'kmExplicacion');}
      if(i===4){if(!d.tipo)throw falla('Elegí qué autoriza el cliente.','tipo');if(d.tipo==='revision'&&!d.revisionCosto)throw falla('Indicá si la revisión tiene costo.','revisionCosto');if((d.tipo==='service'||d.revisionCosto==='si')&&!d.autPersona.trim())throw falla('Indicá quién autorizó lo acordado.','autPersona');}
      if(i===5&&d.quien==='otra'&&!d.dejaNombre.trim())throw falla('Escribí quién deja el auto.','dejaNombre');
    };
    const revisar=()=>{
      const d=campos(),auto=modo==='nuevo'?[d.sinPatente?'Sin patente visible':d.patente,d.marca,d.modelo,d.anio].filter(Boolean).join(' · '):[elegido?.patente,elegido?.marca,elegido?.modelo].filter(Boolean).join(' · ');
      const filas=[['Auto',auto,0],['Cliente',modo==='nuevo'?d.cnombre+' · '+d.ctelefono:(elegido?.contacto?.nombre||'Contacto del vehículo'),0],['Fotos del ingreso',fotosIngreso.datos().length+' fotos: '+fotosIngreso.datos().map(x=>x.tipo).join(', '),1],['Estado observado',d.ingresoObservaciones,1],['Tablero / testigos',[{sin_testigos:'Sin testigos de falla observados',con_testigos:'Testigos encendidos',no_enciende:'No se puede encender'}[d.tableroEstado],d.ingresoTestigos].filter(Boolean).join(' · '),1],['Motivo',resumenMotivos(motivos,d.otro)||'Sin botones seleccionados',2],['En palabras del cliente',d.relato||'No se cargó',2],['Kilometraje',d.sinKm?'Sin lectura':d.km+' km',3],['Aclaración de la lectura',d.kmExplicacion||'No se cargó',3],['Autorización',d.tipo==='service'?'Service ya autorizado':`Revisión y presupuesto · ${d.revisionCosto==='si'?'con costo':'sin costo'}`,4],['Quién autorizó',d.autPersona&&!(d.tipo==='revision'&&d.revisionCosto==='no')?d.autPersona:'No corresponde',4],['Importe acordado',d.autImporte&&!(d.tipo==='revision'&&d.revisionCosto==='no')?d.autImporte:'No se cargó',4],['Plantilla de tareas',d.tipo==='service'?(cat.plantillas.find(p=>String(p.id)===d.plantillaId)?.nombre||'Sin plantilla'):'No corresponde',4],['Quién trae el auto',d.quien==='otra'?d.dejaNombre+' · '+d.dejaTelefono:'El cliente',5],['Responsable',usuarios.find(u=>String(u.id)===d.responsableId)?.nombre||'Sin asignar',5],['Retiro',d.retiro?.replace('T',' ')||'A confirmar',5],['Prioridad',d.urgente?'Urgente':'Normal',5],['Nota de retiro',d.retiroNota||'No se cargó',5]];
      f.querySelector('[data-revision-final]').innerHTML=filas.map(([k,v,i])=>`<button type="button" class="rec-review-row" data-cambiar="${i}" aria-label="Cambiar ${k}"><span><small>${k}</small><strong>${esc(v)}</strong></span><span>Cambiar</span></button>`).join('');
      f.querySelectorAll('[data-cambiar]').forEach(b=>b.onclick=()=>{volverRevision=true;irPaso(+b.dataset.cambiar);});
    };
    const irPaso=(i,enfocar=true)=>{
      const anterior=paso;detenerMovimiento(f);
      paso=i;limpiarErrores(f);f.querySelectorAll('[data-paso]').forEach(s=>s.hidden=+s.dataset.paso!==i);
      raiz.querySelectorAll('[data-progreso]').forEach(s=>s.classList.toggle('completo',+s.dataset.progreso<=i));raiz.querySelector('.rec-progreso').setAttribute('aria-valuenow',i+1);raiz.querySelector('.rec-progreso').setAttribute('aria-valuetext',PASOS[i]);raiz.querySelector('[data-paso-label]').textContent=`Paso ${i+1} de ${PASOS.length} · ${PASOS[i]}`;
      f.querySelectorAll('[data-indice]').forEach(li=>li.toggleAttribute('aria-current',+li.dataset.indice===i));f.querySelector('[data-omitir]').hidden=i!==5||volverRevision;f.querySelector('[data-continuar]').type=i===6?'submit':'button';f.querySelector('[data-continuar]').innerHTML=i===6?`Recibir ${icono('check')}`:volverRevision?'Volver a revisión':`Continuar ${icono('der')}`;
      vistaDatos();if(i===6)revisar();if(enfocar){window.scrollTo(0,0);f.querySelector(`[data-paso="${i}"] h2`).focus({preventScroll:true});}guardar();
      if(enfocar&&i!==anterior)entrada(f.querySelector(`[data-paso="${i}"]`),{tipo:'paso',direccion:i-anterior});
    };
    const bloquear=()=>{f.querySelectorAll('input,select,textarea,button').forEach(e=>{if(!e.matches('[data-continuar]'))e.disabled=true;});raiz.querySelector('[data-atras]').disabled=true;f.querySelector('[data-continuar]').textContent='Reintentar el ingreso';};
    const seleccionar=async id=>{const n=++consulta;try{const r=await get('/api/vehiculos/'+id);if(n!==consulta||!f.isConnected)return;if(elegido?.id!==r.vehiculo.id){relacionada=null;fotosIngreso.reiniciar();}elegido=r.vehiculo;modo='conocido';resultados.innerHTML='';vistaDatos();guardar();if(!elegido.visitas?.some(x=>!x.entregada_at&&!x.anulada_at))irPaso(1);}catch(e){toast(e.message,{error:true});}};
    const enlazarResultados=box=>box.querySelectorAll('[data-elegir]').forEach(b=>b.onclick=()=>seleccionar(b.dataset.elegir));
    const buscar=async()=>{const n=++consulta,t=q.value.trim();f.querySelector('[data-recientes]').hidden=t.length>=2;if(t.length<2){resultados.innerHTML='';return;}try{const r=await get('/api/buscar?q='+encodeURIComponent(t));if(n!==consulta||!f.isConnected)return;resultados.innerHTML=r.vehiculos.length?r.vehiculos.map(resultado).join(''):'<p class="rec-vacio">No hay coincidencias. Revisá la patente o cargá un auto nuevo.</p>';enlazarResultados(resultados);}catch(e){if(n===consulta)resultados.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}};
    q.oninput=()=>{++consulta;clearTimeout(timer);timer=setTimeout(buscar,220);};
    const nuevo=sin=>{if(modo!=='nuevo')fotosIngreso.reiniciar();++consulta;clearTimeout(timer);relacionada=null;modo='nuevo';f.elements.sinPatente.checked=sin;if(!f.elements.patente.value&&q.value.trim())f.elements.patente.value=q.value.trim().toUpperCase();vistaDatos();guardar();f.querySelector('[data-nuevo-auto] h2').focus();};
    f.querySelector('[data-nuevo]').onclick=()=>nuevo(false);f.querySelector('[data-sin-patente]').onclick=()=>nuevo(true);f.querySelector('[data-volver-busqueda]').onclick=()=>{modo=elegido?'conocido':'buscar';vistaDatos();guardar();q.focus();};
    f.querySelectorAll('[name=marcaOpcion]').forEach(r=>r.onchange=()=>{marca();guardar();vistaDatos();});f.elements.marcaOtra.oninput=()=>marca();
    f.querySelectorAll('[data-motivo]').forEach(b=>b.onclick=()=>{const id=b.dataset.motivo;motivos=motivos.some(m=>m.id===id)?motivos.filter(m=>m.id!==id):[...motivos,{id,detalles:[]}];detalleMotivos();vistaDatos();guardar();});
    f.addEventListener('input',e=>{if(e.target===f.elements.marca)return;if(modo==='nuevo'&&['patente','sinPatente','marcaOpcion','marcaOtra','modelo'].includes(e.target.name)&&fotosIngreso.tieneFotos()){fotosIngreso.reiniciar();toast('Cambiaste el auto: cargá nuevas fotos para este ingreso.');}if(e.target.type!=='search'){vistaDatos();guardar();}});f.addEventListener('change',()=>{vistaDatos();guardar();});
    raiz.querySelector('[data-atras]').onclick=()=>{if(pendiente)return;if(paso===0){if(modo==='nuevo'){modo=elegido?'conocido':'buscar';vistaDatos();guardar();}else app.ir('#/hoy');}else if(volverRevision){volverRevision=false;irPaso(6);}else irPaso(paso-1);};
    f.querySelector('[data-omitir]').onclick=()=>{try{validar(5);irPaso(6);}catch(e){mostrarError(f,e);}};
    const cq=f.querySelector('#rec-contacto-q'),cc=f.querySelector('[data-contactos]');
    cq.oninput=()=>{const n=++consultaContacto;clearTimeout(ctimer);const t=cq.value.trim();if(t.length<2){cc.innerHTML='';return;}ctimer=setTimeout(async()=>{try{const r=await get('/api/contactos?q='+encodeURIComponent(t));if(n!==consultaContacto||!f.isConnected)return;cc.innerHTML=r.contactos.slice(0,5).map(c=>`<button type="button" class="resultado" data-contacto="${c.id}"><strong>${esc(c.nombre)}</strong><span>${esc(c.telefono||'Sin teléfono')}</span><span>Reutilizar contacto</span></button>`).join('')||'<p class="small muted">Sin coincidencias. Completá los datos del cliente.</p>';cc.querySelectorAll('[data-contacto]').forEach(b=>b.onclick=()=>{const c=r.contactos.find(c=>c.id===+b.dataset.contacto);f.elements.contactoId.value=c.id;f.elements.cnombre.value=c.nombre;f.elements.ctelefono.value=c.telefono||'';f.elements.cnombre.readOnly=true;f.elements.ctelefono.readOnly=true;cc.innerHTML='';const p=f.querySelector('[data-contacto-elegido]');p.hidden=false;p.innerHTML='Contacto existente elegido. <button type="button" class="btn btn-texto">Usar otro contacto</button>';p.querySelector('button').onclick=()=>{f.elements.contactoId.value='';f.elements.cnombre.readOnly=false;f.elements.ctelefono.readOnly=false;p.hidden=true;guardar();};guardar();vistaDatos();});}catch(e){cc.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}},220);};
    f.querySelector('[data-continuar]').addEventListener('click',e=>{if(paso===6)return;e.preventDefault();try{validar(paso);const siguiente=volverRevision?6:paso+1;volverRevision=false;irPaso(siguiente);}catch(e){mostrarError(f,e);}});
    f.addEventListener('keydown',e=>{if(e.key==='Enter'&&paso<6&&e.target.tagName==='INPUT'&&!['radio','checkbox','search'].includes(e.target.type)){e.preventDefault();f.querySelector('[data-continuar]').click();}});
    alEnviar(f,async()=>{
      if(!pendiente){try{validar(paso);}catch(e){throw e;}if(paso<6){const siguiente=volverRevision?6:paso+1;volverRevision=false;irPaso(siguiente);return false;}
        for(let i=0;i<6;i++){try{validar(i);}catch(e){irPaso(i);throw e;}}
      }
      const d=campos();
      const cuerpo=pendiente||{estadoIngreso:{clave:claveDeEnvio(f),fotos:fotosIngreso.datos().map(({id,tipo,descripcion})=>({id,tipo,descripcion})),carroceria:d.carroceria,tablero:d.tableroEstado,observaciones:d.ingresoObservaciones,testigos:d.ingresoTestigos,confirmado:!!d.ingresoConfirmado},tipo:d.tipo,km:d.sinKm?'':d.km,sinKm:!!d.sinKm,kmExplicacion:d.kmExplicacion,responsableId:d.responsableId||null,retiro:d.retiro||null,retiroNota:d.retiroNota,prioridad:d.urgente?'alta':'normal',relacionadaId:relacionada?.id||null,turnoId:turno?.id||null,plantillaId:d.tipo==='service'?d.plantillaId||null:null,autorizacion:d.tipo==='service'?{persona:d.autPersona,importe:d.autImporte}:d.revisionCosto==='si'?{revisionConCosto:true,persona:d.autPersona,importe:d.autImporte}:{},recepcion:{motivos,otro:d.otro,relato:d.relato,autoriza:d.tipo,revisionCosto:d.revisionCosto},...(modo==='conocido'?{vehiculoId:elegido.id,...(d.quien==='otra'?{contacto:{nombre:d.dejaNombre,telefono:d.dejaTelefono}}:{})}:{vehiculo:{patente:d.sinPatente?`SIN PATENTE ${f.dataset.clave.slice(0,6).toUpperCase()}`:d.patente,marca:d.marca,modelo:d.modelo,anio:d.anio},...(d.contactoId?{contactoId:+d.contactoId}:{contacto:{nombre:d.cnombre,telefono:d.ctelefono}})})};
      // La persona que lo trae no reemplaza al titular del vehículo nuevo.
      if(!pendiente&&modo==='nuevo'&&d.quien==='otra')cuerpo.retiroNota=[d.retiroNota,`Lo dejó ${d.dejaNombre}${d.dejaTelefono?' · '+d.dejaTelefono:''}`].filter(Boolean).join('. ').slice(0,300);
      f.querySelector('[data-continuar]').textContent='Guardando…';
      try{const r=await post('/api/visitas',cuerpo,{idempotencia:claveDeEnvio(f)});borrarBorrador(app);delete f.dataset.sucio;raiz.innerHTML=`<section class="rec-exito"><span class="rec-exito-icon">${icono('check')}</span><h1 tabindex="-1">Auto recibido</h1><p>El servidor confirmó la orden <strong>N.º ${esc(r.visita.numero)}</strong> para ${esc(r.visita.vehiculo.patente)}.</p><a class="btn btn-primario" href="#/visitas/${r.id}">Abrir la orden</a><a class="btn" href="#/recibir?nueva=1">Recibir otro auto</a><a class="btn btn-texto" href="#/hoy">Volver a Hoy</a></section>`;raiz.querySelector('h1').focus();}
      catch(e){if(e.datos?.guardadoSinConfirmar){pendiente=cuerpo;guardar();bloquear();}else{const mapa={patente:0,marca:0,modelo:0,anio:0,cnombre:0,ctelefono:0,fotosIngreso:1,carroceria:1,tableroEstado:1,ingresoObservaciones:1,ingresoTestigos:1,ingresoConfirmado:1,motivos:2,relato:2,otro:2,km:3,kmExplicacion:3,tipo:4,revisionCosto:4,autPersona:4,autImporte:4,responsableId:5,retiro:5};irPaso(mapa[e.campo]??6);f.querySelector('[data-continuar]').textContent=paso===6?'Reintentar el ingreso':'Continuar';if(e.datos?.visitaAbierta)toast(e.message,{error:true,accion:{texto:'Abrir orden',fn:()=>app.ir('#/visitas/'+e.datos.visitaAbierta.id)}});}throw e;}
    });
    if(draft?.campos?.contactoId){f.elements.cnombre.readOnly=true;f.elements.ctelefono.readOnly=true;const p=f.querySelector('[data-contacto-elegido]');p.hidden=false;p.innerHTML='Contacto existente recuperado del borrador. <button type="button" class="btn btn-texto">Usar otro contacto</button>';p.querySelector('button').onclick=()=>{f.elements.contactoId.value='';f.elements.cnombre.readOnly=false;f.elements.ctelefono.readOnly=false;p.hidden=true;guardar();};}
    marca();detalleMotivos();irPaso(paso,false);if(pendiente)bloquear();
    if(!pendiente){get('/api/vehiculos').then(r=>{if(!f.isConnected)return;const box=f.querySelector('[data-lista-recientes]');box.innerHTML=r.vehiculos.filter(v=>!v.archivado).slice(0,6).map(resultado).join('')||'<p class="muted">Todavía no hay vehículos.</p>';enlazarResultados(box);}).catch(e=>{if(f.isConnected)f.querySelector('[data-lista-recientes]').textContent=e.message;});if(q.value)buscar();}
  }};
}
