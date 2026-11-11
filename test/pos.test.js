import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {levantar} from './entorno.js';

let e,recepcion,mecanico,norte;
before(async()=>{e=await levantar();[recepcion,mecanico,norte]=await Promise.all(['recepcion','marcos','norte'].map(e.cliente));});
after(async()=>{await e.cerrar();});

test('Las tarjetas POS usan la última visita y la orden abierta de este taller',async()=>{
  const {vehiculos}=await recepcion.get('/api/buscar?q=AE482KJ');
  const tarjeta=vehiculos.find(v=>v.patente.replace(/\s/g,'')==='AE482KJ');assert.ok(tarjeta);
  const {vehiculo}=await recepcion.get('/api/vehiculos/'+tarjeta.id);
  assert.equal(tarjeta.ultima_visita,vehiculo.visitas.map(v=>v.ingreso_at).sort().at(-1));
  assert.equal(tarjeta.visitaAbierta.id,e.datos.etios.visitaActual);
  const recientes=(await recepcion.get('/api/vehiculos')).vehiculos.find(v=>v.id===tarjeta.id);
  assert.equal(recientes.visitaAbierta.id,tarjeta.visitaAbierta.id);
  assert.equal(recientes.ultima_visita,tarjeta.ultima_visita);
});

test('Las proyecciones POS conservan el aislamiento y los permisos del mecánico',async()=>{
  const {vehiculos}=await mecanico.get('/api/buscar?q=AE482KJ');assert.ok(vehiculos.length);
  assert.ok(!Object.hasOwn(vehiculos[0],'totales'));
  const ingreso=await mecanico.pedir('POST','/api/visitas',{vehiculoId:vehiculos[0].id,tipo:'revision',motivo:'Prueba de permisos',sinKm:true});assert.equal(ingreso.estado,403);
  const ajenos=await norte.get('/api/vehiculos');
  assert.ok(ajenos.vehiculos.every(v=>!vehiculos.some(a=>a.id===v.id)));
  const ajena=await norte.pedir('GET','/api/vehiculos/'+vehiculos[0].id);assert.equal(ajena.estado,404);
});
