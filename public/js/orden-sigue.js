// Orden «Paso a paso» (rediseño aprobado del 25/11/2026): «Qué sigue» en la orden y como cápsula sobre la isla.
// Solo lee la visita que manda el servidor y arma presentación: el texto base es el paso de server/reglas.js
// (situacion) y los bloqueos de cada trabajo repiten bloqueosRealizar. Ninguna acción se ejecuta desde acá: los
// botones llevan a la sección o al repuesto donde están las acciones reales, con sus permisos y validaciones.
import { esc, chipSituacion, fecha, toast, telLlamada, telWhatsApp } from './ui.js?v=0.1.0';
import { ic } from './diseno.js?v=0.1.0';

// Cliente y contacto en el marco de la orden: llamar y WhatsApp usan el teléfono cargado y se abren solo cuando la
// persona toca el enlace (WhatsApp abre la conversación sin texto: no envía nada). Sin teléfono, se dice claramente.
export function contactoCliente(v) {
  const nombre = v.contacto_nombre || 'Sin cliente';
  const tel = telLlamada(v.contacto_telefono);
  return `<div class="h-cli"><span class="h-cli-ic" aria-hidden="true">${ic('person')}</span>
    <p class="h-cli-t"><span class="sr">Cliente: </span><b>${esc(nombre)}</b><small>${tel ? esc(v.contacto_telefono) : 'Sin teléfono cargado · no se puede llamar ni escribir'}</small></p>
    ${tel ? `<div class="h-cli-acc"><a class="h-cto" href="tel:${esc(tel)}" aria-label="Llamar a ${esc(nombre)} (${esc(v.contacto_telefono)})">${ic('call')}<span>Llamar</span></a>
      <a class="h-cto" href="https://wa.me/${esc(telWhatsApp(v.contacto_telefono))}" target="_blank" rel="noopener" aria-label="Abrir WhatsApp con ${esc(nombre)}. No envía ningún mensaje.">${ic('sms')}<span>WhatsApp</span></a></div>` : ''}</div>`;
}

const resp = (l) => l.respuesta?.respuesta || (l.autorizada_ingreso ? 'autoriza' : null);
const cerrada = (v) => !!(v.entregada_at || v.anulada_at);
export const RESULTADO_TXT = { resuelto: 'Resuelto y comprobado', mejoro: 'Mejoró, pero falta resolver', no_reproducido: 'No se pudo reproducir el problema', pendiente: 'Sigue pendiente' };

// Trabajos autorizados con su estado de presentación. Los motivos de bloqueo son los mismos que exige el servidor
// para marcar realizado (bloqueosRealizar): un repuesto vinculado sin colocar, un cambio sin respuesta del cliente o
// tareas del service pendientes. Un repuesto solo frena el trabajo al que está vinculado (linea_id); no se infiere
// ninguna relación por el parecido de los nombres.
export function clasificarTrabajos(v, app) {
  const vigentes = (v.presupuesto?.lineas || []).filter((l) => l.estado === 'vigente');
  const yo = app.sesion.usuario;
  const asignado = yo.rol !== 'mecanico' || !v.responsable_id || v.responsable_id === yo.id;
  const permisos = {
    asignado,
    ejecuta: app.puede('trabajo.ejecutar') && !cerrada(v) && asignado,
    coloca: app.puede('repuestos.colocar') && !cerrada(v) && asignado,
    gestiona: app.puede('repuestos.gestionar') && !cerrada(v)
  };
  const tareasPend = (v.tareas || []).filter((t) => t.estado === 'pendiente');
  const trabajos = vigentes.filter((l) => resp(l) === 'autoriza').map((l) => {
    const reps = (v.repuestos || []).filter((r) => r.linea_id === l.id);
    const cambio = vigentes.find((x) => x.origen_linea_id === l.id && !resp(x));
    const sinColocar = reps.filter((r) => r.etapa !== 'colocado');
    const esperan = reps.filter((r) => r.etapa === 'falta_pedir' || r.etapa === 'pedido');
    const tareas = v.tipo === 'service' && l.autorizada_ingreso && tareasPend.length;
    const bloqueos = [
      ...(cambio ? ['Hay un cambio de este trabajo esperando la respuesta del cliente.'] : []),
      ...(sinColocar.length ? [`Falta colocar: ${sinColocar.map((r) => r.descripcion).join(', ')}.`] : []),
      ...(tareas ? [`El service tiene ${tareasPend.length} tarea${tareasPend.length > 1 ? 's' : ''} sin confirmar.`] : [])
    ];
    const estado = l.realizado_at ? 'realizado' : cambio ? 'respuesta' : esperan.length ? 'repuesto' : sinColocar.length ? 'colocar' : tareas ? 'tareas' : 'hacer';
    return { l, reps, cambio, sinColocar, esperan, bloqueos, estado, espera: estado === 'respuesta' || estado === 'repuesto' };
  });
  // Repuestos que esperan, con el mismo criterio que la situación del servidor: vinculados a un trabajo autorizado
  // o sin trabajo asignado.
  const deEjecutables = new Set(trabajos.map((t) => t.l.id));
  const esperando = (v.repuestos || []).filter((r) => (r.linea_id == null || deEjecutables.has(r.linea_id)) && (r.etapa === 'falta_pedir' || r.etapa === 'pedido'));
  return { trabajos, esperando, tareasPend, noEjecutables: vigentes.filter((l) => resp(l) && resp(l) !== 'autoriza'), ...permisos };
}

