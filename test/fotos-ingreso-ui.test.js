import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enlazarFotosIngreso} from '../public/js/estado-ingreso.js';
const box=()=>({isConnected:true,innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null});
const turno=()=>new Promise(resolve=>setImmediate(resolve));
const inicial=[{id:11,tipo:'tablero',descripcion:'Tablero',token:'token-tablero-ficticio',intentada:true},{id:12,tipo:'exterior',descripcion:'Exterior',token:'token-exterior-ficticio',intentada:true}];
test('Fotos de ingreso: espera recuperación confirmada y conserva únicamente referencias del servidor',async()=>{
 const original=globalThis.fetch;let responder,cambios=0;
 globalThis.fetch=()=>new Promise(resolve=>{responder=resolve;});
 try{
  const fotos=enlazarFotosIngreso(box(),{clave:'clave-ficticia-123',inicial,guardar:()=>cambios++});
  assert.throws(()=>fotos.validar('sin_danos'),/Esperá/);
  responder(new Response(JSON.stringify({fotos:inicial}),{headers:{'Content-Type':'application/json'}}));await turno();
  assert.doesNotThrow(()=>fotos.validar('sin_danos'));assert.throws(()=>fotos.validar('con_danos'),/detalle/);assert.equal(cambios,1);
  assert.deepEqual(fotos.datos(),inicial);
 }finally{globalThis.fetch=original;}
});
test('Cambiar de auto durante la recuperación no aplica la respuesta anterior al borrador nuevo',async()=>{
 const original=globalThis.fetch;let responder,cambios=0;
 globalThis.fetch=()=>new Promise(resolve=>{responder=resolve;});
 try{
  const fotos=enlazarFotosIngreso(box(),{clave:'clave-ficticia-456',inicial,guardar:()=>cambios++});fotos.reiniciar();
  const nuevas=fotos.datos();assert.equal(cambios,1);
  responder(new Response(JSON.stringify({fotos:inicial}),{headers:{'Content-Type':'application/json'}}));await turno();
  assert.deepEqual(fotos.datos(),nuevas);assert.equal(cambios,1);assert.ok(nuevas.every(f=>f.id===null));assert.throws(()=>fotos.validar('sin_danos'),/pendientes/);
 }finally{globalThis.fetch=original;}
});
test('Sin conexión al recuperar fotos nunca se da el ingreso como completo',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Offline ficticio');};
 try{
  const fotos=enlazarFotosIngreso(box(),{clave:'clave-ficticia-789',inicial,guardar:()=>{}});await turno();
  assert.ok(fotos.datos().every(f=>!f.id));assert.throws(()=>fotos.validar('sin_danos'),/pendientes/);
 }finally{globalThis.fetch=original;}
});
test('Un borrador sin fotos elegidas no informa una carga fallida al recargar',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({fotos:[]}),{headers:{'Content-Type':'application/json'}});
 try{
  const raiz=box(),sinFotos=inicial.map(({intentada,...f})=>({...f,id:null}));
  const fotos=enlazarFotosIngreso(raiz,{clave:'clave-vacia-ficticia',inicial:sinFotos,guardar:()=>{}});await turno();
  assert.ok(!raiz.innerHTML.includes('Esta foto no llegó'));assert.ok(raiz.innerHTML.includes('Falta cargar esta foto'));assert.equal(fotos.tieneFotos(),false);
 }finally{globalThis.fetch=original;}
});
