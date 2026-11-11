// Compras: registrar, recibir (entra al stock una sola vez), vincular remito/factura, devolver, pagar al proveedor.
import { get, post, claveDeEnvio } from '../api.js?v=0.1.0';
import { esc, icono, pesos, cant, fecha, fechaHora, chip, campo, casilla, alEnviar, toast, confirmar, aviso, MEDIOS, hoyLocal } from '../ui.js?v=0.1.0';

const EST = { borrador: ['Sin recibir', 'ambar', 'reloj'], recibida: ['Recibida', 'verde', 'check'], anulada: ['Anulada', 'rojo', 'ban'] };
const filaCompra = (articulos) => `<div class="linea-form" data-linea style="grid-template-columns:minmax(0,1fr)"><div class="fila-campos">
  ${campo({ nombre: 'articuloId', etiqueta: 'Artículo', tipo: 'select', opciones: [['', 'Artículo nuevo (escribir abajo)'], ...articulos.map((a) => [a.id, `${a.nombre} (${a.unidad})`])] })}
  ${campo({ nombre: 'nuevoNombre', etiqueta: 'Nombre del artículo nuevo' })}
  ${campo({ nombre: 'nuevaUnidad', etiqueta: 'Unidad (nuevo)', tipo: 'select', opciones: ['u.', 'L', 'kg', 'm', 'juego', 'kit', 'par'] })}
  ${campo({ nombre: 'cantidad', etiqueta: 'Cantidad', requerido: true, attrs: 'inputmode="decimal"' })}
  ${campo({ nombre: 'costo', etiqueta: 'Costo unitario', requerido: true, attrs: 'inputmode="decimal"' })}
</div><button type="button" class="btn btn-chico btn-texto" data-quitar>${icono('x')}Quitar</button></div>`;

