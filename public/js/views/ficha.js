// Ficha del auto: identidad estable, contacto actual, lecturas fechadas, próximo service, pendientes e historial.
import { get, post, put, api } from '../api.js?v=0.1.0';
import { esc, icono, patente, nombreAuto, chipSituacion, chip, fecha, km, pesos, campo, alEnviar, toast, confirmar } from '../ui.js?v=0.1.0';
import { camposVehiculo, enlazarModelos } from './autos.js?v=0.1.0';

const RES = { resuelto: ['Resuelto y comprobado', 'verde', 'check'], mejoro: ['Mejoró, falta resolver', 'ambar', 'alerta'], no_reproducido: ['No se pudo reproducir', 'azul', 'info'], pendiente: ['Sigue pendiente', 'rojo', 'alerta'] };

export default async function ficha({ params, app }) {
  const { vehiculo: v } = await get(`/api/vehiculos/${params.id}`);
  const abierta = v.visitas.find((x) => !x.entregada_at && !x.anulada_at);
  const ultimaCerrada = v.visitas.find((x) => x.entregada_at);
  const ps = v.proximoService;
  const editar = app.puede('vehiculos.editar');
  return {
    titulo: v.patente,
    html: `<div class="pagina pagina--contexto">
      <div class="pagina__cuerpo">
        <a class="volver" href="#/autos">${icono('izq')}Autos y clientes</a>
        <div class="cab"><div class="cab__titulo">${patente(v.patente, true)}<h1 tabindex="-1">${nombreAuto(v)}</h1>${v.archivado ? chip('Ficha archivada', '', 'candado') : ''}</div>
          <div class="acciones">
            ${abierta ? `<a class="btn btn-primario" href="#/visitas/${abierta.id}">${icono('llave')}Ver la visita abierta</a>` : app.puede('visita.recibir') && !v.archivado ? `<a class="btn btn-primario" href="#/recibir?vehiculo=${v.id}">${icono('mas')}Recibir este auto</a>` : ''}
            ${!abierta && ultimaCerrada && app.puede('visita.recibir') && !v.archivado ? `<a class="btn" href="#/recibir?vehiculo=${v.id}&relacionada=${ultimaCerrada.id}">${icono('historial')}Vuelve por el mismo problema</a>` : ''}
          </div></div>
        ${v.mismaPatente.length ? `<div class="aviso aviso--ambar">${icono('alerta')}<div>Hay otra ficha en este taller con la misma patente: ${v.mismaPatente.map((x) => `<a href="#/autos/${x.id}">${esc(x.patente)} ${esc(x.marca || '')} ${esc(x.modelo || '')}</a>`).join(', ')}. No se unen solas: revisá si es el mismo auto.</div></div>` : ''}
        ${ps ? `<section class="panel"><div class="panel__cuerpo bloque"><h2>Próximo service</h2>
          <div class="datos">
            <div class="dato"><span>Corresponde</span><strong>${[ps.km_objetivo != null ? km(ps.km_objetivo) : null, ps.fecha_objetivo ? fecha(ps.fecha_objetivo) : null].filter(Boolean).join(' o ')}</strong></div>
            <div class="dato"><span>Última lectura</span><strong>${ps.ultimaLectura ? km(ps.ultimaLectura.km) + ' · ' + fecha(ps.ultimaLectura.fecha) : 'Sin lectura'}</strong></div>
            <div class="dato"><span>Diferencia</span><strong>${ps.faltanKm == null ? 'Sin datos para calcular' : ps.faltanKm >= 0 ? `Faltan ${ps.faltanKm.toLocaleString('es-AR')} km según esa lectura` : `Pasado por ${(-ps.faltanKm).toLocaleString('es-AR')} km según esa lectura`}</strong></div>
          </div><p class="muted small">${esc(ps.criterio || '')} Lo definió el técnico; una reparación distinta no reinicia este control.</p></div></section>` : ''}
        ${v.seguimientos.filter((s) => s.tipo !== 'service').length ? `<section class="bloque"><h2>Quedó pendiente</h2><ul class="lista panel">${v.seguimientos.filter((s) => s.tipo !== 'service').map((s) => `<li><div class="fila"><strong>${esc(s.titulo)}</strong>${s.importe != null ? `<span class="num">${pesos(s.importe)}</span>` : ''}</div><span class="muted small">${esc(s.criterio || '')}</span></li>`).join('')}</ul><a class="small" href="#/pendientes">Ver en Pendientes</a></section>` : ''}
        <section class="bloque" aria-labelledby="t-hist"><h2 id="t-hist">Visitas</h2>
          ${v.visitas.length ? `<div class="panel"><ul class="lista">${v.visitas.map((x) => `<li><div class="fila"><span class="fila__izq"><strong>N.º ${esc(x.numero)}</strong><span class="muted">${esc(fecha(x.ingreso_at))} · ${x.tipo === 'service' ? 'Service' : 'Revisión o reparación'}</span></span>${chipSituacion(x.situacion)}</div>
            <p>${esc(x.motivo)}</p>${x.control ? `<p class="small">${chip(RES[x.control.resultado][0], RES[x.control.resultado][1], RES[x.control.resultado][2])} <span class="muted">${esc(x.control.como)}</span></p>` : ''}<a class="small" href="#/visitas/${x.id}">Abrir visita N.º ${esc(x.numero)}</a></li>`).join('')}</ul></div>` : '<p class="muted">Este auto todavía no tiene visitas.</p>'}
          <p class="muted small">El historial orienta la revisión; el diagnóstico lo confirma el mecánico con pruebas.</p>
        </section>
        <section class="bloque" aria-labelledby="t-km"><h2 id="t-km">Lecturas de kilómetros</h2>
          ${v.lecturas.length ? `<div class="panel"><ul class="lista">${v.lecturas.map((l) => `<li><div class="fila"><strong class="num">${km(l.km)}</strong><span class="muted small">${esc(fecha(l.fecha))}${l.visita_numero ? ' · visita N.º ' + esc(l.visita_numero) : ''}</span></div><span class="muted small">${esc(l.origen)}${l.explicacion ? ' · ' + esc(l.explicacion) : ''}</span></li>`).join('')}</ul></div>` : '<p class="muted">Sin lecturas registradas.</p>'}
          ${editar ? `<details class="mas"><summary>Registrar una lectura</summary><div class="mas__cuerpo"><form class="form" id="f-lectura" novalidate>
            <div class="fila-campos">${campo({ nombre: 'km', etiqueta: 'Kilómetros', requerido: true, attrs: 'inputmode="numeric"' })}${campo({ nombre: 'origen', etiqueta: 'De dónde sale', placeholder: 'Ej.: lo informó el cliente por teléfono' })}</div>
            ${campo({ nombre: 'explicacion', etiqueta: 'Explicación si es menor que la anterior', tipo: 'textarea' })}
            <div class="form-pie"><button class="btn btn-primario" type="submit">Guardar lectura</button></div></form></div></details>` : ''}
        </section>
        ${editar ? `<section class="bloque"><h2>Datos del auto</h2><details class="mas"><summary>Corregir datos del auto</summary><div class="mas__cuerpo"><form class="form" id="f-vehiculo" novalidate>
          ${camposVehiculo(v)}<p class="muted small">Corregir los datos actuales no cambia los documentos ya emitidos.</p><div class="form-pie"><button class="btn btn-primario" type="submit">Guardar cambios</button></div></form></div></details></section>` : ''}
        ${app.puede('vehiculos.archivar') ? `<section class="bloque"><button type="button" class="btn ${v.archivado ? '' : 'btn-peligro'}" data-archivar>${icono(v.archivado ? 'historial' : 'candado')}${v.archivado ? 'Recuperar la ficha' : 'Archivar la ficha'}</button></section>` : ''}
      </div>
      <aside class="contexto" aria-label="Contacto">
        <section class="bloque"><h2>Contacto actual</h2>
          ${v.contacto ? `<p><strong>${esc(v.contacto.nombre)}</strong></p>${v.contacto.saldo ? `<p><a href="#/cuentas/${v.contacto.id}" class="${v.contacto.saldo > 0 ? 'texto-rojo' : ''}">${v.contacto.saldo > 0 ? `Debe ${pesos(v.contacto.saldo)}` : `Saldo a favor ${pesos(-v.contacto.saldo)}`} · ver cuenta</a></p>` : ''}${v.contacto.telefono ? `<p class="muted">${esc(v.contacto.telefono)}</p><div class="acciones"><a class="btn btn-chico" href="tel:${esc(v.contacto.telefono.replace(/[^\d+]/g, ''))}">${icono('telefono')}Llamar</a></div>` : ''}
            <p class="small muted">${v.contacto.acepta_avisos === 1 ? 'Acepta recibir avisos.' : v.contacto.acepta_avisos === 0 ? 'No quiere recibir avisos.' : 'No se registró si acepta avisos.'}</p>` : '<p class="muted">Sin contacto.</p>'}
          ${v.contactosAnteriores.length ? `<p class="small muted">Contactos anteriores: ${v.contactosAnteriores.map((c) => esc(c.nombre)).join(', ')}. Las visitas anteriores conservan sus datos.</p>` : ''}
          ${editar ? `<details class="mas"><summary>Cambiar el contacto</summary><div class="mas__cuerpo"><form class="form" id="f-contacto" novalidate>
            ${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true })}${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' })}
            ${campo({ nombre: 'motivo', etiqueta: 'Motivo del cambio', requerido: true, placeholder: 'Ej.: vendió el auto' })}
            <button class="btn btn-primario" type="submit">Cambiar contacto</button></form></div></details>
            ${v.contacto ? `<details class="mas"><summary>Corregir teléfono o avisos</summary><div class="mas__cuerpo"><form class="form" id="f-corregir" novalidate>
              ${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: v.contacto.nombre })}${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', valor: v.contacto.telefono || '' })}${campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email', valor: v.contacto.email || '' })}
              ${campo({ nombre: 'avisos', etiqueta: '¿Acepta avisos?', tipo: 'select', valor: v.contacto.acepta_avisos == null ? '' : String(v.contacto.acepta_avisos), opciones: [['', 'No se registró'], ['1', 'Sí'], ['0', 'No']] })}
              <button class="btn btn-primario" type="submit">Guardar</button></form></div></details>` : ''}` : ''}
        </section>
      </aside>
    </div>`,
    despues(raiz) {
      const fv = raiz.querySelector('#f-vehiculo');
      if (fv) {
        enlazarModelos(fv);
        alEnviar(fv, async (d) => { await put(`/api/vehiculos/${v.id}`, { ...d, version: v.version }); toast('Datos del auto guardados.'); app.recargar(); });
      }
      const fl = raiz.querySelector('#f-lectura');
      if (fl) alEnviar(fl, async (d) => { await post(`/api/vehiculos/${v.id}/lecturas`, d); toast('Lectura guardada.'); app.recargar(); });
      const fc = raiz.querySelector('#f-contacto');
      if (fc) alEnviar(fc, async (d) => { await post(`/api/vehiculos/${v.id}/contacto`, { contacto: { nombre: d.nombre, telefono: d.telefono }, motivo: d.motivo }); toast('Contacto cambiado. Las visitas anteriores conservan el suyo.'); app.recargar(); });
      const fk = raiz.querySelector('#f-corregir');
      if (fk) alEnviar(fk, async (d) => { await put(`/api/contactos/${v.contacto.id}`, { nombre: d.nombre, telefono: d.telefono, email: d.email, acepta_avisos: d.avisos === '' ? null : d.avisos === '1', version: v.contacto.version }); toast('Contacto actualizado.'); app.recargar(); });
      raiz.querySelector('[data-archivar]')?.addEventListener('click', async () => {
        if (v.archivado) { await api('POST', `/api/vehiculos/${v.id}/archivar`, { archivar: false }); toast('Ficha recuperada.'); return app.recargar(); }
        const r = await confirmar({ titulo: 'Archivar la ficha', texto: 'La ficha deja de aparecer en las listas. No se borra: el historial y los documentos se conservan y se puede recuperar.', aceptar: 'Archivar', peligro: true, pedir: { etiqueta: 'Motivo' } });
        if (!r.ok) return;
        try { await api('POST', `/api/vehiculos/${v.id}/archivar`, { archivar: true, motivo: r.valor }); toast('Ficha archivada.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      });
    }
  };
}