const IC_SIT = { revision: 'search', presupuesto: 'receipt_long', autorizacion: 'receipt_long', repuesto: 'build', trabajo: 'build', control: 'task_alt', controlada: 'task_alt', lista: 'check_circle' };
const detalleEspera = (r) => r.etapa === 'falta_pedir' ? 'Falta pedir' : `Pedido · ${r.fecha_prevista ? 'llegada prevista ' + fecha(r.fecha_prevista) : 'sin fecha de llegada confirmada'}`;

// Modelo de «Qué sigue»: texto, acción que lleva al lugar real, otras acciones posibles y lo que espera repuesto.
// Cuando hay varias acciones posibles, el orden es una sugerencia y se dice así: el taller decide.
export function queSigue(v, app) {
  if (cerrada(v)) return null;
  const s = v.situacion;
  const m = { sit: s, icono: IC_SIT[s.clave] || 'info', texto: s.paso, extra: '', accion: null, tambien: [], espera: [], sugerido: false, resultado: '' };
  const ir = (texto, sec, ancla = '') => ({ texto, sec, ancla });
  const control = v.controles.find((c) => c.vigente);
  const dinero = app.puede('ver.dinero');
  if (s.clave === 'revision') m.accion = ir('Ir a la revisión', 'revision');
  else if (s.clave === 'presupuesto') m.accion = ir('Ir al presupuesto', 'presupuesto');
  else if (s.clave === 'autorizacion') {
    m.accion = ir(app.puede('presupuesto.respuesta') ? 'Registrar la respuesta' : 'Ver el presupuesto', 'presupuesto');
    if (!app.puede('presupuesto.respuesta')) m.extra = 'La respuesta del cliente la registran recepción o el dueño.';
  } else if (s.clave === 'repuesto' || s.clave === 'trabajo') {
    const c = clasificarTrabajos(v, app);
    const posibles = [];
    const posible = (paso, corto, boton, ancla) => posibles.push({ paso, corto, accion: ir(boton, 'trabajo', ancla) });
    for (const r of v.repuestos || []) if (r.etapa === 'llego' && c.coloca) posible(`Colocar y registrar: ${r.descripcion}.`, `Colocar: ${r.descripcion}`, 'Ir al repuesto', `rep-${r.id}`);
    if (c.ejecuta) for (const t of c.trabajos) if (!t.l.realizado_at && !t.bloqueos.length) posible(t.reps.length ? `Repuestos colocados. Marcar realizado: ${t.l.descripcion}.` : `Terminar y registrar: ${t.l.descripcion}.`, t.l.descripcion, 'Ir al trabajo', `lin-${t.l.id}`);
    if (c.ejecuta && c.tareasPend.length) posible(`Tareas del service: ${c.tareasPend.length} pendiente${c.tareasPend.length > 1 ? 's' : ''}.`, 'Tareas del service', 'Ir a las tareas', 'tareas');
    let esperan = c.esperando;
    if (posibles.length) {
      m.texto = posibles[0].paso;
      m.accion = posibles[0].accion;
      m.tambien = posibles.slice(1, 4).map((p) => ({ ...p.accion, texto: p.corto }));
      m.sugerido = posibles.length > 1;
    } else if (esperan.length) {
      m.accion = ir('Ir al repuesto', 'trabajo', `rep-${esperan[0].id}`);
      if (esperan[0].etapa === 'pedido') m.extra = esperan[0].fecha_prevista ? `Llegada prevista: ${fecha(esperan[0].fecha_prevista)}.` : 'Sin fecha de llegada confirmada.';
      esperan = esperan.slice(1);
    } else m.accion = ir('Ir a Trabajo', 'trabajo');
    m.espera = esperan.map((r) => ({ texto: r.descripcion, detalle: detalleEspera(r), sec: 'trabajo', ancla: `rep-${r.id}` }));
    if (!c.asignado && app.puede('trabajo.ejecutar')) m.extra = `La orden está asignada a ${v.responsable || 'otra persona'}: pedí que te la asignen para registrar avances.`;
  } else if (s.clave === 'control') {
    m.accion = ir('Ir a comprobar', 'control', 'entrega');
    if (!app.puede('control.registrar')) m.extra = 'El resultado lo comprueba el mecánico asignado o el dueño.';
  } else if (s.clave === 'controlada') m.accion = ir('Ir a la entrega', 'control', 'entrega');
  else if (s.clave === 'lista') {
    const sinLiquidar = (v.presupuesto?.lineas || []).some((l) => l.estado === 'vigente' && resp(l) === 'autoriza' && l.realizado_at && l.importe > 0 && !l.cargo_id);
    const saldo = v.totales?.saldo || 0;
    if (sinLiquidar && dinero) m.accion = ir('Ir a Dinero', 'cobros');
    else if (app.puede('visita.entregar')) {
      m.accion = ir('Ir a la entrega', 'control', 'entrega');
      if (saldo > 0 && !/saldo/.test(m.texto)) m.extra = 'Queda saldo: el cobro se registra aparte.';
      if (saldo > 0 && app.puede('caja.registrar')) m.tambien = [{ texto: 'Registrar cobro', sec: 'cobros', ancla: '' }];
    } else m.accion = ir('Ver la entrega', 'control', 'entrega');
  }
  if (control && control.resultado !== 'resuelto' && ['controlada', 'lista'].includes(s.clave)) m.resultado = `Resultado: ${RESULTADO_TXT[control.resultado]}`;
  return m;
}

