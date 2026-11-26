// Orden (diseño final): cabecera A con la tarjeta grafito (marca, patente, vehículo, cliente con llamar y WhatsApp,
// cinco etapas, estado, responsable y retiro), «Qué sigue» (también como cápsula sobre la isla, orden-sigue.js) e
// interior B: «Ahora» con la sección que corresponde atender o la pedida por el enlace, el dinero según permisos y
// «Toda la orden» con las demás secciones desplegables. Las secciones y sus acciones son las de visita-partes.js:
// mismos servicios, permisos y validaciones del servidor.
import { get, post, put, claveDeEnvio } from '../api.js?v=0.1.0';
import { esc, chipSituacion, cuando, fecha, km, pesos, campo, alEnviar, toast, confirmar, hayCambiosSinGuardar } from '../ui.js?v=0.1.0';
import { seccionRevision, seccionPresupuesto, seccionTrabajo, seccionControl, seccionCobros, seccionArchivos } from './visita-partes.js?v=0.1.0';
import { queSigue, tarjetaSigue, capsulaSigue, contactoCliente, enlazarSigue, enlazarIr, aplicarPendiente } from '../orden-sigue.js?v=0.1.0';
import { resumenOrden } from '../orden-presentacion.js?v=0.1.0';
import { vistaEstadoIngreso } from '../estado-ingreso.js?v=0.1.0';
import { ic, placa, logoMarca, cabecera, ETAPAS_ORDEN } from '../diseno.js?v=0.1.0';

// [ruta, título, ícono]. Las rutas son las de siempre (#/visitas/:id/:seccion).
const SECCIONES = [['resumen', 'Resumen', 'description'], ['revision', 'Revisión', 'search'], ['presupuesto', 'Presupuesto y autorizaciones', 'receipt_long'], ['trabajo', 'Trabajos', 'build'], ['repuestos', 'Repuestos', 'inventory_2'], ['control', 'Control y entrega', 'task_alt'], ['cobros', 'Dinero', 'payments'], ['archivos', 'Archivos y mensajes', 'photo_library'], ['historial', 'Historial', 'history']];
const ETAPA = { revision: 1, presupuesto: 2, autorizacion: 2, repuesto: 3, trabajo: 3, control: 3, controlada: 3, lista: 4 };
// Sección abierta en «Toda la orden», por orden: se conserva al guardar y recargar la pantalla.
const abiertas = new Map();

const seccionNatural = (v, app) => ({ revision: 'revision', presupuesto: 'presupuesto', autorizacion: 'presupuesto', repuesto: 'trabajo', trabajo: 'trabajo', control: 'control', controlada: 'control', lista: /Liquidar/.test(v.situacion.paso) && app.puede('ver.dinero') ? 'cobros' : 'control' })[v.situacion.clave] || 'resumen';

