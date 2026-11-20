import {get,post,claveDeEnvio} from '../api.js?v=0.1.0';
import {esc,icono,fecha,campo,casilla,leerForm,alEnviar,mostrarError,limpiarErrores,toast,confirmar,copiar,numeroEntrada} from '../ui.js?v=0.1.0';
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
// Paso 1 (propuesta B refinada, 20/11/2026) y pasos 5 a 7. Patente: Mercosur (AB 123 CD), anterior (ABC 123) u otro
// formato que el taller escriba; el servidor la normaliza igual (sin espacios ni guiones) para comparar.
const normPat=t=>String(t??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function formatoPat(t){
  const n=normPat(t);
  if(/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(n))return {tipo:'Mercosur',txt:`${n.slice(0,2)} ${n.slice(2,5)} ${n.slice(5)}`};
  if(/^[A-Z]{3}\d{3}$/.test(n))return {tipo:'anterior',txt:`${n.slice(0,3)} ${n.slice(3)}`};
  return {tipo:'',txt:String(t??'').trim().toUpperCase()};
}
const pareceP=t=>{const n=normPat(t);return n.length>=5&&n.length<=8&&/[A-Z]/.test(n)&&/\d/.test(n);};
const iniciales=n=>String(n||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';
const sinPat=p=>/^SIN PATENTE/i.test(String(p||''));
const placaVeh=p=>sinPat(p)?'<span class="placa sinpat" translate="no">Sin patente</span>':placaD(p);
const marcaModelo=v=>[v?.marca,v?.modelo].filter(Boolean).join(' ');
// Importe como lo acepta el servidor: «45000», «45.000», «1.234,50» o «1234.50».
const IMPORTE=/^\$?(\d{1,3}(\.\d{3})*(,\d{1,2})?|\d+(,\d{1,2})?|\d+\.\d{1,2})$/;
const importeOk=t=>IMPORTE.test(String(t||'').replace(/\s/g,''));
const pesos=t=>{const n=numeroEntrada(t);return '$ '+n.toLocaleString('es-AR',n%1?{minimumFractionDigits:2,maximumFractionDigits:2}:{maximumFractionDigits:0});};
// Segmento (importe, costo de la revisión, quién lo trae): radio real con la marca de elegido.
const sg=(n,v,t,s='')=>`<label class="rb-sg"><input type="radio" name="${n}" value="${v}"><span class="rb-sg-l">${ic('check','ck')}${t}</span>${s?`<small>${s}</small>`:''}</label>`;
// Encabezado de tarjeta del paso 1: ícono, dato y estado (pendiente, listo o falta).
const cabSec=(icono,titulo,id)=>`<div class="rb-sec-h"><span class="rb-sn" data-sn>${ic(icono)}</span><h3 id="${id}" data-sec-t>${titulo}</h3><span class="rb-est" data-est>Pendiente</span></div><p class="rb-err" data-err role="alert" hidden></p>`;
const errIc=m=>`${ic('warning')}<span>${esc(m)}</span>`;
const fechaCorta=f=>new Date(f+'T00:00').toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'});

// Fila de un auto: patente, marca y modelo, cliente y situación. Con orden abierta no se elige: se informa y se ofrece
// abrir esa orden, que es lo único que el sistema admite (no se recibe dos veces).
function fila(v,{estatica=false}={}){
  const ab=v.visitaAbierta||v.visitas?.find(x=>!x.entregada_at&&!x.anulada_at);
  const cli=typeof v.contacto==='object'?v.contacto?.nombre:v.contacto,tel=typeof v.contacto==='object'?v.contacto?.telefono:v.telefono;
  const st=v.archivado?'<span class="chip rb-gris">Ficha archivada · recuperala desde la ficha del auto</span>'
    :ab?`<span class="chip warn">${ic('build')}Orden abierta · N.º ${esc(ab.numero)}</span>`
    :`<small>Sin orden abierta${v.ultima_visita?' · última visita '+esc(fecha(v.ultima_visita)):''}</small>`;
  const cuerpo=`${logoMarca(v.marca)}<span class="rb-lr-t"><span class="rb-lr-r">${placaVeh(v.patente)}<b>${esc(marcaModelo(v)||'Vehículo sin datos')}</b></span><small>${esc([cli||'Sin contacto',tel].filter(Boolean).join(' · '))}</small><span class="rb-lr-st">${st}</span></span>`;
  if(estatica||v.archivado)return `<div class="rb-lr${ab?' ab':''}">${cuerpo}</div>`;
  return `<button type="button" class="rb-lr${ab?' ab':''}" ${ab?`data-abierta="${v.id}"`:`data-elegir="${v.id}"`} aria-label="${esc(`${ab?'Ver orden abierta de':'Elegir'} ${v.patente||'auto sin patente'}`)}">${cuerpo}${ic('chevron_right')}</button>`;
}

// Hoja inferior con opciones (la misma del paso 2). Devuelve la opción elegida o null si se cierra.
function hojaElegir({titulo,html='',opciones}){
  return new Promise(res=>{
    const d=document.createElement('dialog'),foco=document.activeElement;d.className='hoja-dlg p2-hoja';d.setAttribute('aria-labelledby','rb-hoja-t');
    d.innerHTML=`<header><h2 id="rb-hoja-t">${esc(titulo)}</h2><button type="button" class="ibtn" data-cerrar aria-label="Cerrar">${ic('close')}</button></header><div class="hoja-c">${html}<div class="rb-hoja-acc">${opciones.map((o,i)=>`<button type="button" class="btn ${o.prim?'btn-primario':o.ter?'btn-texto':''}" data-op="${i}">${esc(o.t)}</button>`).join('')}</div></div>`;
    document.body.append(d);let v=null;
    d.addEventListener('click',e=>{const b=e.target.closest('[data-op]');if(b){v=opciones[+b.dataset.op].v;d.close();}else if(e.target===d||e.target.closest('[data-cerrar]'))d.close();});
    d.addEventListener('close',()=>{d.remove();if(foco?.isConnected)foco.focus({preventScroll:true});res(v);},{once:true});
    d.showModal();d.querySelector('[data-op]').focus();
  });
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
      <p class="rb-corr" data-corr hidden></p><ol class="hoja-ing">
        <li class="hi" data-hi="0"><button type="button" class="hi-fila" data-ir-paso="0"><span class="hi-n">1</span><span class="hi-t"><b>${PASOS[0]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="0" class="rec-etapa rb1">
          <h2 tabindex="-1" class="sr">¿Qué auto es?</h2>
          <div class="rb-bq" data-bq data-campo="vehiculoId"><label for="rec-q" class="rb-bq-l">¿Ya vino antes? Buscalo</label>
            <div class="rb-bq-in">${ic('search')}<input id="rec-q" type="search" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" placeholder="Patente, cliente o teléfono" value="${esc(query.patente||turno?.patente||'')}"><button type="button" class="ibtn" data-limpiar-q aria-label="Borrar la búsqueda" hidden>${ic('close')}</button></div>
            <button type="button" class="rb-bt chico" data-ver-ultimos>Ver últimos autos cargados${ic('chevron_right')}</button></div>
          <div data-modo-buscar class="rb-modo-w" hidden>
            <div class="rb-modo" role="status">${ic('search')}<span><b>Buscando un auto ya cargado</b><small data-modo-sub></small></span><button type="button" class="rb-bt chico" data-salir-busqueda></button></div>
            <section class="rb-sec" aria-labelledby="rb-res-t"><div class="rb-sec-h"><h3 id="rb-res-t" data-res-t>Últimos autos</h3></div><p class="rb-err" data-q-err role="alert" hidden>${errIc('Elegí un auto de la lista o volvé a Auto nuevo.')}</p><div data-resultados aria-live="polite"></div></section>
          </div>
          <div data-modo-elegido class="rb-modo-w" hidden></div>
          <div data-modo-nuevo class="rb-modo-w" hidden>
            <span data-ficha-ref aria-hidden="true"></span><section class="rb-ficha" data-ficha aria-label="Así queda el auto nuevo"></section>
            <div data-elegido-aparte></div>
            <section class="rb-sec" data-sec="patente" aria-labelledby="rb-h-pat">${cabSec('badge','Patente','rb-h-pat')}
              <div class="rb-placa-in" data-placa-in data-campo="patente"><i aria-hidden="true"></i><label for="rb-patente" class="sr">Patente</label><input id="rb-patente" name="patente" type="text" maxlength="20" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="AB 123 CD" aria-describedby="rb-fmt"></div>
              <p class="rb-fmt" id="rb-fmt" data-fmt></p>
              <div data-dup></div><div data-dup-conf hidden>${casilla('confirmarDuplicado','Es otro vehículo con la misma patente: cargarlo igual')}</div>
              <label class="rb-sw" data-campo="sinPatente"><input type="checkbox" name="sinPatente" value="1" role="switch"><span class="tx"><b>No tiene patente o no se puede leer</b><small data-sw-sub>Se identifica con una descripción</small></span><span class="est" data-sw-est aria-hidden="true">No</span><span class="tr" aria-hidden="true"><i></i></span></label>
              <div data-sinpat class="rb-col" hidden><div class="rb-sinpat">${ic('block')}<span><b>Sin patente visible</b><small>No es lo mismo que una patente sin cargar: el auto se identifica con una descripción.</small></span></div><p class="rb-aparte" data-pat-aparte hidden></p>
                ${campo({nombre:'identificacion',etiqueta:'Cómo reconocerlo',tipo:'textarea',attrs:'rows="2" maxlength="300"',placeholder:'Color, detalles, número de chasis',ayuda:'Se guarda en las notas de la ficha. El sistema le asigna una referencia «SIN PATENTE» para encontrarlo.'})}</div>
              <div class="rb-aparte" data-ident-aparte hidden></div>
            </section>
            <section class="rb-sec" data-sec="marca" aria-labelledby="rb-h-marca">${cabSec('directions_car','Marca','rb-h-marca')}
              <div class="rb-marcas" role="radiogroup" aria-labelledby="rb-h-marca" data-campo="marca">${MARCAS.map(m=>`<label class="rb-mc${m==='Otra'?' otra':''}"><input type="radio" name="marcaOpcion" value="${m}"><span class="rb-ml">${m==='Otra'?ic('add'):`<img src="/marcas/${m.toLowerCase()}.${['Chevrolet','Ford'].includes(m)?'png':'svg'}" alt="" width="44" height="32">`}</span><span class="rb-mn">${m}</span><span class="rb-mk" aria-hidden="true">${ic('check')}</span></label>`).join('')}</div>
              <div data-otra-marca hidden>${campo({nombre:'marcaOtra',etiqueta:'Nombre de la marca',requerido:true,attrs:'maxlength="60" autocapitalize="words" enterkeyhint="next"',placeholder:'Ej.: Mercedes-Benz'})}</div><input type="hidden" name="marca"><datalist id="dl-modelos"></datalist>
              <p class="rb-aparte" data-otra-aparte hidden></p>
            </section>
            <section class="rb-sec" data-sec="modelo" aria-labelledby="rb-h-mod">${cabSec('directions_car','Modelo y año','rb-h-mod')}
              ${campo({nombre:'modelo',etiqueta:'Modelo',requerido:true,attrs:'list="dl-modelos" maxlength="80" autocapitalize="words" enterkeyhint="next"',placeholder:'Ej.: Cronos 1.3'})}
              <div class="rb-anio">${campo({nombre:'anio',etiqueta:'Año',attrs:'inputmode="numeric" maxlength="4" enterkeyhint="next"',placeholder:'Ej.: 2022',ayuda:'Si no se sabe, dejalo vacío.'})}</div>
            </section>
            <section class="rb-sec" data-sec="cliente" aria-labelledby="rb-h-cli">${cabSec('person','Cliente','rb-h-cli')}
              <div class="rb-ops2" role="radiogroup" aria-labelledby="rb-h-cli" data-campo="clienteModo">
                <label class="rb-op2"><input type="radio" name="clienteModo" value="existente">${ic('person_search','rb-op2-ic')}<b>Ya cargado</b><small>Buscar por nombre o teléfono</small><span class="rb-op2-ind" aria-hidden="true">${ic('check')}</span></label>
                <label class="rb-op2"><input type="radio" name="clienteModo" value="nuevo">${ic('person_add','rb-op2-ic')}<b>Cliente nuevo</b><small>Nombre y teléfono</small><span class="rb-op2-ind" aria-hidden="true">${ic('check')}</span></label></div>
              <div data-cli-existente class="rb-col" data-campo="contactoId" hidden><div data-cli-elegido></div>
                <div data-cli-buscar class="rb-col"><div class="campo"><label for="rec-contacto-q">Buscar cliente</label><input id="rec-contacto-q" type="search" placeholder="Nombre o teléfono" autocomplete="off" enterkeyhint="search"></div><ul class="rb-lres" data-contactos aria-live="polite"></ul></div>
                <input type="hidden" name="contactoId"><input type="hidden" name="contactoNombre"><input type="hidden" name="contactoTel"><p class="rb-aparte" data-cn-aparte hidden></p></div>
              <div data-cli-nuevo class="rb-col" hidden>${campo({nombre:'cnombre',etiqueta:'Nombre del cliente',requerido:true,attrs:'maxlength="120" autocapitalize="words" enterkeyhint="next"',placeholder:'Ej.: Laura Méndez'})}${campo({nombre:'ctelefono',etiqueta:'Teléfono',tipo:'tel',requerido:true,attrs:'maxlength="40" inputmode="tel" enterkeyhint="done"',placeholder:'Ej.: 2622 55-0142',ayuda:'Con o sin espacios y guiones.'})}<p class="rb-aparte" data-ce-aparte hidden></p></div>
            </section>
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
        <li class="hi" data-hi="4"><button type="button" class="hi-fila" data-ir-paso="4"><span class="hi-n">5</span><span class="hi-t"><b>${PASOS[4]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="4" class="rec-etapa rb5" hidden><h2 tabindex="-1">¿Qué autoriza hoy el cliente?</h2><p class="rec-explica">Registrá lo acordado al ingresar. El motivo de ingreso cuenta por qué llega el auto; no es una autorización.</p>
          <fieldset class="p2-bloque p2-ops" data-campo="tipo"><legend><h3 class="p2-sh">Qué autoriza</h3></legend>
            ${op('tipo','revision','Revisión y presupuesto','Revisar y presupuestar. No autoriza a reparar.','search')}
            ${op('tipo','service','Service ya autorizado','Solo el service acordado. Adicionales, aparte.','task_alt')}
            <p class="rb-vacio" data-sin-tipo>${ic('info')}<span>Elegí una opción para ver su alcance y los datos que se registran.</span></p>
            <div class="rb-alc" role="note" data-alc hidden></div></fieldset>
          <fieldset class="p2-bloque" data-revision data-campo="revisionCosto" hidden><legend><h3 class="p2-sh">¿La revisión tiene costo para el cliente?</h3></legend><div class="rb-seg dos">${sg('revisionCosto','si','Sí, con costo','Se registra quién la autorizó')}${sg('revisionCosto','no','Sin costo','No se cobra la revisión')}</div></fieldset>
          <div class="p2-bloque" data-autorizado hidden><div class="campo" data-campo="autPersona"><label for="rb-quien">Quién autorizó</label><input id="rb-quien" name="autPersona" type="text" maxlength="120" placeholder="Nombre de quien dio el OK" autocomplete="off" enterkeyhint="done"><div class="p2-atajos" data-quien-atajos></div></div></div>
          <fieldset class="p2-bloque" data-importe data-campo="autImporte" hidden><legend><h3 class="p2-sh">Importe acordado <span class="p2-req">(opcional)</span></h3></legend>
            <div class="rb-seg">${sg('impModo','nada','Sin indicar','No se acordó')}${sg('impModo','cero','Sin cargo','$ 0')}${sg('impModo','monto','Con importe','$ con valor')}</div>
            <div class="campo" data-monto hidden><label for="rb-monto">Monto acordado</label><div class="rb-pre"><span aria-hidden="true">$</span><input id="rb-monto" name="autImporte" type="text" inputmode="decimal" maxlength="16" placeholder="Ej.: 45000" autocomplete="off" enterkeyhint="done"></div></div>
            <p class="rb-res" data-imp-res aria-live="polite"></p></fieldset>
          <div class="p2-bloque" data-service hidden><h3 class="p2-sh"><label for="rb-plant">Plantilla de tareas</label> <span class="p2-req">(opcional)</span></h3><p class="p2-sub">Propone tareas para la orden. No las marca como hechas ni agrega cargos.</p>
            <div class="rb-sel"><select id="rb-plant" name="plantillaId"><option value="">Sin plantilla</option>${cat.plantillas.filter(p=>p.activo).map(p=>`<option value="${p.id}">${esc(p.nombre)} · ${p.tareas.length} ${p.tareas.length===1?'tarea':'tareas'}</option>`).join('')}</select>${ic('expand_more')}</div><div data-plant></div></div>
        </section></li>
        <li class="hi" data-hi="5"><button type="button" class="hi-fila" data-ir-paso="5"><span class="hi-n">6</span><span class="hi-t"><b>${PASOS[5]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="5" class="rec-etapa rb6" hidden><h2 tabindex="-1"><span>Antes de terminar</span><span class="chip rb-gris">Todo opcional</span></h2><p class="rec-explica">Lo que no se sepa ahora se completa después en la ficha. Podés omitir este paso.</p>
          <div class="p2-bloque"><span class="rb-gt">${ic('directions_car')}Hoy, al ingresar</span>
            <fieldset class="rb-fs" data-campo="quien"><legend><h3 class="p2-sh">¿Quién trae el auto?</h3></legend><div class="rb-seg dos">${sg('quien','cliente','El cliente','<span data-cli-nombre></span>')}${sg('quien','otra','Otra persona','En nombre del cliente')}</div></fieldset>
            <div class="rb-otra" data-otra-persona hidden><b>Quién lo trae hoy</b>${campo({nombre:'dejaNombre',etiqueta:'Nombre',requerido:true,attrs:'maxlength="120" autocapitalize="words" enterkeyhint="next"',placeholder:'Ej.: Julián Méndez'})}${campo({nombre:'dejaTelefono',etiqueta:'Teléfono',tipo:'tel',attrs:'maxlength="40" inputmode="tel" enterkeyhint="done"',placeholder:'Ej.: 2622 55-0199'})}<p class="rb-nota" data-otra-nota></p></div></div>
          <div class="p2-bloque"><span class="rb-gt">${ic('build')}En el taller</span>
            <div class="campo" data-campo="responsableId"><label for="rb-resp">Responsable <span class="muted xs">(opcional)</span></label><div class="rb-sel"><select id="rb-resp" name="responsableId"><option value="">Sin asignar</option>${usuarios.filter(u=>u.activo).map(u=>`<option value="${u.id}"${String(u.id)===String(relacionada?.responsable_id||'')?' selected':''}>${esc(u.nombre)}</option>`).join('')}</select>${ic('expand_more')}</div></div>
            <label class="rb-sw" data-campo="urgente"><input type="checkbox" name="urgente" value="1" role="switch"><span class="tx"><b>${ic('flag')}Marcar como urgente</b><small>Queda con prioridad alta en la orden</small></span><span class="est" data-urg-est aria-hidden="true">No</span><span class="tr" aria-hidden="true"><i></i></span></label></div>
          <div class="p2-bloque" data-campo="retiro"><span class="rb-gt">${ic('calendar_month')}Retiro</span><h3 class="p2-sh">Retiro acordado <span class="p2-req">(opcional)</span></h3>
            <div class="rb-duo">${campo({nombre:'retiroFecha',etiqueta:'Fecha',tipo:'date'})}${campo({nombre:'retiroHora',etiqueta:'Hora',tipo:'time'})}</div>
            <div class="rb-ret" data-ret aria-live="polite"></div><p class="p2-ayuda e" data-ret-parcial hidden>${ic('warning')}<span>El sistema guarda el retiro con día y hora: completá los dos o vaciá el retiro.</span></p>
            ${campo({nombre:'retiroNota',etiqueta:'Nota de retiro',tipo:'textarea',attrs:'maxlength="300" rows="2"',placeholder:'Ej.: lo retira la hija, Carla'})}
            <p class="p2-aviso info">${ic('info')}<span>Si lo retira otra persona, anotalo en la nota de retiro.</span></p></div>
        </section></li>
        <li class="hi" data-hi="6"><button type="button" class="hi-fila" data-ir-paso="6"><span class="hi-n">7</span><span class="hi-t"><b>${PASOS[6]}</b><small data-hi-resumen></small></span><span class="hi-cambiar">Cambiar</span></button><section data-paso="6" class="rec-etapa rb7" hidden><h2 tabindex="-1">Revisá y confirmá el ingreso</h2>
          <div data-hero></div><p class="rec-explica">Cada «Cambiar» lleva a ese dato. Al volver, el resumen muestra el valor nuevo y el resto se conserva, fotos incluidas.</p><div class="rb-rvs" data-revision-final></div></section></li>
      </ol>
      <footer class="rec-barra"><div class="rec-barra-i"><p class="rec-borr">${ic('edit_note')}<span data-estado-borrador role="status">Completá los datos para continuar.</span></p><button type="button" class="rec-faltan" data-faltan hidden></button></div>
        <div class="hi-acc" data-acciones><button type="button" class="btn" data-atras-barra>${ic('arrow_back')}Atrás</button><button type="button" class="btn btn-texto" data-omitir hidden>Omitir</button><button type="submit" class="btn btn-primario" data-continuar>Continuar</button></div></footer>
    </form>
  </div>`,despues(raiz){
    const f=raiz.querySelector('#f-recibir'),q=f.querySelector('#rec-q'),resultados=f.querySelector('[data-resultados]');
    // modo: el auto que se va a recibir (nuevo o ya cargado). «buscando» es solo la vista de búsqueda: no descarta nada.
    let modo=elegido?'conocido':'nuevo',buscando=false,verUltimos=false,paso=0,volverRevision=false,motivos=[],consulta=0,consultaContacto=0,consultaDup=0,timer,ctimer,dtimer,pendiente=null;
    let intento1=false,dupLista=[],recientes=null,listaActual=[],contactosR=[],estadoEnvio='',errorEnvio='',ultimoCambio=-1,omitido6=false;
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
    const marcarRadio=(n,v)=>f.querySelectorAll(`[name="${n}"]`).forEach(r=>{r.checked=r.value===v;});
    if(draft&&!query.vehiculo&&!query.turno&&!query.patente){
      const c=draft.campos||{};
      for(const [k,v] of Object.entries(c)){const es=[...f.elements].filter(e=>e.name===k);for(const e of es){if(e.type==='checkbox')e.checked=!!v;else if(e.type==='radio')e.checked=e.value===v;else e.value=v??'';}}
      // Borradores anteriores: retiro en un solo campo, importe sin opción, cliente elegido escrito en los campos del nuevo.
      if(c.retiro&&!c.retiroFecha){f.elements.retiroFecha.value=String(c.retiro).slice(0,10);f.elements.retiroHora.value=String(c.retiro).slice(11,16);}
      if(!c.impModo&&c.autImporte!=null){const v=String(c.autImporte).trim();marcarRadio('impModo',!v?'nada':numeroEntrada(v)===0?'cero':'monto');}
      if(!c.clienteModo&&(c.contactoId||c.cnombre)){if(c.contactoId){marcarRadio('clienteModo','existente');f.elements.contactoNombre.value=c.cnombre||'';f.elements.contactoTel.value=c.ctelefono||'';f.elements.cnombre.value='';f.elements.ctelefono.value='';}else marcarRadio('clienteModo','nuevo');}
      modo=draft.modo==='nuevo'||draft.modo==='conocido'&&elegido?draft.modo:elegido?'conocido':'nuevo';paso=draft.fotosVersion===1?Math.min(6,Math.max(0,draft.paso||0)):0;motivos=draft.motivos||[];pendiente=draft.pendiente||null;omitido6=!!draft.omitido6;f.dataset.clave=draft.clave||crypto.randomUUID();
      if(pendiente)estadoEnvio='incierto';
    }else if(turno?.nombre){f.elements.cnombre.value=turno.nombre;f.elements.ctelefono.value=turno.telefono||'';marcarRadio('clienteModo','nuevo');}
    if(!campos().impModo)marcarRadio('impModo','nada');
    claveDeEnvio(f);
    // Borradores anteriores guardaban el texto de «No enciende» en el mismo campo que los testigos.
    if(campos().tableroEstado==='no_enciende'&&!f.elements.noEncVer.value&&f.elements.testigosVer.value){f.elements.noEncVer.value=f.elements.testigosVer.value;f.elements.testigosVer.value='';}
    {const d=campos();Object.assign(previo2,{tablero:d.tableroEstado,carroceria:d.carroceria,motor:d.motorEstado});}
    const guardar=()=>{
      f.dataset.sucio='1';
      componer();const ok=guardarBorrador(app,{fotosVersion:1,fotos:fotosIngreso?.datos()||draft?.fotos||[],campos:campos(),vehiculoId:modo==='conocido'?elegido?.id:null,modo,paso,motivos,clave:f.dataset.clave,pendiente,omitido6,turnoId:turno?.id,relacionadaId:relacionada?.id});
      f.toggleAttribute('data-sin-aviso',ok);f.querySelector('[data-estado-borrador]').textContent=estadoEnvio==='falla'?'Resultado sin comprobar · no cierres esta pestaña':pendiente?'Resultado incierto · comprobá antes de confirmar':ok?'Borrador en esta pestaña · el auto aún no está recibido':'No se pudo conservar el borrador. No cierres esta pantalla.';
      f.querySelector('.rec-borr').classList.toggle('warn',!!pendiente||estadoEnvio==='error');
    };
    fotosIngreso=enlazarFotosIngreso(f.querySelector('[data-fotos-ingreso]'),{clave:claveDeEnvio(f),inicial:draft?.fotos||[],danos:f.querySelector('[data-danos]'),carroceria:()=>f.querySelector('[name=carroceria]:checked')?.value||'',alDano:()=>{const x=f.querySelector('[name=carroceria][value=con_danos]');x.checked=true;previo2.carroceria='con_danos';invalidar('Cambiaste la carrocería.');vistaDatos();},demo:!!app.sesion.taller?.demo,faltas:()=>intento2,tablero:()=>f.querySelector('[name=tableroEstado]:checked')?.value||'',alCambio:motivo=>invalidar(motivo),guardar:()=>{actualizar2();guardar();}});
    const marca=()=>{const d=campos();f.elements.marca.value=d.marcaOpcion==='Otra'?d.marcaOtra.trim():d.marcaOpcion||'';f.elements.marca.dispatchEvent(new Event('input'));};
    enlazarModelos(f);
    const abiertaDe=v=>v?.visitas?.find(x=>!x.entregada_at&&!x.anulada_at);
    // Cliente del ingreso según la opción activa; lo de la otra opción queda aparte y no se envía.
    const clienteDe=d=>modo==='conocido'?{nombre:elegido?.contacto?.nombre||'',tel:elegido?.contacto?.telefono||''}:d.clienteModo==='existente'?(d.contactoId?{nombre:d.contactoNombre,tel:d.contactoTel}:{nombre:'',tel:''}):d.clienteModo==='nuevo'?{nombre:d.cnombre.trim(),tel:d.ctelefono.trim()}:{nombre:'',tel:''};
    const datosNuevo=d=>!!(d.patente.trim()||d.identificacion.trim()||d.marcaOpcion||d.modelo.trim()||d.cnombre.trim()||d.contactoId);
    const resumenNuevo=d=>[d.sinPatente?'sin patente':formatoPat(d.patente).txt,marcaModelo(d)].filter(Boolean).join(' · ')||'datos sueltos';
    // Lo que falta del paso 1, en el orden de las tarjetas. k agrupa por tarjeta (y tramo de la ficha).
    const pendientes1=()=>{
      const d=campos(),L=[];
      if(buscando)return [{k:'busqueda',msg:'Elegí un auto de la lista o volvé a Auto nuevo.',ir:'#rec-q',campo:'vehiculoId'}];
      if(modo==='conocido'){
        if(!elegido)L.push({k:'busqueda',msg:'Elegí un auto o cargá uno nuevo.',ir:'#rec-q',campo:'vehiculoId'});
        else if(abiertaDe(elegido))L.push({k:'abierta',msg:'Este auto ya tiene una orden abierta. Continuá esa orden.',ir:'[data-modo-elegido] .btn',campo:'vehiculoId'});
        return L;
      }
      if(!d.sinPatente&&normPat(d.patente).length<3)L.push({k:'patente',msg:'Escribí la patente completa o marcá que no tiene patente visible.',ir:'#rb-patente',campo:'patente'});
      else if(!d.sinPatente&&dupLista.length&&!d.confirmarDuplicado)L.push({k:'patente',msg:'Esa patente ya está cargada: usá ese auto o confirmá que es otro vehículo.',ir:'[data-dup] .btn',campo:'patente'});
      if(!d.marcaOpcion)L.push({k:'marca',msg:'Elegí una marca. Si no está en la lista, tocá «Otra».',ir:'[name=marcaOpcion]',campo:'marca'});
      else if(d.marcaOpcion==='Otra'&&!d.marcaOtra.trim())L.push({k:'marca',msg:'Escribí el nombre de la marca.',ir:'[name=marcaOtra]',campo:'marcaOtra'});
      if(!d.modelo.trim())L.push({k:'modelo',msg:'Escribí el modelo del auto.',ir:'[name=modelo]',campo:'modelo'});
      if(d.anio&&(!/^\d{4}$/.test(d.anio)||+d.anio<1900||+d.anio>2100))L.push({k:'modelo',msg:'Revisá el año o dejalo vacío.',ir:'[name=anio]',campo:'anio'});
      if(!d.clienteModo)L.push({k:'cliente',msg:'Indicá si el cliente ya está cargado o es nuevo.',ir:'[name=clienteModo]',campo:'clienteModo'});
      else if(d.clienteModo==='existente'&&!d.contactoId)L.push({k:'cliente',msg:'Elegí el cliente de la lista.',ir:'#rec-contacto-q',campo:'contactoId'});
      else if(d.clienteModo==='nuevo'){
        if(!d.cnombre.trim())L.push({k:'cliente',msg:'Escribí el nombre del cliente.',ir:'[name=cnombre]',campo:'cnombre'});
        if(d.ctelefono.replace(/\D/g,'').length<6)L.push({k:'cliente',msg:'Escribí un teléfono de al menos 6 números.',ir:'[name=ctelefono]',campo:'ctelefono'});
      }
      return L;
    };
    const P1=['patente','marca','modelo','cliente'];
    const pintarDup=()=>{
      const box=f.querySelector('[data-dup]'),ver=modo==='nuevo'&&!f.elements.sinPatente.checked&&dupLista.length>0;
      f.querySelector('[data-dup-conf]').hidden=!ver;if(!ver)f.elements.confirmarDuplicado.checked=false;
      box.innerHTML=ver?`<div class="rb-dup" role="alert"><p class="rb-dup-h">${ic('warning')}<span>Esta patente ya está cargada en el taller. Revisá si es el mismo auto antes de cargarlo como nuevo.</span></p><ul class="rb-lres">${dupLista.map(v=>{const ab=v.visitaAbierta;return `<li class="rb-col">${fila(v,{estatica:true})}<div class="rb-acc">${ab?`<a class="btn" href="#/visitas/${ab.id}">Abrir la orden N.º ${esc(ab.numero)}</a>`:`<button type="button" class="btn" data-usar-dup="${v.id}">Usar ese auto${ic('chevron_right')}</button>`}</div></li>`;}).join('')}</ul></div>`:'';
    };
    // Coincidencia real de patente: consulta la búsqueda del taller. El servidor vuelve a comprobarla al confirmar.
    const comprobarDup=()=>{
      clearTimeout(dtimer);const n=++consultaDup,p=normPat(f.elements.patente.value);
      if(modo!=='nuevo'||f.elements.sinPatente.checked||p.length<5){if(dupLista.length){dupLista=[];pintarDup();}return;}
      dtimer=setTimeout(async()=>{try{const r=await get('/api/buscar?q='+encodeURIComponent(p));if(n!==consultaDup||!f.isConnected)return;
        const L=r.vehiculos.filter(v=>!v.archivado&&v.patente_norm===p);if(L.map(v=>v.id).join()!==dupLista.map(v=>v.id).join())f.elements.confirmarDuplicado.checked=false;
        dupLista=L;pintarDup();vistaDatos();}catch{/* Sin conexión: el servidor comprueba la patente al confirmar. */}},350);
    };
    const vista1=()=>{
      const d=campos(),L=pendientes1(),ks=new Set(L.map(x=>x.k)),hayNuevo=datosNuevo(d);
      f.querySelector('[data-bq]').classList.toggle('on',buscando);f.querySelector('[data-limpiar-q]').hidden=!q.value;f.querySelector('[data-ver-ultimos]').hidden=buscando;
      f.querySelector('[data-modo-buscar]').hidden=!buscando;f.querySelector('[data-modo-elegido]').hidden=buscando||modo!=='conocido';f.querySelector('[data-modo-nuevo]').hidden=buscando||modo!=='nuevo';
      const b=raiz.querySelector('[data-faltan]');
      if(buscando){
        const volver=modo==='conocido'&&elegido?'Volver al auto elegido':hayNuevo?'Volver a Auto nuevo':'Cargar auto nuevo';
        f.querySelectorAll('[data-salir-busqueda]').forEach(x=>{x.textContent=volver;});
        f.querySelector('[data-modo-sub]').textContent=modo==='nuevo'&&hayNuevo?`Tu auto nuevo a medio cargar (${resumenNuevo(d)}) queda guardado aparte.`:'Tocá un auto para elegirlo.';
        f.querySelector('[data-q-err]').hidden=!intento1;b.hidden=true;return;
      }
      if(modo==='conocido'){
        const box=f.querySelector('[data-modo-elegido]');b.hidden=true;
        if(!elegido){box.innerHTML='';return;}
        const ab=abiertaDe(elegido),ul=ultimaLectura(elegido.lecturas);
        box.innerHTML=`<section class="rb-ficha" aria-label="Auto elegido"><div class="rb-fi-r">${logoMarca(elegido.marca)}<div class="rb-fi-t"><span class="rb-fi-k">Auto ya cargado</span><div class="rb-fi-l2">${placaVeh(elegido.patente)}<b>${esc(marcaModelo(elegido)||'Sin marca ni modelo')}</b></div><span class="rb-fi-s">${esc([elegido.anio?'Año '+elegido.anio:'',elegido.contacto?.nombre?'Cliente '+elegido.contacto.nombre:'Sin contacto'].filter(Boolean).join(' · '))}</span></div>${ab?`<span class="rb-fi-c err">${ic('build')}En el taller</span>`:`<span class="rb-fi-c ok">${ic('check')}Elegido</span>`}</div></section>
          <section class="rb-sec" aria-label="Datos del auto elegido"><dl class="rb-kv"><div><dt>Teléfono del cliente</dt><dd>${esc(elegido.contacto?.telefono||'Sin teléfono')}</dd></div><div><dt>Última lectura</dt><dd>${ul?esc(ul.km.toLocaleString('es-AR'))+' km':'Sin lecturas'}</dd></div><div><dt>Visitas anteriores</dt><dd>${elegido.visitas?.length||0}</dd></div><div><dt>Orden abierta</dt><dd class="${ab?'falta':''}">${ab?'N.º '+esc(ab.numero)+' · '+esc(ab.situacion?.texto||'en el taller'):'No figura'}</dd></div></dl>
          ${ab?`<p class="rb-nota warn">${ic('warning')}<span>No se puede recibir otra vez mientras esa orden siga abierta.</span></p><div class="rb-acc"><a class="btn btn-primario" href="#/visitas/${ab.id}">Abrir la orden N.º ${esc(ab.numero)}</a></div>`:`<p class="rb-nota ok">${ic('check_circle')}<span>Auto elegido. Podés continuar.</span></p>`}
          ${hayNuevo?`<p class="rb-nota">${ic('edit')}<span>Tu auto nuevo a medio cargar (${esc(resumenNuevo(d))}) queda aparte y no se usa con este auto.</span></p>`:''}
          <div class="rb-acc"><button type="button" class="btn" data-otro-auto>${ic('arrow_back')}Elegir otro</button><button type="button" class="btn btn-texto" data-ir-nuevo>${hayNuevo?'Volver a Auto nuevo':'Cargar auto nuevo'}</button></div></section>`;
        return;
      }
      // Auto nuevo: ficha que se completa, tarjetas por dato y lo que quedó aparte al cambiar de opción.
      const fmt=formatoPat(d.patente),cli=clienteDe(d),ok=Object.fromEntries(P1.map(k=>[k,!ks.has(k)])),n=P1.filter(k=>ok[k]).length;
      const placa=d.sinPatente?`<span class="rb-fi-sp">${ic('block')}Sin patente visible</span>`:normPat(d.patente).length>=3?placaD(fmt.txt):'<span class="rb-fi-pv">Patente sin cargar</span>';
      const mm=marcaModelo(d);
      f.querySelector('[data-ficha]').innerHTML=`<div class="rb-fi-r">${logoMarca(d.marca)}<div class="rb-fi-t"><span class="rb-fi-k">Auto nuevo · así queda</span><div class="rb-fi-l2">${placa}<b class="${mm?'':'vac'}">${esc(mm||'Marca y modelo sin cargar')}</b></div><span class="rb-fi-s${d.anio||cli.nombre?'':' vac'}">${esc([d.anio?'Año '+d.anio:'Año sin indicar',cli.nombre?'Cliente '+cli.nombre:'Cliente sin indicar'].join(' · '))}</span></div>
        ${n===4?`<span class="rb-fi-c ok">${ic('check')}Completo</span>`:`<button type="button" class="rb-fi-c${intento1?' err':''}" data-ir-falta aria-label="${4-n===1?'Falta un dato':`Faltan ${4-n} datos`}: ir al primero">${intento1?`Faltan ${4-n}`:`${n} de 4`}</button>`}</div>
        <ul class="rb-fi-g" aria-label="Datos para continuar">${P1.map(k=>{const t=k==='patente'&&d.sinPatente?'Descripción':{patente:'Patente',marca:'Marca',modelo:'Modelo',cliente:'Cliente'}[k];return `<li><button type="button" class="rb-fg ${ok[k]?'ok':intento1?'err':''}" data-ir-sec="${k}" aria-label="${t}: ${ok[k]?'listo':'pendiente'}. Ir a la tarjeta"><i aria-hidden="true"></i><span>${ok[k]?ic('check'):''}${t}</span></button></li>`;}).join('')}</ul>`;
      for(const k of P1){
        const s=f.querySelector(`[data-sec="${k}"]`),err=intento1&&!ok[k],msgs=L.filter(x=>x.k===k).map(x=>x.msg);
        s.classList.toggle('err',err);s.querySelector('[data-sn]').className='rb-sn'+(ok[k]?' ok':err?' err':'');
        const est=s.querySelector('[data-est]');est.className='rb-est'+(ok[k]?' ok':err?' err':'');est.innerHTML=ok[k]?`${ic('check')}Listo`:err?'Falta':'Pendiente';
        const e=s.querySelector('[data-err]');e.hidden=!err;e.innerHTML=err?errIc(msgs.join(' ')):'';
      }
      f.querySelector('[data-sec="patente"] [data-sec-t]').textContent=d.sinPatente?'Sin patente visible':'Patente';
      const pin=f.querySelector('[data-placa-in]');pin.hidden=!!d.sinPatente;pin.classList.toggle('vieja',fmt.tipo==='anterior');pin.classList.toggle('error',intento1&&ks.has('patente')&&!d.sinPatente);
      const fm=f.querySelector('[data-fmt]');fm.hidden=!!d.sinPatente;
      fm.innerHTML=fmt.tipo?`<b>${esc(fmt.txt)}</b><span class="ok">${ic('check')}Formato ${fmt.tipo}</span>`:normPat(d.patente).length>=3?`<b>${esc(fmt.txt)}</b><span>Otro formato · se guarda como lo escribiste</span>`:'<span>Mercosur</span><b>AB 123 CD</b><span>o anterior ABC 123 · con o sin espacios</span>';
      f.querySelector('[data-sw-est]').textContent=d.sinPatente?'Sí':'No';f.querySelector('[data-sw-sub]').textContent=d.sinPatente?'El auto se identifica con una descripción':'Se identifica con una descripción';
      f.querySelector('[data-sinpat]').hidden=!d.sinPatente;
      const pa=f.querySelector('[data-pat-aparte]');pa.hidden=!(d.sinPatente&&d.patente.trim());pa.innerHTML=pa.hidden?'':`${ic('undo')}<span>Patente escrita antes, guardada aparte: <b>${esc(fmt.txt)}</b>. Vuelve si apagás el interruptor.</span>`;
      const ia=f.querySelector('[data-ident-aparte]');ia.hidden=!(!d.sinPatente&&d.identificacion.trim());
      ia.innerHTML=ia.hidden?'':`${ic('description')}<span>Descripción guardada aparte: <b>«${esc(d.identificacion.trim().slice(0,60))}${d.identificacion.trim().length>60?'…':''}»</b>. No se usa mientras haya patente.</span><button type="button" class="rb-bt chico" data-borrar-ident>Borrar</button>`;
      f.querySelector('[data-dup-conf]').hidden=!(!d.sinPatente&&dupLista.length);
      f.querySelector('[data-otra-marca]').hidden=d.marcaOpcion!=='Otra';f.querySelector('.rb-marcas').classList.toggle('error',intento1&&ks.has('marca')&&!d.marcaOpcion);
      const oa=f.querySelector('[data-otra-aparte]');oa.hidden=!(d.marcaOpcion&&d.marcaOpcion!=='Otra'&&d.marcaOtra.trim());oa.innerHTML=oa.hidden?'':`${ic('undo')}<span><b>«${esc(d.marcaOtra.trim())}»</b> queda guardada en «Otra». Se usa ${esc(d.marcaOpcion)} mientras esté elegida.</span>`;
      f.querySelector('.rb-ops2').classList.toggle('error',intento1&&!d.clienteModo);
      f.querySelector('[data-cli-existente]').hidden=d.clienteModo!=='existente';f.querySelector('[data-cli-nuevo]').hidden=d.clienteModo!=='nuevo';
      f.querySelector('[data-cli-buscar]').hidden=!!d.contactoId;
      f.querySelector('[data-cli-elegido]').innerHTML=d.contactoId?`<div class="rb-cli"><span class="rb-av" aria-hidden="true">${esc(iniciales(d.contactoNombre))}</span><span><span class="rb-sel-t">${ic('check')}Cliente elegido</span><b>${esc(d.contactoNombre)}</b><small>${esc(d.contactoTel||'Sin teléfono')}</small></span><button type="button" class="rb-bt chico" data-cambiar-cli>Cambiar</button></div>`:'';
      const cn=f.querySelector('[data-cn-aparte]');cn.hidden=!(d.cnombre.trim()||d.ctelefono.trim());cn.innerHTML=cn.hidden?'':`${ic('edit')}<span>Cliente nuevo a medio cargar: <b>${esc([d.cnombre.trim(),d.ctelefono.trim()].filter(Boolean).join(' · '))}</b>. Se conserva si volvés a «Cliente nuevo».</span>`;
      const ce=f.querySelector('[data-ce-aparte]');ce.hidden=!d.contactoId;ce.innerHTML=ce.hidden?'':`${ic('undo')}<span>Cliente elegido antes: <b>${esc(d.contactoNombre)}</b>. Se conserva si volvés a «Ya cargado».</span>`;
      f.querySelector('[data-elegido-aparte]').innerHTML=elegido?`<p class="rb-aparte">${ic('undo')}<span>Auto elegido antes: <b>${esc([sinPat(elegido.patente)?'Sin patente':elegido.patente,marcaModelo(elegido)].filter(Boolean).join(' · '))}</b>. No se usa mientras cargues uno nuevo.</span><button type="button" class="rb-bt chico" data-volver-elegido>Volver a ese auto</button></p>`:'';
      b.hidden=!!pendiente;b.classList.toggle('ok',!L.length);b.innerHTML=L.length?`${L.length===1?'Falta 1':`Faltan ${L.length}`}${ic('arrow_downward')}`:`${ic('check')}Listo para seguir`;b.setAttribute('aria-label',L.length?`${L.length===1?'Falta un dato':`Faltan ${L.length} datos`}. Ir al primero`:'Paso 1 completo');
    };
    const nombrePersonas=d=>[clienteDe(d).nombre&&{l:clienteDe(d).nombre+' · cliente',v:clienteDe(d).nombre},d.quien==='otra'&&d.dejaNombre.trim()&&{l:d.dejaNombre.trim()+' · lo trae',v:d.dejaNombre.trim()}].filter(Boolean);
    // Importe: vacío y cero son distintos. Vacío no crea línea; cero registra «sin cargo».
    const importeDe=d=>d.impModo==='cero'?'0':d.impModo==='monto'&&importeOk(d.autImporte)?d.autImporte.trim():'';
    const textoImporte=d=>{const v=importeDe(d);return v===''?'Sin indicar':numeroEntrada(v)===0?'$ 0 · sin cargo':pesos(v);};
    const retiroDe=d=>d.retiroFecha&&d.retiroHora?`${d.retiroFecha}T${d.retiroHora}`:null;
    const textoRetiro=d=>d.retiroFecha&&d.retiroHora?`${fechaCorta(d.retiroFecha)} · ${d.retiroHora} h`:d.retiroFecha?`${fechaCorta(d.retiroFecha)} · falta la hora`:d.retiroHora?`Falta el día · ${d.retiroHora} h`:'A confirmar';
    const vista5=()=>{
      const d=campos(),t=d.tipo,conAut=t==='service'||t==='revision'&&d.revisionCosto==='si';
      f.querySelector('[data-sin-tipo]').hidden=!!t;const alc=f.querySelector('[data-alc]');alc.hidden=!t;
      if(t){const [si,no]=t==='revision'?['revisar el auto y armar el presupuesto.','reparar. Para eso hace falta la respuesta del cliente al presupuesto.']:['solo lo acordado al ingresar.','adicionales. Cada uno necesita su propia respuesta.'];
        alc.setAttribute('aria-label',`Alcance de ${t==='revision'?'Revisión y presupuesto':'Service ya autorizado'}`);
        alc.innerHTML=`<span class="rb-alc-t">Alcance</span><ul><li class="si"><span class="m">${ic('check')}</span><span><b>Sí:</b> ${si}</span></li><li class="no"><span class="m">${ic('close')}</span><span><b>No:</b> ${no}</span></li></ul>`;}
      f.querySelector('[data-revision]').hidden=t!=='revision';f.querySelector('[data-autorizado]').hidden=!conAut;f.querySelector('[data-importe]').hidden=!conAut;f.querySelector('[data-service]').hidden=t!=='service';
      f.querySelector('[data-monto]').hidden=d.impModo!=='monto';
      const P=nombrePersonas(d);f.querySelector('[data-quien-atajos]').innerHTML=P.length?`<span>Completar con</span>${P.map(p=>`<button type="button" class="p2-at" data-quien-at="${esc(p.v)}" aria-pressed="${d.autPersona.trim()===p.v}">${ic('check')}${esc(p.l)}</button>`).join('')}`:'';
      const m=d.autImporte.trim(),est=d.impModo==='cero'?'cero':d.impModo!=='monto'?'nada':!m?'falta':!importeOk(m)?'mal':numeroEntrada(m)===0?'cero0':'monto';
      const r=f.querySelector('[data-imp-res]');r.className='rb-res '+({cero:'cero',cero0:'cero',monto:'monto',falta:'falta',mal:'falta'}[est]||'');
      r.innerHTML=`${ic('payments')}<span>${{nada:'Queda registrado: <b>Sin indicar</b>',cero:'Queda registrado: <b>$ 0 · sin cargo</b>',cero0:'Escribiste 0, se registra: <b>$ 0 · sin cargo</b>',falta:'Escribí el monto. Mientras tanto queda: <b>Sin indicar</b>',mal:'Revisá el monto: escribilo con números, por ejemplo 45000 o 45.000,50.',monto:`Queda registrado: <b>${esc(pesos(m))}</b>`}[est]}</span>`;
      const p=cat.plantillas.find(x=>String(x.id)===d.plantillaId);
      f.querySelector('[data-plant]').innerHTML=p?`<div class="rb-plant"><div class="rb-plant-h"><b>${p.tareas.length} ${p.tareas.length===1?'tarea propuesta':'tareas propuestas'}</b><span class="chip rb-gris">Pendientes</span><span class="chip rb-gris">$ 0 agregado</span></div><ul>${p.tareas.map(x=>`<li><i aria-hidden="true"></i>${esc(x)}</li>`).join('')}</ul><p class="rb-nota">Ninguna queda hecha ni cobrada.</p></div>`:'';
    };
    const vista6=()=>{
      const d=campos();f.querySelector('[data-otra-persona]').hidden=d.quien!=='otra';
      f.querySelector('[data-cli-nombre]').textContent=clienteDe(d).nombre||'Titular del auto';
      f.querySelector('[data-otra-nota]').textContent=modo==='conocido'?'Queda como contacto de esta orden.':'Se anota en la nota de retiro; el titular sigue siendo el cliente cargado en el paso 1.';
      f.querySelector('[data-urg-est]').textContent=d.urgente?'Sí':'No';
      const r=f.querySelector('[data-ret]'),con=!!(d.retiroFecha||d.retiroHora);r.classList.toggle('vac',!con);
      r.innerHTML=`${ic('calendar_month')}<span>${esc(textoRetiro(d))}</span>${con?'<button type="button" class="rb-bt chico" data-vaciar-retiro>Vaciar</button>':''}`;
      f.querySelector('[data-ret-parcial]').hidden=!(con&&!(d.retiroFecha&&d.retiroHora));
    };
    const vistaDatos=()=>{
      const d=campos();f.elements.km.disabled=!!d.sinKm;
      if(d.carroceria!==carroceriaVista){carroceriaVista=d.carroceria;fotosIngreso?.refrescar();}
      componer();actualizar2();
      if(paso===0)vista1();vista5();vista6();
      const placa=modo==='nuevo'?(d.sinPatente?'Sin patente visible':normPat(d.patente).length>=3?formatoPat(d.patente).txt:''):sinPat(elegido?.patente)?'Sin patente':elegido?.patente;
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
      if(i===0){const L=pendientes1();if(L.length)throw falla(L[0].msg,L[0].campo);}
      if(i===1){fotosIngreso.validar(d.carroceria);if(!d.tableroEstado)throw falla('Indicá el estado del tablero.','tableroEstado');if(d.tableroEstado!=='sin_testigos'&&!d.ingresoTestigos.trim())throw falla(d.tableroEstado==='no_enciende'?'Contá qué pasa al intentar encenderlo.':'Escribí qué testigos se ven.','ingresoTestigos');if(!d.carroceria)throw falla('Indicá si observás daños previos.','carroceria');if(!d.ingresoObservaciones.trim())throw falla('Describí el estado visible al ingresar.','carroceria');if(!d.ingresoConfirmado)throw falla('Confirmá que verificaste las fotos y el estado de este auto.','ingresoConfirmado');}
      if(i===2){if(!motivos.length&&!d.relato.trim())throw falla('Elegí un motivo o escribí lo que cuenta el cliente.','relato');if(motivos.some(m=>m.id==='otro')&&!d.otro.trim())throw falla('Contá el otro motivo.','otro');}
      if(i===3&&!d.sinKm){const n=d.km.replace(/[.\s]/g,'');if(!/^\d+$/.test(n)||+n>9999999)throw falla('Escribí los kilómetros o marcá Sin lectura.','km');const ultima=ultimaLectura(elegido?.lecturas);if(modo==='conocido'&&ultima&&+n<ultima.km&&!d.kmExplicacion.trim())throw falla(`La lectura anterior es ${ultima.km} km. Explicá la diferencia.`,'kmExplicacion');}
      if(i===4){if(!d.tipo)throw falla('Elegí qué autoriza el cliente.','tipo');if(d.tipo==='revision'&&!d.revisionCosto)throw falla('Indicá si la revisión tiene costo.','revisionCosto');const conAut=d.tipo==='service'||d.revisionCosto==='si';if(conAut&&!d.autPersona.trim())throw falla('Indicá quién autorizó lo acordado.','autPersona');if(conAut&&d.impModo==='monto'&&d.autImporte.trim()&&!importeOk(d.autImporte))throw falla('Revisá el monto: escribilo con números o elegí «Sin indicar».','autImporte');}
      if(i===5){if(d.quien==='otra'&&!d.dejaNombre.trim())throw falla('Escribí quién deja el auto.','dejaNombre');if(!!d.retiroFecha!==!!d.retiroHora)throw falla('Completá el día y la hora del retiro, o vaciá el retiro.',d.retiroFecha?'retiroHora':'retiroFecha');}
    };
    // Todo lo que falta para confirmar, con el paso donde se completa.
    const faltantes=()=>{const L=[];for(let i=0;i<6;i++){if(i===0){pendientes1().forEach(x=>L.push({i:0,t:'Auto y cliente',d:x.msg}));continue;}try{validar(i);}catch(e){L.push({i,t:PASOS[i],d:e.message});}}return L;};
    const textoAuto=d=>modo==='nuevo'?[d.sinPatente?'Sin patente visible':formatoPat(d.patente).txt,marcaModelo(d)].filter(Boolean).join(' · '):[sinPat(elegido?.patente)?'Sin patente':elegido?.patente,marcaModelo(elegido)].filter(Boolean).join(' · ');
    const textoAut=d=>d.tipo==='service'?'Service ya autorizado':d.tipo==='revision'?`Revisión y presupuesto · ${d.revisionCosto==='si'?'con costo':d.revisionCosto==='no'?'sin costo':'costo sin indicar'}`:'';
    const resumenPasos=()=>{
      const d=campos(),fotos=fotosIngreso?.datos()||[];
      return [textoAuto(d)||'Sin auto elegido',`${fotos.length} foto${fotos.length===1?'':'s'} · ${d.carroceria==='con_danos'?'con daños previos':d.carroceria==='sin_danos'?'sin daños visibles':'estado por indicar'}`,resumenMotivos(motivos,d.otro)||d.relato||'Sin motivo',d.sinKm?'Sin lectura':d.km?d.km+' km':'',textoAut(d),omitido6?'Omitido':[d.responsableId?'Con responsable':'',retiroDe(d)?'Retiro acordado':'',d.urgente?'Urgente':''].filter(Boolean).join(' · ')||'Sin datos opcionales',''];
    };
    // Estado del envío en el paso 7: un error del servidor (no se guardó) es distinto de un corte (no se sabe).
    const heroFinal=L=>{
      const g='<span class="rb-giro" aria-hidden="true"></span>';
      if(estadoEnvio==='enviando')return `<div class="rb-hero env" role="status">${g}<div><h3>Confirmando el ingreso…</h3><p>Esperá la respuesta. El botón queda bloqueado para evitar un segundo envío.</p></div></div>`;
      if(estadoEnvio==='comprobando')return `<div class="rb-hero env" role="status">${g}<div><h3>Comprobando si quedó registrado…</h3><p>Se reenvía con la misma clave de este ingreso. Hasta saberlo, no se puede cambiar nada.</p></div></div>`;
      if(estadoEnvio==='incierto')return `<div class="rb-hero inc" role="alert" tabindex="-1">${ic('cloud_off')}<div><h3>Se cortó la conexión</h3><p>No sabemos si el ingreso quedó registrado. Tocá «Comprobar si quedó registrado»: se reenvía con la misma clave y, si ya estaba guardado, el sistema devuelve esa orden sin crear otra.</p></div></div>`;
      if(estadoEnvio==='falla')return `<div class="rb-hero inc" role="alert" tabindex="-1">${ic('warning')}<div><h3>No pudimos comprobar el resultado</h3><p>Seguimos sin saber si el ingreso quedó registrado. Volvé a comprobar cuando haya conexión, sin cambiar nada. El borrador sigue en esta pestaña del navegador mientras no la cierres.</p><div class="rb-acc"><button type="button" class="p2-at" data-ver-resumen>${ic('description')}Ver resumen para seguir después</button></div></div></div>`;
      if(estadoEnvio==='error')return `<div class="rb-hero err" role="alert" tabindex="-1">${ic('error')}<div><h3>No se guardó el ingreso</h3><p>${esc(errorEnvio)}</p><p>El auto no quedó recibido y lo cargado sigue acá. Corregí el dato o reintentá.</p></div></div>`;
      if(L.length)return `<div class="rb-hero pend" role="status" tabindex="-1">${ic('warning')}<div><h3>${L.length===1?'Falta 1 dato para confirmar':`Faltan ${L.length} datos para confirmar`}</h3><p>Tocá «Completar» para ir al dato. Después volvés acá.</p><ul class="rb-falt">${L.map(x=>`<li><span><b>${esc(x.t)}</b><small>${esc(x.d)}</small></span><button type="button" class="rb-bt chico" data-completar="${x.i}" aria-label="Completar ${esc(x.t)}">Completar${ic('arrow_forward')}</button></li>`).join('')}</ul></div></div>`;
      return `<div class="rb-hero listo" role="status">${ic('info')}<div><h3>Listo para confirmar</h3><p>El auto sigue como borrador. Queda recibido cuando el sistema confirma el guardado.</p></div></div>`;
    };
    const botonFinal=()=>{
      const b=f.querySelector('[data-continuar]'),n=faltantes().length;
      b.innerHTML=estadoEnvio==='enviando'?'Confirmando…':estadoEnvio==='comprobando'?'Comprobando…':estadoEnvio==='incierto'?`${ic('search')}Comprobar si quedó registrado`:estadoEnvio==='falla'?`${ic('refresh')}Volver a comprobar`:estadoEnvio==='error'?`${ic('refresh')}Reintentar confirmar`:`${ic('check')}Confirmar el ingreso${n?`<span class="rb-falta">${n===1?'Falta 1':`Faltan ${n}`}</span>`:''}`;
    };
    const revisar=()=>{
      const d=campos(),L=faltantes(),falta=new Set(L.map(x=>x.i)),cli=clienteDe(d),e=fotosIngreso.estado(),M=e.miniaturas;
      f.querySelector('[data-hero]').innerHTML=heroFinal(L);
      const kv=(k,v,cls='')=>`<div><dt>${k}</dt><dd class="${cls}">${esc(v)}</dd></div>`;
      const rv=(i,icono,titulo,cuerpo,{boton,chips=''})=>`<section class="rb-rv${ultimoCambio===i&&!falta.has(i)?' recien':''}${falta.has(i)?' warnb':''}" aria-labelledby="rb-rv-${titulo.length}-${i}"><div class="rb-rv-h"><span class="rb-rv-i">${ic(icono)}</span><h3 id="rb-rv-${titulo.length}-${i}">${titulo}${falta.has(i)?'<span class="chip warn">Falta</span>':ultimoCambio===i?`<span class="chip marca">${ic('check')}Actualizado</span>`:''}${chips}</h3><button type="button" class="rb-bt" data-cambiar="${i}" ${pendiente?'disabled':''}>${boton}</button></div><div class="rb-rv-b">${cuerpo}</div></section>`;
      const placa=modo==='nuevo'?(d.sinPatente?`<span class="placa sinpat">Sin patente</span>`:placaD(formatoPat(d.patente).txt)):placaVeh(elegido?.patente);
      const aut=d.tipo==='service'||d.tipo==='revision'&&d.revisionCosto==='si';
      const tab={sin_testigos:'Sin testigos de falla observados',con_testigos:'Testigos encendidos',no_enciende:'No se puede encender'}[d.tableroEstado];
      const motivosTxt=resumenMotivos(motivos,d.otro);
      f.querySelector('[data-revision-final]').innerHTML=[
        rv(0,'directions_car','Auto y cliente',`<div class="rb-auto">${placa}<b>${esc((modo==='nuevo'?[marcaModelo(d),d.anio]:[marcaModelo(elegido),elegido?.anio]).filter(Boolean).join(' ')||'Sin marca ni modelo')}</b></div><dl class="rb-kv">${kv('Cliente',[cli.nombre,cli.tel].filter(Boolean).join(' · ')||'Falta indicar',cli.nombre?'':'falta')}${modo==='nuevo'&&d.sinPatente&&d.identificacion.trim()?kv('Cómo reconocerlo',d.identificacion.trim()):''}</dl>`,{boton:'Cambiar auto'}),
        rv(1,'photo_camera','Fotos y estado',`<div class="rb-th" aria-label="${M.length} ${M.length===1?'foto':'fotos'}">${M.slice(0,4).map(m=>`<img src="${m.src}" alt="">`).join('')}<small>${M.length?`${M.length} ${M.length===1?'foto':'fotos'}`:'Sin fotos todavía'}</small></div><dl class="rb-kv">${kv('Estado observado',d.ingresoObservaciones||'Falta indicar',d.ingresoObservaciones?'':'falta')}</dl>`,{boton:'Cambiar fotos'}),
        rv(1,'speed','Tablero y testigos',`<dl class="rb-kv">${kv('Tablero',[tab,d.ingresoTestigos].filter(Boolean).join(' · ')||'Falta indicar',tab?'':'falta')}</dl>`,{boton:'Cambiar testigos'}),
        rv(2,'build','Motivo',`${motivosTxt?`<div class="rb-mchips">${motivosTxt.split(' · ').map(m=>`<span class="chip rb-gris">${esc(m)}</span>`).join('')}</div>`:''}${d.relato.trim()?`<dl class="rb-kv">${kv('En palabras del cliente',d.relato.trim())}</dl>`:''}${!motivosTxt&&!d.relato.trim()?`<dl class="rb-kv">${kv('Motivo','Falta indicar','falta')}</dl>`:''}`,{boton:'Cambiar motivo'}),
        rv(3,'speed','Kilometraje',`<dl class="rb-kv">${kv('Lectura del tablero',d.sinKm?'Sin lectura':d.km?d.km+' km':'Falta indicar',d.sinKm||d.km?'':'falta')}${d.kmExplicacion.trim()?kv('Aclaración',d.kmExplicacion.trim()):''}</dl>`,{boton:'Cambiar km'}),
        rv(4,'task_alt','Autorización',`<dl class="rb-kv">${kv('Qué autoriza',textoAut(d)||'Falta elegir',d.tipo?'':'falta')}${kv('Quién autorizó',aut?d.autPersona.trim()||'Falta indicar':'No corresponde',aut&&!d.autPersona.trim()?'falta':'')}${aut?kv('Importe acordado',textoImporte(d)):''}${d.tipo==='service'?kv('Plantilla de tareas',cat.plantillas.find(p=>String(p.id)===d.plantillaId)?.nombre||'Sin plantilla'):''}</dl>`,{boton:'Cambiar autorización'}),
        rv(5,'calendar_month','Datos opcionales',`<dl class="rb-kv">${kv('Lo trae',d.quien==='otra'?[d.dejaNombre.trim(),d.dejaTelefono.trim()].filter(Boolean).join(' · ')||'Falta el nombre':'El cliente',d.quien==='otra'&&!d.dejaNombre.trim()?'falta':'')}${kv('Responsable',usuarios.find(u=>String(u.id)===d.responsableId)?.nombre||'Sin asignar')}${kv('Retiro acordado',textoRetiro(d),retiroDe(d)||!(d.retiroFecha||d.retiroHora)?'':'falta')}${kv('Nota de retiro',d.retiroNota.trim()||'No se cargó')}</dl>`,{boton:'Cambiar opcionales',chips:`${omitido6?'<span class="chip rb-gris">Omitido</span>':''}${d.urgente?'<span class="chip warn">Urgente</span>':''}`})
      ].join('');
      botonFinal();
    };
    const irPaso=(i,enfocar=true)=>{
      const anterior=paso;detenerMovimiento(f);
      paso=i;limpiarErrores(f);f.querySelectorAll('[data-paso]').forEach(s=>s.hidden=+s.dataset.paso!==i);
      if(i===0)buscando=false;
      raiz.querySelector('[data-paso-label]').textContent=`Paso ${i+1} de ${PASOS.length} · ${PASOS[i]}`;raiz.querySelectorAll('[data-tramo]').forEach(t=>{const n=+t.dataset.tramo;t.className=n<i?'h':n===i?'a':'';});
      const res=resumenPasos();f.querySelectorAll('[data-hi]').forEach(li=>{const n=+li.dataset.hi,estado=n<i?'hecho':n===i?'actual':'futuro';li.className='hi '+estado;li.toggleAttribute('aria-current',n===i);const b=li.querySelector('[data-ir-paso]');b.disabled=n>=i;b.querySelector('[data-hi-resumen]').textContent=n<i?res[n]:'';b.querySelector('.hi-n').innerHTML=n<i?ic('check'):String(n+1);});
      const corr=f.querySelector('[data-corr]');corr.hidden=!volverRevision||i===6;corr.innerHTML=`${ic('edit')}<span>Cambiando: ${PASOS[i].toLowerCase()} · el resto se conserva</span>`;
      f.querySelector('[data-omitir]').hidden=i!==5||volverRevision;f.querySelector('[data-continuar]').type=i===6?'submit':'button';f.querySelector('[data-continuar]').innerHTML=i===6?'':volverRevision?`<span class="rec-lb">Volver a la revisión<small>Con el cambio aplicado</small></span><span class="rec-fl">${ic('arrow_forward')}</span>`:`<span class="rec-lb">Continuar<small>Paso ${i+2} · ${PASOS[i+1]}</small></span><span class="rec-fl">${ic('arrow_downward')}</span>`;f.querySelector('[data-atras-barra]').hidden=i===0;if(i!==1)intento2=false;f.querySelector('[data-p2-res]').hidden=true;
      vistaDatos();if(i===6)revisar();if(enfocar){const li=f.querySelector(`[data-hi="${i}"]`);li.scrollIntoView({block:'start'});f.querySelector(`[data-paso="${i}"] h2`).focus({preventScroll:true});}guardar();
      if(enfocar&&i!==anterior)entrada(f.querySelector(`[data-paso="${i}"]`),{tipo:'paso',direccion:i-anterior});
    };
    // Con un resultado incierto no se puede cambiar nada: el reintento debe ser idéntico para que la clave lo reconozca.
    const bloquear=()=>{f.querySelectorAll('.hi:not([data-hi="6"]),[data-revision-final],[data-corr]').forEach(e=>{e.inert=true;});f.querySelector('[data-atras-barra]').disabled=true;raiz.querySelector('[data-faltan]').hidden=true;raiz.querySelector('[data-atras]').disabled=true;};
    const desbloquear=()=>{f.querySelectorAll('[inert]').forEach(e=>{e.inert=false;});f.querySelector('[data-atras-barra]').disabled=false;raiz.querySelector('[data-atras]').disabled=false;};
    const cambiarAutoOk=async()=>!fotosIngreso.tieneFotos()||(await confirmar({titulo:'¿Cambiar de auto?',texto:'Las fotos del paso 2 son de este auto y se quitan del ingreso. El resto de lo cargado se conserva.',aceptar:'Cambiar de auto',peligro:true})).ok;
    const avisarAbierta=async v=>{const ab=v.visitaAbierta||abiertaDe(v);if(!ab)return;
      const r=await hojaElegir({titulo:'Este auto tiene una orden abierta',html:`<ul class="rb-lres"><li>${fila(v,{estatica:true})}</li></ul><p class="rb-hoja-p">No se puede recibir otra vez mientras la orden N.º ${esc(ab.numero)} siga abierta. Abrila para continuar con ese ingreso.</p>`,opciones:[{v:'abrir',t:`Abrir la orden N.º ${ab.numero}`,prim:true},{v:null,t:'Volver a los resultados'}]});
      if(r==='abrir')app.ir('#/visitas/'+ab.id);};
    const seleccionar=async id=>{const n=++consulta;try{const r=await get('/api/vehiculos/'+id);if(n!==consulta||!f.isConnected)return;const v=r.vehiculo;
      if(abiertaDe(v))return avisarAbierta(v);
      const otro=modo!=='conocido'||elegido?.id!==v.id;if(otro&&!(await cambiarAutoOk()))return;
      if(elegido?.id!==v.id)relacionada=null;if(otro)fotosIngreso.reiniciar();
      elegido=v;modo='conocido';buscando=false;verUltimos=false;intento1=false;q.value='';vistaDatos();guardar();f.querySelector('[data-modo-elegido] .rb-ficha')?.scrollIntoView({block:'nearest'});f.querySelector('[data-modo-elegido] [data-otro-auto]')?.focus({preventScroll:true});
    }catch(e){toast(e.message,{error:true});}};
    const irNuevo=async()=>{if(modo==='conocido'&&!(await cambiarAutoOk()))return;if(modo!=='nuevo')fotosIngreso.reiniciar();relacionada=null;modo='nuevo';buscando=false;verUltimos=false;intento1=false;vistaDatos();guardar();comprobarDup();f.querySelector('[data-ficha]').scrollIntoView({block:'nearest'});};
    const pintarLista=(vehiculos,texto)=>{
      listaActual=vehiculos;const n=vehiculos.length;f.querySelector('[data-res-t]').textContent=texto?(n===1?'1 coincidencia':`${n}${n>=25?' o más':''} coincidencias`):'Últimos autos';
      if(!n){resultados.innerHTML=texto?`<div class="rb-sinres"><b>Sin coincidencias para «${esc(texto)}»</b><p>No hay ningún auto con esa patente, cliente o teléfono. Lo escrito no se pierde.</p><div class="rb-hoja-acc">${pareceP(texto)?`<button type="button" class="rb-alt" data-nuevo-con>${ic('add')}<span><b>Cargar auto nuevo con ${esc(formatoPat(texto).txt)}</b><small>La búsqueda pasa al campo Patente</small></span></button>`:''}<button type="button" class="btn" data-salir-busqueda></button></div></div>`:'<p class="rb-vacio">Todavía no hay autos cargados.</p>';vista1();return;}
      resultados.innerHTML=`<ul class="rb-lres" aria-label="Autos encontrados">${vehiculos.slice(0,8).map(v=>`<li>${fila(v)}</li>`).join('')}</ul>${n>8?`<p class="rb-mas">Y ${n-8} más. Escribí más letras o números para acotar.</p>`:''}`;
    };
    const buscar=async()=>{const n=++consulta,t=q.value.trim();if(t.length<2){if(verUltimos)return mostrarRecientes();buscando=false;vistaDatos();return;}
      buscando=true;verUltimos=false;vistaDatos();resultados.innerHTML='<p class="rb-nota">Buscando…</p>';
      try{const r=await get('/api/buscar?q='+encodeURIComponent(t));if(n!==consulta||!f.isConnected)return;pintarLista(r.vehiculos,t);}catch(e){if(n===consulta)resultados.innerHTML=`<p class="rb-err" role="alert">${errIc(e.message)}</p>`;}};
    const mostrarRecientes=async()=>{const n=++consulta;buscando=true;verUltimos=true;vistaDatos();
      if(!recientes){resultados.innerHTML='<p class="rb-nota">Cargando autos…</p>';try{recientes=(await get('/api/vehiculos')).vehiculos.filter(v=>!v.archivado);}catch(e){if(n===consulta)resultados.innerHTML=`<p class="rb-err" role="alert">${errIc(e.message)}</p>`;return;}}
      if(n===consulta&&f.isConnected)pintarLista(recientes,'');};
    q.oninput=()=>{++consulta;clearTimeout(timer);f.querySelector('[data-limpiar-q]').hidden=!q.value;timer=setTimeout(buscar,220);};
    f.querySelector('[data-limpiar-q]').onclick=()=>{q.value='';++consulta;clearTimeout(timer);verUltimos=false;buscando=false;vistaDatos();q.focus();};
    f.querySelector('[data-ver-ultimos]').onclick=()=>{q.value='';mostrarRecientes();};
    f.querySelectorAll('[name=marcaOpcion]').forEach(r=>r.onchange=()=>{marca();guardar();vistaDatos();});f.elements.marcaOtra.oninput=()=>marca();
    f.elements.patente.addEventListener('input',comprobarDup);f.elements.patente.addEventListener('change',()=>{const x=formatoPat(f.elements.patente.value);if(x.tipo&&f.elements.patente.value!==x.txt){f.elements.patente.value=x.txt;vistaDatos();guardar();}});f.elements.sinPatente.addEventListener('change',()=>{pintarDup();comprobarDup();});
    // Acciones del paso 1, la revisión y los atajos: un solo oyente para el contenido que se vuelve a dibujar.
    f.addEventListener('click',async e=>{
      const t=e.target.closest('button,a');if(!t||!f.contains(t))return;const ds=t.dataset;
      if(ds.elegir)return seleccionar(ds.elegir);
      if(ds.abierta){const v=listaActual.find(x=>String(x.id)===ds.abierta);if(v?.visitaAbierta)return avisarAbierta(v);return seleccionar(ds.abierta);}
      if(ds.usarDup)return seleccionar(ds.usarDup);
      if('salirBusqueda' in ds){q.value='';++consulta;verUltimos=false;if(modo==='conocido'&&elegido){buscando=false;vistaDatos();}else irNuevo();return;}
      if('otroAuto' in ds){q.value='';return mostrarRecientes();}
      if('irNuevo' in ds)return irNuevo();
      if('volverElegido' in ds)return seleccionar(elegido.id);
      if('nuevoCon' in ds){
        const texto=q.value.trim(),antes=f.elements.patente.value.trim();let usar=texto;
        if(antes&&normPat(antes)!==normPat(texto)){const r=await hojaElegir({titulo:'¿Qué patente usamos?',html:`<p class="rb-hoja-p">Ya había una patente escrita en Auto nuevo. Elegí cuál queda; la otra no se pierde sin que lo decidas.</p>`,opciones:[{v:'q',t:`Usar ${formatoPat(texto).txt} (de la búsqueda)`,prim:true},{v:'antes',t:`Mantener ${formatoPat(antes).txt}`},{v:null,t:'Cancelar',ter:true}]});if(!r)return;usar=r==='q'?texto:antes;}
        f.elements.patente.value=formatoPat(usar).txt;f.elements.sinPatente.checked=false;q.value='';await irNuevo();comprobarDup();f.elements.patente.focus();return;
      }
      if(ds.irSec){const s=f.querySelector(`[data-sec="${ds.irSec}"]`);s.scrollIntoView({block:'start'});(s.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea')||s.querySelector('input'))?.focus({preventScroll:true});return;}
      if('irFalta' in ds){intento1=true;vistaDatos();const L=pendientes1();if(L.length)irDato(L[0].ir);return;}
      if('borrarIdent' in ds){if((await confirmar({titulo:'¿Borrar la descripción guardada?',texto:'Se borra de este borrador. La patente queda como está.',aceptar:'Borrar descripción',peligro:true})).ok){f.elements.identificacion.value='';vistaDatos();guardar();}return;}
      if('cambiarCli' in ds){f.elements.contactoId.value='';vistaDatos();guardar();f.querySelector('#rec-contacto-q').focus();return;}
      if(ds.contacto){const c=contactosR.find(x=>String(x.id)===ds.contacto);if(!c)return;f.elements.contactoId.value=c.id;f.elements.contactoNombre.value=c.nombre;f.elements.contactoTel.value=c.telefono||'';cq.value='';cc.innerHTML='';vistaDatos();guardar();f.querySelector('[data-cambiar-cli]')?.focus();return;}
      if('cliNuevoCon' in ds){const t2=cq.value.trim(),tel=/^[\d\s()+-]+$/.test(t2),el=f.elements[tel?'ctelefono':'cnombre'];marcarRadio('clienteModo','nuevo');if(!el.value.trim())el.value=t2;else toast(`Ya había ${tel?'un teléfono':'un nombre'} escrito para el cliente nuevo: se conserva.`);cq.value='';cc.innerHTML='';vistaDatos();guardar();el.focus();return;}
      if(ds.quienAt!=null){f.elements.autPersona.value=ds.quienAt;vistaDatos();guardar();return;}
      if('vaciarRetiro' in ds){f.elements.retiroFecha.value='';f.elements.retiroHora.value='';vistaDatos();guardar();f.elements.retiroFecha.focus();return;}
      if(ds.completar!=null){volverRevision=true;irPaso(+ds.completar);return;}
      if(ds.cambiar!=null&&!pendiente){volverRevision=true;irPaso(+ds.cambiar);return;}
      if('verResumen' in ds)return verResumen();
    });
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
    raiz.querySelector('[data-faltan]').onclick=()=>{if(paso===0){intento1=true;vistaDatos();const L=pendientes1();if(L.length)irDato(L[0].ir);else f.querySelector('[data-continuar]').focus();return;}intento2=true;fotosIngreso.refrescar();actualizar2();if(pendientes2().length)resumen2(true);else irDato('[name=ingresoConfirmado]');};
    f.addEventListener('input',e=>{if(e.target===f.elements.marca)return;if(modo==='nuevo'&&['patente','sinPatente','marcaOpcion','marcaOtra','modelo'].includes(e.target.name)&&fotosIngreso.tieneFotos()){fotosIngreso.reiniciar();toast('Cambiaste el auto: cargá nuevas fotos para este ingreso.');}if(e.target.type!=='search'){vistaDatos();guardar();}});f.addEventListener('change',e=>{if(e.target.type==='search')return;vistaDatos();guardar();});
    raiz.querySelector('[data-atras]').onclick=raiz.querySelector('[data-atras-barra]').onclick=()=>{if(pendiente)return;if(paso===0){if(buscando){q.value='';buscando=false;verUltimos=false;vistaDatos();}else app.ir('#/hoy');}else if(volverRevision){volverRevision=false;irPaso(6);}else irPaso(paso-1);};
    f.querySelectorAll('[data-ir-paso]').forEach(b=>b.onclick=()=>{const n=+b.dataset.irPaso;if(n<paso&&!pendiente){volverRevision=paso===6;irPaso(n);}});
    // Omitir el paso 6 con datos cargados no los descarta en silencio: se elige conservarlos o descartarlos.
    f.querySelector('[data-omitir]').onclick=async()=>{
      const d=campos(),datos=[d.quien==='otra'&&['Lo trae',[d.dejaNombre.trim(),d.dejaTelefono.trim()].filter(Boolean).join(' · ')||'Otra persona'],d.responsableId&&['Responsable',usuarios.find(u=>String(u.id)===d.responsableId)?.nombre||''],d.urgente&&['Prioridad','Urgente'],(d.retiroFecha||d.retiroHora)&&['Retiro acordado',textoRetiro(d)],d.retiroNota.trim()&&['Nota de retiro',d.retiroNota.trim()]].filter(Boolean);
      if(!datos.length){omitido6=true;irPaso(6);return;}
      const r=await hojaElegir({titulo:'Ya cargaste datos en este paso',html:`<p class="rb-hoja-p">Elegí qué hacer con ellos antes de seguir.</p><ul class="rb-lst">${datos.map(([k,v])=>`<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul><p class="rb-opc-ex"><span><b>Conservar:</b> pasan a la revisión y se guardan con el ingreso.</span><span><b>Descartar:</b> se borran solo los datos de este paso.</span></p>`,opciones:[{v:'conservar',t:'Conservar y seguir',prim:true},{v:'descartar',t:'Descartar y seguir'},{v:null,t:'Seguir editando',ter:true}]});
      if(r==='conservar'){try{validar(5);omitido6=false;irPaso(6);}catch(e){mostrarError(f,e);}}
      if(r==='descartar'){marcarRadio('quien','cliente');['dejaNombre','dejaTelefono','responsableId','retiroFecha','retiroHora','retiroNota'].forEach(k=>{f.elements[k].value='';});f.elements.urgente.checked=false;omitido6=true;irPaso(6);}
    };
    const cq=f.querySelector('#rec-contacto-q'),cc=f.querySelector('[data-contactos]');
    cq.oninput=()=>{const n=++consultaContacto;clearTimeout(ctimer);const t=cq.value.trim();if(t.length<2){cc.innerHTML='';return;}ctimer=setTimeout(async()=>{try{const r=await get('/api/contactos?q='+encodeURIComponent(t));if(n!==consultaContacto||!f.isConnected)return;contactosR=r.contactos.slice(0,6);
      cc.innerHTML=contactosR.length?contactosR.map(c=>`<li><button type="button" class="rb-lr cli" data-contacto="${c.id}"><span class="rb-av" aria-hidden="true">${esc(iniciales(c.nombre))}</span><span class="rb-lr-t"><b>${esc(c.nombre)}</b><small>${esc(c.telefono||'Sin teléfono')}</small></span>${ic('chevron_right')}</button></li>`).join('')
        :`<li class="rb-sinres"><b>Sin coincidencias para «${esc(t)}»</b><p>Podés cargarlo como cliente nuevo; lo que escribiste pasa al campo que corresponda.</p><button type="button" class="rb-alt" data-cli-nuevo-con>${ic('add')}<span><b>Cliente nuevo con «${esc(t)}»</b><small>Pasa al campo ${/^[\d\s()+-]+$/.test(t)?'Teléfono':'Nombre'}</small></span></button></li>`;
    }catch(e){if(n===consultaContacto)cc.innerHTML=`<li class="rb-err" role="alert">${errIc(e.message)}</li>`;}},220);};
    f.querySelector('[data-continuar]').addEventListener('click',e=>{if(paso===6)return;e.preventDefault();
      if(paso===0){intento1=true;vistaDatos();const L=pendientes1();if(L.length){irDato(L[0].ir);return;}}
      if(paso===1){intento2=true;fotosIngreso.refrescar();actualizar2();if(!resumen2(true))return;}
      try{validar(paso);if(paso===5)omitido6=false;const siguiente=volverRevision?6:paso+1;if(volverRevision)ultimoCambio=paso;volverRevision=false;irPaso(siguiente);}catch(e){mostrarError(f,e);}});
    f.addEventListener('keydown',e=>{if(e.key==='Enter'&&paso<6&&e.target.tagName==='INPUT'&&!['radio','checkbox','search'].includes(e.target.type)){e.preventDefault();f.querySelector('[data-continuar]').click();}});
    const armarCuerpo=d=>{
      const aut=d.tipo==='service'||d.revisionCosto==='si',importe=importeDe(d);
      const cuerpo={estadoIngreso:{clave:claveDeEnvio(f),fotos:fotosIngreso.datos().filter(x=>x.tipo!=='detalle'||d.carroceria==='con_danos').map(({id,tipo,descripcion})=>({id,tipo,descripcion})),carroceria:d.carroceria,tablero:d.tableroEstado,observaciones:d.ingresoObservaciones,testigos:d.ingresoTestigos,confirmado:!!d.ingresoConfirmado},tipo:d.tipo,km:d.sinKm?'':d.km,sinKm:!!d.sinKm,kmExplicacion:d.kmExplicacion,responsableId:d.responsableId||null,retiro:retiroDe(d),retiroNota:d.retiroNota,prioridad:d.urgente?'alta':'normal',relacionadaId:relacionada?.id||null,turnoId:turno?.id||null,plantillaId:d.tipo==='service'?d.plantillaId||null:null,
        autorizacion:!aut?{}:{...(d.tipo==='service'?{}:{revisionConCosto:true}),persona:d.autPersona,importe},recepcion:{motivos,otro:d.otro,relato:d.relato,autoriza:d.tipo,revisionCosto:d.revisionCosto},
        ...(modo==='conocido'?{vehiculoId:elegido.id,...(d.quien==='otra'?{contacto:{nombre:d.dejaNombre,telefono:d.dejaTelefono}}:{})}
          :{vehiculo:{patente:d.sinPatente?`SIN PATENTE ${f.dataset.clave.slice(0,6).toUpperCase()}`:d.patente,marca:d.marca,modelo:d.modelo,anio:d.anio,...(d.sinPatente&&d.identificacion.trim()?{notas:d.identificacion.trim()}:{}),...(!d.sinPatente&&dupLista.length&&d.confirmarDuplicado?{confirmarDuplicado:true}:{})},
            ...(d.clienteModo==='existente'?{contactoId:+d.contactoId}:{contacto:{nombre:d.cnombre,telefono:d.ctelefono}})})};
      // La persona que lo trae no reemplaza al titular del vehículo nuevo.
      if(modo==='nuevo'&&d.quien==='otra')cuerpo.retiroNota=[d.retiroNota,`Lo dejó ${d.dejaNombre}${d.dejaTelefono?' · '+d.dejaTelefono:''}`].filter(Boolean).join('. ').slice(0,300);
      return cuerpo;
    };
    const verResumen=()=>{const d=campos(),txt=[`Ingreso sin confirmar · ${new Date().toLocaleString('es-AR')}`,`Auto: ${textoAuto(d)}`,`Cliente: ${[clienteDe(d).nombre,clienteDe(d).tel].filter(Boolean).join(' · ')}`,`Autorización: ${textoAut(d)}`,`Kilometraje: ${d.sinKm?'Sin lectura':d.km+' km'}`,`Retiro: ${textoRetiro(d)}`,`Clave del ingreso: ${claveDeEnvio(f)}`].join('\n');
      hojaElegir({titulo:'Resumen para seguir después',html:`<p class="rb-hoja-p">Sirve para averiguar si el ingreso quedó registrado y no cargarlo dos veces. No guarda nada en el sistema.</p><pre class="rb-resumen">${esc(txt)}</pre>`,opciones:[{v:'copiar',t:'Copiar resumen',prim:true},{v:null,t:'Volver'}]}).then(r=>{if(r==='copiar')copiar(txt);});};
    const exito=(r,d)=>{
      const cli=clienteDe(d),v=r.visita||{},auto=v.vehiculo||{};
      raiz.innerHTML=`<section class="rb-exito" aria-labelledby="rb-ex-t"><span class="rb-ex-ic">${ic('check')}</span><h1 id="rb-ex-t" tabindex="-1">${r.repetido?'El ingreso ya estaba registrado':'Auto recibido'}</h1><p>${r.repetido?'La comprobación encontró este ingreso guardado. No se creó otro.':'El sistema confirmó el guardado. El vehículo quedó recibido.'}</p>
        <div class="rb-ex-card"><div class="rb-auto">${placaVeh(auto.patente)}<b>${esc(marcaModelo(auto)||textoAuto(d))}</b></div><dl class="rb-kv"><div class="ancho"><dt>Cliente</dt><dd>${esc(v.contacto_nombre||cli.nombre||'Contacto del vehículo')}</dd></div><div><dt>Orden</dt><dd>N.º ${esc(v.numero)}</dd></div><div><dt>Autorización</dt><dd>${esc(textoAut(d))}</dd></div><div class="ancho"><dt>Retiro acordado</dt><dd>${esc(textoRetiro(d))}</dd></div></dl></div>
        <div class="rb-ex-acc"><a class="btn btn-primario" href="#/visitas/${r.id}">Abrir la orden</a><a class="btn" href="#/recibir?nueva=1">Recibir otro auto</a><a class="btn btn-texto" href="#/hoy">Volver a Hoy</a></div></section>`;
      raiz.querySelector('h1').focus();
    };
    alEnviar(f,async()=>{
      if(!pendiente){
        if(paso<6){validar(paso);const siguiente=volverRevision?6:paso+1;volverRevision=false;irPaso(siguiente);return false;}
        if(faltantes().length){estadoEnvio=estadoEnvio==='error'?'':estadoEnvio;revisar();const h=f.querySelector('[data-hero] .rb-hero');h?.scrollIntoView({block:'start'});h?.focus({preventScroll:true});return false;}
      }
      const d=campos(),reintento=!!pendiente,cuerpo=pendiente||armarCuerpo(d);
      estadoEnvio=reintento?'comprobando':'enviando';revisar();f.querySelector('[data-estado-borrador]').textContent=reintento?'Comprobando… no confirmes de nuevo':'Guardando… el auto aún no está recibido';
      try{const r=await post('/api/visitas',cuerpo,{idempotencia:claveDeEnvio(f)});borrarBorrador(app);delete f.dataset.sucio;exito(r,d);}
      catch(e){
        if(e.datos?.guardadoSinConfirmar){pendiente=cuerpo;estadoEnvio=reintento?'falla':'incierto';guardar();bloquear();revisar();f.querySelector('[data-hero] .rb-hero')?.focus();return false;}
        // El servidor respondió con un error: el ingreso no se guardó y se puede corregir.
        if(reintento){pendiente=null;desbloquear();}
        estadoEnvio='error';errorEnvio=e.message;
        if(e.datos?.duplicados){dupLista=e.datos.duplicados;pintarDup();}
        const mapa={patente:0,marca:0,marcaOtra:0,modelo:0,anio:0,cnombre:0,ctelefono:0,clienteModo:0,contactoId:0,vehiculoId:0,fotosIngreso:1,carroceria:1,tableroEstado:1,ingresoObservaciones:1,ingresoTestigos:1,testigosVer:1,ingresoConfirmado:1,motivos:2,relato:2,otro:2,motivo:2,km:3,kmExplicacion:3,tipo:4,revisionCosto:4,autPersona:4,autImporte:4,responsableId:5,retiro:5,dejaNombre:5};
        guardar();
        if(mapa[e.campo]!=null){volverRevision=true;irPaso(mapa[e.campo]);if(mapa[e.campo]===0){intento1=true;vistaDatos();}mostrarError(f,e);}
        else{revisar();f.querySelector('[data-hero] .rb-hero')?.focus();}
        if(e.datos?.visitaAbierta)toast(e.message,{error:true,accion:{texto:'Abrir orden',fn:()=>app.ir('#/visitas/'+e.datos.visitaAbierta.id)}});
        return false;
      }
    });
    marca();detalleMotivos();irPaso(paso,false);if(pendiente){bloquear();requestAnimationFrame(()=>f.querySelector('[data-hero] .rb-hero')?.scrollIntoView({block:'center'}));}
    // La ficha del auto nuevo se achica al quedar fija arriba (y con el teclado abierto, por la altura disponible).
    if('IntersectionObserver' in window){const ficha=f.querySelector('[data-ficha]');new IntersectionObserver(([x])=>ficha.classList.toggle('compacto',!x.isIntersecting&&x.boundingClientRect.top<0)).observe(f.querySelector('[data-ficha-ref]'));}
    if(!pendiente){if(q.value)buscar();else if(modo==='nuevo')comprobarDup();}
  }};
}
