// Paso 2 «¿Cómo llega?»: reemplazo seguro de fotos (la anterior se conserva hasta que la nueva llega), formatos que
// admite el sistema y cuándo se vuelve a pedir la verificación. Las cargas se simulan con un fetch controlado; los
// formatos y el límite se comprueban también contra el servidor real con una base temporal.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {levantar} from './entorno.js';
import {enlazarFotosIngreso} from '../public/js/estado-ingreso.js';

globalThis.document??={getElementById:()=>null};
const box=()=>({isConnected:true,innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null});
const turno=()=>new Promise(resolve=>setImmediate(resolve));
const jpg=(nombre='foto.jpg')=>new File([Uint8Array.from([0xff,0xd8,0xff,1,2,3])],nombre,{type:'image/jpeg'});
const json=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
const inicial=[{id:21,tipo:'tablero',descripcion:'Tablero al ingresar',token:'token-tablero-paso2',intentada:true},{id:22,tipo:'exterior',descripcion:'Vista exterior al ingresar',token:'token-exterior-paso2',intentada:true}];
// Componente con las dos fotos ya comprobadas y un fetch que responde según `responder`.
async function armar(responder){
  const original=globalThis.fetch,cambios=[],pedidos=[];
  globalThis.fetch=async(url,o={})=>{if(!o.method||o.method==='GET')return json({fotos:inicial});pedidos.push(url);return responder(url,o);};
  const fotos=enlazarFotosIngreso(box(),{clave:'clave-paso2-ficticia',inicial,guardar:()=>{},alCambio:m=>{cambios.push(m);return ()=>{};}});
  await turno();
  return {fotos,cambios,pedidos,restaurar:()=>{globalThis.fetch=original;}};
}

test('Paso 2: si el reemplazo falla, se conserva la foto anterior y no se vuelve a pedir la verificación',async()=>{
  const {fotos,cambios,pedidos,restaurar}=await armar(async()=>{throw new TypeError('Sin conexión ficticia');});
  try{
    fotos.cargar('tablero',[jpg('nueva.jpg')],'token-tablero-paso2');await turno();await turno();
    assert.equal(pedidos.length,1);
    assert.deepEqual(fotos.datos(),inicial,'el borrador sigue con la foto anterior');
    assert.deepEqual(cambios,[],'un cambio fallido no reinicia la verificación');
    assert.doesNotThrow(()=>fotos.validar('sin_danos'),'la anterior sigue siendo válida para continuar');
  }finally{restaurar();}
});

test('Paso 2: un archivo grande, un PDF o una foto HEIC no se suben y la anterior queda',async()=>{
  const {fotos,cambios,pedidos,restaurar}=await armar(async()=>json({id:99,tipo:'tablero'}));
  try{
    const grande=new File([new Uint8Array(15*1024*1024+1)],'IMG_2041.jpg',{type:'image/jpeg'});
    for(const f of [grande,new File(['%PDF-1.4'],'presupuesto.pdf',{type:'application/pdf'}),new File([new Uint8Array(10)],'IMG_0001.HEIC',{type:'image/heic'})])fotos.cargar('tablero',[f],'token-tablero-paso2');
    await turno();
    assert.equal(pedidos.length,0,'se rechazan antes de enviarlos');
    assert.deepEqual(fotos.datos(),inicial);assert.deepEqual(cambios,[]);
    assert.deepEqual(fotos.estado().fallidas,[],'un cambio no admitido no cuenta como foto fallida');
  }finally{restaurar();}
});

test('Paso 2: el reemplazo correcto cambia la foto recién cuando el servidor la confirma y pide verificar de nuevo',async()=>{
  let soltar;const {fotos,cambios,restaurar}=await armar(()=>new Promise(r=>{soltar=()=>r(json({id:30,tipo:'tablero'}));}));
  try{
    fotos.cargar('tablero',[jpg()],'token-tablero-paso2');await turno();
    assert.equal(fotos.datos()[0].id,21,'mientras sube, sigue la anterior');
    assert.throws(()=>fotos.validar('sin_danos'),/Esperá/,'un cambio en curso no deja continuar');
    soltar();await turno();await turno();
    assert.equal(fotos.datos()[0].id,30);assert.notEqual(fotos.datos()[0].token,'token-tablero-paso2');
    assert.deepEqual(cambios,['Cambiaste la foto del tablero.']);
  }finally{restaurar();}
});

test('Paso 2: cancelar un cambio descarta la respuesta tardía y deja la anterior',async()=>{
  let soltar;const {fotos,cambios,restaurar}=await armar(()=>new Promise(r=>{soltar=()=>r(json({id:31,tipo:'exterior'}));}));
  try{
    fotos.cargar('exterior',[jpg()],'token-exterior-paso2');await turno();
    fotos.cancelar('token-exterior-paso2');soltar();await turno();await turno();
    assert.deepEqual(fotos.datos(),inicial);assert.deepEqual(cambios,[]);
  }finally{restaurar();}
});

let E;
before(async()=>{E=await levantar();});
after(async()=>E?.cerrar());
test('Paso 2: el servidor admite solo JPG, PNG o WEBP de hasta 15 MB (HEIC/HEIF no)',async()=>{
  const c=await E.cliente('recepcion');
  const ruta=()=>`/api/recepcion/fotos?clave=${crypto.randomUUID()}&tipo=tablero&token=${crypto.randomUUID()}`;
  for(const mime of ['image/heic','image/heif']){const r=await c.pedir('POST',ruta(),undefined,{crudo:Buffer.alloc(64,1),cabeceras:{'Content-Type':mime}});assert.equal(r.estado,400);assert.match(r.datos.error,/JPG, PNG o WEBP/);}
  const grande=Buffer.alloc(15*1024*1024+1);grande.set([0xff,0xd8,0xff]);
  // El servidor corta la conexión al pasar el límite (o responde 413): nunca guarda el archivo. La interfaz lo frena antes.
  const antes=E.servidor.db.prepare('SELECT COUNT(*) n FROM adjuntos').get().n;
  const r=await c.pedir('POST',ruta(),undefined,{crudo:grande,cabeceras:{'Content-Type':'image/jpeg'}}).catch(()=>({estado:413}));
  assert.equal(r.estado,413);assert.equal(E.servidor.db.prepare('SELECT COUNT(*) n FROM adjuntos').get().n,antes);
});
