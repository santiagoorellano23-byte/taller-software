// Pendientes: próximos services y trabajos que el cliente dejó para después. Avisos preparados a mano.
import { get, post } from '../api.js?v=0.1.0';
import { esc, icono, patente, nombreAuto, chip, fecha, fechaHora, km, pesos, campo, alEnviar, toast, confirmar, aviso, copiar, hoyLocal } from '../ui.js?v=0.1.0';

const AVISO = { preparado: ['Mensaje preparado · no enviado', 'violeta', 'reloj'], abierto: ['WhatsApp abierto · sin confirmar envío', 'ambar', 'mensaje'], enviado: ['Avisado', 'verde', 'check'], respondido: ['Respondió', 'verde', 'check'], fallido: ['No se pudo avisar', 'rojo', 'alerta'], descartado: ['Aviso descartado', '', 'ban'] };

function urgencia(s, hoy) {
  if (s.fecha_objetivo && s.fecha_objetivo < hoy) return ['Vencido por fecha', 'rojo', 'alerta'];
  if (s.faltanKm != null && s.faltanKm <= 0) return ['Pasado según la última lectura', 'rojo', 'alerta'];
  if (s.faltanKm != null && s.faltanKm <= 1500) return ['Próximo', 'ambar', 'reloj'];
  return null;
}

function item(s, app, hoy) {
  const u = s.tipo === 'service' ? urgencia(s, hoy) : null;
  return `<li data-seg="${s.id}"><div class="fila"><span class="fila__izq">${patente(s.vehiculo.patente)}<strong>${nombreAuto(s.vehiculo)}</strong></span>${u ? chip(...u) : ''}${s.ultimoAviso ? chip(...AVISO[s.ultimoAviso.estado]) : chip('Sin avisar', '', 'menos')}</div>
    <p><strong>${esc(s.titulo)}</strong>${s.importe != null ? ` · presupuestado ${pesos(s.importe)}` : ''}</p>
    ${s.tipo === 'service' ? `<p class="small">Corresponde ${[s.km_objetivo != null ? km(s.km_objetivo) : null, s.fecha_objetivo ? fecha(s.fecha_objetivo) : null].filter(Boolean).join(' o ')} · Última lectura: ${s.ultimaLectura ? km(s.ultimaLectura.km) + ' (' + fecha(s.ultimaLectura.fecha) + ')' : 'sin lectura'}${s.faltanKm != null ? ` · ${s.faltanKm >= 0 ? 'faltan ' + s.faltanKm.toLocaleString('es-AR') + ' km' : 'pasado por ' + (-s.faltanKm).toLocaleString('es-AR') + ' km'} según esa lectura` : ''}</p>` : ''}
    <p class="small muted">${esc(s.criterio || '')}${s.origen ? ` · surge de la visita N.º ${esc(s.origen.numero)} (${esc(fecha(s.origen.ingreso_at))})` : ''} · Contacto: ${esc(s.contacto?.nombre || 'sin contacto')}${s.contacto?.acepta_avisos === 0 ? ' (no quiere avisos)' : ''}</p>
    <div class="acciones">${app.puede('avisos.preparar') && s.contacto ? `<button type="button" class="btn btn-chico" data-preparar="${s.id}">${icono('mensaje')}Preparar aviso</button>` : ''}
      ${app.puede('visita.recibir') ? `<a class="btn btn-chico" href="#/recibir?vehiculo=${s.vehiculo.id}${s.tipo === 'service' ? '&tipo=service' : ''}">${icono('mas')}Recibir el auto</a>` : ''}
      ${app.puede('seguimientos.gestionar') ? `<button type="button" class="btn btn-chico btn-texto" data-cerrar="${s.id}" data-version="${s.version}">Cerrar pendiente</button>` : ''}</div>
    <div data-aviso-form="${s.id}" hidden></div></li>`;
}

