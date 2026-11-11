// Ayudas de interfaz: formato, estados con palabra e ícono, formularios con errores claros, avisos y confirmaciones.
import { icono } from './iconos.js?v=0.1.0';
import { iniciarMovimiento, entrada, retirar } from './movimiento.js?v=0.1.0';
iniciarMovimiento();

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = esc;

// ---------- Formato ----------
export const pesos = (c) => c == null ? '—' : '$' + (c / 100).toLocaleString('es-AR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
export const cant = (m, u) => `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 3 })}${u ? ' ' + u : ''}`;
export const km = (n) => n == null ? 'Sin lectura' : n.toLocaleString('es-AR') + ' km';
export const aEntradaDinero = (c) => c == null ? '' : (c / 100).toLocaleString('es-AR', { maximumFractionDigits: 2, useGrouping: false });
export const aEntradaCant = (m) => m == null ? '' : String(m / 1000).replace('.', ',');
let ZONA = 'America/Argentina/Mendoza';
export const fijarZona = (z) => { ZONA = z || ZONA; };
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function partes(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d).map((x) => [x.type, x.value]));
  return p;
}
// Acepta ISO UTC ("…Z") u hora local del taller ("AAAA-MM-DDTHH:MM") o fecha ("AAAA-MM-DD").
export function aLocal(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v + 'T00:00';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v;
  const p = partes(new Date(v));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function hoyLocal() { return aLocal(new Date().toISOString()).slice(0, 10); }
export function fecha(v) { const l = aLocal(v); return l ? `${l.slice(8, 10)}/${l.slice(5, 7)}/${l.slice(0, 4)}` : ''; }
export function fechaCorta(v) { const l = aLocal(v); return l ? `${l.slice(8, 10)}/${l.slice(5, 7)}` : ''; }
export function hora(v) { const l = aLocal(v); return l ? l.slice(11, 16) : ''; }
export function cuando(v) {
  const l = aLocal(v);
  if (!l) return '';
  const hoy = hoyLocal();
  const d = l.slice(0, 10);
  const ayer = new Date(hoy + 'T12:00:00Z'); ayer.setUTCDate(ayer.getUTCDate() - 1);
  const man = new Date(hoy + 'T12:00:00Z'); man.setUTCDate(man.getUTCDate() + 1);
  const dia = d === hoy ? 'Hoy' : d === ayer.toISOString().slice(0, 10) ? 'Ayer' : d === man.toISOString().slice(0, 10) ? 'Mañana' : `${DIAS[new Date(d + 'T12:00:00Z').getUTCDay()]} ${fechaCorta(l)}`;
  return `${dia} ${l.slice(11, 16)}`;
}
export const fechaHora = (v) => v ? `${fecha(v)} ${hora(v)}` : '';
export function haceCuanto(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`;
  return `hace ${Math.floor(h / 24)} día(s)`;
}

// ---------- Piezas visuales ----------
export const patente = (p, grande = false) => `<span class="patente${grande ? ' patente--grande' : ''}" translate="no">${esc(p)}</span>`;
export function nombreAuto(v) {
  if (!v) return '';
  return `${esc([v.marca, v.modelo].filter(Boolean).join(' ') || 'Auto sin datos')}${v.version_txt ? ` <span>${esc(v.version_txt)}</span>` : ''}`;
}
const SIT = {
  revision: ['teal', 'buscar'], autorizacion: ['violeta', 'reloj'], presupuesto: ['azul', 'documento'], repuesto: ['ambar', 'caja'],
  trabajo: ['teal', 'llave'], control: ['azul', 'escudo'], controlada: ['verde', 'check'], lista: ['verde', 'check'], entregada: ['', 'check'], anulada: ['rojo', 'ban']
};
export function chipSituacion(s) {
  const [c, i] = SIT[s.clave] || ['', 'info'];
  return `<span class="estado ${c ? 'estado--' + c : ''}">${icono(i)}${esc(s.texto)}</span>`;
}
export function chip(texto, color = '', ic = 'info') { return `<span class="estado ${color ? 'estado--' + color : ''}">${icono(ic)}${esc(texto)}</span>`; }
export const RESPUESTAS = { autoriza: ['Autorizado', 'verde', 'check'], rechaza: ['No autorizado', 'rojo', 'ban'], posterga: ['Para más adelante', 'ambar', 'pausa'] };
export function chipRespuesta(r, cambio) {
  if (!r) return chip(cambio ? 'Cambio sin respuesta' : 'Sin respuesta', 'violeta', 'reloj');
  const [t, c, i] = RESPUESTAS[r];
  return chip(t, c, i);
}
export const ETAPAS = { falta_pedir: ['Falta pedir', 'rojo', 'alerta'], pedido: ['Pedido', 'ambar', 'camion'], llego: ['Llegó · falta colocar', 'azul', 'caja'], colocado: ['Colocado', 'verde', 'check'] };
export const chipEtapa = (e) => { const [t, c, i] = ETAPAS[e]; return chip(t, c, i); };
export const TIPO_LINEA = { repuesto: 'Repuesto', insumo: 'Insumo', mano_obra: 'Mano de obra', servicio_externo: 'Servicio externo', revision: 'Revisión', otro: 'Otro' };
export const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Tarjeta de débito', credito: 'Tarjeta de crédito', cheque: 'Cheque', otro: 'Otro' };
export const UNIDADES = ['u.', 'L', 'kg', 'm', 'h', 'juego', 'kit', 'par'];
export const CANALES = { telefono: 'teléfono', whatsapp: 'WhatsApp', presencial: 'en persona', correo: 'correo', otro: 'otro medio' };
export const vacio = (texto, extra = '') => `<div class="vacio"><p>${esc(texto)}</p>${extra}</div>`;
export const aviso = (texto, tipo = '', ic = 'info') => `<div class="aviso ${tipo ? 'aviso--' + tipo : ''}" role="note">${icono(ic)}<div>${texto}</div></div>`;

// ---------- Campos de formulario ----------
let nCampo = 0;
export function campo({ nombre, etiqueta, tipo = 'text', valor = '', ayuda = '', requerido = false, opciones = null, attrs = '', ancho = '', placeholder = '', id }) {
  const fid = id || `c-${nombre.replace(/[^a-z0-9]/gi, '-')}-${++nCampo}`;
  const ayudaId = ayuda ? fid + '-ayuda' : '';
  const req = requerido ? ' required aria-required="true"' : '';
  const desc = ayudaId ? ` aria-describedby="${ayudaId}"` : '';
  let control;
  if (tipo === 'textarea') control = `<textarea id="${fid}" name="${nombre}"${req}${desc} ${attrs} placeholder="${attr(placeholder)}">${esc(valor)}</textarea>`;
  else if (tipo === 'select') control = `<select id="${fid}" name="${nombre}"${req}${desc} ${attrs}>${opciones.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${attr(v)}"${String(v) === String(valor ?? '') ? ' selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;
  else control = `<input id="${fid}" name="${nombre}" type="${tipo}" value="${attr(valor)}"${req}${desc} ${attrs} placeholder="${attr(placeholder)}" autocomplete="off">`;
  return `<div class="campo" data-campo="${attr(nombre)}" ${ancho ? `style="${ancho}"` : ''}><label for="${fid}">${esc(etiqueta)}${requerido ? '' : ' <span class="muted xs">(opcional)</span>'}</label>${ayuda ? `<p class="ayuda" id="${ayudaId}">${ayuda}</p>` : ''}${control}</div>`;
}
export function opcionesRadio(nombre, opciones, valor, leyenda, { requerido = true } = {}) {
  return `<fieldset class="grupo" data-campo="${attr(nombre)}"><legend>${esc(leyenda)}</legend><div class="opciones">${opciones.map(([v, t, ic]) => `<label class="opcion"><input type="radio" name="${nombre}" value="${attr(v)}"${String(v) === String(valor) ? ' checked' : ''}${requerido ? ' required' : ''}><span>${ic ? icono(ic) : ''}${esc(t)}</span></label>`).join('')}</div></fieldset>`;
}
export const casilla = (nombre, texto, marcado = false, extra = '') => `<label class="check" data-campo="${attr(nombre)}"><input type="checkbox" name="${nombre}" value="1"${marcado ? ' checked' : ''} ${extra}><span>${texto}</span></label>`;

export function leerForm(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') { if (el.name.endsWith('[]')) { const k = el.name.slice(0, -2); d[k] = d[k] || []; if (el.checked) d[k].push(el.value); } else d[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; else if (!(el.name in d)) d[el.name] = ''; }
    else d[el.name] = el.value;
  }
  return d;
}

export function limpiarErrores(form) {
  form.querySelectorAll('.campo--error').forEach((c) => c.classList.remove('campo--error'));
  form.querySelectorAll('[data-error-descrito]').forEach((el) => {
    const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== el.dataset.errorDescrito);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
    delete el.dataset.errorDescrito;
  });
  form.querySelectorAll('.campo__error, .resumen-errores').forEach((e) => e.remove());
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
}
// Muestra un resumen arriba del formulario y marca el campo. Lo escrito no se borra.
export function mostrarError(form, err) {
  limpiarErrores(form);
  const box = document.createElement('div');
  box.className = 'resumen-errores';
  box.setAttribute('role', 'alert');
  box.tabIndex = -1;
  let destino = null;
  if (err.campo) {
    const nombre = err.campo.replace(/^lineas\.(\d+)\.(.+)$/, (_, i, k) => `${k}`);
    const idx = /^lineas\.(\d+)\./.exec(err.campo)?.[1];
    let contenedor = idx != null ? form.querySelectorAll('[data-linea]')[Number(idx)] : form;
    contenedor = contenedor || form;
    const c = contenedor.querySelector(`[data-campo="${CSS.escape(nombre)}"]`) || form.querySelector(`[data-campo="${CSS.escape(err.campo)}"]`);
    if (c) {
      c.classList.add('campo--error');
      const ctl = c.querySelector('input, select, textarea');
      if (ctl) { ctl.setAttribute('aria-invalid', 'true'); destino = ctl; }
      const p = document.createElement('p');
      p.className = 'campo__error';
      p.id = `error-campo-${++nCampo}`;
      p.textContent = err.message;
      if (ctl) {
        ctl.dataset.errorDescrito = p.id;
        ctl.setAttribute('aria-describedby', [ctl.getAttribute('aria-describedby'), p.id].filter(Boolean).join(' '));
      }
      c.appendChild(p);
    }
  }
  box.innerHTML = `<h2>${err.datos?.guardadoSinConfirmar ? 'Guardado sin confirmar' : err.datos?.sinConexion ? 'Consulta sin conexión' : 'Falta corregir algo'}</h2><p>${esc(err.message)}</p>${destino ? `<p><button type="button" class="enlace" data-ir-campo>Ir al dato</button></p>` : ''}`;
  form.prepend(box);
  box.querySelector('[data-ir-campo]')?.addEventListener('click', (e) => { e.preventDefault(); destino.focus(); });
  box.focus();
}

