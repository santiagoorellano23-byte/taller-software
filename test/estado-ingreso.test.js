import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {levantar} from './entorno.js';
import {fotosPrueba} from '../scripts/fotos-prueba.js';
import {crearRespaldo,restaurarRespaldo} from '../server/respaldo.js';
import {DatabaseSync} from 'node:sqlite';
let E,dueno,recepcion,mecanico,norte;
before(async()=>{E=await levantar();[dueno,recepcion,mecanico,norte]=await Promise.all(['dueno','recepcion','marcos','norte'].map(k=>E.cliente(k)));});
after(async()=>E.cerrar());
const cuerpo=()=>({tipo:'revision',vehiculo:{patente:'FOTO'+crypto.randomBytes(3).toString('hex')},contacto:{nombre:'Cliente ficticio'},motivo:'Prueba de fotos de ingreso',sinKm:true});
const contar=()=>Object.fromEntries(['visitas','vehiculos','contactos','lecturas'].map(t=>[t,E.servidor.db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n]));
test('Todos los ingresos, incluida API anterior, exigen fotos: no deja altas parciales',async()=>{
 const n=contar(),r=await dueno.pedir('POST','/api/visitas',cuerpo());
 assert.equal(r.estado,400);assert.equal(r.datos.campo,'fotosIngreso');assert.deepEqual(contar(),n);
});
test('Fotos privadas preparadas: permisos, firma, MIME y recuperación solo del mismo usuario/taller',async()=>{
 const e=await fotosPrueba(recepcion),p=await recepcion.get('/api/recepcion/fotos?clave='+e.clave);
 assert.deepEqual(p.fotos.map(f=>f.id),e.fotos.map(f=>f.id));
 for(const c of [dueno,norte])assert.deepEqual((await c.get('/api/recepcion/fotos?clave='+e.clave)).fotos,[]);
 const ruta=`/api/recepcion/fotos?clave=${e.clave}&tipo=tablero&token=${crypto.randomUUID()}`;
 assert.equal((await mecanico.pedir('POST',ruta,undefined,{crudo:Buffer.from('abc'),cabeceras:{'Content-Type':'image/png'}})).estado,403);
 for(const mime of ['image/svg+xml','application/pdf','image/png'])assert.equal((await dueno.pedir('POST',ruta,undefined,{crudo:Buffer.from('<script>no</script>'),cabeceras:{'Content-Type':mime}})).estado,400);
 assert.equal((await norte.pedir('GET','/api/adjuntos/'+e.fotos[0].id)).estado,404);
});
test('No acepta fotos faltantes, repetidas, del borrador ajeno ni reutilizadas; exige daño y testigos detallados',async()=>{
 const e=await fotosPrueba(dueno),ajeno=await fotosPrueba(recepcion),n=contar();
 const variantes=[
  {...e,fotos:e.fotos.slice(0,1)}, {...e,fotos:[e.fotos[0],e.fotos[0]]},
  {...e,fotos:[e.fotos[0],ajeno.fotos[1]]}, {...e,carroceria:'con_danos'},
  {...e,tablero:'con_testigos',testigos:''}, {...e,tablero:'no_enciende',testigos:''},
  {...e,confirmado:false}, {...e,observaciones:''}, {...e,fotos:e.fotos.map(f=>({...f,descripcion:''}))}
 ];
 for(const estadoIngreso of variantes)assert.equal((await dueno.pedir('POST','/api/visitas',{...cuerpo(),estadoIngreso})).estado,400);
 assert.deepEqual(contar(),n);
 const r=await dueno.post('/api/visitas',{...cuerpo(),estadoIngreso:e});
 assert.equal((await dueno.pedir('POST','/api/visitas',{...cuerpo(),estadoIngreso:e})).estado,400);
 assert.equal(r.visita.recepcion.estadoIngreso.fotos.length,2);
});
test('Confirma fotos y observaciones con orden, fecha, autor, huella e idempotencia; historial no editable ni archivable',async()=>{
 const e=await fotosPrueba(dueno),token=crypto.randomUUID();
 const png=fs.readFileSync(path.join(E.dir,'archivos',E.servidor.db.prepare('SELECT ruta FROM adjuntos WHERE id=?').get(e.fotos[0].id).ruta));
 const archivo=Buffer.concat([png,Buffer.from('DETALLE FICTICIO')]);
 const ruta=`/api/recepcion/fotos?clave=${e.clave}&tipo=detalle&token=${token}`,op={crudo:archivo,idempotencia:token,cabeceras:{'Content-Type':'image/png'}};
 const a=await dueno.post(ruta,undefined,op),aa=await dueno.post(ruta,undefined,op);assert.equal(a.id,aa.id);assert.equal(aa.repetido,true);
 e.fotos.push({id:a.id,tipo:'detalle',descripcion:'Rayón ficticio en puerta derecha'});e.carroceria='con_danos';e.tablero='con_testigos';e.testigos='ABS, motor en marcha (ficticio).';e.observaciones='Rayón previo en puerta delantera derecha (ficticio).';
 const b={...cuerpo(),estadoIngreso:e},clave=crypto.randomUUID(),n=contar().visitas;
 const r=await dueno.post('/api/visitas',b,{idempotencia:clave}),repetido=await dueno.post('/api/visitas',b,{idempotencia:clave});
 assert.equal(r.id,repetido.id);assert.equal(repetido.repetido,true);assert.equal(contar().visitas,n+1);
 const v=(await dueno.get('/api/visitas/'+r.id)).visita,estado=v.recepcion.estadoIngreso;
 assert.equal(estado.observaciones,e.observaciones);assert.equal(estado.testigos,e.testigos);assert.ok(estado.registradoPor);assert.ok(!Number.isNaN(Date.parse(estado.registradoAt)));
 for(const f of estado.fotos){assert.match(f.sha256,/^[a-f0-9]{64}$/);assert.ok(f.fecha);const adj=E.servidor.db.prepare('SELECT * FROM adjuntos WHERE id=?').get(f.id);assert.equal(adj.visita_id,r.id);assert.equal(adj.vehiculo_id,v.vehiculo_id);assert.equal(adj.sha256,f.sha256);}
 assert.equal(v.actividad.filter(a=>a.accion==='Estado y fotos al ingresar registrados').length,1);
 assert.equal((await dueno.pedir('POST',`/api/adjuntos/${a.id}/archivar`,{motivo:'No borrar evidencia'})).estado,400);
 assert.equal((await norte.pedir('GET','/api/visitas/'+r.id)).estado,404);
 assert.equal((await mecanico.get('/api/visitas/'+r.id)).visita.recepcion.estadoIngreso.fotos.length,3);
 // Edición de cabecera no pisa el registro original.
 await dueno.put('/api/visitas/'+r.id,{version:v.version,retiroNota:'Aclaración posterior',estadoIngreso:{observaciones:'No reemplazar'}});
 assert.deepEqual((await dueno.get('/api/visitas/'+r.id)).visita.recepcion.estadoIngreso,estado);
});
test('Archivos perdidos o alterados y huellas repetidas impiden confirmar sin consumir fotos',async()=>{
 const e=await fotosPrueba(dueno),a=E.servidor.db.prepare('SELECT * FROM adjuntos WHERE id=?').get(e.fotos[0].id),ruta=path.join(E.dir,'archivos',a.ruta),buf=fs.readFileSync(ruta),n=contar();
 fs.writeFileSync(ruta,Buffer.from('corrupto'));
 assert.equal((await dueno.pedir('POST','/api/visitas',{...cuerpo(),estadoIngreso:e})).estado,400);fs.writeFileSync(ruta,buf);
 const otro=E.servidor.db.prepare('SELECT * FROM adjuntos WHERE id=?').get(e.fotos[1].id);
 E.servidor.db.prepare('UPDATE adjuntos SET sha256=? WHERE id=?').run(a.sha256,otro.id);
 assert.equal((await dueno.pedir('POST','/api/visitas',{...cuerpo(),estadoIngreso:e})).estado,400);
 E.servidor.db.prepare('UPDATE adjuntos SET sha256=? WHERE id=?').run(otro.sha256,otro.id);
 assert.deepEqual(contar(),n);assert.equal(E.servidor.db.prepare('SELECT visita_id FROM adjuntos WHERE id=?').get(a.id).visita_id,null);
});
test('Respaldo y restauración conservan el registro original, fotos privadas y huellas',async()=>{
 const r=await dueno.recibir(cuerpo()),original=r.visita.recepcion.estadoIngreso;
 const copia=await crearRespaldo({archivoBase:path.join(E.dir,'talleres.db'),carpetaArchivos:path.join(E.dir,'archivos'),destino:path.join(E.dir,'copias-prueba')});
 const destino=path.join(E.dir,'restauracion-prueba');
 const ver=restaurarRespaldo({respaldo:copia.dir,destinoDatos:destino});assert.equal(ver.ok,true);
 const db=new DatabaseSync(path.join(destino,'talleres.db'),{readOnly:true});
 try{assert.deepEqual(JSON.parse(db.prepare('SELECT recepcion_json FROM visitas WHERE id=?').get(r.id).recepcion_json).estadoIngreso,original);
  for(const f of original.fotos){const a=db.prepare('SELECT ruta,sha256 FROM adjuntos WHERE id=?').get(f.id);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(destino,'archivos',a.ruta))).digest('hex'),f.sha256);}
 }finally{db.close();}
});
