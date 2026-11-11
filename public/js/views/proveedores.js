// Proveedores: contacto y notas.
import { get, post, put } from '../api.js?v=0.1.0';
import { esc, icono, campo, alEnviar, toast } from '../ui.js?v=0.1.0';

export default async function proveedores({ app }) {
  const { proveedores: lista } = await get('/api/proveedores');
  const edita = app.puede('proveedores.gestionar');
  return {
    titulo: 'Proveedores',
    html: `<div class="pagina" style="max-width:900px">
      <a class="volver" href="#/mas">${icono('izq')}Más funciones</a>
      <div class="cab"><h1 tabindex="-1">Proveedores</h1>${app.puede('compras.gestionar') ? `<a class="btn" href="#/compras?nueva=1">${icono('camion')}Nueva compra</a>` : ''}</div>
      <div class="panel">${lista.length ? `<ul class="lista">${lista.map((p) => `<li><div class="fila"><strong>${esc(p.nombre)}</strong>${p.telefono ? `<a class="btn btn-chico" href="tel:${esc(p.telefono.replace(/[^\d+]/g, ''))}">${icono('telefono')}${esc(p.telefono)}</a>` : ''}</div>${p.notas ? `<p class="small muted">${esc(p.notas)}</p>` : ''}
        ${edita ? `<details class="mas"><summary>Editar</summary><div class="mas__cuerpo"><form class="form" data-editar="${p.id}" novalidate><div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: p.nombre })}${campo({ nombre: 'telefono', etiqueta: 'Teléfono', valor: p.telefono || '' })}${campo({ nombre: 'email', etiqueta: 'Correo', valor: p.email || '' })}</div>${campo({ nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', valor: p.notas || '' })}<button class="btn" type="submit">Guardar</button></form></div></details>` : ''}</li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Todavía no hay proveedores.</p></div>'}</div>
      ${edita ? `<form class="form panel panel__cuerpo" id="f-prov" novalidate><h2>Agregar proveedor</h2><div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true })}${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' })}${campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email' })}</div>${campo({ nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', placeholder: 'Días de reparto, condiciones, contacto…' })}<button class="btn btn-primario" type="submit">Guardar proveedor</button></form>` : ''}
    </div>`,
    despues(raiz) {
      const f = raiz.querySelector('#f-prov');
      if (f) alEnviar(f, async (d) => { await post('/api/proveedores', d); toast('Proveedor guardado.'); app.recargar(); });
      raiz.querySelectorAll('[data-editar]').forEach((fe) => alEnviar(fe, async (d) => { await put(`/api/proveedores/${fe.dataset.editar}`, d); toast('Proveedor actualizado.'); app.recargar(); }));
    }
  };
}