function resumenDe(v, k, dinero) {
  const t = v.totales;
  if (k === 'resumen') return [v.motivo, v.adjuntos.length ? `${v.adjuntos.length} archivo${v.adjuntos.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
  if (k === 'revision') return v.revision ? `${v.hallazgos.length} hallazgo${v.hallazgos.length === 1 ? '' : 's'}` : v.tipo === 'service' ? 'Service: según plantilla' : 'Sin registrar';
  if (k === 'presupuesto') { const n = v.presupuesto?.lineas?.length || 0; return n ? `${n} línea${n === 1 ? '' : 's'}${dinero && t ? ' · autorizado ' + pesos(t.autorizado) : ''}` : 'Sin presupuesto'; }
  if (k === 'trabajo') { const h = v.tareas.filter((x) => x.estado === 'hecha').length; return v.tareas.length ? `${h} de ${v.tareas.length} tareas` : 'Sin tareas'; }
  if (k === 'repuestos') return v.repuestos.length ? `${v.repuestos.length} repuesto${v.repuestos.length === 1 ? '' : 's'}` : 'Sin repuestos';
  if (k === 'control') return v.entregada_at ? 'Entregado ' + fecha(v.entregada_at) : v.controles.some((c) => c.vigente) ? 'Comprobado' : 'Pendiente';
  if (k === 'cobros') return !t ? '' : t.liquidado ? (t.saldo > 0 ? 'Saldo ' + pesos(t.saldo) : t.aFavor ? 'A favor ' + pesos(t.aFavor) : 'Sin saldo') : 'Saldo al liquidar';
  if (k === 'archivos') return `${v.adjuntos.length} archivo${v.adjuntos.length === 1 ? '' : 's'} · ${v.documentos.length} documento${v.documentos.length === 1 ? '' : 's'}`;
  if (k === 'historial') return `${v.actividad.length} evento${v.actividad.length === 1 ? '' : 's'}`;
  return '';
}

// Cinco dimensiones de dinero que nunca se mezclan; el saldo existe recién al liquidar.
function dineroTira(t) {
  if (!t) return '';
  const saldo = !t.liquidado ? '<span class="sindato">Se fija al liquidar</span>' : t.aFavor ? 'A favor ' + esc(pesos(t.aFavor)) : esc(pesos(t.saldo));
  return `<dl class="dinero-tira" aria-label="Dinero de esta orden"><div class="dc"><dt>Autorizado</dt><dd>${esc(pesos(t.autorizado))}</dd></div><div class="dc"><dt>Realizado</dt><dd>${esc(pesos(t.realizado))}</dd></div>
    <div class="dc"><dt>Liquidado</dt><dd>${t.liquidado ? esc(pesos(t.liquidado)) : '<span class="sindato">Al liquidar</span>'}</dd></div><div class="dc"><dt>Cobrado</dt><dd>${esc(pesos(t.cobrado))}</dd></div>
    <div class="dc saldo"><dt>Saldo</dt><dd>${saldo}</dd></div></dl>`;
}

function planificacion(v, app, usuarios) {
  if (!app.puede('visita.editar') || v.entregada_at || v.anulada_at) return '';
  return `<details class="desp" data-planificacion><summary>${ic('edit')}Cambiar responsable, retiro o prioridad</summary><div class="desp-c"><form class="form" id="f-cabecera" novalidate><div class="fila-campos">
      ${campo({ nombre: 'responsableId', etiqueta: 'Responsable', tipo: 'select', valor: v.responsable_id || '', opciones: [['', 'Sin asignar'], ...usuarios.filter((u) => u.activo).map((u) => [u.id, `${u.nombre} · ${u.rolTexto}`])] })}
      ${campo({ nombre: 'retiro', etiqueta: 'Retiro acordado', tipo: 'datetime-local', valor: v.retiro_acordado || '', ayuda: 'Vacío = a confirmar.' })}
      ${campo({ nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', valor: v.prioridad, opciones: [['normal', 'Normal'], ['alta', 'Alta']] })}</div>
      ${campo({ nombre: 'retiroNota', etiqueta: 'Nota sobre el retiro', valor: v.retiro_nota || '' })}
      <button class="btn btn-primario" type="submit">${ic('check')}Guardar cambios</button></form></div></details>`;
}

export default async function visita({ params, app }) {
  const pedidos = [get(`/api/visitas/${params.id}`), get('/api/catalogos'), app.puede('stock.ver') ? get('/api/articulos') : Promise.resolve({ articulos: [] }), app.puede('stock.ver') ? get('/api/proveedores') : Promise.resolve({ proveedores: [] }), app.puede('avisos.preparar') ? get(`/api/avisos?visitaId=${params.id}`) : Promise.resolve({ avisos: [] }), get('/api/usuarios')];
  const [{ visita: v }, cat, { articulos }, { proveedores }, { avisos }, { usuarios }] = await Promise.all(pedidos);
  cat.proveedores = proveedores;
  const dinero = app.puede('ver.dinero');
  if (dinero && app.puede('calculadora.usar')) { const calculo = await get('/api/calculadora?horas=1'); cat.valorHora = calculo.valorHora; }
  cat.articulos = articulos;
  const cerrada = !!(v.entregada_at || v.anulada_at);
  const visibles = SECCIONES.filter(([k]) => k !== 'cobros' || dinero);
  const pedida = visibles.find((s) => s[0] === params.seccion)?.[0];
  const natural = cerrada ? 'resumen' : seccionNatural(v, app);
  const ahora = pedida || natural;
  const sigue = queSigue(v, app);

  // Cada sección se arma con su función de siempre; la de «Ahora» y la abierta en «Toda la orden».
  const actividad = `<details class="desp"><summary>${ic('history')}Actividad de la orden (${v.actividad.length})</summary><div class="desp-c"><ol class="tiempo">${v.actividad.map((a) => `<li><time>${esc(cuando(a.fecha))}</time><span class="li-t"><b>${esc(a.accion)}</b><small>${esc(a.por || '')}${a.detalle ? ' · ' + esc(a.detalle) : ''}</small></span></li>`).join('')}</ol></div></details>`;
  const parteDe = (sec) => {
    let p = null;
    if (sec === 'resumen') p = resumenOrden(v, app);
    else if (sec === 'revision') p = seccionRevision(v, app);
    else if (sec === 'presupuesto') p = seccionPresupuesto(v, app, cat);
    else if (sec === 'trabajo' || sec === 'repuestos') p = seccionTrabajo(v, app, cat, articulos.filter((a) => a.activo), { soloRepuestos: sec === 'repuestos' });
    else if (sec === 'control') p = seccionControl(v, app);
    else if (sec === 'cobros' && dinero) p = seccionCobros(v, app);
    else if (sec === 'archivos') p = seccionArchivos(v, app, avisos);
    else if (sec === 'historial') p = { html: `${vistaEstadoIngreso(v)}<section class="bloque"><h2>Historial y notas del equipo</h2>${app.puede('adjuntos.subir') && !cerrada && (app.sesion.usuario.rol !== 'mecanico' || !v.responsable_id || v.responsable_id === app.sesion.usuario.id) ? `<form class="form" id="f-nota" novalidate>${campo({ nombre: 'texto', etiqueta: 'Nota interna', tipo: 'textarea', requerido: true, attrs: 'maxlength="1000"', ayuda: 'Solo para el equipo del taller. No agrega trabajos, cargos ni autorizaciones.' })}<button class="btn btn-primario" type="submit">Guardar nota</button></form>` : ''}</section>`, enlazar(raiz) { const f = raiz.querySelector('#f-nota'); if (f) alEnviar(f, async (d) => { await post(`/api/visitas/${v.id}/notas`, d, { idempotencia: claveDeEnvio(f) }); delete f.dataset.sucio; toast('Nota guardada en el historial.'); app.recargar(); }); } };
    if (p && ['control', 'archivos'].includes(sec)) p.html = vistaEstadoIngreso(v) + p.html;
    if (p && ['archivos', 'historial'].includes(sec)) p.html += actividad;
    return p;
  };
  const parteAhora = parteDe(ahora);
  // Trabajos y Repuestos comparten formulario: no se muestran los dos a la vez.
  const comparte = (k) => ['trabajo', 'repuestos'].includes(k) && ['trabajo', 'repuestos'].includes(ahora);
  const resto = visibles.filter(([k]) => k !== ahora && !comparte(k));
  const abierta = resto.some(([k]) => k === abiertas.get(v.id)) ? abiertas.get(v.id) : '';

  const e = v.anulada_at ? -1 : v.entregada_at ? 5 : ETAPA[v.situacion.clave] ?? 1;
  const etapaTxt = v.anulada_at ? 'Orden anulada: el recorrido se interrumpió' : v.entregada_at ? 'Entregado: recorrido completo' : `Etapa actual: ${ETAPAS_ORDEN[e]}, ${e + 1} de 5`;
  const auto = [v.vehiculo.marca, v.vehiculo.modelo].filter(Boolean).join(' ') || 'Vehículo sin datos';
  const detalleAuto = [v.vehiculo.version_txt, v.vehiculo.anio].filter(Boolean).join(' · ');
  // «Qué sigue» ya dice el paso: el título solo aparece si la orden está cerrada o se pidió otra sección.
  const tituloAhora = cerrada ? (v.anulada_at ? 'Orden anulada' : 'Orden entregada') : ahora === natural ? '' : SECCIONES.find((s) => s[0] === ahora)[1];
  const icAhora = cerrada ? (v.anulada_at ? 'block' : 'history') : SECCIONES.find((s) => s[0] === ahora)[2];

  return {
    titulo: `${v.vehiculo.patente || 'Sin patente'} · Orden ${v.numero}`,
    html: `<div class="o-grid"><div class="o-izq">
      ${cabecera({ titulo: `Orden N.º ${esc(v.numero)}`, sub: v.tipo === 'service' ? 'Service' : 'Revisión / reparación', volver: app.ultimaLista || '#/trabajos', ayuda: 'guia' })}
      <section class="heroe" aria-label="Vehículo y progreso de la orden">
        <div class="h-id">${logoMarca(v.vehiculo.marca, { grande: true })}${placa(v.vehiculo.patente, { grande: true })}</div>
        <div class="h-mod"><b>${esc(auto)}</b>${detalleAuto ? `<small>${esc(detalleAuto)}</small>` : ''}</div>
        ${contactoCliente(v)}
        <ol class="pasos ${v.anulada_at ? 'anulada' : ''}" aria-label="${esc(etapaTxt)}">${ETAPAS_ORDEN.map((t, i) => { const cls = v.anulada_at ? 'x' : i < e ? 'h' : i === e ? 'a' : '';
          return `<li class="${cls}" ${i === e ? 'aria-current="step"' : ''}><span>${cls === 'h' ? ic('check') : ''}</span><small>${i === 2 ? '<span class="lg">Presupuesto</span><span class="ct">Presup.</span>' : t}</small></li>`; }).join('')}</ol>
        <p class="pasos-actual" aria-hidden="true">${esc(v.anulada_at ? 'Orden anulada' : v.entregada_at ? 'Entregado' : `${ETAPAS_ORDEN[e]} · etapa ${e + 1} de 5`)}</p>
        <div class="t-chips">${v.anulada_at ? `<span class="chip err">${ic('block')}Anulada</span>` : chipSituacion(v.situacion)}${v.prioridad === 'alta' && !cerrada ? `<span class="chip err">${ic('priority_high')}Urgente</span>` : ''}${v.lista_at && !cerrada ? `<span class="chip">${ic('directions_car')}Entrega pendiente</span>` : ''}</div>
        <div class="o-meta"><span class="o-meta-i">${ic('person')}${v.responsable ? esc(v.responsable) : '<span class="sindato">Sin responsable</span>'}</span><span class="o-meta-i">${ic('schedule')}${v.retiro_acordado ? (v.entregada_at ? 'Retiro acordado ' : 'Retiro ') + esc(cuando(v.retiro_acordado)) : '<span class="sindato">Retiro a confirmar</span>'}</span></div>
      </section>
    </div>
    <div class="o-der">
      ${tarjetaSigue(sigue)}
      <section class="ahora" ${tituloAhora ? 'aria-labelledby="ahora-t"' : 'aria-label="Sección de la orden"'}>${tituloAhora ? `<h2 id="ahora-t">${ic(icAhora)}${esc(tituloAhora)}</h2>` : ''}
        ${v.anulada_at ? `<p class="aviso-in err">${ic('block')}<span>Anulada: ${esc(v.anulada_motivo || '')}. Se conserva todo su historial; solo consulta.</span></p>` : v.entregada_at ? `<p class="aviso-in">${ic('task_alt')}<span>Entregado ${esc(cuando(v.entregada_at))}.</span></p>` : ''}
        <div class="ahora-cuerpo"><div class="seccion-orden" data-seccion-cuerpo>${parteAhora ? parteAhora.html : ''}</div></div>
        ${!cerrada && app.puede('adjuntos.subir') ? `<button type="button" class="btn btn-texto" data-registrar>${ic('add')}Registrar otra cosa…</button>` : ''}
      </section>
      ${dinero && ahora !== 'cobros' ? dineroTira(v.totales) : ''}
      <section class="acordeon" aria-labelledby="toda-t"><h2 id="toda-t">Toda la orden</h2>
        ${resto.map(([k, t, i]) => `<details class="ac-i" data-sec="${k}" ${k === abierta ? 'open' : ''}><summary><span class="li-ic">${ic(i)}</span><span class="li-t"><b>${t}</b><small>${esc(resumenDe(v, k, dinero))}</small></span>${ic('expand_more', 'giro')}</summary><div class="ac-c" data-cuerpo></div></details>`).join('')}
      </section>
    </div>
    <div class="o-extra">
      ${planificacion(v, app, usuarios)}
      <ul class="lista-d">
        <li><a class="li-b" href="#/autos/${v.vehiculo.id}"><span class="li-ic">${ic('directions_car')}</span><span class="li-t"><b>Ficha e historial del vehículo</b><small>Visitas anteriores y lecturas</small></span>${ic('chevron_right')}</a></li>
        ${app.puede('avisos.preparar') ? `<li><a class="li-b" href="#/visitas/${v.id}/archivos#t-msj"><span class="li-ic">${ic('sms')}</span><span class="li-t"><b>Preparar mensaje</b><small>Se copia o se abre en WhatsApp; no se envía solo</small></span>${ic('chevron_right')}</a></li>` : ''}
      </ul>
      <details class="desp"><summary>${ic('move_to_inbox')}Datos de ingreso</summary><div class="desp-c"><p><b>Motivo:</b> ${esc(v.motivo)}</p><p class="nota">Ingreso ${esc(fecha(v.ingreso_at))} · ${v.lecturas[0] ? esc(km(v.lecturas[0].km)) : 'Sin lectura'}</p>${v.autorizacion_ingreso ? `<p>${esc(v.autorizacion_ingreso)}</p>` : ''}${v.relacionada ? `<a href="#/visitas/${v.relacionada.id}">Vuelve por la orden N.º ${esc(v.relacionada.numero)}. La garantía la decide el taller.</a>` : ''}${v.relacionadas.map((x) => `<a href="#/visitas/${x.id}">Orden posterior vinculada N.º ${esc(x.numero)}</a>`).join('')}${v.turno ? `<p>Turno ${esc(v.turno.codigo)}</p>` : ''}</div></details>
      ${app.puede('visita.anular') && !cerrada ? `<div><button type="button" class="btn btn-peligro btn-chico" data-anular>${ic('block')}Anular orden</button></div>` : ''}
    </div></div>${capsulaSigue(sigue, v)}`,
    despues(raiz) {
      parteAhora?.enlazar?.(raiz.querySelector('[data-seccion-cuerpo]'));
      enlazarIr(raiz, v, app);
      enlazarSigue(raiz);
      aplicarPendiente();
      // «Toda la orden»: una sección abierta por vez, armada al abrirla con su función real.
      const items = [...raiz.querySelectorAll('.ac-i')];
      const abrir = (det) => {
        const cuerpo = det.querySelector('[data-cuerpo]');
        if (!det.open) { cuerpo.innerHTML = ''; if (abiertas.get(v.id) === det.dataset.sec) abiertas.delete(v.id); return; }
        items.forEach((o) => { if (o !== det && o.open) { o.open = false; o.querySelector('[data-cuerpo]').innerHTML = ''; } });
        abiertas.set(v.id, det.dataset.sec);
        const p = parteDe(det.dataset.sec);
        cuerpo.innerHTML = p ? p.html : '';
        p?.enlazar?.(cuerpo);
        enlazarIr(cuerpo, v, app);
      };
      items.forEach((det) => { det.addEventListener('toggle', () => abrir(det)); if (det.open) abrir(det); });
      raiz.querySelector('[data-registrar]')?.addEventListener('click', () => {
        if (hayCambiosSinGuardar()) { toast('Terminá o cancelá el formulario abierto antes de registrar otra cosa.', { error: true }); return; }
        const origen = raiz.querySelector('[data-registrar]');
        const d = document.createElement('dialog'); d.className = 'dialogo'; d.setAttribute('aria-labelledby', 'registrar-titulo');
        const opciones = [...(app.puede('revision.registrar') ? [['revision', 'Hallazgo de revisión']] : []), ...(app.puede('repuestos.gestionar') ? [['repuestos', 'Repuesto que falta']] : []), ...(app.puede('adjuntos.subir') ? [['historial', 'Nota interna'], ['archivos', 'Foto o archivo']] : [])];
        d.innerHTML = `<div class="dialogo__cuerpo bloque"><h2 id="registrar-titulo">¿Qué querés registrar?</h2>${opciones.map(([sec, t]) => `<a class="btn" href="#/visitas/${v.id}/${sec}">${t}${ic('chevron_right')}</a>`).join('')}<button class="btn btn-texto" type="button">Volver</button></div>`;
        document.body.append(d); d.querySelectorAll('a').forEach((a) => { a.onclick = () => d.close(); }); d.querySelector('button').onclick = () => d.close();
        d.addEventListener('close', () => { d.remove(); if (origen.isConnected) origen.focus(); }, { once: true }); d.showModal();
      });
      const fc = raiz.querySelector('#f-cabecera');
      if (fc) alEnviar(fc, async (d) => { await put(`/api/visitas/${v.id}`, { ...d, responsableId: d.responsableId || null, retiro: d.retiro || null, version: v.version }); toast('Datos de la orden guardados.'); app.recargar(); });
      raiz.querySelector('[data-anular]')?.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Anular la orden', texto: 'La orden queda registrada como anulada y solo se puede consultar. No se borra nada.', efecto: 'No se puede anular si tiene cobros o piezas colocadas.', aceptar: 'Anular la orden', peligro: true, pedir: { etiqueta: 'Motivo de la anulación' } });
        if (!r.ok) return;
        try { await post(`/api/visitas/${v.id}/anular`, { motivo: r.valor }); toast('Orden anulada.'); app.recargar(); } catch (err) { toast(err.message, { error: true }); }
      });
      if (location.hash.includes('#t-msj')) raiz.querySelector('#t-msj')?.scrollIntoView();
    }
  };
}
