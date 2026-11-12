// Página pública voluntaria del taller y solicitud de turno (queda sin confirmar hasta que el taller la confirma).
import { api } from './api.js?v=0.1.0';
import { esc, campo, casilla, alEnviar, icono, aviso } from './ui.js?v=0.1.0';
import { cssApariencia } from './marca.js?v=0.1.0';

const slug = location.pathname.split('/')[2];
const main = document.getElementById('contenido');
const cab = document.getElementById('cabecera');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const hoy = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

async function iniciar() {
  let t;
  try { ({ taller: t } = await api('GET', `/api/publico/${encodeURIComponent(slug)}`)); } catch (e) {
    document.title = 'Taller no encontrado';
    main.innerHTML = `<h1>No encontramos este taller</h1><p>${esc(e.message)}</p><p><a href="/directorio">Ver el listado de talleres</a></p>`;
    return;
  }
  document.title = `${t.nombre}${t.localidad ? ' · ' + t.localidad : ''}`;
  const hoja = document.createElement('style'); hoja.textContent = cssApariencia(t.apariencia); document.head.append(hoja);
  cab.innerHTML = `<div class="pub-cab__fila">${t.tieneLogo ? `<img src="/publico/logo/${esc(t.slug)}" alt="${esc(t.nombre)}">` : `<span class="marca"><span class="marca__nombre"><span class="marca__texto">${esc(t.nombre)}</span></span></span>`}
    <div>${t.lema ? `<p style="color:var(--silver);font-weight:600">${esc(t.lema)}</p>` : ''}${t.localidad ? `<p style="color:var(--on-dark-2)">${icono('mapa', 'i-sm')} ${esc(t.localidad)}</p>` : ''}</div></div>`;
  main.innerHTML = `<div class="pub-grid">
    <section class="bloque"><h1 tabindex="-1">${esc(t.nombre)}</h1>${t.descripcion ? `<p>${esc(t.descripcion)}</p>` : ''}
      ${t.servicios.length ? `<h2>Servicios</h2><ul class="pub-servicios">${t.servicios.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <h2>Contacto</h2><div class="datos">${t.telefono ? `<div class="dato"><span>Teléfono</span><strong><a href="tel:${esc(t.telefono.replace(/[^\d+]/g, ''))}">${esc(t.telefono)}</a></strong></div>` : ''}
        ${t.direccion ? `<div class="dato"><span>Dirección</span><strong>${esc(t.direccion)}</strong></div>` : ''}${t.horarios ? `<div class="dato"><span>Horarios</span><strong>${esc(t.horarios)}</strong></div>` : ''}</div>
      ${t.mapa ? `<p><a class="btn" href="${esc(t.mapa)}" target="_blank" rel="noopener noreferrer">${icono('mapa')}Ver en el mapa</a></p>` : ''}</section>
    <section class="panel panel__cuerpo bloque" aria-labelledby="t-turno"><h2 id="t-turno">Pedir un turno</h2>
      ${t.turnosOnline ? `<p class="small muted">Atención: ${t.agenda.dias.map((d) => DIAS[d]).join(', ')} de ${(t.agenda.franjas || [[t.agenda.desde, t.agenda.hasta]]).map(([d, h]) => `${esc(d)} a ${esc(h)}`).join(' y de ')}. El taller confirma la solicitud; todavía no es un turno asignado.</p>
        <form class="form" id="f-turno" novalidate>
          ${campo({ nombre: 'fecha', etiqueta: 'Día', tipo: 'date', requerido: true, valor: hoy(), attrs: `min="${hoy()}"` })}
          <fieldset class="grupo" data-campo="hora"><legend>Horario aproximado</legend><div class="horarios-turno" data-horarios><p class="muted small">Elegí un día.</p></div></fieldset>
          <div data-servicios></div>
          ${campo({ nombre: 'nombre', etiqueta: 'Tu nombre', requerido: true, attrs: 'autocomplete="name"' })}
          ${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', requerido: true, attrs: 'autocomplete="tel"' })}
          <div class="fila-campos">${campo({ nombre: 'patente', etiqueta: 'Patente' })}${campo({ nombre: 'vehiculo', etiqueta: 'Auto', placeholder: 'Marca y modelo' })}</div>
          ${campo({ nombre: 'motivo', etiqueta: '¿Qué le pasa al auto?', tipo: 'textarea' })}
          <div class="trampa" aria-hidden="true"><label>No completar <input name="sitio" tabindex="-1" autocomplete="off"></label></div>
          ${casilla('acepta', 'Acepto que el taller me contacte por esta solicitud')}
          ${casilla('avisos', 'Quiero que me recuerden el turno (opcional)')}
          <button class="btn btn-primario btn-ancho" type="submit">Enviar solicitud</button>
        </form>
        <details class="mas"><summary>Consultar una solicitud enviada</summary><div class="mas__cuerpo"><form class="form" id="f-consulta" novalidate data-sin-aviso>
          <div class="fila-campos">${campo({ nombre: 'codigo', etiqueta: 'Código', requerido: true })}${campo({ nombre: 'tel', etiqueta: 'Últimos 4 números del teléfono', requerido: true, attrs: 'inputmode="numeric" maxlength="4"' })}</div>
          <button class="btn" type="submit">Consultar</button><div data-consulta></div></form></div></details>`
        : `<p>Este taller no recibe turnos online. ${t.telefono ? `Llamá al <a href="tel:${esc(t.telefono.replace(/[^\d+]/g, ''))}">${esc(t.telefono)}</a>.` : ''}</p>`}
    </section></div>`;
  const f = document.getElementById('f-turno');
  if (!f) return;
  const cargarHorarios = async () => {
    const cont = f.querySelector('[data-horarios]');
    try {
      const servicioElegido = f.querySelector('[name="servicioId"]')?.value || '';
      const d = await api('GET', `/api/publico/${encodeURIComponent(slug)}/turnos?fecha=${f.fecha.value}${servicioElegido ? '&servicioId=' + encodeURIComponent(servicioElegido) : ''}`);
      cont.innerHTML = d.horarios.length ? d.horarios.map((h) => `<label><input type="radio" name="hora" value="${h.hora}" ${h.libre ? '' : 'disabled'} required><span>${h.hora}</span></label>`).join('') : '<p class="muted small">Ese día el taller no atiende o ya no quedan horarios. Probá con otro día.</p>';
      const s = f.querySelector('[data-servicios]');
      if (!s.innerHTML && d.servicios.length) {
        s.innerHTML = campo({ nombre: 'servicioId', etiqueta: 'Servicio', tipo: 'select', opciones: [['', 'Otro / no sé'], ...d.servicios.map((x) => [x.id, x.nombre])] });
        s.querySelector('select').addEventListener('change', cargarHorarios);
      }
    } catch (e) { cont.innerHTML = `<p class="muted small">${esc(e.message)}</p>`; }
  };
  f.fecha.addEventListener('change', cargarHorarios);
  cargarHorarios();
  alEnviar(f, async (d) => {
    if (!d.hora) throw Object.assign(new Error('Elegí un horario.'), { campo: 'hora' });
    const r = await api('POST', `/api/publico/${encodeURIComponent(slug)}/turnos`, { ...d, servicioId: d.servicioId ? Number(d.servicioId) : null });
    f.outerHTML = `<div class="bloque">${aviso(`<strong>${esc(r.mensaje)}</strong>`, 'verde', 'check')}<p>Tu código de solicitud es <strong style="font-size:1.4em;letter-spacing:.08em">${esc(r.codigo)}</strong>. Guardalo para consultar el estado.</p></div>`;
  });
  const fc = document.getElementById('f-consulta');
  fc?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = fc.querySelector('[data-consulta]');
    try { const r = await api('GET', `/api/publico/${encodeURIComponent(slug)}/turnos/${encodeURIComponent(fc.codigo.value.trim())}?tel=${encodeURIComponent(fc.tel.value.trim())}`); out.innerHTML = aviso(`<strong>${esc(r.estado)}</strong>${r.inicio ? ' · ' + esc(r.inicio.replace('T', ' ')) : ''}`, 'gris'); } catch (err) { out.innerHTML = aviso(esc(err.message), 'ambar'); }
  });
}
iniciar();
