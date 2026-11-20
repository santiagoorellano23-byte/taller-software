import {get,post,claveDeEnvio} from '../api.js?v=0.1.0';
import {esc,icono,patente,nombreAuto,fecha,campo,casilla,opcionesRadio,leerForm,alEnviar,mostrarError,limpiarErrores,toast,confirmar} from '../ui.js?v=0.1.0';
import {enlazarModelos} from './autos.js?v=0.1.0';
import {entrada,detenerMovimiento} from '../movimiento.js?v=0.1.0';
import {MARCAS,MOTIVOS,material,resumenMotivos,leerBorrador,guardarBorrador,borrarBorrador,borradorPara,ultimaLectura,visitaRelacionada} from '../recepcion-modelo.js?v=0.1.0';
import {enlazarFotosIngreso,FORMATOS} from '../estado-ingreso.js?v=0.1.0';
import {ic,placa as placaD,logoMarca} from '../diseno.js?v=0.1.0';

const PASOS=['Auto','Estado al ingresar','Motivo','Kilometraje','Autorización','Datos opcionales','Revisión'];
const falla=(message,campo)=>Object.assign(new Error(message),{campo});
// Paso 2: opción grande con ícono, aclaración y marca de elegida; número de cada bloque; atajos de testigos (escriben en el texto).
const op=(n,v,t,s,i)=>`<label class="p2-op"><input type="radio" name="${n}" value="${v}">${ic(i,'p2-op-ic')}<span class="p2-op-t"><b>${t}</b>${s?`<small>${s}</small>`:''}<span class="p2-op-sel" aria-hidden="true">${ic('check')}Elegido</span></span><span class="p2-op-ind" aria-hidden="true">${ic('check')}</span></label>`;
const n2=n=>`<span class="p2-n" data-n2="${n}">${n}</span>`;
const TESTIGOS=['Check engine','Batería','Aceite','Temperatura','ABS','Airbag','Frenos'];
function resultado(v){
  const abierta=v.visitaAbierta||v.visitas?.find(x=>!x.entregada_at&&!x.anulada_at);
  const cliente=typeof v.contacto==='object'?v.contacto?.nombre:v.contacto;
  // Fila compacta: si ya tiene una orden abierta, lleva a esa orden (no se abre otra); si no, se elige.
  const id=`<span class="t-id">${placaD(v.patente)}<span class="t-mod"><b>${esc([v.marca,v.modelo].filter(Boolean).join(' ')||'Vehículo sin datos')}</b><small>${esc(cliente||'Sin contacto')}</small></span></span>`;
  return abierta?`<a class="orden-f rec-fila" href="#/visitas/${abierta.id}">${logoMarca(v.marca)}${id}<span class="chip warn">En el taller · N.º ${esc(abierta.numero)}</span></a>`
    :`<button type="button" class="orden-f rec-fila" data-elegir="${v.id}" aria-label="Elegir ${esc(v.patente||'auto sin patente')}">${logoMarca(v.marca)}${id}${ic('chevron_right','chev')}</button>`;
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
  return {titulo:'Recibir un auto',html:`<div class="rec-b">
    <header class="rec-banda"><a class="ibtn" href="#/hoy" aria-label="Salir de la recepción" title="Salir de la recepción">${ic('close')}</a><div><h1 tabindex="-1">Recibir un auto</h1><p><span data-paso-label>Paso 1 de 7 · Auto</span><span class="rec-placa" data-placa-banda hidden></span></p><div class="rec-tramos" aria-hidden="true">${PASOS.map((_,i)=>`<span data-tramo="${i}"></span>`).join('')}</div></div><button class="ibtn" type="button" data-atras aria-label="Volver al paso anterior" title="Volver al paso anterior">${ic('arrow_back')}</button></header>
    <form id="f-recibir" class="rec-hoja" novalidate>
      <ol class="hoja-ing">
        <li class="hi" data-hi="0"><button type="button" class="hi-fila" data-ir-paso="0"><span class="hi-n">1</span><span class="hi-t"><b>${PASOS[0]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="0" class="rec-etapa">
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
        </section></li>
        <li class="hi" data-hi="1"><button type="button" class="hi-fila" data-ir-paso="1"><span class="hi-n">2</span><span class="hi-t"><b>${PASOS[1]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="1" class="rec-etapa p2" hidden><h2 tabindex="-1"><span>¿Cómo llega?<small>Fotos y estado del auto al ingresar</small></span></h2>
          <div class="p2-res" data-p2-res role="alert" tabindex="-1" hidden></div>
          <div class="p2-bloque" id="p2-fotos" data-campo="fotosIngreso"><h3 class="p2-sh">${n2(1)}Fotos</h3><p class="p2-sub">Tablero y exterior son obligatorias · ${FORMATOS.replace(' · ',' de ')}</p><div data-fotos-ingreso></div></div>
          <fieldset class="p2-bloque p2-ops" id="p2-tablero" data-campo="tableroEstado"><legend><h3 class="p2-sh">${n2(2)}Estado del tablero</h3></legend>
            ${op('tableroEstado','sin_testigos','Sin alertas observadas','Enciende y no hay testigos de falla','speed')}
            ${op('tableroEstado','con_testigos','Con testigos encendidos','Indicá cuáles','warning')}
            <div class="p2-det" data-det="con_testigos" data-campo="ingresoTestigos" hidden><label class="p2-lbl" for="rec-testigos">¿Qué testigos están encendidos? <span class="p2-req">· obligatorio</span></label><input class="p2-inp" id="rec-testigos" name="testigosVer" maxlength="900" autocomplete="off" placeholder="Ej.: check engine y batería">
              <div class="p2-atajos" role="group" aria-label="Atajos de testigos"><span>Tocá para sumar o quitar</span>${TESTIGOS.map(t=>`<button type="button" class="p2-at" data-atajo="${t}" aria-pressed="false">${ic('check')}${t}</button>`).join('')}</div>
              <fieldset class="p2-motor"><legend class="p2-lbl">Al mirarlo <span class="p2-req">(opcional)</span></legend><label class="p2-chip"><input type="radio" name="motorEstado" value="encendido"><span>Motor encendido</span></label><label class="p2-chip"><input type="radio" name="motorEstado" value="contacto"><span>Solo en contacto</span></label></fieldset></div>
            ${op('tableroEstado','no_enciende','No enciende el tablero','Distinto de «enciende pero el motor no arranca»','key_off')}
            <div class="p2-det" data-det="no_enciende" data-campo="ingresoTestigos" hidden><label class="p2-lbl" for="rec-noenc">¿Qué pasa al intentar encenderlo? <span class="p2-req">· obligatorio</span></label><textarea class="p2-inp" id="rec-noenc" name="noEncVer" rows="2" maxlength="1000" placeholder="Ej.: gira la llave y no prende ninguna luz"></textarea><p class="p2-ayuda">${ic('info')}<span>Si el tablero enciende pero el motor no arranca, elegí otra opción y anotalo en el Motivo.</span></p></div>
            <div data-aparte></div><input type="hidden" name="ingresoTestigos"></fieldset>
          <fieldset class="p2-bloque p2-ops" id="p2-carroceria" data-campo="carroceria"><legend><h3 class="p2-sh">${n2(3)}Carrocería e interior</h3></legend>
            ${op('carroceria','sin_danos','Sin daños visibles observados','','check_circle')}
            ${op('carroceria','con_danos','Con daños previos','Cada daño con descripción y foto','car_crash')}
            <div class="p2-danos" data-danos></div><input type="hidden" name="ingresoObservaciones"></fieldset>
          <div class="p2-bloque" data-campo="ingresoObservaciones"><div class="p2-campo"><label for="rec-aclaracion">Observaciones al ingresar <span class="p2-req">(opcional)</span></label><textarea class="p2-inp" id="rec-aclaracion" name="ingresoAclaracion" maxlength="600" rows="2" placeholder="Algo que el taller deba saber al recibirlo"></textarea><p class="p2-ayuda">No vuelven a pedir la verificación.</p></div></div>
          <div class="p2-bloque" id="p2-verificacion"><h3 class="p2-sh">${n2(4)}Verificación</h3>
            <div class="p2-ver"><div class="p2-ver-fotos" data-ver-fotos></div><dl data-ver-datos></dl><p class="p2-aviso warn" data-invalida hidden></p>
              <label class="p2-casilla" data-campo="ingresoConfirmado"><input type="checkbox" name="ingresoConfirmado" value="1" aria-describedby="p2-ver-d"><span class="p2-caja" aria-hidden="true">${ic('check')}</span><span><b>Verifiqué las fotos y el estado de este auto</b><small id="p2-ver-d" data-ver-d></small></span></label></div></div>
        </section></li>
        <li class="hi" data-hi="2"><button type="button" class="hi-fila" data-ir-paso="2"><span class="hi-n">3</span><span class="hi-t"><b>${PASOS[2]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="2" class="rec-etapa" hidden><h2 tabindex="-1">¿Por qué viene?</h2><p class="rec-explica">Marcá lo que cuenta el cliente. Podés marcar varios. No es un diagnóstico.</p>
          ${turno?.motivo?`<p class="aviso">En el turno dijo: ${esc(turno.motivo)}. Revisalo con el cliente.</p>`:''}
          <div class="rec-motivos" data-campo="motivos">${MOTIVOS.slice(0,6).map(m=>`<button type="button" class="rec-motivo" data-motivo="${m.id}" aria-pressed="false">${material(m.icono)}<strong>${m.nombre}</strong><span class="rec-check" aria-hidden="true">${icono('check')}</span></button>`).join('')}</div>
          <details class="rec-mas"><summary>Ver más motivos</summary><div class="rec-motivos">${MOTIVOS.slice(6).map(m=>`<button type="button" class="rec-motivo" data-motivo="${m.id}" aria-pressed="false">${material(m.icono)}<strong>${m.nombre}</strong><span class="rec-check" aria-hidden="true">${icono('check')}</span></button>`).join('')}</div></details>
          <div data-detalles></div><div data-otro hidden>${campo({nombre:'otro',etiqueta:'Otro motivo',requerido:true,attrs:'maxlength="200"'})}</div>
          ${campo({nombre:'relato',etiqueta:'En palabras del cliente',tipo:'textarea',attrs:'maxlength="1000" rows="3"',ayuda:'Se guarda aparte de los botones: desmarcar un motivo no borra este texto.',valor:relacionada?'Vuelve por: '+relacionada.motivo:turno?.motivo||'',placeholder:'Ej.: chilla al frenar en bajada'})}
        </section></li>
        <li class="hi" data-hi="3"><button type="button" class="hi-fila" data-ir-paso="3"><span class="hi-n">4</span><span class="hi-t"><b>${PASOS[3]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="3" class="rec-etapa" hidden><h2 tabindex="-1">Kilometraje</h2><p class="rec-explica">Lo que marca el tablero al ingresar.</p>
          ${campo({nombre:'km',etiqueta:'Lectura del tablero (km)',requerido:true,attrs:'inputmode="numeric" maxlength="9"',placeholder:'Ej.: 84150'})}${casilla('sinKm','Sin lectura')}
          <div data-explicacion-km>${campo({nombre:'kmExplicacion',etiqueta:'Aclaración de la lectura',tipo:'textarea',attrs:'maxlength="500"',ayuda:'Si la lectura es menor que la anterior, explicá la diferencia. Si no se puede leer, podés indicar por qué.'})}</div>
        </section></li>
        <li class="hi" data-hi="4"><button type="button" class="hi-fila" data-ir-paso="4"><span class="hi-n">5</span><span class="hi-t"><b>${PASOS[4]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="4" class="rec-etapa" hidden><h2 tabindex="-1">¿Qué autoriza hoy el cliente?</h2><p class="rec-explica">Registrá lo acordado. Un motivo no es una autorización.</p>
          ${opcionesRadio('tipo',[['revision','Revisión y presupuesto','buscar'],['service','Service ya autorizado','service']],'','Qué autoriza')}
          <p class="small muted">Revisión y presupuesto no autoriza reparar. Service registra solo lo acordado al ingresar; los adicionales requieren su propia respuesta.</p>
          <div data-revision hidden>${opcionesRadio('revisionCosto',[['si','Sí, con costo'],['no','Sin costo']],'','¿La revisión tiene costo para el cliente?')}</div>
          <div data-autorizado hidden class="bloque"><div class="fila-campos">${campo({nombre:'autPersona',etiqueta:'Quién autorizó',requerido:true,attrs:'maxlength="120"'})}${campo({nombre:'autImporte',etiqueta:'Importe acordado',attrs:'inputmode="decimal"',ayuda:'Solo si ya se acordó. Cero significa sin cargo.'})}</div></div>
          <div data-service hidden>${campo({nombre:'plantillaId',etiqueta:'Plantilla de tareas',tipo:'select',opciones:[['','Sin plantilla'],...cat.plantillas.filter(p=>p.activo).map(p=>[p.id,p.nombre])],ayuda:'Propone tareas; no las marca hechas ni agrega cargos.'})}</div>
        </section></li>
        <li class="hi" data-hi="5"><button type="button" class="hi-fila" data-ir-paso="5"><span class="hi-n">6</span><span class="hi-t"><b>${PASOS[5]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="5" class="rec-etapa" hidden><h2 tabindex="-1">Antes de terminar</h2><p class="rec-explica">Todo opcional. Si no se sabe ahora, se completa después en la ficha.</p>
          ${opcionesRadio('quien',[['cliente','El cliente'],['otra','Otra persona']],'cliente','¿Quién trae el auto?',{requerido:false})}<div data-otra-persona hidden>${campo({nombre:'dejaNombre',etiqueta:'Nombre de quien lo deja',requerido:true,attrs:'maxlength="120"'})}${campo({nombre:'dejaTelefono',etiqueta:'Su teléfono',tipo:'tel',attrs:'maxlength="40"'})}</div>
          ${campo({nombre:'responsableId',etiqueta:'Responsable',tipo:'select',opciones:[['','Sin asignar'],...usuarios.filter(u=>u.activo).map(u=>[u.id,u.nombre])],valor:relacionada?.responsable_id||''})}
          ${campo({nombre:'retiro',etiqueta:'Retiro acordado',tipo:'datetime-local',ayuda:'Vacío significa a confirmar.'})}${casilla('urgente','Marcar como urgente')}${campo({nombre:'retiroNota',etiqueta:'Nota de retiro',attrs:'maxlength="300"',placeholder:'Ej.: lo retira la hija'})}
        </section></li>
        <li class="hi" data-hi="6"><button type="button" class="hi-fila" data-ir-paso="6"><span class="hi-n">7</span><span class="hi-t"><b>${PASOS[6]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="6" class="rec-etapa" hidden><h2 tabindex="-1">Revisá y confirmá el ingreso</h2><p class="rec-explica">El auto queda recibido recién cuando tocás «Confirmar el ingreso» y el servidor lo guarda. Podés cambiar cualquier dato.</p><div class="rec-revision" data-revision-final></div></section></li>
      </ol>
      <footer class="rec-barra"><div class="rec-barra-i"><p class="rec-borr">${ic('edit_note')}<span data-estado-borrador role="status">Completá los datos para continuar.</span></p><button type="button" class="rec-faltan" data-faltan hidden></button></div>
        <div class="hi-acc" data-acciones><button type="button" class="btn" data-atras-barra>${ic('arrow_back')}Atrás</button><button type="button" class="btn btn-texto" data-omitir hidden>Omitir</button><button type="submit" class="btn btn-primario" data-continuar>Continuar</button></div></footer>
    </form>
  </div>`,despues(raiz){
    const f=raiz.querySelector('#f-recibir'),q=f.querySelector('#rec-q'),resultados=f.querySelector('[data-resultados]');
    let modo=elegido?'conocido':'buscar',paso=0,volverRevision=false,motivos=[],consulta=0,consultaContacto=0,timer,ctimer,pendiente=null;
    let fotosIngreso,carroceriaVista;
    let intento2=false,avisoInvalida='';const previo2={};
    const TEXTO_OPCION={con_testigos:'testigosVer',no_enciende:'noEncVer'},NOMBRE_OPCION={con_testigos:'Con testigos encendidos',no_enciende:'No enciende el tablero'};
    // El servidor pide testigos y observaciones como texto: se arman con lo que la persona escribió y eligió. Cada opción
    // del tablero conserva su propio texto en el borrador; solo se envía el de la opción elegida.
    const componer=()=>{
      const d=campos(),motor={encendido:'Motor encendido',contacto:'Solo en contacto'}[d.motorEstado];
      f.elements.ingresoTestigos.value=d.tableroEstado==='con_testigos'?[d.testigosVer.trim(),motor].filter(Boolean).join(' · '):d.tableroEstado==='no_enciende'?d.noEncVer.trim():'';
      const danos=(fotosIngreso?.datos()||[]).filter(x=>x.tipo==='detalle'&&x.descripcion.trim()).map((x,i)=>`Daño ${i+1}: ${x.descripcion.trim()}`);
      const base=d.carroceria==='sin_danos'?'Sin daños visibles observados.':d.carroceria==='con_danos'?danos.join('. '):'';
      f.elements.ingresoObservaciones.value=[base,d.ingresoAclaracion.trim()?`Observaciones: ${d.ingresoAclaracion.trim()}`:''].filter(Boolean).join(' ').slice(0,2000);
    };
    // Un cambio efectivo (foto lista, cambiada o quitada; tablero, su texto, carrocería o daños) vuelve a pedir la
    // verificación y dice qué cambió. Devuelve cómo deshacerlo, para el «Deshacer» de quitar una foto.
    const invalidar=motivo=>{
      const cb=f.elements.ingresoConfirmado;if(!cb.checked)return ()=>{};
      cb.checked=false;avisoInvalida=motivo;actualizar2();guardar();
      return ()=>{cb.checked=true;avisoInvalida='';actualizar2();guardar();};
    };
    // Lo que falta del paso 2, en el orden de la pantalla, con el destino de cada dato.
    const pendientes2=()=>{
      if(!fotosIngreso)return [];
      const d=campos(),F=fotosIngreso.pendientes(d.carroceria),L=F.filter(x=>!x.k.startsWith('dano'));
      if(!d.tableroEstado)L.push({k:'tablero',msg:'Indicá el estado del tablero.',ir:'#p2-tablero input'});
      else if(d.tableroEstado==='con_testigos'&&!d.testigosVer.trim())L.push({k:'tableroNota',msg:'Indicá qué testigos están encendidos.',ir:'#rec-testigos'});
      else if(d.tableroEstado==='no_enciende'&&!d.noEncVer.trim())L.push({k:'tableroNota',msg:'Contá qué pasa al intentar encenderlo.',ir:'#rec-noenc'});
      if(!d.carroceria)L.push({k:'carroceria',msg:'Indicá si observás daños previos.',ir:'#p2-carroceria input'});
      L.push(...F.filter(x=>x.k.startsWith('dano')));
      if(!d.ingresoConfirmado)L.push({k:'verificado',msg:'Confirmá que verificaste las fotos y el estado.',ir:'[name=ingresoConfirmado]'});
      return L;
    };
    const irDato=sel=>{
      const el=f.querySelector(sel);if(!el)return;
      const caja=el.matches('input:not([type=radio]):not([type=checkbox]),textarea,button')?el:el.closest('label,.p2-ft,.p2-dano,[data-campo]')||el;
      caja.scrollIntoView({block:'center'});(el.matches('[type=checkbox]')&&el.disabled?f.querySelector('.p2-casilla'):el).focus({preventScroll:true});
    };
    const resumen2=enfocar=>{
      const caja=f.querySelector('[data-p2-res]'),L=pendientes2();
      caja.hidden=!intento2||!L.length;
      caja.innerHTML=L.length?`<b>${ic('error')}${L.length===1?'Falta un dato para continuar':`Faltan ${L.length} datos para continuar`}</b><ul>${L.map(x=>`<li><button type="button" data-ir-dato="${esc(x.ir)}">${ic('expand_more')}${esc(x.msg)}</button></li>`).join('')}</ul>`:'';
      caja.querySelectorAll('[data-ir-dato]').forEach(b=>b.onclick=()=>irDato(b.dataset.irDato));
      if(enfocar&&L.length){caja.scrollIntoView({block:'start'});caja.focus({preventScroll:true});}
      return !L.length;
    };
    // Estado visible del paso 2: detalle de la opción elegida, texto apartado, atajos, números de bloque, resumen para
    // verificar, casilla habilitada solo con lo demás completo y el contador de la barra.
    const actualizar2=()=>{
      if(!fotosIngreso)return;
      const d=campos(),L=pendientes2(),k=new Set(L.map(x=>x.k)),e=fotosIngreso.estado();
      // El error del servidor sobre el texto del tablero se marca en el detalle visible.
      f.querySelectorAll('[data-det]').forEach(x=>{x.hidden=x.dataset.det!==d.tableroEstado;x.toggleAttribute('data-campo',!x.hidden);if(!x.hidden)x.dataset.campo='ingresoTestigos';});
      const elegidos=d.testigosVer.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);
      f.querySelectorAll('[data-atajo]').forEach(b=>b.setAttribute('aria-pressed',String(elegidos.includes(b.dataset.atajo.toLowerCase()))));
      f.querySelector('[data-aparte]').innerHTML=Object.entries(TEXTO_OPCION).filter(([o,n])=>o!==d.tableroEstado&&d[n].trim()).map(([o,n])=>{const t=d[n].trim();return `<div class="p2-aparte" role="status"><span>${ic('info')} Quedó aparte lo que escribiste para «${NOMBRE_OPCION[o]}»: <q>${esc(t.length>90?t.slice(0,88)+'…':t)}</q>. No se usa con la opción elegida; si volvés a elegirla, aparece de nuevo.</span><span class="p2-acc"><button type="button" class="p2-bt" data-borrar-aparte="${n}">${ic('delete')}Borrar ese texto</button></span></div>`;}).join('');
      f.querySelectorAll('[data-borrar-aparte]').forEach(b=>b.onclick=()=>{f.elements[b.dataset.borrarAparte].value='';toast('Texto borrado.');actualizar2();guardar();f.querySelector('#p2-tablero input:checked')?.focus();});
      const okF=!['fotos','ftablero','fexterior','fdesc'].some(x=>k.has(x)),okT=!k.has('tablero')&&!k.has('tableroNota'),okC=![...k].some(x=>x==='carroceria'||x.startsWith('dano')),ver=!!d.ingresoConfirmado;
      [[1,okF],[2,okT],[3,okC],[4,ver]].forEach(([n,ok])=>{const s=f.querySelector(`[data-n2="${n}"]`);s.classList.toggle('ok',ok);s.innerHTML=ok?`${ic('check')}<span class="sr">completo</span>`:String(n);});
      f.querySelector('#p2-tablero').classList.toggle('p2-error',intento2&&k.has('tablero'));f.querySelector('#p2-carroceria').classList.toggle('p2-error',intento2&&k.has('carroceria'));
      f.querySelectorAll('[data-det]').forEach(x=>{const err=intento2&&k.has('tableroNota')&&x.dataset.det===d.tableroEstado;x.classList.toggle('p2-error',err);x.querySelector('input,textarea').toggleAttribute('aria-invalid',err);});
      const M=e.miniaturas;f.querySelector('[data-ver-fotos]').innerHTML=`${M.slice(0,5).map(m=>`<img src="${m.src}" alt="">`).join('')}${M.length>5?`<span class="p2-mas-n">+${M.length-5}</span>`:''}<small>${M.length?M.length+(M.length===1?' foto':' fotos'):'Sin fotos todavía'}</small>`;
      const tab=d.tableroEstado==='sin_testigos'?'Sin alertas observadas':d.tableroEstado==='con_testigos'?'Con testigos'+(d.testigosVer.trim()?': '+d.testigosVer.trim():''):d.tableroEstado==='no_enciende'?'No enciende'+(d.noEncVer.trim()?': '+d.noEncVer.trim():''):'';
      const car=d.carroceria==='sin_danos'?'Sin daños visibles observados':d.carroceria==='con_danos'?`${e.detalle} ${e.detalle===1?'daño previo':'daños previos'}`:'';
      f.querySelector('[data-ver-datos]').innerHTML=`<dt>Tablero</dt><dd class="${tab?'':'falta'}">${esc(tab||'Falta indicar')}</dd><dt>Carrocería</dt><dd class="${car?'':'falta'}">${esc(car||'Falta indicar')}</dd>`;
      const inv=f.querySelector('[data-invalida]');inv.hidden=!avisoInvalida||ver;inv.innerHTML=avisoInvalida?`${ic('warning')}<span>${esc(avisoInvalida)} Revisá y volvé a confirmar.</span>`:'';
      const resto=L.every(x=>x.k==='verificado'),cb=f.elements.ingresoConfirmado,cas=f.querySelector('.p2-casilla');
      cb.disabled=!resto&&!ver;cas.classList.toggle('dis',cb.disabled);cas.classList.toggle('on',ver);cas.classList.toggle('p2-error',intento2&&resto&&!ver);
      f.querySelector('[data-ver-d]').textContent=cb.disabled?'Se habilita cuando estén las fotos obligatorias y el estado.':'Si cambiás una foto o el estado, se vuelve a pedir.';
      const b=raiz.querySelector('[data-faltan]');b.hidden=paso!==1||!!pendiente;b.classList.toggle('ok',!L.length);b.innerHTML=L.length?(L.length===1?'Falta 1':`Faltan ${L.length}`):`${ic('check')}Completo`;b.setAttribute('aria-label',L.length?`${L.length===1?'Falta un dato':`Faltan ${L.length} datos`}. Ver cuáles`:'Paso 2 completo');
      if(intento2)resumen2(false);
    };
    const campos=()=>leerForm(f);
    if(draft&&!query.vehiculo&&!query.turno&&!query.patente){
      for(const [k,v] of Object.entries(draft.campos||{})){const es=[...f.elements].filter(e=>e.name===k);for(const e of es){if(e.type==='checkbox')e.checked=!!v;else if(e.type==='radio')e.checked=e.value===v;else e.value=v??'';}}
      modo=draft.modo||modo;paso=draft.fotosVersion===1?Math.min(6,Math.max(0,draft.paso||0)):0;motivos=draft.motivos||[];pendiente=draft.pendiente||null;f.dataset.clave=draft.clave||crypto.randomUUID();
    }else{f.elements.cnombre.value=turno?.nombre||'';f.elements.ctelefono.value=turno?.telefono||'';}
    claveDeEnvio(f);
    // Borradores anteriores guardaban el texto de «No enciende» en el mismo campo que los testigos.
    if(campos().tableroEstado==='no_enciende'&&!f.elements.noEncVer.value&&f.elements.testigosVer.value){f.elements.noEncVer.value=f.elements.testigosVer.value;f.elements.testigosVer.value='';}
    {const d=campos();Object.assign(previo2,{tablero:d.tableroEstado,carroceria:d.carroceria,motor:d.motorEstado});}
    const guardar=()=>{
      f.dataset.sucio='1';
      componer();const ok=guardarBorrador(app,{fotosVersion:1,fotos:fotosIngreso?.datos()||draft?.fotos||[],campos:campos(),vehiculoId:modo==='conocido'?elegido?.id:null,modo,paso,motivos,clave:f.dataset.clave,pendiente,turnoId:turno?.id,relacionadaId:relacionada?.id});
      f.toggleAttribute('data-sin-aviso',ok);f.querySelector('[data-estado-borrador]').textContent=pendiente?'Guardado sin confirmar. Reintentá sin cambiar los datos.':ok?'Borrador en esta pestaña · el auto aún no está recibido':'No se pudo conservar el borrador. No cierres esta pantalla.';
    };
    fotosIngreso=enlazarFotosIngreso(f.querySelector('[data-fotos-ingreso]'),{clave:claveDeEnvio(f),inicial:draft?.fotos||[],danos:f.querySelector('[data-danos]'),carroceria:()=>f.querySelector('[name=carroceria]:checked')?.value||'',alDano:()=>{const x=f.querySelector('[name=carroceria][value=con_danos]');x.checked=true;previo2.carroceria='con_danos';invalidar('Cambiaste la carrocería.');vistaDatos();},demo:!!app.sesion.taller?.demo,faltas:()=>intento2,tablero:()=>f.querySelector('[name=tableroEstado]:checked')?.value||'',alCambio:motivo=>invalidar(motivo),guardar:()=>{actualizar2();guardar();}});
    const marca=()=>{const d=campos();f.elements.marca.value=d.marcaOpcion==='Otra'?d.marcaOtra:d.marcaOpcion||'';f.querySelector('[data-otra-marca]').hidden=d.marcaOpcion!=='Otra';f.querySelector('[data-marca-estado]').textContent=d.marcaOpcion?`Marca elegida: ${f.elements.marca.value||'Otra (completá el nombre)'}`:'Elegí una marca.';f.elements.marca.dispatchEvent(new Event('input'));};
    enlazarModelos(f);
    const vistaDatos=()=>{
      const d=campos();f.querySelector('[data-nuevo-auto]').hidden=modo!=='nuevo';f.querySelector('[data-buscar-auto]').hidden=modo==='nuevo';
      f.elements.patente.disabled=!!d.sinPatente;f.elements.km.disabled=!!d.sinKm;
      if(d.carroceria!==carroceriaVista){carroceriaVista=d.carroceria;fotosIngreso?.refrescar();}
      componer();actualizar2();
      f.querySelector('[data-revision]').hidden=d.tipo!=='revision';f.querySelector('[data-autorizado]').hidden=!(d.tipo==='service'||d.tipo==='revision'&&d.revisionCosto==='si');f.querySelector('[data-service]').hidden=d.tipo!=='service';f.querySelector('[data-otra-persona]').hidden=d.quien!=='otra';
      const abierta=elegido?.visitas?.find(x=>!x.entregada_at&&!x.anulada_at);
      f.querySelector('[data-elegido]').innerHTML=modo==='conocido'&&elegido?`<div class="rec-elegido">${resultado(elegido)}${!abierta?'<p>'+icono('check')+' Auto elegido. Podés continuar o buscar otro.</p>':''}</div>`:'';
      const placa=modo==='nuevo'?(d.sinPatente?'Sin patente visible':d.patente):elegido?.patente;
      const modelo=modo==='nuevo'?[d.marca,d.modelo,d.anio].filter(Boolean).join(' '):elegido?[elegido.marca,elegido.modelo].filter(Boolean).join(' '):'';
      const pb=raiz.querySelector('[data-placa-banda]');if(pb){pb.hidden=!placa;pb.textContent=placa||'';pb.setAttribute('aria-label','Patente '+(placa||''));}
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
      if(i===1){fotosIngreso.validar(d.carroceria);if(!d.tableroEstado)throw falla('Indicá el estado del tablero.','tableroEstado');if(d.tableroEstado!=='sin_testigos'&&!d.ingresoTestigos.trim())throw falla(d.tableroEstado==='no_enciende'?'Contá qué pasa al intentar encenderlo.':'Escribí qué testigos se ven.','ingresoTestigos');if(!d.carroceria)throw falla('Indicá si observás daños previos.','carroceria');if(!d.ingresoObservaciones.trim())throw falla('Describí el estado visible al ingresar.','carroceria');if(!d.ingresoConfirmado)throw falla('Confirmá que verificaste las fotos y el estado de este auto.','ingresoConfirmado');}
      if(i===2){if(!motivos.length&&!d.relato.trim())throw falla('Elegí un motivo o escribí lo que cuenta el cliente.','relato');if(motivos.some(m=>m.id==='otro')&&!d.otro.trim())throw falla('Contá el otro motivo.','otro');}
      if(i===3&&!d.sinKm){const n=d.km.replace(/[.\s]/g,'');if(!/^\d+$/.test(n)||+n>9999999)throw falla('Escribí los kilómetros o marcá Sin lectura.','km');const ultima=ultimaLectura(elegido?.lecturas);if(modo==='conocido'&&ultima&&+n<ultima.km&&!d.kmExplicacion.trim())throw falla(`La lectura anterior es ${ultima.km} km. Explicá la diferencia.`,'kmExplicacion');}
      if(i===4){if(!d.tipo)throw falla('Elegí qué autoriza el cliente.','tipo');if(d.tipo==='revision'&&!d.revisionCosto)throw falla('Indicá si la revisión tiene costo.','revisionCosto');if((d.tipo==='service'||d.revisionCosto==='si')&&!d.autPersona.trim())throw falla('Indicá quién autorizó lo acordado.','autPersona');}
      if(i===5&&d.quien==='otra'&&!d.dejaNombre.trim())throw falla('Escribí quién deja el auto.','dejaNombre');
    };
    const resumenPasos=()=>{
      const d=campos(),fotos=fotosIngreso?.datos()||[];
      const auto=modo==='nuevo'?[d.sinPatente?'Sin patente visible':d.patente,d.marca,d.modelo].filter(Boolean).join(' · '):[elegido?.patente,elegido?.marca,elegido?.modelo].filter(Boolean).join(' · ');
      return [auto||'Sin auto elegido',`${fotos.length} foto${fotos.length===1?'':'s'} · ${d.carroceria==='con_danos'?'con daños previos':d.carroceria==='sin_danos'?'sin daños visibles':'estado por indicar'}`,resumenMotivos(motivos,d.otro)||d.relato||'Sin motivo',d.sinKm?'Sin lectura':d.km?d.km+' km':'',d.tipo==='service'?'Service ya autorizado':d.tipo==='revision'?'Revisión y presupuesto':'',[d.responsableId?'Con responsable':'',d.retiro?'Retiro acordado':'',d.urgente?'Urgente':''].filter(Boolean).join(' · ')||'Sin datos opcionales',''];
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
      raiz.querySelector('[data-paso-label]').textContent=`Paso ${i+1} de ${PASOS.length} · ${PASOS[i]}`;raiz.querySelectorAll('[data-tramo]').forEach(t=>{const n=+t.dataset.tramo;t.className=n<i?'h':n===i?'a':'';});
      const res=resumenPasos();f.querySelectorAll('[data-hi]').forEach(li=>{const n=+li.dataset.hi,estado=n<i?'hecho':n===i?'actual':'futuro';li.className='hi '+estado;li.toggleAttribute('aria-current',n===i);const b=li.querySelector('[data-ir-paso]');b.disabled=n>=i;b.querySelector('[data-hi-resumen]').textContent=n<i?res[n]:'';b.querySelector('.hi-n').innerHTML=n<i?ic('check'):String(n+1);});
      f.querySelectorAll('[data-indice]').forEach(li=>li.toggleAttribute('aria-current',+li.dataset.indice===i));f.querySelector('[data-omitir]').hidden=i!==5||volverRevision;f.querySelector('[data-continuar]').type=i===6?'submit':'button';f.querySelector('[data-continuar]').innerHTML=i===6?`${ic('check')}Confirmar el ingreso`:volverRevision?'Volver a revisión':`<span class="rec-lb">Continuar<small>Paso ${i+2} · ${PASOS[i+1]}</small></span><span class="rec-fl">${ic('arrow_downward')}</span>`;f.querySelector('[data-atras-barra]').hidden=i===0;if(i!==1)intento2=false;f.querySelector('[data-p2-res]').hidden=true;
      vistaDatos();if(i===6)revisar();if(enfocar){const li=f.querySelector(`[data-hi="${i}"]`);li.scrollIntoView({block:'start'});f.querySelector(`[data-paso="${i}"] h2`).focus({preventScroll:true});}guardar();
      if(enfocar&&i!==anterior)entrada(f.querySelector(`[data-paso="${i}"]`),{tipo:'paso',direccion:i-anterior});
    };
    const bloquear=()=>{f.querySelectorAll('input,select,textarea,button').forEach(e=>{if(!e.matches('[data-continuar]'))e.disabled=true;});raiz.querySelector('[data-faltan]').hidden=true;raiz.querySelector('[data-atras]').disabled=true;f.querySelector('[data-continuar]').textContent='Reintentar el ingreso';};
    const seleccionar=async id=>{const n=++consulta;try{const r=await get('/api/vehiculos/'+id);if(n!==consulta||!f.isConnected)return;if(elegido?.id!==r.vehiculo.id){relacionada=null;fotosIngreso.reiniciar();}elegido=r.vehiculo;modo='conocido';resultados.innerHTML='';vistaDatos();guardar();if(!elegido.visitas?.some(x=>!x.entregada_at&&!x.anulada_at))irPaso(1);}catch(e){toast(e.message,{error:true});}};
    const enlazarResultados=box=>box.querySelectorAll('[data-elegir]').forEach(b=>b.onclick=()=>seleccionar(b.dataset.elegir));
    const buscar=async()=>{const n=++consulta,t=q.value.trim();f.querySelector('[data-recientes]').hidden=t.length>=2;if(t.length<2){resultados.innerHTML='';return;}try{const r=await get('/api/buscar?q='+encodeURIComponent(t));if(n!==consulta||!f.isConnected)return;resultados.innerHTML=r.vehiculos.length?r.vehiculos.map(resultado).join(''):'<p class="rec-vacio">No hay coincidencias. Revisá la patente o cargá un auto nuevo.</p>';enlazarResultados(resultados);}catch(e){if(n===consulta)resultados.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}};
    q.oninput=()=>{++consulta;clearTimeout(timer);timer=setTimeout(buscar,220);};
    const nuevo=sin=>{if(modo!=='nuevo')fotosIngreso.reiniciar();++consulta;clearTimeout(timer);relacionada=null;modo='nuevo';f.elements.sinPatente.checked=sin;if(!f.elements.patente.value&&q.value.trim())f.elements.patente.value=q.value.trim().toUpperCase();vistaDatos();guardar();f.querySelector('[data-nuevo-auto] h2').focus();};
    f.querySelector('[data-nuevo]').onclick=()=>nuevo(false);f.querySelector('[data-sin-patente]').onclick=()=>nuevo(true);f.querySelector('[data-volver-busqueda]').onclick=()=>{modo=elegido?'conocido':'buscar';vistaDatos();guardar();q.focus();};
    f.querySelectorAll('[name=marcaOpcion]').forEach(r=>r.onchange=()=>{marca();guardar();vistaDatos();});f.elements.marcaOtra.oninput=()=>marca();
    f.querySelectorAll('[data-motivo]').forEach(b=>b.onclick=()=>{const id=b.dataset.motivo;motivos=motivos.some(m=>m.id===id)?motivos.filter(m=>m.id!==id):[...motivos,{id,detalles:[]}];detalleMotivos();vistaDatos();guardar();});
    // Paso 2: cambiar el tablero, su texto o la carrocería vuelve a pedir la verificación. Pasar a «Sin daños» con daños
    // cargados se confirma y los quita del borrador (antes quedaban ocultos y se enviaban igual).
    f.addEventListener('change',async e=>{
      const t=e.target;
      if(t.name==='tableroEstado'&&t.value!==previo2.tablero){previo2.tablero=t.value;invalidar('Cambiaste el estado del tablero.');}
      if(t.name==='motorEstado'&&t.value!==previo2.motor){previo2.motor=t.value;invalidar('Cambiaste el detalle del tablero.');}
      if(t.name==='ingresoConfirmado'&&t.checked){avisoInvalida='';actualizar2();}
      if(t.name==='carroceria'&&t.value!==previo2.carroceria){
        if(t.value==='sin_danos'&&fotosIngreso.tieneDanos()&&!(await confirmar({titulo:'¿Sin daños visibles?',texto:'Se quitan del borrador los daños cargados y sus fotos.',aceptar:'Quitar daños',peligro:true})).ok){f.querySelector('[name=carroceria][value=con_danos]').checked=true;vistaDatos();guardar();f.querySelector('[name=carroceria][value=con_danos]').focus();return;}
        if(t.value==='sin_danos')fotosIngreso.quitarDanos();else fotosIngreso.asegurarDano();
        previo2.carroceria=t.value;invalidar('Cambiaste la carrocería.');vistaDatos();guardar();
      }
    });
    f.addEventListener('input',e=>{const o={testigosVer:'con_testigos',noEncVer:'no_enciende'}[e.target.name];if(o&&campos().tableroEstado===o)invalidar('Cambiaste el detalle del tablero.');});
    f.querySelectorAll('[data-atajo]').forEach(b=>b.onclick=()=>{const L=f.elements.testigosVer.value.split(',').map(t=>t.trim()).filter(Boolean),i=L.findIndex(t=>t.toLowerCase()===b.dataset.atajo.toLowerCase());if(i>=0)L.splice(i,1);else L.push(b.dataset.atajo);f.elements.testigosVer.value=L.join(', ');invalidar('Cambiaste los testigos.');vistaDatos();guardar();});
    raiz.querySelector('[data-faltan]').onclick=()=>{intento2=true;fotosIngreso.refrescar();actualizar2();if(pendientes2().length)resumen2(true);else irDato('[name=ingresoConfirmado]');};
    f.addEventListener('input',e=>{if(e.target===f.elements.marca)return;if(modo==='nuevo'&&['patente','sinPatente','marcaOpcion','marcaOtra','modelo'].includes(e.target.name)&&fotosIngreso.tieneFotos()){fotosIngreso.reiniciar();toast('Cambiaste el auto: cargá nuevas fotos para este ingreso.');}if(e.target.type!=='search'){vistaDatos();guardar();}});f.addEventListener('change',()=>{vistaDatos();guardar();});
    raiz.querySelector('[data-atras]').onclick=raiz.querySelector('[data-atras-barra]').onclick=()=>{if(pendiente)return;if(paso===0){if(modo==='nuevo'){modo=elegido?'conocido':'buscar';vistaDatos();guardar();}else app.ir('#/hoy');}else if(volverRevision){volverRevision=false;irPaso(6);}else irPaso(paso-1);};
    f.querySelectorAll('[data-ir-paso]').forEach(b=>b.onclick=()=>{const n=+b.dataset.irPaso;if(n<paso&&!pendiente){volverRevision=paso===6;irPaso(n);}});
    f.querySelector('[data-omitir]').onclick=()=>{try{validar(5);irPaso(6);}catch(e){mostrarError(f,e);}};
    const cq=f.querySelector('#rec-contacto-q'),cc=f.querySelector('[data-contactos]');
    cq.oninput=()=>{const n=++consultaContacto;clearTimeout(ctimer);const t=cq.value.trim();if(t.length<2){cc.innerHTML='';return;}ctimer=setTimeout(async()=>{try{const r=await get('/api/contactos?q='+encodeURIComponent(t));if(n!==consultaContacto||!f.isConnected)return;cc.innerHTML=r.contactos.slice(0,5).map(c=>`<button type="button" class="resultado" data-contacto="${c.id}"><strong>${esc(c.nombre)}</strong><span>${esc(c.telefono||'Sin teléfono')}</span><span>Reutilizar contacto</span></button>`).join('')||'<p class="small muted">Sin coincidencias. Completá los datos del cliente.</p>';cc.querySelectorAll('[data-contacto]').forEach(b=>b.onclick=()=>{const c=r.contactos.find(c=>c.id===+b.dataset.contacto);f.elements.contactoId.value=c.id;f.elements.cnombre.value=c.nombre;f.elements.ctelefono.value=c.telefono||'';f.elements.cnombre.readOnly=true;f.elements.ctelefono.readOnly=true;cc.innerHTML='';const p=f.querySelector('[data-contacto-elegido]');p.hidden=false;p.innerHTML='Contacto existente elegido. <button type="button" class="btn btn-texto">Usar otro contacto</button>';p.querySelector('button').onclick=()=>{f.elements.contactoId.value='';f.elements.cnombre.readOnly=false;f.elements.ctelefono.readOnly=false;p.hidden=true;guardar();};guardar();vistaDatos();});}catch(e){cc.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}},220);};
    f.querySelector('[data-continuar]').addEventListener('click',e=>{if(paso===6)return;e.preventDefault();if(paso===1){intento2=true;fotosIngreso.refrescar();actualizar2();if(!resumen2(true))return;}try{validar(paso);const siguiente=volverRevision?6:paso+1;volverRevision=false;irPaso(siguiente);}catch(e){mostrarError(f,e);}});
    f.addEventListener('keydown',e=>{if(e.key==='Enter'&&paso<6&&e.target.tagName==='INPUT'&&!['radio','checkbox','search'].includes(e.target.type)){e.preventDefault();f.querySelector('[data-continuar]').click();}});
    alEnviar(f,async()=>{
      if(!pendiente){try{validar(paso);}catch(e){throw e;}if(paso<6){const siguiente=volverRevision?6:paso+1;volverRevision=false;irPaso(siguiente);return false;}
        for(let i=0;i<6;i++){try{validar(i);}catch(e){irPaso(i);throw e;}}
      }
      const d=campos();
      const cuerpo=pendiente||{estadoIngreso:{clave:claveDeEnvio(f),fotos:fotosIngreso.datos().filter(x=>x.tipo!=='detalle'||d.carroceria==='con_danos').map(({id,tipo,descripcion})=>({id,tipo,descripcion})),carroceria:d.carroceria,tablero:d.tableroEstado,observaciones:d.ingresoObservaciones,testigos:d.ingresoTestigos,confirmado:!!d.ingresoConfirmado},tipo:d.tipo,km:d.sinKm?'':d.km,sinKm:!!d.sinKm,kmExplicacion:d.kmExplicacion,responsableId:d.responsableId||null,retiro:d.retiro||null,retiroNota:d.retiroNota,prioridad:d.urgente?'alta':'normal',relacionadaId:relacionada?.id||null,turnoId:turno?.id||null,plantillaId:d.tipo==='service'?d.plantillaId||null:null,autorizacion:d.tipo==='service'?{persona:d.autPersona,importe:d.autImporte}:d.revisionCosto==='si'?{revisionConCosto:true,persona:d.autPersona,importe:d.autImporte}:{},recepcion:{motivos,otro:d.otro,relato:d.relato,autoriza:d.tipo,revisionCosto:d.revisionCosto},...(modo==='conocido'?{vehiculoId:elegido.id,...(d.quien==='otra'?{contacto:{nombre:d.dejaNombre,telefono:d.dejaTelefono}}:{})}:{vehiculo:{patente:d.sinPatente?`SIN PATENTE ${f.dataset.clave.slice(0,6).toUpperCase()}`:d.patente,marca:d.marca,modelo:d.modelo,anio:d.anio},...(d.contactoId?{contactoId:+d.contactoId}:{contacto:{nombre:d.cnombre,telefono:d.ctelefono}})})};
      // La persona que lo trae no reemplaza al titular del vehículo nuevo.
      if(!pendiente&&modo==='nuevo'&&d.quien==='otra')cuerpo.retiroNota=[d.retiroNota,`Lo dejó ${d.dejaNombre}${d.dejaTelefono?' · '+d.dejaTelefono:''}`].filter(Boolean).join('. ').slice(0,300);
      f.querySelector('[data-continuar]').textContent='Guardando…';
      try{const r=await post('/api/visitas',cuerpo,{idempotencia:claveDeEnvio(f)});borrarBorrador(app);delete f.dataset.sucio;raiz.innerHTML=`<section class="rec-exito"><span class="rec-exito-icon">${icono('check')}</span><h1 tabindex="-1">Auto recibido</h1><p>El servidor confirmó la orden <strong>N.º ${esc(r.visita.numero)}</strong> para ${esc(r.visita.vehiculo.patente)}.</p><a class="btn btn-primario" href="#/visitas/${r.id}">Abrir la orden</a><a class="btn" href="#/recibir?nueva=1">Recibir otro auto</a><a class="btn btn-texto" href="#/hoy">Volver a Hoy</a></section>`;raiz.querySelector('h1').focus();}
      catch(e){if(e.datos?.guardadoSinConfirmar){pendiente=cuerpo;guardar();bloquear();}else{const mapa={patente:0,marca:0,modelo:0,anio:0,cnombre:0,ctelefono:0,fotosIngreso:1,carroceria:1,tableroEstado:1,ingresoObservaciones:1,ingresoTestigos:1,testigosVer:1,ingresoConfirmado:1,motivos:2,relato:2,otro:2,km:3,kmExplicacion:3,tipo:4,revisionCosto:4,autPersona:4,autImporte:4,responsableId:5,retiro:5};irPaso(mapa[e.campo]??6);f.querySelector('[data-continuar]').textContent=paso===6?'Reintentar el ingreso':'Continuar';if(e.datos?.visitaAbierta)toast(e.message,{error:true,accion:{texto:'Abrir orden',fn:()=>app.ir('#/visitas/'+e.datos.visitaAbierta.id)}});}throw e;}
    });
    if(draft?.campos?.contactoId){f.elements.cnombre.readOnly=true;f.elements.ctelefono.readOnly=true;const p=f.querySelector('[data-contacto-elegido]');p.hidden=false;p.innerHTML='Contacto existente recuperado del borrador. <button type="button" class="btn btn-texto">Usar otro contacto</button>';p.querySelector('button').onclick=()=>{f.elements.contactoId.value='';f.elements.cnombre.readOnly=false;f.elements.ctelefono.readOnly=false;p.hidden=true;guardar();};}
    marca();detalleMotivos();irPaso(paso,false);if(pendiente)bloquear();
    if(!pendiente){get('/api/vehiculos').then(r=>{if(!f.isConnected)return;const box=f.querySelector('[data-lista-recientes]');box.innerHTML=r.vehiculos.filter(v=>!v.archivado).slice(0,6).map(resultado).join('')||'<p class="muted">Todavía no hay vehículos.</p>';enlazarResultados(box);}).catch(e=>{if(f.isConnected)f.querySelector('[data-lista-recientes]').textContent=e.message;});if(q.value)buscar();}
  }};
}
