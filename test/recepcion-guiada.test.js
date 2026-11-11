import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {levantar} from './entorno.js';
import {GRUPOS_MAS,gruposPermitidos} from '../public/js/views/mas-propuesta.js';
import {permisosDe} from '../server/permisos.js';
import {resumenMotivos,borradorPara,ultimaLectura,visitaRelacionada} from '../public/js/recepcion-modelo.js';
import {puedeOfrecerCobro} from '../public/js/orden-presentacion.js';
let E,dueno,mecanico,norte;
before(async()=>{E=await levantar();[dueno,mecanico,norte]=await Promise.all(['dueno','marcos','norte'].map(k=>E.cliente(k)));});
after(async()=>E.cerrar());
function cuerpo(placa='AA123ZZ'){
 return {tipo:'revision',vehiculo:{patente:placa,marca:'Fiat',modelo:'Cronos',anio:'2022'},contacto:{nombre:'Cliente ficticio del rediseño',telefono:'2622550142'},sinKm:true,autorizacion:{},recepcion:{motivos:[{id:'frenos',detalles:['Vibra al frenar']}],otro:'',relato:'Solo ocurre en bajada.',autoriza:'revision',revisionCosto:'no'}};
}
test('Los borradores no contaminan otro ingreso y los envíos inciertos conservan su identidad',()=>{
 const d={turnoId:17,campos:{patente:'AA100AA'}};
 for(const q of [{vehiculo:'9'},{turno:'18'},{patente:'BB200BB'},{nueva:'1'}])assert.equal(borradorPara(q,d),null);
 assert.equal(borradorPara({},d),d);
 const incierto={...d,pendiente:{vehiculoId:5}};assert.equal(borradorPara({nueva:'1',vehiculo:'9'},incierto),incierto);
 assert.equal(ultimaLectura([{km:null},{km:80000},{km:50000}]).km,80000);
 const auto={visitas:[{id:27}]};assert.equal(visitaRelacionada(auto,27).id,27);assert.equal(visitaRelacionada(auto,'27').id,27);assert.equal(visitaRelacionada(auto,28),null);
});
test('La orden ofrece cobrar solo con importe autorizado o saldo pendiente, sin confundir anticipos con deuda',()=>{
 assert.equal(puedeOfrecerCobro({totales:{autorizado:0,cobrado:0,liquidado:0,saldo:0}}),false);
 assert.equal(puedeOfrecerCobro({totales:{autorizado:10000,cobrado:0,liquidado:0,saldo:0}}),true);
 assert.equal(puedeOfrecerCobro({totales:{autorizado:10000,cobrado:10000,liquidado:0,saldo:0}}),false);
 assert.equal(puedeOfrecerCobro({totales:{autorizado:10000,cobrado:8000,liquidado:10000,saldo:2000}}),true);
 assert.equal(puedeOfrecerCobro({totales:{autorizado:10000,cobrado:10000,liquidado:10000,saldo:0}}),false);
 assert.equal(puedeOfrecerCobro({anulada_at:'2026-11-10',totales:{saldo:2000}}),false);
 assert.equal(puedeOfrecerCobro({totales:null}),false);
});
test('Hoy devuelve asignaciones utilizables en los tres roles y no vincula turnos de otro auto',async()=>{
 for(const k of ['dueno','recepcion','marcos']){const c=await E.cliente(k),h=await c.get('/api/hoy');assert.ok(Array.isArray(h.mias));}
 const turno=await dueno.post('/api/turnos',{nombre:'Cliente de turno ficticio',telefono:'2622000000',patente:'ZZ100ZZ',inicio:'2099-11-10T10:00',duracion:30});
 const antes=E.servidor.db.prepare('SELECT COUNT(*) n FROM visitas').get().n;
 assert.equal((await dueno.pedir('POST','/api/visitas',{...cuerpo('ZZ101ZZ'),turnoId:turno.id})).estado,400);
 assert.equal(E.servidor.db.prepare('SELECT COUNT(*) n FROM visitas').get().n,antes);
 assert.equal(E.servidor.db.prepare('SELECT estado FROM turnos WHERE id=?').get(turno.id).estado,'confirmado');
 const v=await dueno.recibir({...cuerpo('ZZ100ZZ'),turnoId:turno.id});assert.equal(v.visita.turno_id,turno.id);
});
test('Recepción guiada: motivos y relato separados; marca, año y lectura desconocida reales; reintento idempotente',async()=>{
 const b=cuerpo(),r=await dueno.recibir(b,{idempotencia:'recepcion-guiada-uno'}),otra=await dueno.recibir(b,{idempotencia:'recepcion-guiada-uno'});
 assert.equal(r.id,otra.id);assert.equal(otra.repetido,true);
 const v=(await dueno.get('/api/visitas/'+r.id)).visita;
 assert.deepEqual(Object.fromEntries(Object.entries(v.recepcion).filter(([k])=>k!=='estadoIngreso')),b.recepcion);assert.equal(v.vehiculo.marca,'Fiat');assert.equal(v.vehiculo.anio,2022);assert.equal(v.lecturas[0].km,null);assert.equal(v.autorizacion_ingreso,null);assert.equal(v.presupuesto,null);
 assert.equal(v.motivo,'Frenos (Vibra al frenar)\nSolo ocurre en bajada.');
 assert.equal(v.dimensiones.find(([k])=>k==='Autorización')[1],'Revisión aceptada');
 const anterior=(await dueno.get('/api/visitas/'+E.datos.etios.visitaActual)).visita;
 assert.equal(anterior.dimensiones.find(([k])=>k==='Dinero')[1],'Anticipo');
 assert.equal((await dueno.pedir('POST','/api/visitas',{...b,vehiculo:undefined,contacto:undefined,vehiculoId:v.vehiculo.id})).estado,409);
 assert.equal((await norte.pedir('GET','/api/visitas/'+r.id)).estado,404);
 const vm=(await mecanico.get('/api/visitas/'+r.id)).visita;
 assert.ok(!vm.dimensiones.some(([k])=>k==='Dinero'));assert.equal(vm.totales,null);
});
test('La recepción rechaza autorización inconsistente, motivos ajenos, otro vacío y revisión sin decisión de costo, sin guardar registros',async()=>{
 const n=E.servidor.db.prepare('SELECT COUNT(*) AS n FROM visitas').get().n;
 for(const cambio of [{autoriza:'service'},{revisionCosto:''},{motivos:[{id:'falso',detalles:[]}]},{motivos:[{id:'otro',detalles:[]}],otro:''},{motivos:[{id:'frenos',detalles:['diagnóstico inventado']}]}]){
  const b=cuerpo();b.recepcion={...b.recepcion,...cambio};assert.equal((await dueno.pedir('POST','/api/visitas',b)).estado,400);
 }
 const b=cuerpo();assert.equal((await mecanico.pedir('POST','/api/visitas',b)).estado,403);
 assert.equal(E.servidor.db.prepare('SELECT COUNT(*) AS n FROM visitas').get().n,n);
});
test('Service como motivo no autoriza; revisión con costo y service explícitos conservan sus reglas',async()=>{
 const b=cuerpo('AA124ZZ');b.recepcion.motivos=[{id:'service',detalles:['Aceite y filtros']}];
 const r=await dueno.recibir(b);assert.equal(r.visita.tipo,'revision');assert.equal(r.visita.autorizacion_ingreso,null);
 const c=cuerpo('AA125ZZ');c.recepcion.revisionCosto='si';c.autorizacion={revisionConCosto:true,persona:'Titular ficticio',importe:'1000'};
 const rc=await dueno.recibir(c);assert.equal(rc.visita.presupuesto.lineas[0].tipo,'revision');assert.equal(rc.visita.presupuesto.lineas[0].autorizada_ingreso,1);
 const s=cuerpo('AA126ZZ');s.tipo='service';s.recepcion.autoriza='service';s.autorizacion={persona:'Titular ficticio'};
 const rs=await dueno.recibir(s);assert.equal(rs.visita.tipo,'service');assert.equal(rs.visita.presupuesto,null);
});
test('Más respeta orden exacto y roles; no muestra grupos vacíos ni accesos sin permiso',()=>{
 assert.deepEqual(GRUPOS_MAS.map(x=>x[0]),['Agenda y clientes','Repuestos y compras','Dinero','Consulta','Administración']);
 assert.deepEqual(GRUPOS_MAS.flatMap(x=>x[1].map(i=>i[2])),['Agenda de turnos','Cuentas de clientes','Stock y reservas','Compras y proveedores','Mostrador','Caja','Reportes','Documentos','Biblioteca técnica','Calculadora de mano de obra','Leer o generar QR','Ajustes, servicios y plantillas','Usuarios y permisos','Conexiones externas','Registro de acciones','Exportación y respaldo']);
 for(const rol of ['dueno','recepcion','mecanico']){const permisos=new Set(permisosDe(rol));const grupos=gruposPermitidos({puede:p=>permisos.has(p)});assert.ok(grupos.every(([,items])=>items.length&&items.every(i=>!i[3]||permisos.has(i[3]))));if(rol==='mecanico')assert.ok(!grupos.some(([t])=>['Dinero','Administración'].includes(t)));}
 const relato='Chilla al frenar';assert.equal(resumenMotivos([]),'');assert.equal(relato,'Chilla al frenar');
});

test('Nota interna: historial persistente, idempotencia, asignación y separación por taller, sin alterar presupuesto ni saldo',async()=>{
 const id=E.datos.etios.visitaActual,antes=(await dueno.get('/api/visitas/'+id)).visita;
 const b={texto:'Llamar para coordinar la prueba del auto (ficticio).'};
 const r=await mecanico.post(`/api/visitas/${id}/notas`,b,{idempotencia:'nota-equipo'});
 await mecanico.post(`/api/visitas/${id}/notas`,b,{idempotencia:'nota-equipo'});
 const v=(await dueno.get('/api/visitas/'+id)).visita;
 assert.equal(v.actividad.filter(a=>a.accion==='Nota interna del equipo'&&a.detalle===b.texto).length,1);
 assert.deepEqual(v.presupuesto,antes.presupuesto);assert.deepEqual(v.totales,antes.totales);
 assert.equal((await norte.pedir('POST',`/api/visitas/${id}/notas`,b)).estado,404);
 const julian=await E.cliente('julian');assert.equal((await julian.pedir('POST',`/api/visitas/${id}/notas`,b)).estado,403);
});
