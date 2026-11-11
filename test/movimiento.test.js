import test from 'node:test';
import assert from 'node:assert/strict';

test('Movimiento: interrupción, teclado, preferencia y retirada nunca bloquean la interacción', async t => {
  const anteriores = Object.fromEntries(['document','matchMedia','getComputedStyle'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const eventos={}, cambios=[];
  const media={matches:false,addEventListener:(n,fn)=>cambios.push(fn)};
  globalThis.document={documentElement:{dataset:{}},addEventListener:(n,fn)=>{eventos[n]=fn;}};
  globalThis.matchMedia=()=>media;
  globalThis.getComputedStyle=()=>({opacity:'.65',transform:'matrix(1,0,0,1,0,3)'});
  const m=await import('../public/js/movimiento.js?prueba-movimiento');
  const crear=()=>({
    isConnected:true,dataset:{},style:{},atributos:{},efectos:[],
    contains(el){return this===el;},setAttribute(n,v){this.atributos[n]=v;},
    remove(){this.isConnected=false;},
    animate(cuadros,opciones){
      let resolver,rechazar;const efecto={cuadros,opciones,cancelado:false,
        finished:new Promise((si,no)=>{resolver=si;rechazar=no;}),
        cancel(){this.cancelado=true;rechazar(new Error('Cancelado'));},terminar(){resolver();}};
      this.efectos.push(efecto);return efecto;
    }
  });
  try {
    await t.test('Reentrar cancela solo la animación anterior y permite limpiar la vista',()=>{
      const el=crear();m.entrada(el);const primera=el.efectos[0];m.entrada(el,{tipo:'paso',direccion:-1});
      assert.equal(primera.cancelado,true);assert.equal(el.efectos[1].cuadros[0].transform,'translateX(-6px)');
      m.detenerMovimiento(el);assert.equal(el.efectos[1].cancelado,true);assert.equal(el.isConnected,true);
    });
    await t.test('Teclado y cambio de preferencia cancelan movimiento ya iniciado',()=>{
      const el=crear();m.entrada(el);eventos.keydown();assert.equal(el.efectos[0].cancelado,true);
      m.entrada(el);assert.equal(el.efectos.length,1);eventos.pointerdown();m.entrada(el);
      media.matches=true;cambios.forEach(fn=>fn());assert.equal(el.efectos[1].cancelado,true);
      m.entrada(el);assert.equal(el.efectos.length,2);media.matches=false;
    });
    await t.test('Cerrar durante entrada desactiva interacción de inmediato y continúa desde posición actual',async()=>{
      const el=crear();m.entrada(el,{tipo:'aviso'});m.retirar(el);
      assert.equal(el.inert,true);assert.equal(el.style.pointerEvents,'none');assert.equal(el.atributos['aria-hidden'],'true');
      assert.equal(el.efectos[0].cancelado,true);assert.equal(el.efectos[1].cuadros[0].opacity,'.65');
      m.retirar(el);assert.equal(el.efectos.length,2);
      el.efectos[1].terminar();await Promise.resolve();assert.equal(el.isConnected,false);
    });
    await t.test('Sin WAAPI o con movimiento reducido, retirar es inmediato',()=>{
      const el=crear();el.animate=undefined;m.retirar(el);assert.equal(el.isConnected,false);
      media.matches=true;const otro=crear();m.retirar(otro);assert.equal(otro.isConnected,false);assert.equal(otro.efectos.length,0);media.matches=false;
    });
    await t.test('Cambiar preferencia durante salida limpia el nodo y no deja interacción oculta',async()=>{
      const el=crear();m.retirar(el);media.matches=true;cambios.forEach(fn=>fn());
      await Promise.resolve();assert.equal(el.isConnected,false);media.matches=false;
    });
    await t.test('Fallback de salida retira aunque finished nunca se resuelva',async()=>{
      const el=crear();m.retirar(el);await new Promise(si=>setTimeout(si,180));assert.equal(el.isConnected,false);
    });
    await t.test('El motor usa los tokens CSS, incluso cuando el tiempo está expresado en segundos',()=>{
      globalThis.getComputedStyle=()=>({getPropertyValue:n=>({'--respuesta':'0.21s','--respuesta-curva':'ease-out'}[n]||'')});
      const el=crear();m.entrada(el);assert.equal(el.efectos[0].opciones.duration,210);assert.equal(el.efectos[0].opciones.easing,'ease-out');m.detenerMovimiento();
    });
  } finally {
    m.detenerMovimiento();
    for(const [k,descriptor] of Object.entries(anteriores)){if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}
  }
});
