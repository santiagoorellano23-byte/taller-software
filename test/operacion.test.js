import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { levantar } from './entorno.js';
import { crearRespaldo,restaurarRespaldo } from '../server/respaldo.js';
import { abrirBase } from '../server/db.js';
import { renderDocumento } from '../public/js/documento.js';
let E,dueno,recepcion,marcos,julian,norte,id,hallazgoId,fotoId;
const png=Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082','hex');
before(async()=>{E=await levantar();[dueno,recepcion,marcos,julian,norte]=await Promise.all(['dueno','recepcion','marcos','julian','norte'].map(k=>E.cliente(k)));id=E.datos.etios.visitaActual;});
after(async()=>{await E.cerrar();});

test('Hoy conserva una sola orden y permite pendientes simultáneos con fecha del taller',async()=>{
  await dueno.post(`/api/visitas/${id}/presupuesto`,{lineas:[{tipo:'mano_obra',descripcion:'Revisar ruido adicional ficticio',cantidad:'1',unidad:'u.',precio:'1000'}]});
  const relojAnterior=process.env.TALLERES_RELOJ;
  process.env.TALLERES_RELOJ='2027-01-02T01:30:00Z';
  E.servidor.db.prepare('UPDATE visitas SET retiro_acordado=? WHERE id=?').run('2027-01-01T23:00',id);
  try{
    const d=await dueno.get('/api/hoy');
    assert.equal(d.hoy,'2027-01-01');assert.equal(d.zona,'America/Argentina/Mendoza');
    assert.ok(d.pendientes.autorizacion.includes(id));assert.ok(d.pendientes.repuestos.includes(id));assert.ok(d.pendientes.retiros.includes(id));
    assert.equal(d.presentes.filter(v=>v.id===id).length,1);
    for(const ids of Object.values(d.pendientes))assert.equal(ids.length,new Set(ids).size);
    assert.ok(d.presentes.find(v=>v.id===id).operacion.bloqueos.some(b=>b.tipo==='repuesto'));
    assert.ok(!d.presentes.some(v=>v.entregada_at||v.anulada_at));
  }finally{if(relojAnterior===undefined)delete process.env.TALLERES_RELOJ;else process.env.TALLERES_RELOJ=relojAnterior;}
});

test('Hallazgo: permisos, aislamiento y reintento sin duplicar ni alterar presupuesto, tareas o dinero',async()=>{
  const antes=(await dueno.get(`/api/visitas/${id}`)).visita;
  const b={observacion:'Pérdida visible (ficticia)',gravedad:'prioritario',propuesta:'Comprobar origen antes de presupuestar'};
  assert.equal((await recepcion.pedir('POST',`/api/visitas/${id}/hallazgos`,b)).estado,403);
  assert.equal((await julian.pedir('POST',`/api/visitas/${id}/hallazgos`,b)).estado,403);
  assert.equal((await norte.pedir('POST',`/api/visitas/${id}/hallazgos`,b)).estado,404);
  const r=await marcos.post(`/api/visitas/${id}/hallazgos`,b,{idempotencia:'hallazgo-uno'});hallazgoId=r.id;
  const repetido=await marcos.post(`/api/visitas/${id}/hallazgos`,b,{idempotencia:'hallazgo-uno'});assert.equal(repetido.id,r.id);assert.equal(repetido.repetido,true);
  const v=(await dueno.get(`/api/visitas/${id}`)).visita;
  assert.equal(v.hallazgos.length,1);assert.deepEqual(v.presupuesto,antes.presupuesto);assert.deepEqual(v.cuenta,antes.cuenta);assert.deepEqual(v.tareas,antes.tareas);assert.deepEqual(v.totales,antes.totales);
  assert.equal((await norte.pedir('GET',`/api/visitas/${id}`)).estado,404);
});

test('Fotos: validación y vínculo a la misma orden; edición conserva versiones y detecta conflictos',async()=>{
  const f=await dueno.ok('POST',`/api/adjuntos?ambito=visita&visitaId=${id}`,undefined,{crudo:png,cabeceras:{'Content-Type':'image/png','X-Nombre-Archivo':'ficticia.png'}});fotoId=f.id;
  const otra=(await dueno.get('/api/visitas')).visitas.find(v=>v.id!==id);
  const fOtra=await dueno.ok('POST',`/api/adjuntos?ambito=visita&visitaId=${otra.id}`,undefined,{crudo:png,cabeceras:{'Content-Type':'image/png'}});
  const b={observacion:'Pérdida comprobada con foto (ficticia)',gravedad:'recomendado',propuesta:'Revisar unión',versionActual:1,motivoEdicion:'Se completó la inspección',adjuntoId:fOtra.id};
  assert.equal((await dueno.pedir('PUT',`/api/visitas/${id}/hallazgos/${hallazgoId}`,b)).estado,400);
  assert.equal((await dueno.pedir('POST','/api/adjuntos?ambito=visita&visitaId='+id,undefined,{crudo:Buffer.from('no es foto'),cabeceras:{'Content-Type':'image/png'}})).estado,400);
  const cambio=await dueno.put(`/api/visitas/${id}/hallazgos/${hallazgoId}`,{...b,adjuntoId:fotoId});
  assert.equal((await dueno.pedir('PUT',`/api/visitas/${id}/hallazgos/${hallazgoId}`,{...b,adjuntoId:fotoId})).estado,409);
  const v=(await dueno.get(`/api/visitas/${id}`)).visita;
  assert.equal(v.hallazgos[0].id,cambio.id);assert.equal(v.hallazgos[0].version_num,2);assert.equal(v.hallazgos[0].anteriores.length,1);assert.equal(v.hallazgos[0].anteriores[0].observacion,'Pérdida visible (ficticia)');
  assert.equal((await (await E.cliente()).pedir('GET',`/api/adjuntos/${fotoId}`)).estado,401);
  assert.equal((await norte.pedir('GET',`/api/adjuntos/${fotoId}`)).estado,404);
});