// Envía un formulario: evita el doble envío, muestra carga, conserva lo escrito ante errores.
export function alEnviar(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.enviando) return;
    const boton = e.submitter || form.querySelector('[type="submit"]');
    form.dataset.enviando = '1';
    boton?.classList.add('cargando');
    boton?.setAttribute('aria-busy', 'true');
    if(boton)boton.disabled=true;
    limpiarErrores(form);
    let cancelado=false;
    try {
      const resultado=await fn(leerForm(form), boton);
      cancelado=resultado===false;
      if(resultado!==false)delete form.dataset.sucio;
    } catch (err) {
      if (err && err.message) mostrarError(form, err);
      else throw err;
    } finally {
      delete form.dataset.enviando;
      boton?.classList.remove('cargando');
      boton?.removeAttribute('aria-busy');
      if(boton)boton.disabled=false;
      if(cancelado&&boton?.isConnected)boton.focus({preventScroll:true});
    }
  });
  form.addEventListener('input', (e) => { if(e.target.type!=='search')form.dataset.sucio = '1'; });
}
export const hayCambiosSinGuardar = () => !!document.querySelector('form[data-sucio]:not([data-sin-aviso])');

// ---------- Avisos flotantes ----------
export function toast(mensaje, { error = false, accion = null, duracion = 6000 } = {}) {
  const cont = document.getElementById('toasts');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = 'toast' + (error ? ' toast--error' : '');
  t.setAttribute('role', error ? 'alert' : 'status');
  t.setAttribute('aria-atomic', 'true');
  t.innerHTML = `${icono(error ? 'alerta' : 'check')}<div>${esc(mensaje)}</div>`;
  const focoAnterior = document.activeElement;
  const desdeEnvio = !!focoAnterior?.closest?.('form[data-enviando]');
  let timer, inicio, restante = error ? duracion * 2 : duracion;
  let sobre = false;
  const pausar = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    restante = Math.max(0, restante - (performance.now() - inicio));
  };
  const quitar = () => {
    if (t.dataset.retirando) return;
    clearTimeout(timer);
    const teniaFoco = t.contains(document.activeElement);
    if (teniaFoco) {
      // Un guardado puede reemplazar ese botón justo después de cerrar el aviso.
      // Deshabilitar el botón durante el envío puede haber dejado el foco en body.
      const util = focoAnterior?.isConnected && focoAnterior !== document.body && focoAnterior !== document.documentElement;
      const destino = !desdeEnvio && util ? focoAnterior : document.getElementById('contenido');
      destino?.focus({preventScroll:true});
    }
    retirar(t);
  };
  const continuar = () => {
    // Los avisos con acción quedan disponibles hasta que la persona decida.
    if (accion || duracion <= 0 || sobre || t.contains(document.activeElement) || timer || !t.isConnected) return;
    inicio = performance.now();
    timer = setTimeout(quitar, restante);
  };
  t.addEventListener('pointerenter', () => { sobre = true; pausar(); });
  t.addEventListener('pointerleave', () => { sobre = false; continuar(); });
  t.addEventListener('focusin', pausar);
  t.addEventListener('focusout', () => queueMicrotask(continuar));
  if (accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = accion.texto;
    b.onclick = () => { quitar(); accion.fn(); };
    t.appendChild(b);
  }
  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.innerHTML = `${icono('x', 'i-sm')}<span class="sr">Cerrar aviso</span>`;
  cerrar.onclick = quitar;
  t.appendChild(cerrar);
  cont.appendChild(t);
  entrada(t, {tipo:'aviso'});
  const max=matchMedia('(max-width:719px)').matches?1:2;
  // No descartar acciones pendientes ni quitar el control que tiene el foco.
  while ([...cont.children].filter(el => !el.dataset.retirando).length > max) {
    const viejo = [...cont.children].find(el => el !== t && !el.dataset.retirando && !el.dataset.conAccion && !el.contains(document.activeElement));
    if (!viejo) break;
    viejo.dispatchEvent(new Event('aviso-descartar'));
  }
  if (accion) t.dataset.conAccion = '1';
  t.addEventListener('aviso-descartar', quitar, {once:true});
  continuar();
}

