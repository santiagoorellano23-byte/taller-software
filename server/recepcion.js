import {MOTIVOS,resumenMotivos} from '../public/js/recepcion-modelo.js';
import {falla,requerido,opcional} from './util.js';
export function datosRecepcion(r){
  if(r==null)return null; // Compatibilidad con clientes anteriores de la API.
  if(typeof r!=='object'||Array.isArray(r)||!Array.isArray(r.motivos)||r.motivos.length>MOTIVOS.length)falla('Revisá los motivos del ingreso.','motivos');
  const vistos=new Set();
  const motivos=r.motivos.map(x=>{
    const m=MOTIVOS.find(m=>m.id===x?.id);
    if(!m||vistos.has(m.id)||!Array.isArray(x.detalles)||x.detalles.some(d=>!m.detalles.includes(d)))falla('Revisá los motivos seleccionados.','motivos');
    vistos.add(m.id);return {id:m.id,detalles:[...new Set(x.detalles)]};
  });
  const otro=vistos.has('otro')?requerido(r.otro,'Contá el otro motivo.','otro',200):'';
  const relato=opcional(r.relato,1000)||'';
  if(!motivos.length&&!relato.trim())falla('Elegí un motivo o escribí lo que cuenta el cliente.','relato');
  if(!['revision','service'].includes(r.autoriza))falla('Elegí qué autoriza el cliente.','tipo');
  if(r.autoriza==='revision'&&!['si','no'].includes(r.revisionCosto))falla('Indicá si la revisión tiene costo.','revisionCosto');
  return {motivos,otro,relato,autoriza:r.autoriza,revisionCosto:r.autoriza==='revision'?r.revisionCosto:null};
}
export function motivoRecepcion(r){return [resumenMotivos(r.motivos,r.otro),r.relato].filter(Boolean).join('\n');}