const botonIr = (d, cls) => `<button type="button" class="${cls}" data-ir-sec="${esc(d.sec)}" data-ir-ancla="${esc(d.ancla || '')}">`;
// Cuerpo compartido por la tarjeta y la cápsula abierta.
function cuerpo(m) {
  return `<p class="qs-texto">${esc(m.texto)}${m.extra ? ` <span>${esc(m.extra)}</span>` : ''}</p>
    ${m.resultado ? `<p class="qs-res">${ic('warning')}${esc(m.resultado)}</p>` : ''}
    ${m.accion ? `${botonIr(m.accion, 'btn btn-primario btn-full qs-ir')}${esc(m.accion.texto)}</button>` : ''}
    ${m.tambien.length ? `<div class="qs-grupo"><h3>También disponible</h3><div class="qs-tambien">${m.tambien.map((a) => `${botonIr(a, 'qs-alt')}${ic('arrow_forward')}<span>${esc(a.texto)}</span></button>`).join('')}</div></div>` : ''}
    ${m.espera.length ? `<div class="qs-grupo"><h3>Esperando repuesto · no frena lo demás</h3><ul class="qs-espera">${m.espera.map((w) => `<li>${ic('lock')}<p><b>${esc(w.texto)}</b> · ${esc(w.detalle)}</p>${botonIr(w, 'btn btn-texto btn-chico')}Ver<span class="sr"> ${esc(w.texto)}</span></button></li>`).join('')}</ul></div>` : ''}
    ${m.sugerido ? '<p class="qs-sug">Orden sugerido: lo decide el taller.</p>' : ''}`;
}

export function tarjetaSigue(m) {
  if (!m) return '';
  return `<section class="qs" id="que-sigue" aria-labelledby="qs-t" tabindex="-1">
    <div class="qs-cab"><span class="qs-ic" aria-hidden="true">${ic(m.icono)}</span><h2 id="qs-t">Qué sigue</h2>${chipSituacion(m.sit)}</div>
    ${cuerpo(m)}</section>`;
}