// ---------- Confirmación con efecto explicado (solo para operaciones sensibles) ----------
export function confirmar({ titulo, texto, efecto = '', aceptar = 'Confirmar', peligro = false, pedir = null }) {
  return new Promise((resolve) => {
    const focoAnterior=document.activeElement;
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    const id = `dlg-${++nCampo}`;
    d.setAttribute('aria-labelledby', `${id}-titulo`);
    if (texto) d.setAttribute('aria-describedby', `${id}-descripcion`);
    d.innerHTML = `<form method="dialog" class="form"><div class="dialogo__cuerpo"><h2 id="${id}-titulo">${esc(titulo)}</h2>${texto ? `<p id="${id}-descripcion">${texto}</p>` : ''}${efecto ? aviso(efecto, peligro ? 'ambar' : 'gris') : ''}
      ${pedir ? campo({ nombre: 'valor', etiqueta: pedir.etiqueta, tipo: pedir.tipo || 'textarea', requerido: pedir.requerido !== false, ayuda: pedir.ayuda || '', valor: pedir.valor || '' }) : ''}</div>
      <div class="dialogo__pie"><button type="button" class="btn" value="no" data-cancelar>Volver sin cambios</button><button type="submit" class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" value="si">${esc(aceptar)}</button></div></form>`;
    document.body.appendChild(d);
    const form = d.querySelector('form');
    d.querySelector('[data-cancelar]').onclick = () => d.close('no');
    form.addEventListener('submit', (e) => {
      const v = form.elements.valor;
      if (v && pedir.requerido !== false && !v.value.trim()) { e.preventDefault(); v.focus(); v.closest('.campo').classList.add('campo--error'); return; }
      d.returnValue = 'si';
    });
    d.addEventListener('close', () => { const ok = d.returnValue === 'si'; const valor = form.elements.valor?.value; d.remove(); if(focoAnterior?.isConnected)focoAnterior.focus({preventScroll:true}); resolve({ ok, valor }); });
    d.showModal();
    (form.elements.valor || d.querySelector('[data-cancelar]')).focus();
  });
}

