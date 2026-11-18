// Ficha del auto: identidad estable, contacto actual, lecturas fechadas, próximo service, pendientes e historial.
import { get, post, put, api } from '../api.js?v=0.1.0';
import { esc, chipSituacion, chip, fecha, km, pesos, campo, alEnviar, toast, confirmar } from '../ui.js?v=0.1.0';
import { ic, placa, logoMarca, cabecera } from '../diseno.js?v=0.1.0';
import { camposVehiculo, enlazarModelos } from './autos.js?v=0.1.0';

const RES = { resuelto: ['Resuelto y comprobado', 'verde', 'check'], mejoro: ['Mejoró, falta resolver', 'ambar', 'alerta'], no_reproducido: ['No se pudo reproducir', 'azul', 'info'], pendiente: ['Sigue pendiente', 'rojo', 'alerta'] };

export default async function ficha({ params, app }) {
  const { vehiculo: v } = await get(`/api/vehiculos/${params.id}`);
  const abierta = v.visitas.find((x) => !x.entregada_at && !x.anulada_at);
  const ultimaCerrada = v.visitas.find((x) => x.entregada_at);
  const ps = v.proximoService;
  const editar = app.puede('vehiculos.editar');
  return {
    titulo: v.patente || 'Ficha del auto',
    html: `${cabecera({ titulo: esc(v.contacto?.nombre || 'Sin contacto'), volver: '#/autos', ayuda: 'buscar', sub: v.contacto?.telefono ? `<a href="tel:${esc(v.contacto.telefono.replace(/[^\d+]/g, ''))}">${ic('call')}${esc(v.contacto.telefono)}</a>` : '<span class="sindato">Sin teléfono</span>' })}
      <section class="tarjeta" aria-label="Vehículo">
        <div class="t-cab">${logoMarca(v.marca, { grande: true })}<span class="t-id">${placa(v.patente, { grande: true })}<span class="t-mod"><b>${esc([v.marca, v.modelo].filter(Boolean).join(' ') || 'Vehículo sin datos')}</b><small>${esc([v.version_txt, v.anio].filter(Boolean).join(' · ') || 'Sin datos de versión')}${v.lecturas[0] ? ' · ' + esc(km(v.lecturas[0].km)) : ''}</small></span></span>${v.archivado ? `<span class="chip">${ic('lock')}Ficha archivada</span>` : ''}</div>
        <div class="acciones">
          ${abierta ? `<a class="btn btn-primario" href="#/visitas/${abierta.id}">${ic('build')}Abrir orden N.º ${esc(abierta.numero)}</a>` : app.puede('visita.recibir') && !v.archivado ? `<a class="btn btn-primario" href="#/recibir?vehiculo=${v.id}">${ic('add')}Recibir este auto</a>` : ''}
          ${!abierta && ultimaCerrada && app.puede('visita.recibir') && !v.archivado ? `<a class="btn" href="#/recibir?vehiculo=${v.id}&relacionada=${ultimaCerrada.id}">${ic('history')}Vuelve por el mismo problema</a>` : ''}
        </div>
        ${v.mismaPatente.length ? `<p class="aviso-in warn">${ic('warning')}<span>Hay otra ficha en este taller con la misma patente: ${v.mismaPatente.map((x) => `<a href="#/autos/${x.id}">${esc(x.patente)} ${esc(x.marca || '')} ${esc(x.modelo || '')}</a>`).join(', ')}. No se unen solas: revisá si es el mismo auto.</span></p>` : ''}
        <h2 class="h3">Historial por patente</h2>
        ${v.visitas.length ? `<ol class="tiempo">${v.visitas.map((x) => `<li><time>${esc(fecha(x.ingreso_at))}</time><a class="li-b" href="#/visitas/${x.id}"><span class="li-t"><b>N.º ${esc(x.numero)} · ${x.tipo === 'service' ? 'Service' : 'Revisión o reparación'}</b><small>${esc(x.motivo)}</small>${chipSituacion(x.situacion)}${x.control ? chip(RES[x.control.resultado][0], RES[x.control.resultado][1], RES[x.control.resultado][2]) : ''}</span>${ic('chevron_right')}</a></li>`).join('')}</ol>` : '<p class="nota">Sin visitas registradas.</p>'}
        <p class="nota">${ic('info')}El historial orienta la revisión; el diagnóstico lo confirma el mecánico con pruebas.</p>
      </section>
      ${ps ? `<section class="bloque-d"><div class="sec-h"><h2>Próximo service</h2></div><dl class="kvs">
          <div class="kv"><dt>Corresponde</dt><dd>${[ps.km_objetivo != null ? km(ps.km_objetivo) : null, ps.fecha_objetivo ? fecha(ps.fecha_objetivo) : null].filter(Boolean).join(' o ')}</dd></div>
          <div class="kv"><dt>Última lectura</dt><dd>${ps.ultimaLectura ? km(ps.ultimaLectura.km) + ' · ' + fecha(ps.ultimaLectura.fecha) : 'Sin lectura'}</dd></div>
          <div class="kv"><dt>Diferencia</dt><dd>${ps.faltanKm == null ? 'Sin datos para calcular' : ps.faltanKm >= 0 ? `Faltan ${ps.faltanKm.toLocaleString('es-AR')} km según esa lectura` : `Pasado por ${(-ps.faltanKm).toLocaleString('es-AR')} km según esa lectura`}</dd></div>
        </dl><p class="nota">${esc(ps.criterio || '')} Lo definió el técnico; una reparación distinta no reinicia este control.</p></section>` : ''}
      ${v.seguimientos.filter((x) => x.tipo !== 'service').length ? `<section class="bloque-d"><div class="sec-h"><h2>Quedó pendiente</h2><a href="#/pendientes">Ver en Pendientes</a></div><ul class="lista-d densa">${v.seguimientos.filter((x) => x.tipo !== 'service').map((x) => `<li><span class="li-t"><b>${esc(x.titulo)}</b><small>${esc(x.criterio || '')}</small></span>${x.importe != null ? `<span class="monto-d">${pesos(x.importe)}</span>` : ''}</li>`).join('')}</ul></section>` : ''}
      <section class="bloque-d" aria-labelledby="t-contacto"><div class="sec-h"><h2 id="t-contacto">Contacto actual</h2></div>
        ${v.contacto ? `<p><b>${esc(v.contacto.nombre)}</b>${v.contacto.telefono ? ` · ${esc(v.contacto.telefono)}` : ' · <span class="sindato">sin teléfono</span>'}</p>${v.contacto.saldo ? `<p><a href="#/cuentas/${v.contacto.id}" class="${v.contacto.saldo > 0 ? 'texto-rojo' : ''}">${v.contacto.saldo > 0 ? `Debe ${pesos(v.contacto.saldo)}` : `Saldo a favor ${pesos(-v.contacto.saldo)}`} · ver cuenta</a></p>` : ''}
          ${v.contacto.telefono ? `<div class="acciones"><a class="btn btn-chico" href="tel:${esc(v.contacto.telefono.replace(/[^\d+]/g, ''))}">${ic('call')}Llamar</a></div>` : ''}
          <p class="nota">${v.contacto.acepta_avisos === 1 ? 'Acepta recibir avisos.' : v.contacto.acepta_avisos === 0 ? 'No quiere recibir avisos.' : 'No se registró si acepta avisos.'}</p>` : '<p class="nota">Sin contacto.</p>'}
        ${v.contactosAnteriores.length ? `<p class="nota">Contactos anteriores: ${v.contactosAnteriores.map((c) => esc(c.nombre)).join(', ')}. Las visitas anteriores conservan sus datos.</p>` : ''}
        ${editar ? `<details class="desp"><summary>${ic('person_add')}Cambiar el contacto</summary><div class="desp-c"><form class="form" id="f-contacto" novalidate>
          ${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true })}${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' })}
          ${campo({ nombre: 'motivo', etiqueta: 'Motivo del cambio', requerido: true, placeholder: 'Ej.: vendió el auto' })}
          <button class="btn btn-primario" type="submit">Cambiar contacto</button></form></div></details>
          ${v.contacto ? `<details class="desp"><summary>${ic('edit')}Corregir teléfono o avisos</summary><div class="desp-c"><form class="form" id="f-corregir" novalidate>
            ${campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: v.contacto.nombre })}${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', valor: v.contacto.telefono || '' })}${campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email', valor: v.contacto.email || '' })}
            ${campo({ nombre: 'avisos', etiqueta: '¿Acepta avisos?', tipo: 'select', valor: v.contacto.acepta_avisos == null ? '' : String(v.contacto.acepta_avisos), opciones: [['', 'No se registró'], ['1', 'Sí'], ['0', 'No']] })}
            <button class="btn btn-primario" type="submit">Guardar</button></form></div></details>` : ''}` : ''}
      </section>
      <section class="bloque-d" aria-labelledby="t-km"><div class="sec-h"><h2 id="t-km">Lecturas de kilómetros</h2></div>
        ${v.lecturas.length ? `<ul class="lista-d densa">${v.lecturas.map((l) => `<li><span class="li-t"><b class="monto-d">${km(l.km)}</b><small>${esc(fecha(l.fecha))}${l.visita_numero ? ' · visita N.º ' + esc(l.visita_numero) : ''} · ${esc(l.origen)}${l.explicacion ? ' · ' + esc(l.explicacion) : ''}</small></span></li>`).join('')}</ul>` : '<p class="nota">Sin lecturas registradas.</p>'}
        ${editar ? `<details class="desp"><summary>${ic('speed')}Registrar una lectura</summary><div class="desp-c"><form class="form" id="f-lectura" novalidate>
          <div class="fila-campos">${campo({ nombre: 'km', etiqueta: 'Kilómetros', requerido: true, attrs: 'inputmode="numeric"' })}${campo({ nombre: 'origen', etiqueta: 'De dónde sale', placeholder: 'Ej.: lo informó el cliente por teléfono' })}</div>
          ${campo({ nombre: 'explicacion', etiqueta: 'Explicación si es menor que la anterior', tipo: 'textarea' })}
          <div class="form-pie"><button class="btn btn-primario" type="submit">Guardar lectura</button></div></form></div></details>` : ''}
      </section>
      ${editar ? `<details class="desp"><summary>${ic('edit')}Corregir datos del auto</summary><div class="desp-c"><form class="form" id="f-vehiculo" novalidate>
        ${camposVehiculo(v)}<p class="nota">Corregir los datos actuales no cambia los documentos ya emitidos.</p><div class="form-pie"><button class="btn btn-primario" type="submit">Guardar cambios</button></div></form></div></details>` : ''}
      ${app.puede('vehiculos.archivar') ? `<div><button type="button" class="btn ${v.archivado ? '' : 'btn-peligro'}" data-archivar>${ic(v.archivado ? 'history' : 'lock')}${v.archivado ? 'Recuperar la ficha' : 'Archivar la ficha'}</button></div>` : ''}`,
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
