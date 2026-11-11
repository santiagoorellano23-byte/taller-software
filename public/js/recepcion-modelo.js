// Catálogo y resumen compartidos por recepción y servidor. No modifica el relato.
export const MARCAS = ['Fiat','Volkswagen','Toyota','Chevrolet','Ford','Renault','Peugeot','Otra'];
export const MOTIVOS = [
  {id:'service',nombre:'Service',icono:'oil_barrel',pregunta:'¿Qué pidió?',detalles:['Aceite y filtros','Service por kilometraje','No sabe']},
  {id:'noarranca',nombre:'No arranca',icono:'key_off',pregunta:'¿Qué hace al intentar?',detalles:['No hace nada','Hace clic','Gira y no arranca','Arranca y se apaga','No sabe']},
  {id:'ruido',nombre:'Ruido / vibración',icono:'graphic_eq',pregunta:'¿Cuándo pasa?',detalles:['Al frenar','Al acelerar','En baches','En curvas','En frío','Siempre']},
  {id:'fluidos',nombre:'Pérdida de fluidos',icono:'water_drop',pregunta:'¿Qué pierde?',detalles:['Aceite','Agua','Combustible','No sabe']},
  {id:'frenos',nombre:'Frenos',icono:'stop_circle',pregunta:'¿Qué nota?',detalles:['Ruido','Pedal largo','Tira para un lado','Vibra al frenar']},
  {id:'otro',nombre:'Otro motivo',icono:'edit_note',detalles:[]},
  ...[['testigo','Testigo encendido','warning'],['temp','Calienta','thermostat'],['humo','Humo','cloud'],['elec','Eléctrico / batería','electric_bolt'],['aire','Aire acondicionado','ac_unit'],['direccion','Dirección / tren delantero','swap_horiz'],['potencia','Tirones / sin fuerza','trending_down'],['combustible','Olor o consumo de combustible','local_gas_station'],['caja','Embrague / caja','settings']].map(([id,nombre,icono])=>({id,nombre,icono,detalles:[]}))
];
export function resumenMotivos(motivos=[],otro='') {
  return motivos.map(x=>{const m=MOTIVOS.find(m=>m.id===x.id);return !m?'':m.id==='otro'?`Otro: ${otro}`:m.nombre+(x.detalles?.length?` (${x.detalles.join(', ')})`:'');}).filter(Boolean).join(' · ');
}
export function material(nombre) {
  return `<img class="material-icon" src="/iconos-material/${nombre}.svg" width="24" height="24" alt="" aria-hidden="true">`;
}
export const claveBorrador = app => `talleres-recepcion:${app.sesion.taller.id}:${app.sesion.usuario.id}`;
export function leerBorrador(app) {
  try {const d=JSON.parse(sessionStorage.getItem(claveBorrador(app)));return d?.schema===1&&Date.now()-d.fecha<86400000?d:null;}catch{return null;}
}
export function guardarBorrador(app,d) {
  try{sessionStorage.setItem(claveBorrador(app),JSON.stringify({...d,schema:1,fecha:Date.now()}));return true;}catch{return false;}
}
export function borrarBorrador(app){try{sessionStorage.removeItem(claveBorrador(app));}catch{/* Sigue funcionando sin almacenamiento. */}}
// Un destino explícito inicia su propio ingreso; un envío incierto siempre se recupera.
export function borradorPara(query,draft){return draft?.pendiente?draft:query.nueva||query.vehiculo||query.turno||query.patente?null:draft;}
export function ultimaLectura(lecturas=[]){return lecturas.find(x=>x.km!=null);}
export function visitaRelacionada(vehiculo,id){return vehiculo?.visitas?.find(v=>String(v.id)===String(id))||null;}