// Cápsula sobre la isla (solo en celular, cuando «Qué sigue» quedó arriba) y su versión abierta en un diálogo.
export function capsulaSigue(m, v) {
  if (!m) return '';
  const resumen = [m.tambien.length ? `+${m.tambien.length} disponible${m.tambien.length > 1 ? 's' : ''}` : '', m.espera.length ? `${m.espera.length} esperando repuesto` : ''].filter(Boolean).join(' · ');
  return `<div class="qs-capsula" data-qs-capsula hidden><button type="button" class="qs-cap-b" aria-haspopup="dialog" aria-expanded="false" data-qs-abrir>
      <span class="qs-ic" aria-hidden="true">${ic(m.icono)}</span>
      <span class="qs-cap-t"><span class="qs-cap-s">Qué sigue · ${esc(m.sit.texto)}</span><span class="qs-cap-x">${esc(m.texto)}</span>${resumen ? `<span class="qs-cap-r">${esc(resumen)}</span>` : ''}</span>
      <span class="qs-cap-f" aria-hidden="true">${ic('expand_more')}</span><span class="sr">Abrir Qué sigue</span></button></div>
    <dialog class="qs-dlg" aria-labelledby="qs-dlg-t" data-qs-dlg><div class="qs-dlg-c">
      <div class="qs-cab"><span class="qs-ic" aria-hidden="true">${ic(m.icono)}</span><div class="qs-dlg-tt"><h2 id="qs-dlg-t">Qué sigue · Orden ${esc(v.numero)}</h2><p>${esc(m.sit.texto)}</p></div>
        <button type="button" class="qs-cerrar" aria-label="Cerrar Qué sigue" data-qs-cerrar>${ic('expand_more')}</button></div>
      ${cuerpo(m)}</div></dialog>`;
}

// Lleva a un destino de la orden. Si el elemento ya está en pantalla, se desplaza y lo resalta; si no, cambia a la
// sección (ruta de siempre) y lo resalta al terminar de dibujar.
let pendiente = '';
function resaltar(el) {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'center' });
  el.focus({ preventScroll: true });
  el.classList.remove('destello');
  void el.offsetWidth;
  el.classList.add('destello');
  setTimeout(() => el.classList.remove('destello'), 1800);
}
export function irA(v, app, sec, ancla) {
  const el = ancla && document.getElementById(ancla);
  if (el && !el.closest('details:not([open])')) { resaltar(el); return; }
  pendiente = ancla;
  app.ir(`#/visitas/${v.id}/${sec}`);
}
export function aplicarPendiente() {
  if (!pendiente) return;
  const id = pendiente;
  pendiente = '';
  // Después de que la app restaure el desplazamiento de la pantalla.
  requestAnimationFrame(() => { const el = document.getElementById(id); if (el) resaltar(el); });
}

// Botones «Ir a…» de «Qué sigue» y de las secciones (también las que se abren después en «Toda la orden»).
export function enlazarIr(raiz, v, app) {
  raiz.querySelectorAll('[data-ir-sec]').forEach((b) => b.addEventListener('click', () => {
    b.closest('dialog')?.close();
    irA(v, app, b.dataset.irSec, b.dataset.irAncla);
  }));
}

export function enlazarSigue(raiz) {
  const tarjeta = raiz.querySelector('#que-sigue');
  const cap = raiz.querySelector('[data-qs-capsula]');
  const dlg = raiz.querySelector('[data-qs-dlg]');
  if (!tarjeta || !cap || !dlg) return;
  const abrir = cap.querySelector('[data-qs-abrir]');
  // Visible solo cuando la tarjeta quedó por encima de la pantalla (no cuando todavía no se llegó a ella).
  const io = new IntersectionObserver(([e]) => {
    if (!tarjeta.isConnected) { io.disconnect(); return; }
    cap.hidden = e.isIntersecting || e.boundingClientRect.top > 0;
  }, { rootMargin: '-56px 0px 0px 0px' });
  io.observe(tarjeta);
  abrir.addEventListener('click', () => { dlg.showModal(); abrir.setAttribute('aria-expanded', 'true'); dlg.querySelector('[data-qs-cerrar]').focus(); });
  dlg.querySelector('[data-qs-cerrar]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { abrir.setAttribute('aria-expanded', 'false'); if (!cap.hidden && document.activeElement === document.body) abrir.focus({ preventScroll: true }); });
}

// Botón con acción en curso: muestra la carga dentro del botón y evita un segundo toque. Si falla, avisa y no cambia
// nada en pantalla; si sale bien, la orden se vuelve a dibujar con los datos del servidor.
export async function accionEnCurso(boton, app, fn, ok) {
  if (boton?.getAttribute('aria-busy') === 'true') return;
  boton?.setAttribute('aria-busy', 'true');
  boton?.classList.add('cargando');
  try { await fn(); if (ok) toast(ok); app.recargar(); }
  catch (e) { toast(e.message, { error: true }); boton?.removeAttribute('aria-busy'); boton?.classList.remove('cargando'); }
}
