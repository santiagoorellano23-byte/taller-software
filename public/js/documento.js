// Dibuja un documento emitido (copia fechada) como HTML imprimible. Lo usan la aplicación y la vista pública de enlaces.
// Función pura: recibe el contenido guardado y devuelve texto HTML escapado.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pesos = (c) => c == null ? '' : '$ ' + (c / 100).toLocaleString('es-AR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const cant = (m, u) => `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${esc(u || '')}`.trim();
const FMT = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fecha = (iso) => {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split('-').reverse().join('/');
  const d = new Date(iso.length === 16 ? iso + ':00' : iso);
  if (isNaN(d)) return esc(iso);
  // Hora del taller (igual en la pantalla, la impresión y el enlace público), formato 24 h.
  const p = Object.fromEntries(FMT.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};
const CANAL = { telefono: 'teléfono', whatsapp: 'WhatsApp', presencial: 'en persona', correo: 'correo', otro: 'otro medio' };
const RESP = { autoriza: 'Autorizado', rechaza: 'No autorizado', posterga: 'Para más adelante' };
const MEDIO = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Tarjeta de débito', credito: 'Tarjeta de crédito', cheque: 'Cheque', otro: 'Otro' };
const TAREA = { hecho: 'Hecho', no_aplica: 'No aplica', pendiente: 'Pendiente' };

function encabezado(c) {
  const t = c.taller || {};
  return `<header class="doc-head">
    <div class="doc-marca">${t.logo ? `<img src="${esc(t.logo)}" alt="Logo de ${esc(t.nombre)}">` : ''}<div><strong>${esc(t.nombre)}</strong>${t.lema ? `<span>${esc(t.lema)}</span>` : ''}
    <span>${esc([t.direccion, t.telefono, t.email].filter(Boolean).join(' · '))}</span></div></div>
    <div class="doc-num"><strong>${esc(c.titulo)}</strong><span>N.º ${esc(c.numero)}</span><span>Emitido ${fecha(c.emitido)}</span></div>
  </header>`;
}
function datosAuto(c) {
  if (!c.vehiculo) return '';
  const v = c.vehiculo;
  return `<section class="doc-datos">
    <div><span>Vehículo</span><strong>${esc([v.marca, v.modelo, v.version].filter(Boolean).join(' ') || 'Sin datos')}</strong></div>
    <div><span>Patente</span><strong>${esc(v.patente)}</strong></div>
    <div><span>Cliente</span><strong>${esc(c.cliente?.nombre || '')}</strong></div>
    ${c.visita ? `<div><span>Visita</span><strong>N.º ${esc(c.visita.numero)} · ${esc(c.visita.tipo)}</strong></div><div><span>Ingreso</span><strong>${fecha(c.visita.ingreso)}</strong></div>` : ''}
    ${c.km != null ? `<div><span>Kilómetros</span><strong>${typeof c.km === 'number' ? c.km.toLocaleString('es-AR') + ' km' : esc(c.km)}</strong></div>` : ''}
  </section>`;
}
function tablaLineas(lineas, { estado = false } = {}) {
  if (!lineas?.length) return '<p class="doc-vacio">Sin ítems.</p>';
  const conImporte = lineas.some((l) => l.importe != null);
  return `<table class="doc-tabla"><thead><tr><th>Detalle</th><th class="n">Cantidad</th>${conImporte ? '<th class="n">Precio</th><th class="n">Importe</th>' : ''}${estado ? '<th>Respuesta</th>' : ''}</tr></thead><tbody>
    ${lineas.map((l) => `<tr><td>${esc(l.descripcion)}${l.tipo ? `<small>${esc(l.tipo)}${l.cambio ? ' · cambio de versión ' + esc(l.version) : ''}</small>` : ''}</td><td class="n">${cant(l.cantidad_m, l.unidad)}</td>${conImporte ? `<td class="n">${pesos(l.precio_unit)}</td><td class="n">${pesos(l.importe)}</td>` : ''}${estado ? `<td>${esc(RESP[l.respuesta] || 'Sin respuesta')}</td>` : ''}</tr>`).join('')}
  </tbody></table>`;
}

export function renderDocumento(c) {
  let cuerpo = '';
  if (c.tipo === 'presupuesto') {
    cuerpo = `${datosAuto(c)}
      <p><strong>Motivo:</strong> ${esc(c.visita?.motivo)}</p>
      ${c.diagnostico ? `<p><strong>Diagnóstico:</strong> ${esc(c.diagnostico)}</p>` : ''}
      ${c.recomendacion ? `<p><strong>Recomendación del taller:</strong> ${esc(c.recomendacion)}</p>` : ''}
      <h2>Presupuesto · versión ${esc(c.version)}</h2>${tablaLineas(c.lineas, { estado: true })}
      ${c.totales ? `<dl class="doc-totales"><div><dt>Total presupuestado</dt><dd>${pesos(c.totales.presupuestado)}</dd></div><div><dt>Autorizado</dt><dd>${pesos(c.totales.autorizado)}</dd></div>${c.totales.postergado ? `<div><dt>Para más adelante</dt><dd>${pesos(c.totales.postergado)}</dd></div>` : ''}${c.totales.sinRespuesta ? `<div><dt>Sin respuesta</dt><dd>${pesos(c.totales.sinRespuesta)}</dd></div>` : ''}</dl>` : ''}
      ${c.respuestas?.length ? `<h2>Respuestas registradas</h2><ul>${c.respuestas.map((r) => `<li>${esc(r.descripcion)}: ${esc(RESP[r.respuesta])} por ${esc(r.persona)} (${esc(CANAL[r.canal] || r.canal || 'sin indicar')}, ${fecha(r.fecha)})</li>`).join('')}</ul>` : ''}
      <p class="doc-nota">Válido hasta el ${fecha(c.validez)}. Los precios pueden cambiar después de esa fecha; un cambio sobre un trabajo autorizado necesita una nueva respuesta.</p>`;
  } else if (c.tipo === 'informe' || c.tipo === 'entrega') {
    cuerpo = `${datosAuto(c)}
      <p><strong>Motivo de ingreso:</strong> ${esc(c.visita?.motivo)}</p>
      ${c.visita?.autorizacionIngreso ? `<p>${esc(c.visita.autorizacionIngreso)}</p>` : ''}
      ${c.revision ? `<h2>Revisión</h2><p><strong>Lo que contó el cliente:</strong> ${esc(c.revision.relato)}</p><p><strong>Lo observado:</strong> ${esc(c.revision.hallazgos)}</p>${c.revision.pruebas ? `<p><strong>Pruebas:</strong> ${esc(c.revision.pruebas)}</p>` : ''}<p><strong>Diagnóstico:</strong> ${esc(c.revision.diagnostico)}</p>` : ''}
      ${c.hallazgos?.length ? `<h2>Hallazgos de inspección</h2><p class="doc-nota">Observaciones y propuestas del técnico. No autorizan reparaciones ni representan cargos.</p>${c.hallazgos.map(h=>`<section class="doc-hallazgo"><p><strong>${esc(({informativo:'Informativo',recomendado:'Recomendado',prioritario:'Prioritario'})[h.gravedad]||h.gravedad)}</strong> · ${esc(h.observacion)}</p>${h.propuesta?`<p><strong>Propuesta:</strong> ${esc(h.propuesta)}</p>`:''}${h.foto&&/^data:image\/(jpeg|png|webp);base64,/.test(h.foto)?`<img class="doc-hallazgo-foto" src="${esc(h.foto)}" alt="Foto del hallazgo">`:''}<p class="doc-nota">Versión ${esc(h.version)} · ${esc(h.por||'')} · ${fecha(h.fecha)}</p></section>`).join('')}` : ''}
      <h2>Trabajos realizados</h2>${tablaLineas(c.realizados)}
      ${c.piezas?.length ? `<h2>Piezas colocadas</h2><ul>${c.piezas.map((p) => `<li>${esc(p.descripcion)} × ${cant(p.cantidad_m, p.unidad)} · ${esc(p.origen)}</li>`).join('')}</ul>` : ''}
      ${c.productos?.length ? `<h2>Productos usados</h2><ul>${c.productos.map((p) => `<li>${esc(p.descripcion)} × ${cant(p.cantidad_m, p.unidad)}</li>`).join('')}</ul>` : ''}
      ${c.tareas?.length ? `<h2>Tareas del service</h2><ul>${c.tareas.map((t) => `<li>${esc(t.descripcion)}: ${esc(TAREA[t.estado])}${t.explicacion ? ' (' + esc(t.explicacion) + ')' : ''}</li>`).join('')}</ul>` : ''}
      ${c.control ? `<h2>Resultado</h2><p><strong>${esc(c.control.resultado)}</strong>. Cómo se comprobó: ${esc(c.control.como)}${c.control.nota ? '. ' + esc(c.control.nota) : ''}</p>` : '<p>Resultado todavía sin comprobar.</p>'}
      ${c.pendientes?.length ? `<h2>Quedó pendiente</h2><ul>${c.pendientes.map((p) => `<li>${esc(p.descripcion)}${p.importe != null ? ' · presupuestado ' + pesos(p.importe) : ''}</li>`).join('')}</ul>` : ''}
      ${c.proximo ? `<p><strong>Próximo service indicado por el técnico:</strong> ${[c.proximo.km != null ? c.proximo.km.toLocaleString('es-AR') + ' km' : '', c.proximo.fecha ? fecha(c.proximo.fecha) : ''].filter(Boolean).join(' o ')}${c.proximo.criterio ? ' (' + esc(c.proximo.criterio) + ')' : ''}</p>` : ''}
      ${c.totales ? `<dl class="doc-totales"><div><dt>Realizado</dt><dd>${pesos(c.totales.realizado)}</dd></div><div><dt>Cobrado</dt><dd>${pesos(c.totales.cobrado)}</dd></div><div><dt>Saldo</dt><dd>${pesos(c.totales.saldo)}</dd></div></dl>` : ''}
      ${c.tipo === 'entrega' ? (c.entrega ? `<p><strong>Entregado:</strong> ${fecha(c.entrega.fecha)}${c.entrega.nota ? ' · ' + esc(c.entrega.nota) : ''}</p>` : '<p><strong>Listo para retirar.</strong></p>') : ''}`;
  } else if (c.tipo === 'venta') {
    cuerpo = `<section class="doc-datos"><div><span>Cliente</span><strong>${esc(c.cliente?.nombre)}</strong></div><div><span>Fecha</span><strong>${fecha(c.venta?.fecha)}</strong></div>${c.venta?.estado === 'anulada' ? '<div><span>Estado</span><strong>Anulada</strong></div>' : ''}</section>
      <table class="doc-tabla"><thead><tr><th>Artículo</th><th class="n">Cantidad</th>${c.total != null ? '<th class="n">Precio</th><th class="n">Importe</th>' : ''}</tr></thead><tbody>
      ${(c.lineas || []).map((l) => `<tr><td>${esc(l.descripcion)}</td><td class="n">${cant(l.cantidad_m, '')}</td>${c.total != null ? `<td class="n">${pesos(l.precio_unit)}</td><td class="n">${pesos(l.importe)}</td>` : ''}</tr>`).join('')}</tbody></table>
      ${c.total != null ? `<dl class="doc-totales"><div><dt>Total</dt><dd>${pesos(c.total)}</dd></div>${(c.cobros || []).map((p) => `<div><dt>Cobrado · ${esc(MEDIO[p.medio] || p.medio)}</dt><dd>${pesos(p.importe)}</dd></div>`).join('')}<div><dt>Saldo</dt><dd>${pesos(c.saldo)}</dd></div></dl>` : ''}`;
  } else if (c.tipo === 'recibo') {
    cuerpo = `<p class="doc-recibo">Recibimos de <strong>${esc(c.cliente?.nombre)}</strong> la suma de <strong>${pesos(c.pago?.importe)}</strong> en concepto de ${esc(c.pago?.concepto)}. Medio de pago: ${esc(MEDIO[c.pago?.medio] || c.pago?.medio)}${c.pago?.referencia ? ' (referencia ' + esc(c.pago.referencia) + ')' : ''}. Fecha del pago: ${fecha(c.pago?.fecha)}.</p>`;
  }
  return `<article class="documento">${encabezado(c)}${cuerpo}<footer class="doc-pie"><p>${esc(c.leyenda)}</p><p>Emitido por ${esc(c.emitidoPor || '')}.</p></footer></article>`;
}

export const ESTILO_DOCUMENTO = `
.documento{font-family:Barlow,system-ui,sans-serif;color:#1d1d1d;max-width:820px;margin:0 auto;padding:28px;background:#fff;line-height:1.45;font-size:15px}
.doc-head{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #AE040F;padding-bottom:14px;margin-bottom:16px;flex-wrap:wrap}
.doc-marca{display:flex;gap:12px;align-items:center}.doc-marca img{max-height:64px;max-width:160px;object-fit:contain}
.doc-marca div,.doc-num{display:flex;flex-direction:column}.doc-marca strong{font-size:20px}.doc-marca span,.doc-num span{color:#555;font-size:13px}
.doc-num{text-align:right}.doc-num strong{font-size:18px}
.doc-datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 16px;background:#f5f5f4;padding:12px;border-radius:6px;margin-bottom:14px}
.doc-datos span{display:block;color:#555;font-size:12px}.doc-datos strong{font-size:15px}
.documento h2{font-size:16px;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
.doc-tabla{width:100%;border-collapse:collapse;font-size:14px}.doc-tabla th,.doc-tabla td{border-bottom:1px solid #e3e3e1;padding:6px 4px;text-align:left;vertical-align:top}
.doc-tabla .n{text-align:right;white-space:nowrap}.doc-tabla small{display:block;color:#666}
.doc-totales{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:flex-end;margin:12px 0}.doc-totales div{text-align:right}.doc-totales dt{color:#555;font-size:12px}.doc-totales dd{margin:0;font-weight:700;font-size:16px}
.doc-nota,.doc-pie{color:#555;font-size:12.5px}.doc-pie{border-top:1px solid #ddd;margin-top:24px;padding-top:8px}.doc-recibo{font-size:17px}.doc-vacio{color:#666}
.doc-hallazgo{padding:12px 0;border-bottom:1px solid #ddd;break-inside:avoid}.doc-hallazgo p{white-space:pre-wrap;overflow-wrap:anywhere}.doc-hallazgo-foto{max-width:100%;width:320px;max-height:240px;object-fit:contain;margin:8px 0}
@media print{.documento{padding:0;max-width:none}}
`;