export default async function pendientes({ app }) {
  const d = await get('/api/pendientes');
  const hoy = d.hoy || hoyLocal();
  const servicios = d.services.slice().sort((a, b) => (urgencia(b, hoy) ? 1 : 0) - (urgencia(a, hoy) ? 1 : 0));
  return {
    titulo: 'Pendientes',
    html: `<div class="pagina">
      <div class="cab"><h1 tabindex="-1">Pendientes</h1><button type="button" class="btn btn-chico btn-texto" data-ayuda="pendientes">${icono('ayuda')}¿Cómo hago…?</button></div>
      ${aviso(`<strong>Avisos automáticos: inactivos.</strong> ${esc(d.integracion.motivo)}`, 'gris', 'info')}
      <section class="bloque" aria-labelledby="t-ps"><div class="bloque__cab"><h2 id="t-ps">Próximos services</h2><p>Por kilómetros o fecha, según lo que registró el técnico.</p></div>
        ${servicios.length ? `<div class="panel"><ul class="lista">${servicios.map((s) => item(s, app, hoy)).join('')}</ul></div>` : '<p class="muted">No hay próximos services registrados.</p>'}</section>
      <section class="bloque" aria-labelledby="t-pp"><div class="bloque__cab"><h2 id="t-pp">Trabajos que quedaron para después</h2><p>El cliente los dejó para más adelante. No se cobran hasta hacerlos.</p></div>
        ${d.postergados.length ? `<div class="panel"><ul class="lista">${d.postergados.map((s) => item(s, app, hoy)).join('')}</ul></div>` : '<p class="muted">No hay trabajos postergados.</p>'}</section>
      ${d.otros.length ? `<section class="bloque"><h2>Otros pendientes</h2><div class="panel"><ul class="lista">${d.otros.map((s) => item(s, app, hoy)).join('')}</ul></div></section>` : ''}
    </div>`,
    despues(raiz) {
      const todos = [...d.services, ...d.postergados, ...d.otros];
      raiz.querySelectorAll('[data-preparar]').forEach((b) => b.addEventListener('click', async () => {
        const cont = raiz.querySelector(`[data-aviso-form="${b.dataset.preparar}"]`);
        const { seguimiento: s } = await get(`/api/seguimientos/${b.dataset.preparar}`);
        cont.hidden = false;
        cont.innerHTML = `<form class="form panel panel__cuerpo" novalidate>
          ${s.contacto?.acepta_avisos === 0 ? aviso('Este cliente indicó que no quiere recibir avisos. Revisalo antes de escribirle.', 'ambar', 'alerta') : ''}
          ${campo({ nombre: 'canal', etiqueta: 'Por dónde', tipo: 'select', opciones: [['whatsapp', 'WhatsApp (lo enviás vos)'], ['telefono', 'Llamada'], ['correo', 'Correo'], ['presencial', 'En persona']] })}
          ${campo({ nombre: 'texto', etiqueta: 'Mensaje (podés editarlo)', tipo: 'textarea', requerido: true, valor: s.textoSugerido })}
          ${s.whatsapp?.revisar ? aviso(`Revisá el número en WhatsApp antes de enviar: ${esc(s.contacto?.telefono || '')}.`, 'ambar', 'alerta') : ''}
          <div class="form-pie"><button class="btn btn-primario" type="submit">Preparar mensaje</button><button type="button" class="btn" data-cancelar>Cancelar</button></div></form>`;
        const f = cont.querySelector('form');
        f.querySelector('[data-cancelar]').onclick = () => { cont.hidden = true; cont.innerHTML = ''; };
        alEnviar(f, async (dd) => {
          const r = await post('/api/avisos', { seguimientoId: s.id, canal: dd.canal, texto: dd.texto });
          cont.innerHTML = `<div class="panel panel__cuerpo bloque">${aviso('<strong>Mensaje preparado, todavía no enviado.</strong>', 'gris')}
            <div class="acciones">${r.enlace ? `<a class="btn btn-primario" href="${esc(r.enlace)}" target="_blank" rel="noopener" data-wa>${icono('mensaje')}Abrir WhatsApp</a>` : ''}<button type="button" class="btn" data-copiar>${icono('copiar')}Copiar texto</button>
            <button type="button" class="btn" data-enviado>Ya lo envié</button></div><p class="small muted">Abrir WhatsApp no confirma el envío. Tocá «Ya lo envié» cuando salga.</p></div>`;
          cont.querySelector('[data-copiar]').onclick = () => copiar(dd.texto);
          cont.querySelector('[data-wa]')?.addEventListener('click', () => post(`/api/avisos/${r.id}/estado`, { estado: 'abierto' }).catch(() => {}));
          cont.querySelector('[data-enviado]').onclick = async () => {
            const c = await confirmar({ titulo: '¿El mensaje salió?', texto: 'Confirmá solo si lo enviaste o viste que se envió.', aceptar: 'Sí, se envió' });
            if (!c.ok) return;
            try { await post(`/api/avisos/${r.id}/estado`, { estado: 'enviado', confirmo: true }); toast('Aviso registrado como enviado.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
          };
        });
        f.querySelector('textarea').focus();
      }));
      raiz.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', async () => {
        const s = todos.find((x) => x.id === Number(b.dataset.cerrar));
        const dlg = await confirmar({ titulo: 'Cerrar el pendiente', texto: `${esc(s.titulo)} · ${esc(s.vehiculo.patente)}`, efecto: 'Se conserva en el historial con la nota.', aceptar: 'Marcar resuelto', pedir: { etiqueta: '¿Qué pasó? (por ejemplo: se hizo en la visita 1040, o el cliente no quiere)' } });
        if (!dlg.ok) return;
        try { await post(`/api/seguimientos/${s.id}/cerrar`, { estado: /no quiere|descart|vend/i.test(dlg.valor) ? 'descartado' : 'resuelto', nota: dlg.valor, version: s.version }); toast('Pendiente cerrado.'); app.recargar(); } catch (e) { toast(e.message, { error: true }); }
      }));
      void fechaHora;
    }
  };
}