// Copiar al portapapeles con alternativa.
export async function copiar(textoACopiar) {
  try { await navigator.clipboard.writeText(textoACopiar); toast('Texto copiado.'); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = textoACopiar; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove();
    toast(ok ? 'Texto copiado.' : 'No se pudo copiar automáticamente. Seleccioná el texto y copialo a mano.', { error: !ok });
    return ok;
  }
}
export { icono };

// Solo revisión; no escribe ni cambia efectos de negocio.
export function numeroEntrada(s) {
  s=String(s??'').replace(/\$|\s/g,'');
  return /,/.test(s)?Number(s.replace(/\./g,'').replace(',','.')):/^\d{1,3}(\.\d{3})+$/.test(s)?Number(s.replace(/\./g,'')):Number(s);
}
export async function revisarPago({importe,medio,destino,efecto}) {
  const n=numeroEntrada(importe);
  if(!Number.isFinite(n)||n<=0)throw Object.assign(new Error('Escribí un importe mayor a cero.'),{campo:'importe'});
  if(!MEDIOS[medio])throw Object.assign(new Error('Elegí el medio de pago.'),{campo:'medio'});
  return (await confirmar({titulo:'Revisar cobro',texto:`<strong>${pesos(Math.round(n*100))}</strong> · ${esc(MEDIOS[medio])}<br>${esc(destino)}`,efecto,aceptar:'Confirmar y registrar'})).ok;
}