test('Informe: foto solo con selección explícita, copia fechada inmutable y originales privados',async()=>{
  const r=await dueno.post('/api/documentos',{tipo:'informe',refTipo:'visita',refId:id});
  const sin=(await dueno.get(`/api/documentos/${r.id}`)).documento;
  assert.equal(sin.contenido.hallazgos.length,1);assert.equal(sin.contenido.hallazgos[0].foto,undefined);
  const rf=await dueno.post('/api/documentos',{tipo:'informe',refTipo:'visita',refId:id,incluirFotos:true});
  const con=(await dueno.get(`/api/documentos/${rf.id}`)).documento;
  assert.match(con.contenido.hallazgos[0].foto,/^data:image\/png;base64,/);
  assert.doesNotMatch(renderDocumento(con.contenido),/\/api\/adjuntos\//);
  assert.match(renderDocumento(con.contenido),/No autorizan reparaciones/);
  const h=(await dueno.get(`/api/visitas/${id}`)).visita.hallazgos[0];
  await dueno.put(`/api/visitas/${id}/hallazgos/${h.id}`,{observacion:'Texto actualizado ficticio',gravedad:'informativo',versionActual:2,motivoEdicion:'Verificación posterior',adjuntoId:fotoId});
  assert.deepEqual((await dueno.get(`/api/documentos/${rf.id}`)).documento.contenido,con.contenido);
  const exportado=await dueno.get('/api/exportar');assert.equal(exportado.hallazgos.length,3);
});

test('Hallazgos y fotos sobreviven al respaldo y la restauración con todas sus versiones',async()=>{
  const dest=fs.mkdtempSync(path.join(os.tmpdir(),'talleres-hallazgos-'));
  try{
    const r=await crearRespaldo({archivoBase:path.join(E.dir,'talleres.db'),carpetaArchivos:path.join(E.dir,'archivos'),destino:dest});
    assert.equal(r.manifiesto.base.conteos.hallazgos,3);
    const nueva=path.join(dest,'restaurada');assert.equal(restaurarRespaldo({respaldo:r.dir,destinoDatos:nueva}).ok,true);
    const db=new DatabaseSync(path.join(nueva,'talleres.db'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM hallazgos').get().n,3);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM hallazgos WHERE vigente=1').get().n,1);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();
  }finally{fs.rmSync(dest,{recursive:true,force:true});}
});

test('Migración aditiva desde esquema 0.3 conserva registros y admite respaldos anteriores',async()=>{
  const dest=fs.mkdtempSync(path.join(os.tmpdir(),'talleres-migracion-'));
  try{
    const archivo=path.join(dest,'anterior.db');const db=new DatabaseSync(archivo);
    db.exec('CREATE TABLE migraciones(nombre TEXT PRIMARY KEY,aplicada_at TEXT NOT NULL)');
    for(const nombre of ['001_base.sql','002_idempotencia_contenido.sql','003_entrega_saldo.sql']){db.exec(fs.readFileSync(new URL('../server/migrations/'+nombre,import.meta.url),'utf8'));db.prepare('INSERT INTO migraciones VALUES(?,?)').run(nombre,'2026-10-01T00:00:00Z');}
    db.prepare('INSERT INTO talleres(slug,nombre,config,creado_at) VALUES(?,?,?,?)').run('anterior','Taller anterior ficticio','{}','2026-10-01T00:00:00Z');db.close();
    const r=await crearRespaldo({archivoBase:archivo,carpetaArchivos:path.join(dest,'sin-archivos'),destino:dest});
    assert.equal(r.manifiesto.base.conteos.hallazgos,undefined);
    const nueva=path.join(dest,'restaurada');assert.equal(restaurarRespaldo({respaldo:r.dir,destinoDatos:nueva}).ok,true);
    const migrada=abrirBase(path.join(nueva,'talleres.db'));assert.equal(migrada.prepare('SELECT nombre FROM talleres').get().nombre,'Taller anterior ficticio');assert.equal(migrada.prepare('SELECT COUNT(*) AS n FROM hallazgos').get().n,0);assert.equal(migrada.prepare('PRAGMA foreign_key_check').all().length,0);migrada.close();
  }finally{fs.rmSync(dest,{recursive:true,force:true});}
});