export default async function compras({ params, app, query }) {
  if (params.id) return detalle(params.id, app);
  const [{ compras: lista }, { proveedores }, { articulos }] = await Promise.all([get('/api/compras'), get('/api/proveedores'), get('/api/articulos')]);
  return {
    titulo: 'Compras',
    html: `<div class="pagina">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      ${query.volver?`<a class="volver" href="#/visitas/${Number(query.volver)}/trabajo">${icono('izq')}Volver a la orden</a>`:''}<div class="cab"><h1 tabindex="-1">Compras</h1><div class="acciones"><button type="button" class="btn btn-chico btn-texto" data-ayuda="compra">${icono('ayuda')}¿Cómo hago…?</button><a class="btn btn-chico" href="#/proveedores">${icono('usuarios')}Proveedores</a></div></div>
      <details class="mas" ${query.nueva || !lista.length ? 'open' : ''}><summary>Nueva compra</summary><div class="mas__cuerpo">
        ${`<form class="form" id="f-compra" novalidate>
          <div class="fila-campos">${campo({ nombre: 'proveedorId', etiqueta: 'Proveedor', tipo: 'select', requerido: true, valor:query.proveedor||'', opciones: [['','Elegí un proveedor'],...proveedores.map((p) => [p.id, p.nombre])] })}${campo({ nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: hoyLocal() })}</div>
          <details class="mas" data-alta-prov><summary>Agregar proveedor sin salir</summary><div class="mas__cuerpo"><div class="fila-campos">${campo({nombre:'proveedorNuevo',etiqueta:'Nombre del proveedor'})}${campo({nombre:'proveedorTelefono',etiqueta:'Teléfono',tipo:'tel'})}</div><button type="button" class="btn" data-crear-prov>Guardar proveedor y seleccionarlo</button><p role="status" data-prov-estado class="small muted"></p></div></details>
          <div class="fila-campos">${campo({ nombre: 'docTipo', etiqueta: 'Documento del proveedor', tipo: 'select', opciones: [['remito', 'Remito'], ['factura', 'Factura'], ['otro', 'Otro']] })}${campo({ nombre: 'docNumero', etiqueta: 'Número', ayuda: 'El mismo número no se puede cargar dos veces.' })}</div>
          <div class="lineas-form" data-lineas>${filaCompra(articulos)}</div>
          <button type="button" class="btn btn-chico" data-otra>${icono('mas')}Agregar otro artículo</button>
          ${casilla('recibir', 'La mercadería ya está en el taller: registrar la recepción ahora (entra al stock)', false)}
          ${campo({ nombre: 'nota', etiqueta: 'Nota' })}
          <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Guardar compra</button></div></form>`}
      </div></details>
      <section class="panel"><div class="panel__cab"><h2>Compras registradas</h2></div>
        ${lista.length ? `<ul class="lista">${lista.map((c) => `<li><a class="fila" href="#/compras/${c.id}" style="text-decoration:none;color:inherit"><span><strong>Compra N.º ${esc(c.numero)}</strong> · ${esc(c.proveedor.nombre)}<br><span class="muted small">${esc(fecha(c.fecha))} · ${c.documentos.map((d) => esc(d.tipo + ' ' + d.numero)).join(', ') || 'sin documento'}</span></span>
          <span class="acciones">${chip(...EST[c.estado])}${c.saldoProveedor && c.estado !== 'anulada' ? chip('Debe al proveedor ' + pesos(c.saldoProveedor), 'ambar', 'dinero') : ''}<strong class="num">${pesos(c.total)}</strong></span></a></li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Todavía no hay compras.</p></div>'}</section>
    </div>`,
    despues(raiz) {
      const f = raiz.querySelector('#f-compra');
      if (!f) return;
      const cont = f.querySelector('[data-lineas]');
      if(query.descripcion){cont.querySelector('[name="nuevoNombre"]').value=query.descripcion;cont.querySelector('[name="cantidad"]').value=query.cantidad||'1';}
      const crearProv=f.querySelector('[data-crear-prov]');
      crearProv.onclick=async()=>{
        if(crearProv.disabled)return;crearProv.disabled=true;const estado=f.querySelector('[data-prov-estado]');
        try {const nombre=f.elements.proveedorNuevo.value.trim();if(!nombre)throw new Error('Escribí el nombre del proveedor.');const r=await post('/api/proveedores',{nombre,telefono:f.elements.proveedorTelefono.value});
          const option=new Option(nombre,String(r.id));f.elements.proveedorId.add(option);f.elements.proveedorId.value=String(r.id);f.querySelector('[data-alta-prov]').open=false;estado.textContent='Proveedor guardado.';f.elements.proveedorNuevo.value='';f.elements.proveedorTelefono.value='';
        }catch(e){estado.textContent=e.message;}finally{crearProv.disabled=false;}
      };
      const enlazar = () => cont.querySelectorAll('[data-linea]').forEach((fila) => {
        const articulo = fila.querySelector('[name=articuloId]');
        const mostrarNuevos = () => ['nuevoNombre', 'nuevaUnidad'].forEach(nombre => { fila.querySelector(`[name="${nombre}"]`).closest('.campo').hidden = !!articulo.value; });
        articulo.onchange = mostrarNuevos;
        mostrarNuevos();
        fila.querySelector('[data-quitar]').onclick = () => {
          if (cont.children.length > 1) fila.remove();
          else fila.outerHTML = filaCompra(articulos);
          enlazar();
          f.dataset.sucio = '1';
          cont.lastElementChild.querySelector('[name=articuloId]').focus();
        };
      });
      enlazar();
      f.querySelector('[data-otra]').onclick = () => { cont.insertAdjacentHTML('beforeend', filaCompra(articulos)); enlazar(); };
      alEnviar(f, async (d) => {
        const lineas = [...cont.querySelectorAll('[data-linea]')].map((x) => { const g = (k) => x.querySelector(`[name="${k}"]`).value; return g('articuloId') ? { articuloId: Number(g('articuloId')), cantidad: g('cantidad'), costo: g('costo') } : { nuevoArticulo: { nombre: g('nuevoNombre'), unidad: g('nuevaUnidad') }, cantidad: g('cantidad'), costo: g('costo') }; });
        try {
          const r = await post('/api/compras', { proveedorId: Number(d.proveedorId), fecha: d.fecha, documento: d.docNumero ? { tipo: d.docTipo, numero: d.docNumero, fecha: d.fecha } : null, lineas, recibir: d.recibir, nota: d.nota }, { idempotencia: claveDeEnvio(f) });
          toast(d.recibir ? 'Compra recibida: la mercadería entró al stock.' : 'Compra guardada sin recibir.');
          app.ir('#/compras/' + r.id);
        } catch (e) {
          if (e.datos?.compraId) toast(e.message, { error: true, accion: { texto: 'Ver esa compra', fn: () => app.ir('#/compras/' + e.datos.compraId) } });
          throw e;
        }
      });
    }
  };
}

async function detalle(id, app) {
  const { compra: c } = await get(`/api/compras/${id}`);
  return {
    titulo: `Compra ${c.numero}`,
    html: `<div class="pagina" style="max-width:960px">
      <a class="volver" href="#/compras">${icono('izq')}Compras</a>
      <div class="cab"><div class="cab__titulo"><h1 tabindex="-1">Compra N.º ${esc(c.numero)}</h1>${chip(...EST[c.estado])}</div>
        ${c.estado === 'borrador' ? `<button type="button" class="btn btn-primario" data-recibir>${icono('caja')}Registrar recepción</button>` : ''}</div>
      <p>${esc(c.proveedor.nombre)} · ${esc(fecha(c.fecha))}${c.recibida_at ? ' · recibida ' + esc(fechaHora(c.recibida_at)) : ''}</p>
      ${c.anulada_motivo ? aviso(`Anulada: ${esc(c.anulada_motivo)}`, 'rojo', 'ban') : ''}
      ${c.estado === 'borrador' ? aviso('Todavía no entró al stock. Registrá la recepción cuando la mercadería esté en el taller.', 'ambar', 'reloj') : ''}
      <div class="panel"><ul class="lista">${c.lineas.map((l) => `<li class="fila"><span><strong>${esc(l.articulo)}</strong> × ${esc(cant(l.cantidad_m, l.unidad))} a ${pesos(l.costo_unit)}${l.devuelto_m ? ` <span class="muted small">(devuelto ${esc(cant(l.devuelto_m, l.unidad))})</span>` : ''}</span><strong class="num">${pesos(Math.round(l.cantidad_m * l.costo_unit / 1000))}</strong></li>`).join('')}
        <li class="fila"><strong>Total</strong><strong class="num">${pesos(c.total)}</strong></li></ul></div>
      <section class="panel"><div class="panel__cab"><h2>Documentos del proveedor</h2></div>
        ${c.documentos.length ? `<ul class="lista">${c.documentos.map((d) => `<li class="fila"><span>${esc(d.tipo === 'remito' ? 'Remito' : d.tipo === 'factura' ? 'Factura' : 'Documento')} ${esc(d.numero)}${d.fecha ? ' · ' + esc(fecha(d.fecha)) : ''}</span>${d.importe != null ? `<span class="num">${pesos(d.importe)}</span>` : ''}</li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted small">Sin documentos cargados.</p></div>'}
        ${c.estado !== 'anulada' ? `<div class="panel__cuerpo"><details class="mas"><summary>Agregar factura o remito de esta compra</summary><div class="mas__cuerpo"><form class="form" id="f-doc" novalidate>
          <div class="fila-campos">${campo({ nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: [['factura', 'Factura'], ['remito', 'Remito'], ['otro', 'Otro']] })}${campo({ nombre: 'numero', etiqueta: 'Número', requerido: true })}${campo({ nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date' })}${campo({ nombre: 'importe', etiqueta: 'Importe', attrs: 'inputmode="decimal"' })}</div>
          <p class="muted small">Vincular la factura de un remito ya recibido no vuelve a ingresar mercadería.</p><button class="btn" type="submit">Agregar documento</button></form></div></details></div>` : ''}</section>
      <section class="panel"><div class="panel__cab"><h2>Pagos al proveedor</h2><span class="muted small">Pagado ${pesos(c.pagado)} · saldo ${pesos(c.saldoProveedor)}</span></div>
        ${c.pagos.length ? `<ul class="lista">${c.pagos.map((p) => `<li class="fila"><span>${esc(fecha(p.fecha))} · ${esc(MEDIOS[p.medio] || p.medio)}${p.nota ? ' · ' + esc(p.nota) : ''}${p.anulado_at ? ' ' + chip('Anulado', 'rojo', 'ban') : ''}</span><span class="acciones"><strong class="num">${pesos(p.importe)}</strong>${!p.anulado_at && app.puede('compras.pagar') ? `<button type="button" class="btn btn-chico btn-texto" data-anular-pago="${p.id}">Anular</button>` : ''}</span></li>`).join('')}</ul>` : ''}
        ${app.puede('compras.pagar') && c.estado !== 'anulada' && c.saldoProveedor > 0 ? `<div class="panel__cuerpo"><form class="form" id="f-pago" novalidate data-clave="${crypto.randomUUID ? crypto.randomUUID() : Date.now()}"><div class="fila-campos">${campo({ nombre: 'importe', etiqueta: 'Importe pagado', requerido: true, attrs: 'inputmode="decimal"' })}${campo({ nombre: 'medio', etiqueta: 'Medio', tipo: 'select', opciones: Object.entries(MEDIOS) })}${campo({ nombre: 'nota', etiqueta: 'Nota' })}</div><button class="btn" type="submit">Registrar pago al proveedor</button></form></div>` : ''}</section>
      ${c.estado === 'recibida' ? `<details class="mas"><summary>Devolver mercadería al proveedor</summary><div class="mas__cuerpo"><form class="form" id="f-dev" novalidate>
        ${c.lineas.filter((l) => l.devuelto_m < l.cantidad_m).map((l) => campo({ nombre: 'd-' + l.id, etiqueta: `${l.articulo}: cantidad a devolver (máx. ${cant(l.cantidad_m - l.devuelto_m, l.unidad)})`, attrs: 'inputmode="decimal"' })).join('')}
        ${campo({ nombre: 'motivo', etiqueta: 'Motivo', requerido: true })}<button class="btn" type="submit">Registrar devolución</button></form></div></details>` : ''}
      ${c.estado !== 'anulada' && app.puede('compras.anular') ? `<p><button type="button" class="btn btn-peligro btn-chico" data-anular>${icono('ban')}Anular la compra</button></p>` : ''}
    </div>`,
    despues(raiz) {
      raiz.querySelector('[data-recibir]')?.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Registrar recepción', texto: c.lineas.map((l) => `${esc(l.articulo)} +${esc(cant(l.cantidad_m, l.unidad))}`).join('<br>'), efecto: 'La mercadería entra al stock una sola vez.', aceptar: 'Registrar recepción' });
        if (!r.ok) return;
        try { await post(`/api/compras/${c.id}/recibir`, {}); toast('Recepción registrada.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      });
      const fd = raiz.querySelector('#f-doc');
      if (fd) alEnviar(fd, async (d) => { await post(`/api/compras/${c.id}/documentos`, d); toast('Documento vinculado. El stock no cambió.'); app.recargar(); });
      const fp = raiz.querySelector('#f-pago');
      if (fp) alEnviar(fp, async (d) => { await post(`/api/compras/${c.id}/pagos`, d, { idempotencia: fp.dataset.clave }); toast('Pago al proveedor registrado.'); app.recargar(); });
      const fv = raiz.querySelector('#f-dev');
      if (fv) alEnviar(fv, async (d) => { await post(`/api/compras/${c.id}/devolver`, { motivo: d.motivo, lineas: c.lineas.map((l) => ({ lineaId: l.id, cantidad: d['d-' + l.id] })).filter((x) => x.cantidad) }); toast('Devolución registrada.'); app.recargar(); });
      raiz.querySelectorAll('[data-anular-pago]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Anular el pago al proveedor', aceptar: 'Anular', peligro: true, pedir: { etiqueta: 'Motivo' } });
        if (r.ok) try { await post(`/api/pagos-proveedor/${b.dataset.anularPago}/anular`, { motivo: r.valor }); toast('Pago anulado.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      }));
      raiz.querySelector('[data-anular]')?.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Anular la compra', texto: c.estado === 'recibida' ? 'Se descuenta del stock lo que todavía no se devolvió.' : 'La compra queda anulada sin mover stock.', aceptar: 'Anular compra', peligro: true, pedir: { etiqueta: 'Motivo' } });
        if (r.ok) try { await post(`/api/compras/${c.id}/anular`, { motivo: r.valor }); toast('Compra anulada.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      });
    }
  };
}
