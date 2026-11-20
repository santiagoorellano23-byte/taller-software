// Secciones de la visita. Cada una devuelve { html, enlazar(raiz) } y vuelve a dibujar con datos del servidor tras cada acción.
import { api, get, post, put, claveDeEnvio } from '../api.js?v=0.1.0';
import {
  esc, icono, pesos, cant, km, fecha, fechaHora, cuando, chip, chipRespuesta, chipEtapa, ETAPAS, TIPO_LINEA, MEDIOS, UNIDADES, CANALES, campo, opcionesRadio, casilla,
  alEnviar, toast, confirmar, aviso, leerForm, mostrarError, limpiarErrores, aEntradaDinero, aEntradaCant, copiar, numeroEntrada, revisarPago
} from '../ui.js?v=0.1.0';
import { qrSVG } from '../qr-util.js?v=0.1.0';
import {catalogoPresupuesto,enlazarCatalogoPresupuesto} from '../presupuesto-pos.js?v=0.1.0';
import {normalizar} from '../seleccion-rapida.js?v=0.1.0';
import {vistaHallazgos,enlazarHallazgos} from '../hallazgos.js?v=0.1.0';

const resp = (l) => l.respuesta?.respuesta || (l.autorizada_ingreso ? 'autoriza' : null);
const RESULTADOS = [['resuelto', 'Resuelto y comprobado', 'check'], ['mejoro', 'Mejoró, pero falta resolver', 'alerta'], ['no_reproducido', 'No se pudo reproducir el problema', 'info'], ['pendiente', 'Sigue pendiente', 'reloj']];
const RES_TXT = Object.fromEntries(RESULTADOS.map(([k, t]) => [k, t]));
const cerrada = (v) => !!(v.entregada_at || v.anulada_at);
const acc = async (app, fn, ok) => { try { await fn(); if (ok) toast(ok); app.recargar(); } catch (e) { toast(e.message, { error: true }); } };

// ---------------- Revisión ----------------
// Diseño de Revisión: estado en tres partes, hallazgos (se guardan uno por uno) y revisión técnica en cuatro grupos que
// separan relato, hechos, sospecha y conclusión. Las reglas son las del servidor: relato y observaciones (o un hallazgo)
// para guardar, pruebas para concluir, y diagnóstico con confirmación expresa para «Diagnóstico confirmado».
const EST_REV = {
  en_revision: { t: 'Sigue en revisión', c: 'En revisión', d: 'Todavía estás probando. Podés guardar lo que tengas y seguir después.', i: 'pausa', k: 'ambar' },
  sin_falla: { t: 'Sin falla encontrada', c: 'Sin falla', d: 'Se probó y la falla no apareció.', i: 'info', k: 'azul' },
  confirmado: { t: 'Diagnóstico confirmado', c: 'Confirmado', d: 'Las pruebas comprobaron la causa. Escribí qué se confirmó.', i: 'escudo', k: 'verde' }
};
const CAMPOS_REV = ['relato', 'hallazgos', 'hipotesis', 'pruebas', 'estado', 'diagnostico', 'recomendacion'];
// Revisión escrita y sin guardar que se conserva en pantalla cuando se guarda un hallazgo y la orden se vuelve a dibujar.
// Vive solo en memoria: recargar la página o salir de la orden la pierde (la app avisa antes de salir).
const revisionEnPantalla = new Map();

export function seccionRevision(v, app) {
  const r = v.revision;
  const puede = app.puede('revision.registrar') && !cerrada(v) && !v.controles.some((c) => c.vigente) && (app.sesion.usuario.rol !== 'mecanico' || !v.responsable_id || v.responsable_id === app.sesion.usuario.id);
  const pendiente = puede ? revisionEnPantalla.get(v.id) : null;
  revisionEnPantalla.delete(v.id);
  const nH = (v.hallazgos || []).length;
  const val = (k) => pendiente ? pendiente[k] ?? '' : k === 'relato' ? r?.relato || v.motivo || '' : r?.[k] || (k === 'estado' ? 'en_revision' : '');
  const est = val('estado');
  const fila = (cls, ic, rotulo, txt, extra = '', vacio = 'Sin completar') => `<div class="rv-sr ${cls}"><span class="rv-si">${icono(ic)}</span><div class="rv-st"><span class="rv-lbl">${rotulo}${extra}</span><p class="${txt ? '' : 'rv-vac'}">${txt ? esc(txt) : vacio}</p></div></div>`;
  const tile = (id, k, ic, rotulo, valor, sub, cls) => `<button type="button" class="rv-tile ${cls}" data-ir="${id}" data-tile="${k}"><span class="rv-tl-h"><span class="rv-nd">${icono(ic)}</span>${rotulo}</span><b>${valor}</b><small>${sub}</small></button>`;
  const e = r ? EST_REV[r.estado] : null;
  const tiles = `<div class="rv-tiles">${tile('rv-hall', 'h', nH ? 'check' : 'buscar', 'Hallazgos', nH || 'Ninguno', nH ? (nH === 1 ? 'Registrado' : 'Registrados') : 'Opcional', nH ? 'ok' : '')}
    ${tile('rv-tec', 'r', r ? 'check' : 'portapapeles', 'Revisión', r ? `Versión ${r.version_num}` : 'Pendiente', r ? 'Guardada' : 'Sin registrar', r ? 'ok' : '')}
    ${tile('rv-tec', 'e', e ? e.i : 'ayuda', 'Estado', e ? e.c : 'Sin elegir', !e ? 'Al registrar' : r.estado === 'en_revision' ? 'Sigue abierta' : 'Concluida', !e ? '' : r.estado === 'en_revision' ? 'wip' : 'ok')}</div>`;

  const guardada = r ? `<div class="rv-edh"><span class="rv-chip rv-chip-ok">${icono('check')}Guardada · versión ${r.version_num}</span><span class="rv-chip">${icono('reloj')}${esc(cuando(r.creado_at))}${r.por ? ' · ' + esc(r.por) : ''}</span></div>
    <div class="rv-sum">${fila('rv-quote', 'mensaje', 'Lo que cuenta el cliente', r.relato)}${fila('', 'buscar', 'Lo que se observó', r.hallazgos)}${fila('', 'llave', 'Pruebas realizadas', r.pruebas)}</div>
    <div class="rv-sum"><p class="rv-con-h">Conclusión</p>
      <div class="rv-sr"><span class="rv-si">${icono(e.i)}</span><div class="rv-st"><span class="rv-lbl">Estado de la revisión</span><span class="rv-est rv-est-${e.k}"><i>${icono(e.i)}</i>${e.t}</span></div></div>
      ${r.estado === 'confirmado' ? fila('rv-conf', 'escudo', 'Diagnóstico confirmado', r.diagnostico, ' <span class="rv-chip rv-chip-ok">Comprobado</span>') : ''}
      ${r.hipotesis || r.estado === 'confirmado' ? fila('rv-hipo', 'ayuda', r.estado === 'confirmado' ? 'Posible causa · hipótesis previa' : 'Lo que podría ser', r.hipotesis, ' <span class="rv-chip rv-chip-dash">Sin confirmar</span>', 'Sin hipótesis registrada') : ''}
      ${fila('', 'documento', 'Recomendación para el presupuesto', r.recomendacion, r.recomendacion ? ' <span class="rv-chip rv-chip-l">No es una autorización</span>' : '', 'Sin recomendación')}
    </div>` : '';
  const vacia = !r ? `<div class="rv-vacio"><ul class="rv-incluye" aria-label="Qué incluye la revisión">
      <li>${icono('mensaje')}<span>Lo que cuenta el cliente</span></li><li>${icono('buscar')}<span>Lo que se observó</span></li><li>${icono('llave')}<span>Pruebas realizadas</span></li>
      <li>${icono('ayuda')}<span>Posible causa</span></li><li>${icono('escudo')}<span>Estado y diagnóstico</span></li><li>${icono('documento')}<span>Recomendación</span></li></ul>
      ${v.tipo === 'service' ? '<p class="rv-nota">En un service autorizado no hace falta un diagnóstico extenso.</p>' : ''}
      ${puede && !pendiente ? `<button type="button" class="btn btn-primario btn-full" data-editar-rev>${icono('portapapeles')}Registrar la revisión</button>` : !puede ? '<p class="rv-nota">Todavía no se registró la revisión.</p>' : ''}</div>` : '';

  const grupo = (n, titulo, chipHTML, cuerpo, cls = '', id = '') => `<div class="rv-grp ${cls}"${id ? ` id="${id}"` : ''}><div class="rv-grp-h"><span class="rv-grp-n">${n}</span><b>${titulo}</b>${chipHTML}</div>${cuerpo}</div>`;
  const opcion = (k) => `<label class="rv-op"><input type="radio" name="estado" value="${k}"${est === k ? ' checked' : ''} required><span class="rv-op-ic">${icono(EST_REV[k].i)}</span><span class="rv-op-t"><b>${EST_REV[k].t}</b><small>${EST_REV[k].d}</small><span class="rv-op-sel">${icono('check')}Elegido</span></span><span class="rv-op-ind">${icono('check')}</span></label>`;
  const formulario = puede ? `<form class="form rv-form" id="f-revision" novalidate ${pendiente ? '' : 'hidden'}>
      <div class="rv-edh"><span class="rv-chip rv-chip-a">${icono('lapiz')}${r ? `Editando la versión ${r.version_num} · al guardar se crea la ${r.version_num + 1}` : 'Sin guardar todavía'}</span><button type="button" class="btn btn-texto btn-chico" data-cancelar-rev>Cancelar</button></div>
      ${pendiente ? `<p class="rv-aviso rv-aviso-warn" role="status">${icono('alerta')}<span><b>La revisión técnica sigue sin guardar.</b> Se guardó solo el hallazgo. Lo escrito sigue acá: tocá «Guardar revisión» para registrarlo.</span></p>` : ''}
      ${grupo(1, 'Lo que cuenta el cliente', `<span class="rv-chip">${icono('mensaje')}Relato</span>`, campo({ nombre: 'relato', etiqueta: 'Con sus palabras', tipo: 'textarea', requerido: true, valor: val('relato'), ayuda: 'Anotá lo que dice, aunque no coincida con lo que encuentres.', attrs: 'maxlength="4000" rows="2"' }))}
      ${grupo(2, 'Lo que observaste y probaste', `<span class="rv-chip">${icono('buscar')}Hechos</span>`,
        campo({ nombre: 'hallazgos', etiqueta: 'Observaciones generales', tipo: 'textarea', requerido: !nH, valor: val('hallazgos'), ayuda: nH ? 'Los hallazgos de arriba ya se incluyen por separado en el informe; no hace falta repetirlos.' : 'Lo que viste o mediste. Lo puntual podés cargarlo como hallazgo; con un hallazgo, este campo pasa a ser opcional.', attrs: 'maxlength="4000" rows="2"' })
        + campo({ nombre: 'pruebas', etiqueta: 'Pruebas realizadas', tipo: 'textarea', valor: val('pruebas'), ayuda: 'Solo las pruebas que hiciste, con su resultado. Hacen falta para concluir la revisión.', attrs: 'maxlength="4000" rows="2"' }))}
      ${grupo(3, 'Lo que podría ser', `<span class="rv-chip rv-chip-dash">${icono('ayuda')}Sin confirmar</span>`, campo({ nombre: 'hipotesis', etiqueta: 'Posible causa', tipo: 'textarea', valor: val('hipotesis'), ayuda: '<span data-ayuda-hip>Una sospecha que todavía no comprobaste. Se guarda marcada como no confirmada.</span>', attrs: 'maxlength="4000" rows="2"' }), 'rv-hip')}
      ${grupo(4, 'Conclusión', '', `<fieldset class="rv-ops" data-campo="estado"><legend>¿Cómo está la revisión?</legend>${Object.keys(EST_REV).map(opcion).join('')}</fieldset>
        <div class="rv-diag" data-diag ${est === 'confirmado' ? '' : 'hidden'}>
          ${campo({ nombre: 'diagnostico', etiqueta: 'Diagnóstico confirmado', tipo: 'textarea', requerido: true, valor: val('diagnostico'), ayuda: 'Qué quedó comprobado y con qué prueba. No es lo mismo que «Posible causa», que se guarda como hipótesis.', attrs: 'maxlength="4000" rows="2"', placeholder: 'Ej.: Batería agotada, no retiene carga' })}
          <button type="button" class="btn btn-texto btn-chico" data-copiar-hip hidden>${icono('copiar')}Partir del texto de «Posible causa»</button>
          ${casilla('confirma', 'Confirmo que lo comprobé con las pruebas registradas', !!pendiente?.confirma)}
        </div>
        <div class="rv-aviso rv-aviso-warn" data-sobra role="note" hidden>${icono('alerta')}<span><b>Hay un diagnóstico confirmado escrito</b>Con el estado elegido no se guarda como confirmado. El texto se conserva hasta que decidas.
          <q class="rv-lo" data-sobra-txt></q><span class="rv-lo-a"><button type="button" class="btn btn-texto btn-chico" data-sobra-a="volver">Volver a «Diagnóstico confirmado»</button><button type="button" class="btn btn-texto btn-chico" data-sobra-a="hip">Pasarlo a «Posible causa»</button><button type="button" class="btn btn-texto btn-chico" data-sobra-a="borrar">Borrar el texto</button></span></span></div>
        <div class="rv-req" data-req></div>
        ${campo({ nombre: 'recomendacion', etiqueta: 'Recomendación para el presupuesto', tipo: 'textarea', valor: val('recomendacion'), ayuda: 'Una sugerencia para armar el presupuesto. No es un presupuesto ni una autorización del cliente.', attrs: 'maxlength="4000" rows="2"' })}`, '', 'rv-con')}
      <p class="rv-saves">${icono('info')}<span>«Guardar revisión» guarda los cuatro grupos, no los hallazgos, y crea una versión nueva. Lo que no guardes se pierde al recargar o salir de la orden; la app avisa antes de salir.</span></p>
      <div class="rv-dock" role="region" aria-label="Guardar la revisión técnica"><span class="rv-dock-t"><b><i class="rv-dot" data-dock-dot></i><span data-dock-t aria-live="polite"></span></b><small data-dock-s></small></span>
        <button type="button" class="btn" data-verificar-rev hidden>${icono('buscar')}Verificar</button><button type="submit" class="btn btn-primario" data-guardar-rev>${icono('check')}<span data-guardar-txt>Guardar</span></button></div>
    </form>` : '';

  return {
    html: `${tiles}${vistaHallazgos(v, app, puede)}<section class="rv-sec" id="rv-tec" aria-labelledby="t-rev">
      <div class="rv-sec-h"><span class="rv-sec-ic">${icono('llave')}</span><div><h2 class="rv-h2" id="t-rev">Revisión técnica</h2><p class="rv-sub">${r || pendiente ? 'Separá lo que dice el cliente, lo que comprobaste y lo que todavía es una sospecha.' : 'Todavía no se registró la revisión.'}</p></div></div>
      ${v.autorizacion_ingreso ? aviso(esc(v.autorizacion_ingreso), 'gris', 'escudo') : ''}
      <div data-rev-vista ${pendiente ? 'hidden' : ''}>${guardada}${vacia}
        ${r && puede ? `<button type="button" class="btn rv-editar" data-editar-rev>${icono('lapiz')}Editar revisión (crea la versión ${r.version_num + 1})</button>` : ''}</div>
      ${formulario}
      ${v.revisionesAnteriores.length ? `<details class="mas"><summary>Versiones anteriores (${v.revisionesAnteriores.length})</summary><div class="mas__cuerpo">${v.revisionesAnteriores.slice().reverse().map((x) => `<div class="bloque"><p><strong>Versión ${x.version_num}</strong> · ${esc(x.por || '')} · ${esc(fechaHora(x.creado_at))} · ${esc(EST_REV[x.estado].t)}</p><p class="small">${esc(x.hallazgos)}</p>${x.diagnostico ? `<p class="small">Diagnóstico: ${esc(x.diagnostico)}</p>` : ''}${x.hipotesis ? `<p class="small">Posible causa (sin confirmar): ${esc(x.hipotesis)}</p>` : ''}</div>`).join('')}</div></details>` : ''}
      <p class="rv-nota">${icono('escudo', 'i-sm')}Registrar la revisión no autoriza trabajos ni cambia el presupuesto.</p>
    </section>`,
    enlazar(raiz) {
      raiz.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => {
        const destino = raiz.querySelector('#' + b.dataset.ir);
        destino?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }));
      const f = raiz.querySelector('#f-revision');
      const sucia = () => !!f?.dataset.sucio;
      enlazarHallazgos(raiz, v, app, {
        revisionPendiente: sucia,
        antesDeRecargar: () => { if (sucia()) revisionEnPantalla.set(v.id, leerForm(f)); }
      });
      if (!f) return;
      const vista = raiz.querySelector('[data-rev-vista]');
      const el = (n) => f.elements[n];
      const inicial = JSON.stringify(CAMPOS_REV.map((k) => k === 'estado' ? est : val(k)));
      let guardando = false, incierto = false, error = false;
      const leer = () => leerForm(f);
      const tileRev = raiz.querySelector('[data-tile="r"]'), tileEst = raiz.querySelector('[data-tile="e"]');
      const ponerTile = (t, b, s, cls) => { if (!t) return; t.className = `rv-tile ${cls}`; t.querySelector('b').textContent = b; t.querySelector('small').textContent = s; };
      const actualizar = () => {
        const d = leer(), e = d.estado || 'en_revision', has = (k) => !!String(d[k] || '').trim();
        const cambio = JSON.stringify(CAMPOS_REV.map((k) => d[k] ?? '')) !== inicial || !!pendiente;
        if (cambio) f.dataset.sucio = '1'; else delete f.dataset.sucio;
        f.querySelector('[data-diag]').hidden = e !== 'confirmado';
        f.querySelector('[data-copiar-hip]').hidden = has('diagnostico') || !has('hipotesis');
        const sobra = e !== 'confirmado' && has('diagnostico');
        f.querySelector('[data-sobra]').hidden = !sobra;
        f.querySelector('[data-sobra-txt]').textContent = sobra ? d.diagnostico.trim().slice(0, 160) + (d.diagnostico.trim().length > 160 ? '…' : '') : '';
        f.querySelector('[data-ayuda-hip]').textContent = e === 'confirmado' ? 'Queda como hipótesis previa, aunque el estado sea «Diagnóstico confirmado». Lo comprobado va en «Diagnóstico confirmado».' : 'Una sospecha que todavía no comprobaste. Se guarda marcada como no confirmada.';
        f.querySelectorAll('.rv-op').forEach((o) => o.classList.toggle('sel', o.querySelector('input').checked));
        // Lo que pide el servidor para guardar con el estado elegido.
        const li = (ok, txt, sub) => `<li class="${ok ? 'ok' : 'nd'}">${icono(ok ? 'check' : 'pausa')}<span>${txt}<small>${sub}</small></span></li>`;
        const base = [[has('relato'), 'Relato del cliente', has('relato') ? 'Registrado' : 'Hace falta para guardar'], [has('hallazgos') || nH > 0, 'Observaciones', has('hallazgos') ? 'Registradas' : nH ? `Con ${nH} hallazgo${nH === 1 ? '' : 's'} alcanza` : 'Hacen falta para guardar, o un hallazgo']];
        let titulo, items, pie;
        if (e === 'en_revision') {
          const it = [...base, [has('pruebas'), 'Pruebas realizadas', has('pruebas') ? 'Registradas' : 'Sin completar'], [has('hipotesis'), 'Posible causa', has('hipotesis') ? 'Registrada' : 'Sin completar'], [has('recomendacion'), 'Recomendación', has('recomendacion') ? 'Registrada' : 'Sin completar']];
          titulo = `Registrado hasta ahora · ${it.filter((x) => x[0]).length} de ${it.length}`; items = it;
          pie = 'Con «Sigue en revisión» podés guardar con lo que tengas. Para cerrar la revisión, elegí «Sin falla encontrada» o «Diagnóstico confirmado»: el sistema pide las pruebas realizadas.';
        } else {
          titulo = `Para concluir con «${EST_REV[e].t}»`;
          items = [...base, [has('pruebas'), 'Pruebas realizadas', has('pruebas') ? 'Registradas' : 'Requeridas para concluir']];
          if (e === 'confirmado') items.push([has('diagnostico'), 'Diagnóstico confirmado', has('diagnostico') ? 'Escrito' : 'Requerido: qué se comprobó'], [!!d.confirma, 'Confirmación', d.confirma ? 'Marcada' : 'Requerida: comprobado con las pruebas']);
          pie = 'Son las reglas del sistema: sin esos datos no se guarda y no se pierde nada de lo escrito.';
        }
        f.querySelector('[data-req]').innerHTML = `<b>${titulo}</b><ul class="rv-req2">${items.map(([ok, t, s]) => li(ok, t, s)).join('')}</ul><p class="rv-pend">${icono('info', 'i-sm')}<span>${pie}</span></p>`;
        // Barra de guardado y tarjetas de estado.
        const dot = f.querySelector('[data-dock-dot]'), t = f.querySelector('[data-dock-t]'), s = f.querySelector('[data-dock-s]'), btn = f.querySelector('[data-guardar-rev]'), verif = f.querySelector('[data-verificar-rev]');
        verif.hidden = !incierto || guardando;
        btn.disabled = guardando || (!cambio && !!r && !error && !incierto);
        f.querySelector('[data-guardar-txt]').textContent = guardando ? 'Guardando…' : incierto || error ? 'Reintentar' : 'Guardar';
        const [cd, ct, cs] = guardando ? ['', 'Guardando la revisión…', 'Esperá la confirmación del servidor']
          : incierto ? ['a', 'No sabemos si se guardó', 'Verificá, o reintentá sin cambiar los datos: se comprueba para no duplicarla']
          : error ? ['r', 'La revisión no se guardó', 'Lo escrito sigue en pantalla']
          : !cambio && r ? ['g', `Sin cambios desde la versión ${r.version_num}`, 'Cambiá algo para guardar una versión nueva']
          : cambio ? ['a', 'Revisión sin guardar', 'No incluye los hallazgos'] : ['', 'Revisión sin registrar', 'No incluye los hallazgos'];
        dot.className = `rv-dot ${cd}`; t.textContent = ct; s.textContent = cs;
        if (cambio) ponerTile(tileRev, 'Sin guardar', 'Hay cambios', 'wip');
        else ponerTile(tileRev, r ? `Versión ${r.version_num}` : 'Pendiente', r ? 'Guardada' : 'Sin registrar', r ? 'ok' : '');
        if (cambio) ponerTile(tileEst, EST_REV[e].c, 'Sin guardar', 'wip');
      };
      const mostrarForm = () => { vista.hidden = true; f.hidden = false; actualizar(); el('relato').focus(); };
      raiz.querySelectorAll('[data-editar-rev]').forEach((b) => b.addEventListener('click', mostrarForm));
      f.querySelector('[data-cancelar-rev]').addEventListener('click', async () => {
        if (f.dataset.sucio) {
          const ok = (await confirmar({ titulo: '¿Descartar los cambios de la revisión?', texto: 'Lo que escribiste en la revisión técnica todavía no se guardó.', efecto: r ? `La versión ${r.version_num} guardada no cambia.` : 'No se registra nada.', aceptar: 'Descartar cambios', peligro: true })).ok;
          if (!ok) return;
        }
        delete f.dataset.sucio;
        app.recargar();
      });
      f.querySelector('[data-copiar-hip]').addEventListener('click', () => { el('diagnostico').value = el('hipotesis').value; actualizar(); el('diagnostico').focus(); });
      f.querySelectorAll('[data-sobra-a]').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.sobraA, txt = el('diagnostico').value.trim();
        if (a === 'volver') f.querySelector('input[name="estado"][value="confirmado"]').checked = true;
        if (a === 'hip') { el('hipotesis').value = [el('hipotesis').value.trim(), txt].filter(Boolean).join('\n'); el('diagnostico').value = ''; }
        if (a === 'borrar') el('diagnostico').value = '';
        actualizar();
        (a === 'volver' ? el('diagnostico') : a === 'hip' ? el('hipotesis') : f.querySelector('input[name="estado"]:checked'))?.focus();
      }));
      f.addEventListener('input', () => { if (error) error = false; actualizar(); });
      f.addEventListener('change', actualizar);
      const listo = (repetido, version) => {
        delete f.dataset.sucio;
        toast(repetido ? `La revisión ya estaba guardada${version ? ` (versión ${version})` : ''}. No se registró dos veces.` : `Revisión guardada como versión ${(r?.version_num || 0) + 1}. Los hallazgos se guardan aparte.`);
        app.recargar();
      };
      // Después de un resultado incierto: consulta la orden y compara con la versión que se estaba editando.
      f.querySelector('[data-verificar-rev]').addEventListener('click', async () => {
        guardando = true; actualizar();
        try {
          const actual = (await get(`/api/visitas/${v.id}`)).visita.revision;
          guardando = false;
          if (actual && actual.version_num > (r?.version_num || 0)) return listo(true, actual.version_num);
          incierto = false; error = true;
          mostrarError(f, new Error('La revisión no figura como guardada. Lo escrito sigue en pantalla: podés reintentar.'));
        } catch (err) { guardando = false; mostrarError(f, err); }
        actualizar();
      });
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (guardando) return;
        const d = leer();
        limpiarErrores(f);
        try {
          if ((d.estado || 'en_revision') !== 'confirmado' && d.diagnostico.trim()) throw Object.assign(new Error('Hay un diagnóstico confirmado escrito, pero el estado elegido no es «Diagnóstico confirmado». Decidí qué hacer con ese texto antes de guardar.'), { campo: 'estado' });
          guardando = true; error = false; actualizar();
          const res = await post(`/api/visitas/${v.id}/revision`, { ...d, versionActual: r?.version_num || 0 }, { idempotencia: claveDeEnvio(f) });
          guardando = false;
          listo(!!res.repetido);
        } catch (err) {
          guardando = false;
          incierto = !!err.datos?.guardadoSinConfirmar;
          error = !incierto;
          // Un dato rechazado no deja nada guardado: con los datos corregidos se envía como operación nueva.
          if (error) delete f.dataset.clave;
          mostrarError(f, err);
          actualizar();
        }
      });
      actualizar();
    }
  };
}

// ---------------- Presupuesto ----------------
function formLinea(i, l = {}) {
  return `<div class="linea-form" data-linea ${l.clave?`data-catalogo="${esc(l.clave)}"`:''}>
    ${campo({ nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', valor: l.tipo || (i === 0 ? 'repuesto' : 'mano_obra'), opciones: Object.entries(TIPO_LINEA).filter(([k]) => k !== 'revision') })}
    ${campo({ nombre: 'descripcion', etiqueta: 'Detalle', valor: l.descripcion || '', requerido: true, attrs: 'list="dl-trabajos"' })}
    ${campo({ nombre: 'cantidad', etiqueta: 'Cantidad', valor: l.cantidad || '1', attrs: 'inputmode="decimal"' })}
    ${campo({ nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', valor: l.unidad || 'u.', opciones: UNIDADES })}
    ${campo({ nombre: 'precio', etiqueta: 'Precio unitario', valor: l.precio ?? '', requerido: true, attrs: 'inputmode="decimal"', placeholder: '$' })}
    <output data-subtotal aria-label="Subtotal de la línea">$0</output><button type="button" class="btn btn-chico btn-texto" data-quitar aria-label="Quitar esta línea">${icono('x')}Quitar</button>
  </div>`;
}

// Diseño B: resumen con barra de estados, líneas desplegables, aviso de lo que falta responder y hoja inferior para
// registrar la respuesta. Lo elegido en la hoja es un borrador hasta que el servidor lo confirma; cerrar la hoja lo
// conserva y salir de la pantalla pide confirmación. Importes, totales y reglas vienen del servidor.
const RESP_B = { autoriza: ['Autorizado', 'ok', 'check'], rechaza: ['No autorizado', 'no', 'ban'], posterga: ['Para más adelante', 'luego', 'pausa'] };
const OPC_B = { autoriza: ['Autoriza', 'check'], rechaza: ['No autoriza', 'ban'], posterga: ['Para más adelante', 'pausa'] };
const CANALES_B = [['telefono', 'Teléfono'], ['whatsapp', 'WhatsApp'], ['presencial', 'En persona'], ['correo', 'Correo'], ['otro', 'Otro']];
const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
// Aviso del último guardado confirmado por el servidor: se muestra una vez al volver a dibujar la orden.
const ultimaRespuesta = new Map();

function estadoLinea(l) {
  if (l.estado === 'reemplazada') return { txt: 'Reemplazada por un cambio', cls: 'gris', ic: 'historial' };
  if (l.estado !== 'vigente') return { txt: 'Cambio rechazado: no rige', cls: 'gris', ic: 'ban' };
  const r = resp(l);
  if (!r) return { txt: l.origen_linea_id ? 'Cambio sin respuesta' : 'Sin respuesta', cls: 'pend', ic: 'reloj' };
  const [txt, cls, ic] = RESP_B[r];
  return { txt: txt + (l.realizado_at ? ' · Realizado' : r === 'autoriza' ? ' · Por hacer' : ''), cls, ic };
}

export function seccionPresupuesto(v, app, cat) {
  const dinero = app.puede('ver.dinero');
  const p = v.presupuesto;
  const lineas = p?.lineas || [];
  const vigentes = lineas.filter((l) => l.estado === 'vigente');
  const otras = lineas.filter((l) => l.estado !== 'vigente');
  const sinResp = vigentes.filter((l) => !resp(l));
  const respondidas = vigentes.filter((l) => resp(l));
  const conResp = vigentes.filter((l) => l.respuesta && !l.realizado_at);
  const puedePrep = app.puede('presupuesto.preparar') && !cerrada(v);
  const puedeResp = app.puede('presupuesto.respuesta') && !cerrada(v);
  const t = v.totales;
  const vActual = p ? p.versiones.at(-1) : null;
  const vSig = (vActual?.numero || 0) + 1;
  const monto = (c) => c === 0 ? 'Sin cargo' : pesos(c);
  const ok = ultimaRespuesta.get(v.id);
  // Lo que propuso la revisión, como referencia para armar el presupuesto: no se agrega solo ni autoriza nada.
  const propuestas = [...(v.revision?.recomendacion ? [['Recomendación de la revisión', v.revision.recomendacion]] : []), ...(v.hallazgos || []).filter((h) => h.propuesta).map((h) => [`Hallazgo: ${h.observacion}`, h.propuesta])];
  const referencia = propuestas.length ? `<details class="mas pb-ref"><summary>Lo que propuso la revisión (${propuestas.length})</summary><div class="mas__cuerpo"><ul class="pb-ver-l">${propuestas.map(([de, txt]) => `<li><span class="pb-n">${esc(txt)}<small class="pb-nota">${esc(de)}</small></span></li>`).join('')}</ul><p class="pb-nota">Es una referencia: para presupuestarlo, cargalo como línea. El cliente lo responde después.</p></div></details>` : '';
  ultimaRespuesta.delete(v.id);

  const porTexto = (l) => [
    l.respuesta ? `Respondió ${esc(l.respuesta.persona)} (${esc(CANALES[l.respuesta.canal] || l.respuesta.canal)}) · ${esc(cuando(l.respuesta.fecha_respuesta))}` : l.autorizada_ingreso ? 'Autorizado al recibir el auto.' : l.estado === 'vigente' ? 'Todavía sin respuesta del cliente.' : '',
    l.respuestasAnteriores?.length ? 'La respuesta se corrigió; la anterior queda en las versiones.' : '',
    l.realizado_at ? `Realizado${l.realizado_por_nombre ? ' por ' + esc(l.realizado_por_nombre) : ''} · ${esc(cuando(l.realizado_at))}.` : ''
  ].filter(Boolean).join(' ');
  const filaHTML = (l) => {
    const e = estadoLinea(l);
    const reemplazo = lineas.find((x) => x.origen_linea_id === l.id && x.estado === 'vigente');
    const origen = l.origen_linea_id ? lineas.find((x) => x.id === l.origen_linea_id) : null;
    const cambiable = l.estado === 'vigente' && puedePrep && !l.realizado_at && !l.cargo_id && !reemplazo;
    return `<li class="pb-l" data-linea-id="${l.id}">
      <button type="button" class="pb-fila" aria-expanded="false" aria-controls="pb-d-${l.id}" data-desplegar>
        <span class="pb-ic pb-c-${e.cls}" data-ic-linea>${icono(e.ic)}</span>
        <span class="pb-tx"><span class="pb-n">${esc(l.descripcion)}</span><span class="pb-st pb-t-${e.cls}" data-estado-linea>${esc(e.txt)}</span></span>
        ${dinero ? `<span class="pb-imp num${l.importe === 0 ? ' pb-sincargo' : ''}">${monto(l.importe)}</span>` : ''}
        <span class="pb-chev">${icono('abajo')}</span>
      </button>
      <div class="pb-det" id="pb-d-${l.id}" hidden>
        <dl class="pb-kv"><div><dt>Tipo</dt><dd>${esc(TIPO_LINEA[l.tipo])}</dd></div><div><dt>Cantidad</dt><dd>${esc(cant(l.cantidad_m, l.unidad))}</dd></div>
          ${dinero ? `<div><dt>Precio unitario</dt><dd>${monto(l.precio_unit)}</dd></div>` : ''}<div><dt>Versión</dt><dd>${l.version_num}</dd></div></dl>
        <p class="pb-nota">${porTexto(l)}</p>
        ${origen ? `<p class="pb-nota">Cambio sobre «${esc(origen.descripcion)}»${dinero ? ` (antes ${monto(origen.importe)})` : ''}.${resp(origen) === 'autoriza' ? ' La autorización anterior se conserva mientras el cliente responde.' : ''}</p>` : ''}
        ${l.respuesta?.nota ? `<p class="pb-nota">Nota: ${esc(l.respuesta.nota)}</p>` : ''}
        ${cambiable ? `<button type="button" class="btn btn-chico" data-cambiar="${l.id}">${icono('lapiz', 'i-sm')}Cambiar esta línea</button>` : ''}
        <div class="pb-cambio" data-form-cambio="${l.id}" hidden></div>
      </div>
    </li>`;
  };

  // Resumen: los cuatro importes son los del servidor; la barra solo reparte esos mismos valores.
  const aut = vigentes.filter((l) => resp(l) === 'autoriza');
  const hechos = aut.filter((l) => l.realizado_at).length;
  const nRes = (r) => vigentes.filter((l) => resp(l) === r).length;
  const tiles = [
    ['ok', 'Autorizado', t?.autorizado, aut.length, aut.length ? `${pl(aut.length, 'trabajo', 'trabajos')} · ${hechos} hecho${hechos === 1 ? '' : 's'} · ${aut.length - hechos} por hacer` : 'Nada autorizado todavía'],
    ['pend', 'Sin respuesta', t?.sinRespuesta, sinResp.length, sinResp.length ? `${pl(sinResp.length, 'trabajo', 'trabajos')} · falta que responda` : 'Nada pendiente'],
    ['no', 'No autorizado', t?.rechazado, nRes('rechaza'), pl(nRes('rechaza'), 'trabajo', 'trabajos')],
    ['luego', 'Para más adelante', t?.postergado, nRes('posterga'), nRes('posterga') ? `${pl(nRes('posterga'), 'trabajo', 'trabajos')} · no se cobra` : '0 trabajos']
  ];
  const partes = tiles.map(([k, , imp, n]) => [k, dinero ? imp || 0 : n]).filter(([, x]) => x > 0);
  const resumen = !vigentes.length ? '' : `<div class="pb-sum">
      <div class="pb-total">${dinero ? `<div><span class="pb-lbl">Total presupuestado</span><b class="pb-big num">${pesos(t.presupuestado)}</b></div>` : '<span class="pb-lbl">Estado de las líneas vigentes</span>'}<span class="pb-chip">${pl(vigentes.length, 'línea', 'líneas')}</span></div>
      ${partes.length ? `<div class="pb-barra" aria-hidden="true">${partes.map(([k, x]) => `<span class="pb-s-${k}" style="flex:${x}"></span>`).join('')}</div>` : ''}
      <div class="pb-tiles">${tiles.map(([k, rotulo, imp, n, txt]) => `<div class="pb-tile${n ? '' : ' cero'}${k === 'pend' && n ? ' atento' : ''}"><span class="pb-lg"><span class="pb-dot pb-s-${k}"></span>${rotulo}</span>
        <b class="num">${dinero ? pesos(imp || 0) : pl(n, 'trabajo', 'trabajos')}</b><small>${dinero ? txt : k === 'ok' && n ? `${hechos} hecho${hechos === 1 ? '' : 's'} · ${aut.length - hechos} por hacer` : ''}</small></div>`).join('')}</div>
      ${dinero && t.cambiosPendientes ? `<p class="pb-nota">${icono('info', 'i-sm')}Mientras un cambio espera respuesta, lo autorizado antes sigue contando como autorizado.</p>` : ''}
    </div>`;

  // Versiones: cada una muestra lo que agregó o cambió, el estado actual de esas líneas y las respuestas registradas.
  const versionesHTML = !p ? '' : p.versiones.slice().reverse().map((x) => {
    const propias = lineas.filter((l) => l.version_num === x.numero);
    const eventos = new Map();
    for (const l of propias) for (const r of [...(l.respuestasAnteriores || []), l.respuesta].filter(Boolean)) {
      const k = [r.fecha_respuesta, r.persona, r.canal, r.cargado_por].join('|');
      if (!eventos.has(k)) eventos.set(k, { r, items: [], notas: new Set() });
      eventos.get(k).items.push(`${l.descripcion}: ${OPC_B[r.respuesta][0].toLowerCase()}`);
      if (r.nota) eventos.get(k).notas.add(r.nota);
    }
    const alRecibir = propias.filter((l) => l.autorizada_ingreso);
    const cambios = (() => { try { return JSON.parse(x.cambios || 'null') || []; } catch { return []; } })();
    return `<section class="pb-ver${x === vActual ? ' actual' : ''}" aria-labelledby="pb-ver-${x.numero}">
      <div class="pb-ver-h"><span><b id="pb-ver-${x.numero}">Versión ${x.numero}</b><span class="pb-chip${x === vActual ? ' pb-vig' : ''}">${x === vActual ? 'Vigente' : 'Anterior'}</span></span>${dinero ? `<span class="pb-nota">Agregado: <b class="num">${pesos(propias.reduce((s, l) => s + l.importe, 0))}</b></span>` : ''}</div>
      <p class="pb-nota">${esc(fechaHora(x.creado_at))}${x.por ? ' · ' + esc(x.por) : ''}${x.nota ? ' · ' + esc(x.nota) : ''} · válida hasta ${esc(fecha(x.validez_hasta))}</p>
      ${cambios.length ? `<p class="pb-nota">${cambios.map(esc).join('; ')}</p>` : ''}
      <ul class="pb-ver-l">${propias.map((l) => { const e = estadoLinea(l); return `<li><span class="pb-n">${esc(l.descripcion)}</span><span class="pb-ver-a">${dinero ? `<span class="num">${monto(l.importe)}</span>` : ''}<span class="pb-st pb-t-${e.cls}">${esc(e.txt)}</span></span></li>`; }).join('')}</ul>
      <span class="pb-lbl">Respuestas registradas</span>
      ${alRecibir.length ? `<div class="pb-ev"><b>Autorizado al recibir el auto</b><span>${alRecibir.map((l) => esc(l.descripcion)).join('; ')}</span></div>` : ''}
      ${[...eventos.values()].map(({ r, items, notas }) => `<div class="pb-ev"><b>${esc(r.persona)} · ${esc(CANALES[r.canal] || r.canal)} · ${esc(cuando(r.fecha_respuesta))}</b><span>${items.map(esc).join('; ')}</span>${[...notas].map((n) => `<i>«${esc(n)}»</i>`).join('')}${r.cargado_por_nombre ? `<small>Lo registró ${esc(r.cargado_por_nombre)}</small>` : ''}</div>`).join('')}
      ${!eventos.size && !alRecibir.length ? '<p class="pb-nota">Todavía no hay respuestas en esta versión.</p>' : ''}
    </section>`;
  }).join('');

  const hoja = puedeResp && sinResp.length ? `<dialog class="hoja-dlg pb-hoja" data-hoja-respuesta aria-labelledby="pb-hoja-t">
      <form class="pb-form" id="f-respuesta" novalidate>
        <header class="pb-hoja-cab"><button type="button" class="btn btn-texto pb-volver" data-cerrar-hoja>${icono('izq')}Volver al presupuesto</button><span class="pb-chip borrador" data-borr-chip hidden></span></header>
        <div class="hoja-c pb-hoja-c">
          <div><h2 id="pb-hoja-t" tabindex="-1">Registrar respuesta del cliente</h2><p class="pb-nota">Orden N.º ${esc(v.numero)} · ${esc(v.vehiculo?.patente || 'Sin patente')} · presupuesto versión ${vActual.numero}</p></div>
          <div class="pb-lh"><h3>Sin respuesta (${sinResp.length})</h3><span>Elegí solo lo que respondió</span></div>
          ${sinResp.map((l) => {
            const origen = l.origen_linea_id ? lineas.find((x) => x.id === l.origen_linea_id) : null;
            const ops = ['autoriza', 'rechaza', ...(l.origen_linea_id ? [] : ['posterga'])];
            return `<fieldset class="pb-pcard" data-campo="r-${l.id}"><legend class="sr">Respuesta del cliente para ${esc(l.descripcion)}</legend>
              <div class="pb-pcard-top"><div><p class="pb-n">${esc(l.descripcion)}</p><p class="pb-nota">${esc(TIPO_LINEA[l.tipo])} · ${esc(cant(l.cantidad_m, l.unidad))}${dinero ? ' × ' + monto(l.precio_unit) : ''} · versión ${l.version_num}</p></div>${dinero ? `<span class="pb-imp num${l.importe === 0 ? ' pb-sincargo' : ''}">${monto(l.importe)}</span>` : ''}</div>
              ${origen ? `<p class="pb-nota">${icono('info', 'i-sm')}Cambio sobre «${esc(origen.descripcion)}»${dinero ? ` (antes ${monto(origen.importe)})` : ''}. Se autoriza o se rechaza; si se rechaza, vuelve a regir la línea anterior.</p>` : ''}
              <div class="pb-r3${ops.length === 2 ? ' dos' : ''}">${ops.map((k) => `<label class="pb-op pb-op-${k}"><input type="radio" name="r-${l.id}" value="${k}"><span class="pb-op-i">${icono(OPC_B[k][1])}</span><span>${OPC_B[k][0]}</span></label>`).join('')}</div>
            </fieldset>`;
          }).join('')}
          ${respondidas.length ? `<details class="pb-ya"><summary>Ver lo ya respondido (${respondidas.length})</summary><ul class="pb-ver-l">${respondidas.map((l) => { const e = estadoLinea(l); return `<li><span class="pb-n">${esc(l.descripcion)}</span><span class="pb-st pb-t-${e.cls}">${esc(e.txt)}</span></li>`; }).join('')}</ul></details>` : ''}
          <div class="pb-datos"><h3>Quién y cómo respondió</h3>
            ${campo({ nombre: 'persona', etiqueta: '¿Quién respondió?', requerido: true, placeholder: 'Nombre de quien respondió', ayuda: 'Confirmá o escribí quién respondió. Puede ser otra persona.', attrs: 'maxlength="120" autocomplete="off"' })}
            ${v.contacto_nombre ? `<button type="button" class="pb-sug" data-sugerir>Usar «${esc(v.contacto_nombre)}» · cliente de la orden</button>` : ''}
            <fieldset class="grupo pb-canales" data-campo="canal"><legend>¿Por dónde respondió?</legend><div class="pb-pills">${CANALES_B.map(([k, tx]) => `<label class="pb-pill"><input type="radio" name="canal" value="${k}"><span>${tx}</span></label>`).join('')}</div></fieldset>
            ${campo({ nombre: 'fecha', etiqueta: 'Cuándo', tipo: 'datetime-local', ayuda: 'Vacío = el sistema registra el momento del guardado.' })}
            ${campo({ nombre: 'nota', etiqueta: 'Nota', tipo: 'textarea', placeholder: 'Por ejemplo, por qué lo deja para después', ayuda: 'Se guarda en cada línea que respondas ahora.', attrs: 'maxlength="500" rows="2"' })}
          </div>
          <section class="pb-antes" aria-labelledby="pb-antes-t"><h3 id="pb-antes-t">Antes de guardar</h3><ul class="pb-ver-l" data-resumen-sel hidden></ul><p class="pb-nota" data-quedan>Todavía no elegiste ninguna respuesta.</p>
            <p class="pb-nota"><b>Autorizar no significa que el trabajo esté realizado.</b> Queda «Por hacer» hasta que se registre en Trabajos.</p></section>
        </div>
        <footer class="pb-pie"><div data-pie-aviso></div><p class="pb-pie-linea" role="status" aria-live="polite" data-pie-linea>Ninguna respuesta elegida todavía.</p>
          <div class="pb-pie-acc"><button type="button" class="btn" data-descartar hidden>Descartar</button><button type="submit" class="btn btn-primario" data-guardar>Guardar respuesta</button></div></footer>
      </form>
    </dialog>` : '';

  return {
    html: `<section class="bloque pb" aria-labelledby="t-pre">
      <div class="pb-cab"><h2 id="t-pre">Presupuesto y respuesta del cliente</h2>
        <div class="pb-vrow">${p ? `<button type="button" class="pb-vbtn" data-ver-versiones aria-haspopup="dialog" aria-label="Ver versiones del presupuesto. Vigente: versión ${vActual.numero}"><span class="pb-chip pb-vig">Versión ${vActual.numero} · vigente${icono('der', 'i-sm')}</span></button><span class="pb-nota">Hasta ${esc(fecha(vActual.validez_hasta))}</span>` : '<span class="pb-chip">Sin presupuesto</span>'}
          ${puedeResp && sinResp.length && vigentes.length >= 4 ? `<button type="button" class="pb-sec" data-responder aria-haspopup="dialog"><span data-responder-txt>Responder (${sinResp.length})</span>${icono('der', 'i-sm')}</button>` : ''}</div></div>
      ${!vigentes.length ? `<div class="pb-vacio"><span class="pb-vacio-ic">${icono('documento')}</span><b>Todavía no hay presupuesto</b><p>${v.tipo === 'revision' ? 'Se prepara con lo que surge de la revisión.' : 'Si el importe del service se acordó, podés cargarlo acá.'} Hasta que el cliente responda, nada queda autorizado.</p></div>` : ''}
      ${!dinero ? `<p class="pb-aviso" role="note">${icono('info')}<span>Ves qué está autorizado y qué no. Los importes los ve recepción o el dueño.</span></p>` : ''}
      ${resumen}
      ${ok ? `<p class="pb-aviso pb-aviso-ok" role="status">${icono('check')}<span><b>${esc(ok.titulo)}</b><br>${esc(ok.texto)}</span></p>` : ''}
      ${vigentes.length ? `<div class="pb-lh"><h3>Trabajos y repuestos</h3><span>Tocá una línea para ver el detalle</span></div><ul class="pb-lista">${vigentes.map(filaHTML).join('')}</ul>` : ''}
      ${otras.length ? `<details class="mas pb-otras"><summary>Líneas reemplazadas o rechazadas (${otras.length})</summary><ul class="pb-lista">${otras.map(filaHTML).join('')}</ul></details>` : ''}
      ${puedeResp && sinResp.length ? `<div class="pb-cta" data-cta><div class="pb-cta-c"><div><b>${pl(sinResp.length, 'trabajo sin respuesta', 'trabajos sin respuesta')}</b><span>${dinero ? `${pesos(t.sinRespuesta)} esperando respuesta · ` : ''}podés responder solo algunos</span></div><span class="pb-chip borrador" data-borr-chip hidden></span></div>
        <p class="pb-nota" data-borr-nota hidden></p>
        <button type="button" class="btn btn-primario btn-full" data-abrir-respuesta aria-haspopup="dialog">${icono('check')}<span data-abrir-txt>Registrar respuesta</span></button>
        <button type="button" class="btn btn-texto" data-descartar hidden>Descartar borrador</button></div>` : ''}
      ${vigentes.length && !sinResp.length ? `<p class="pb-aviso" role="note">${icono('check')}<span>El cliente respondió todas las líneas de la versión ${vActual.numero}.${puedePrep ? ` Si hace falta sumar algo, agregá trabajos: se crea la versión ${vSig}.` : ''}</span></p>` : ''}
      ${p || puedePrep ? `<div class="pb-cambios"><div class="pb-cambios-h">${icono('historial')}<span><b>Cambios y versiones</b><small>${puedePrep ? `Cambiar o agregar trabajos crea la versión ${vSig}. ` : ''}${p ? 'Las versiones anteriores y sus respuestas se conservan.' : 'Al guardar se crea la versión 1.'}${puedePrep && vigentes.length ? ' Para cambiar una línea, abrila en la lista.' : ''}</small></span></div>
        <div class="pb-pie-acc">${puedePrep ? `<button type="button" class="btn" data-agregar aria-expanded="${!vigentes.length}">${icono('mas')}${vigentes.length ? 'Agregar trabajos' : 'Preparar el presupuesto'}</button>` : ''}${p ? `<button type="button" class="btn" data-ver-versiones aria-haspopup="dialog">${icono('historial')}Ver versiones (${p.versiones.length})</button>` : ''}</div></div>` : ''}
      ${puedeResp && conResp.length ? `<details class="mas"><summary>Corregir una respuesta ya registrada</summary><div class="mas__cuerpo"><form class="form" id="f-corregir-resp" novalidate>
        ${campo({ nombre: 'lineaId', etiqueta: 'Trabajo', tipo: 'select', opciones: conResp.map((l) => [l.id, `${l.descripcion} (${chipTexto(resp(l))})`]) })}
        ${campo({ nombre: 'respuesta', etiqueta: 'Respuesta correcta', tipo: 'select', opciones: [['autoriza', 'Autoriza'], ['rechaza', 'No autoriza'], ['posterga', 'Para más adelante']] })}
        <div class="fila-campos">${campo({ nombre: 'persona', etiqueta: '¿Quién respondió?', requerido: true, valor: v.contacto_nombre || '' })}${campo({ nombre: 'canal', etiqueta: '¿Por dónde?', tipo: 'select', opciones: [['telefono', 'Teléfono'], ['whatsapp', 'WhatsApp'], ['presencial', 'En persona'], ['otro', 'Otro']] })}</div>
        ${campo({ nombre: 'nota', etiqueta: 'Motivo de la corrección', requerido: true })}
        <button class="btn" type="submit">Guardar corrección</button></form></div></details>` : ''}
      ${puedePrep ? `<div class="pb-editor" data-editor ${vigentes.length ? 'hidden' : ''}><h3 tabindex="-1" data-editor-titulo>${vigentes.length ? `Agregar trabajos · versión ${vSig}` : 'Preparar el presupuesto'}</h3>
        ${referencia}
        ${vigentes.length ? `<p class="pb-nota">Lo que agregues entra en la versión ${vSig}, sin respuesta. Lo ya respondido no cambia.</p>` : ''}
        <datalist id="dl-trabajos">${[...(cat?.servicios||[]).filter(x=>x.activo).map(x=>x.nombre),...(cat?.articulos||[]).filter(x=>x.activo).map(x=>x.nombre),...(cat?.trabajos || []).map((x) => x.nombre), ...(globalThis.TALLERES_CATALOGOS?.productos || []).map((x) => x.nombre)].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
        <form class="form presupuesto-editor" id="f-presupuesto" novalidate>
          ${catalogoPresupuesto(cat)}
          <div class="fila"><h3 data-borrador-titulo tabindex="-1">Líneas del borrador</h3><span class="small muted">Revisá cantidades y precios</span></div>
          <div class="lineas-form" data-lineas>${formLinea(0)}</div>
          <div class="acciones"><button type="button" class="btn btn-chico" data-otra>${icono('mas')}Agregar otra línea</button></div>
          <details class="calculadora-inline"><summary>${icono('calculadora')}Calcular mano de obra acá</summary><div><div class="fila-campos">${campo({nombre:'horasCalculo',etiqueta:'Horas estimadas',attrs:'inputmode="decimal"',valor:'1'})}${campo({nombre:'tarifaCalculo',etiqueta:'Valor por hora',attrs:'inputmode="decimal"',valor:aEntradaDinero(cat.valorHora),ayuda:'Tarifa del taller; podés ajustarla para este cálculo.'})}${campo({nombre:'trabajoCalculo',etiqueta:'Trabajo',valor:'Mano de obra',attrs:'list="dl-trabajos"'})}</div><p class="small muted">Horas × tarifa. El responsable decide el importe y el cliente debe autorizarlo.</p><button type="button" class="btn" data-calcular-linea>Agregar mano de obra al editor</button><p data-calculo-error role="alert" class="small"></p></div></details>
          <div class="presupuesto-total"><span>Esta versión · todavía sin guardar</span><strong data-total>$0</strong></div>
          ${campo({ nombre: 'nota', etiqueta: 'Nota de la versión', placeholder: vigentes.length ? 'Ej.: trabajo adicional encontrado al desarmar' : '' })}
          <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Guardar presupuesto</button>${vigentes.length ? '<button type="button" class="btn" data-cerrar-editor>Cancelar</button>' : ''}</div>
        </form></div>` : ''}
      ${p ? `<dialog class="hoja-dlg pb-hoja" data-hoja-versiones aria-labelledby="pb-vers-t"><header><h2 id="pb-vers-t" tabindex="-1">Versiones del presupuesto</h2><button type="button" class="ibtn" data-cerrar-hoja aria-label="Cerrar">${icono('x')}</button></header>
        <div class="hoja-c"><p class="pb-nota">Cada cambio crea una versión. Cada respuesta queda con la línea y la versión en la que se dio; las anteriores no se modifican.</p>${versionesHTML}<button type="button" class="btn" data-cerrar-hoja>Volver al presupuesto</button></div></dialog>` : ''}
      ${hoja}
    </section>`,
    enlazar(raiz) {
      // Líneas desplegables: solo cambian lo visible, no vuelven a pedir datos.
      raiz.querySelectorAll('[data-desplegar]').forEach((b) => b.addEventListener('click', () => {
        const abierta = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(abierta));
        raiz.querySelector('#' + b.getAttribute('aria-controls')).hidden = !abierta;
      }));
      const abrirHoja = (d, origen) => {
        d.showModal();
        d.querySelector('h2')?.focus();
        d.addEventListener('close', () => { if (origen?.isConnected) origen.focus(); }, { once: true });
      };
      const hv = raiz.querySelector('[data-hoja-versiones]');
      if (hv) {
        raiz.querySelectorAll('[data-ver-versiones]').forEach((b) => b.addEventListener('click', () => abrirHoja(hv, b)));
        hv.querySelectorAll('[data-cerrar-hoja]').forEach((b) => b.addEventListener('click', () => hv.close()));
      }
      const editor = raiz.querySelector('[data-editor]');
      const botonAgregar = raiz.querySelector('[data-agregar]');
      botonAgregar?.addEventListener('click', () => {
        editor.hidden = false;
        botonAgregar.setAttribute('aria-expanded', 'true');
        editor.querySelector('[data-editor-titulo]').focus();
      });
      editor?.querySelector('[data-cerrar-editor]')?.addEventListener('click', async () => {
        const fp = editor.querySelector('form');
        if (fp.dataset.sucio) {
          const r = await confirmar({ titulo: '¿Descartar los trabajos sin guardar?', texto: 'Las líneas que cargaste en el editor todavía no se guardaron.', efecto: 'El presupuesto vigente no cambia.', aceptar: 'Descartar', peligro: true });
          if (!r.ok) return;
        }
        delete fp.dataset.sucio;
        app.recargar();
      });

      // Respuesta del cliente: borrador visible en la lista y en el aviso hasta que el servidor confirma.
      const hr = raiz.querySelector('[data-hoja-respuesta]');
      const fr = raiz.querySelector('#f-respuesta');
      if (hr && fr) {
        const abrir = raiz.querySelector('[data-abrir-respuesta]');
        const pieAviso = fr.querySelector('[data-pie-aviso]');
        const guardarBtn = fr.querySelector('[data-guardar]');
        let guardando = false, incierto = false, errorTxt = '';
        const elegida = (l) => fr.elements[`r-${l.id}`]?.value || '';
        const elegidas = () => sinResp.filter(elegida);
        const borrador = () => elegidas().length > 0 || ['persona', 'fecha', 'nota'].some((k) => fr.elements[k].value.trim()) || !!fr.elements.canal.value;
        const avisoPie = (tipo, html) => { pieAviso.innerHTML = html ? `<p class="pb-aviso pb-aviso-${tipo}" role="alert">${icono(tipo === 'err' ? 'alerta' : 'info')}<span>${html}</span></p>` : ''; };
        const actualizar = () => {
          const els = elegidas(), n = els.length, faltan = sinResp.length - n;
          const hay = borrador();
          if (hay) fr.dataset.sucio = '1'; else delete fr.dataset.sucio;
          raiz.querySelectorAll('[data-borr-chip]').forEach((c) => { c.hidden = !n; c.textContent = pl(n, 'elegida sin guardar', 'elegidas sin guardar'); });
          raiz.querySelectorAll('[data-descartar]').forEach((b) => { b.hidden = !hay; });
          const nota = raiz.querySelector('[data-borr-nota]');
          nota.hidden = !n;
          nota.textContent = n ? `Borrador sin guardar: ${els.map((l) => `${l.descripcion} → ${OPC_B[elegida(l)][0].toLowerCase()}`).join('; ')}. Se registra recién al tocar «Guardar respuesta».` : '';
          raiz.querySelector('[data-abrir-txt]').textContent = hay ? 'Continuar respuesta' : 'Registrar respuesta';
          const rTxt = raiz.querySelector('[data-responder-txt]');
          if (rTxt) rTxt.textContent = hay ? 'Continuar respuesta' : `Responder (${sinResp.length})`;
          for (const l of sinResp) {
            const st = raiz.querySelector(`.pb-lista [data-linea-id="${l.id}"] [data-estado-linea]`);
            if (!st) continue;
            const e = estadoLinea(l), r = elegida(l);
            st.textContent = r ? `Sin guardar: ${OPC_B[r][0]}` : e.txt;
            st.className = `pb-st pb-t-${r ? 'borr' : e.cls}`;
          }
          const lista = fr.querySelector('[data-resumen-sel]');
          lista.hidden = !n;
          lista.innerHTML = els.map((l) => { const [txt, cls] = RESP_B[elegida(l)]; return `<li><span class="pb-n">${esc(l.descripcion)}</span><span class="pb-st pb-t-${cls}">${txt}</span></li>`; }).join('');
          fr.querySelector('[data-quedan]').textContent = !n ? 'Todavía no elegiste ninguna respuesta.' : faltan ? `${pl(faltan, 'línea queda', 'líneas quedan')} sin respuesta y ${faltan === 1 ? 'sigue' : 'siguen'} esperando.` : 'Respondés todas las líneas pendientes.';
          fr.querySelector('[data-pie-linea]').textContent = n ? `${pl(n, 'respuesta elegida', 'respuestas elegidas')} · ${faltan} sin elegir` : 'Ninguna respuesta elegida todavía.';
          guardarBtn.textContent = guardando ? 'Guardando…' : incierto ? 'Verificar y reintentar' : errorTxt ? 'Reintentar guardado' : n ? `Guardar respuesta (${n})` : 'Guardar respuesta';
        };
        abrir.addEventListener('click', () => abrirHoja(hr, abrir));
        // Con cuatro líneas o más, un acceso arriba evita bajar hasta el aviso para responder.
        const responder = raiz.querySelector('[data-responder]');
        responder?.addEventListener('click', () => abrirHoja(hr, responder));
        fr.querySelector('[data-cerrar-hoja]').addEventListener('click', () => hr.close());
        hr.addEventListener('cancel', (e) => { if (guardando) e.preventDefault(); });
        // Tocar de nuevo la opción elegida la quita: esa línea vuelve a quedar sin elegir.
        fr.addEventListener('click', (e) => {
          const r = e.target.closest('input[type="radio"]');
          if (!r) return;
          if (r.dataset.previa === '1') { r.checked = false; r.dataset.previa = ''; }
          else { fr.querySelectorAll(`input[name="${r.name}"]`).forEach((x) => { x.dataset.previa = ''; }); r.dataset.previa = '1'; }
          actualizar();
        });
        fr.addEventListener('input', () => { if (errorTxt && !incierto) { errorTxt = ''; avisoPie(); } fr.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid')); actualizar(); });
        fr.querySelector('[data-sugerir]')?.addEventListener('click', () => { fr.elements.persona.value = v.contacto_nombre; actualizar(); fr.elements.persona.focus(); });
        const descartar = async () => {
          const els = elegidas();
          const r = await confirmar({ titulo: '¿Descartar el borrador?', texto: els.length ? `Se pierden ${pl(els.length, 'respuesta elegida', 'respuestas elegidas')} que todavía no se guardaron: ${els.map((l) => esc(l.descripcion)).join(', ')}.` : 'Se borra lo escrito sobre quién y cómo respondió.', efecto: 'No cambia nada guardado: las líneas siguen sin respuesta.', aceptar: 'Descartar borrador', peligro: true });
          if (!r.ok) return;
          fr.reset();
          fr.querySelectorAll('input[type="radio"]').forEach((x) => { x.dataset.previa = ''; });
          incierto = false; errorTxt = ''; avisoPie();
          delete fr.dataset.clave;
          actualizar();
        };
        raiz.querySelectorAll('[data-descartar]').forEach((b) => b.addEventListener('click', descartar));
        const falta = (msg, ctl) => { errorTxt = msg; avisoPie('err', esc(msg)); if (ctl) { ctl.setAttribute('aria-invalid', 'true'); ctl.focus(); } actualizar(); };
        const exito = (persona, canal, els, repetido) => {
          ultimaRespuesta.set(v.id, { titulo: repetido ? 'La respuesta ya estaba guardada' : 'Respuesta guardada', texto: `${persona} (${CANALES[canal]}): ${els.map((l) => `${l.descripcion} → ${OPC_B[elegida(l)][0].toLowerCase()}`).join('; ')}.${repetido ? ' Se verificó en el servidor y no se registró dos veces.' : ''}` });
          delete fr.dataset.sucio;
          guardando = false;
          hr.close();
          toast(repetido ? 'La respuesta ya estaba guardada. No se duplicó.' : 'Respuesta del cliente guardada.');
          app.recargar();
        };
        fr.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (guardando) return;
          const els = elegidas();
          const persona = fr.elements.persona.value.trim(), canal = fr.elements.canal.value;
          if (!els.length) return falta('Elegí la respuesta de al menos un trabajo.', fr.querySelector('input[name^="r-"]'));
          if (!persona) return falta('Falta indicar quién respondió para poder guardar.', fr.elements.persona);
          if (!canal) return falta('Elegí por dónde respondió.', fr.querySelector('input[name="canal"]'));
          const cuerpo = { persona, canal, fecha: fr.elements.fecha.value || null, respuestas: els.map((l) => ({ lineaId: l.id, respuesta: elegida(l), nota: fr.elements.nota.value.trim() })) };
          guardando = true; errorTxt = ''; avisoPie();
          guardarBtn.disabled = true; guardarBtn.classList.add('cargando'); guardarBtn.setAttribute('aria-busy', 'true');
          fr.querySelector('[data-cerrar-hoja]').disabled = true;
          actualizar();
          try {
            // Después de un resultado incierto, primero se consulta si ya quedó registrada.
            if (incierto) {
              const actual = (await get(`/api/visitas/${v.id}`)).visita.presupuesto?.lineas || [];
              const yaGuardadas = els.filter((l) => actual.find((x) => x.id === l.id)?.respuesta);
              if (yaGuardadas.length === els.length) return exito(persona, canal, els, true);
              if (yaGuardadas.length) { incierto = false; errorTxt = 'x'; avisoPie('err', 'Algunas de estas líneas ya tienen una respuesta registrada. Volvé al presupuesto para ver lo que quedó guardado antes de seguir.'); return; }
            }
            const r = await post(`/api/visitas/${v.id}/respuestas`, cuerpo, { idempotencia: claveDeEnvio(fr) });
            exito(persona, canal, els, !!r.repetido);
          } catch (err) {
            if (err.datos?.sinConexion) {
              incierto = true;
              avisoPie('aviso', '<b>No pudimos confirmar si se guardó.</b> Se cortó la conexión y puede que se haya registrado. Al reintentar, primero se verifica en el servidor para no duplicarla. Tu selección sigue acá.');
            } else {
              incierto = false; errorTxt = err.message;
              const ctl = err.campo === 'persona' ? fr.elements.persona : err.campo === 'canal' ? fr.querySelector('input[name="canal"]') : null;
              avisoPie('err', `<b>No se registró la respuesta.</b> ${esc(err.message)} Tu selección sigue acá.`);
              ctl?.setAttribute('aria-invalid', 'true');
              delete fr.dataset.clave;
            }
          } finally {
            if (guardando) {
              guardando = false;
              guardarBtn.disabled = false; guardarBtn.classList.remove('cargando'); guardarBtn.removeAttribute('aria-busy');
              fr.querySelector('[data-cerrar-hoja]').disabled = false;
              actualizar();
            }
          }
        });
        actualizar();
      }
      const fc = raiz.querySelector('#f-corregir-resp');
      if (fc) alEnviar(fc, async (d) => { await post(`/api/visitas/${v.id}/respuestas`, { persona: d.persona, canal: d.canal, respuestas: [{ lineaId: Number(d.lineaId), respuesta: d.respuesta, nota: d.nota, corrige: true }] }, { idempotencia: claveDeEnvio(fc) }); toast('Respuesta corregida. La anterior queda registrada.'); app.recargar(); });
      raiz.querySelectorAll('[data-cambiar]').forEach((b) => b.addEventListener('click', () => {
        const l = lineas.find((x) => x.id === Number(b.dataset.cambiar));
        const cont = raiz.querySelector(`[data-form-cambio="${l.id}"]`);
        cont.hidden = false;
        b.hidden = true;
        cont.innerHTML = `<form class="form" novalidate>
          ${resp(l) === 'autoriza' ? aviso('Este trabajo ya está autorizado. El cambio crea una versión nueva y necesita la respuesta del cliente; mientras tanto se conserva lo autorizado.', 'ambar', 'alerta') : ''}
          <p class="pb-nota">Guardar el cambio crea la versión ${vSig}. La versión ${vActual.numero} y sus respuestas se conservan.</p>
          <div class="fila-campos">${campo({ nombre: 'descripcion', etiqueta: 'Detalle', valor: l.descripcion })}${campo({ nombre: 'cantidad', etiqueta: 'Cantidad', valor: aEntradaCant(l.cantidad_m), attrs: 'inputmode="decimal"' })}${campo({ nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', valor: l.unidad, opciones: UNIDADES })}${dinero ? campo({ nombre: 'precio', etiqueta: 'Precio unitario', valor: aEntradaDinero(l.precio_unit), attrs: 'inputmode="decimal"' }) : ''}</div>
          ${campo({ nombre: 'motivo', etiqueta: 'Motivo del cambio', requerido: true, placeholder: 'Ej.: el proveedor actualizó el precio' })}
          <div class="form-pie"><button class="btn btn-primario" type="submit">Guardar cambio</button><button type="button" class="btn" data-cancelar>Cancelar</button></div></form>`;
        const f = cont.querySelector('form');
        f.querySelector('[data-cancelar]').onclick = () => { delete f.dataset.sucio; cont.hidden = true; cont.innerHTML = ''; b.hidden = false; b.focus(); };
        alEnviar(f, async (d) => { await post(`/api/visitas/${v.id}/lineas/${l.id}/modificar`, d, { idempotencia: claveDeEnvio(f) }); toast('Cambio guardado en una versión nueva. Falta la respuesta del cliente.'); app.recargar(); });
        f.querySelector('input').focus();
      }));
      const fp = raiz.querySelector('#f-presupuesto');
      if (fp) {
        const cont = fp.querySelector('[data-lineas]');
        const total = () => {
          let s = 0;
          cont.querySelectorAll('[data-linea]').forEach((x) => {
            const q = Number(String(x.querySelector('[name="cantidad"]').value || '1').replace(',', '.')) || 0;
            const pr = String(x.querySelector('[name="precio"]').value || '').replace(/\$|\s/g, '');
            const pn = /,/.test(pr) ? Number(pr.replace(/\./g, '').replace(',', '.')) : /^\d{1,3}(\.\d{3})+$/.test(pr) ? Number(pr.replace(/\./g, '')) : Number(pr) || 0;
            const importe=Math.round(q*pn*100);s += importe;
            const out=x.querySelector('[data-subtotal]');if(out)out.textContent=pesos(importe);
          });
          fp.querySelector('[data-total]').textContent = `${pesos(s)}`;
        };
        const enlazarQuitar = () => cont.querySelectorAll('[data-quitar]').forEach((q) => { q.onclick = () => { q.closest('[data-linea]').remove(); if(!cont.children.length)cont.innerHTML=formLinea(0); enlazarQuitar();total();fp.dataset.sucio='1'; }; });
        enlazarCatalogoPresupuesto(fp,cat,async elegidos=>{
          const filas=[...cont.querySelectorAll('[data-linea]')];
          const duplicadas=elegidos.filter(l=>filas.some(x=>x.dataset.catalogo===l.clave||normalizar(x.querySelector('[name=descripcion]').value.trim())===normalizar(l.descripcion.trim())));
          if(duplicadas.length){const r=await confirmar({titulo:'Revisar líneas repetidas',texto:`Ya están en el borrador: ${duplicadas.map(x=>esc(x.descripcion)).join(', ')}.`,efecto:'Podés cancelar para revisar las líneas existentes. Repetir las agrega de nuevo al borrador.',aceptar:'Agregar también las repetidas'});if(!r.ok)return false;}
          for(const l of elegidos){const vacia=[...cont.children].find(x=>!x.querySelector('[name=descripcion]').value.trim()&&!x.querySelector('[name=precio]').value.trim());if(vacia)vacia.outerHTML=formLinea(cont.children.length,l);else cont.insertAdjacentHTML('beforeend',formLinea(cont.children.length,l));}
          enlazarQuitar();total();fp.dataset.sucio='1';
          const incompleta=[...cont.children].find(x=>!x.querySelector('[name=precio]').value.trim());if(incompleta)incompleta.querySelector('[name=precio]').focus();else if(elegidos.length>1)fp.querySelector('[data-borrador-titulo]').focus();
          return true;
        });
        fp.querySelector('[data-otra]').onclick = () => { cont.insertAdjacentHTML('beforeend', formLinea(cont.children.length)); enlazarQuitar(); cont.lastElementChild.querySelector('[name="descripcion"]').focus(); };
        fp.addEventListener('input', total);
        fp.addEventListener('change',e=>{if(e.target.name==='descripcion'){const fila=e.target.closest('[data-linea]');if(!fila.querySelector('[name=precio]').value){const articulo=cat.articulos?.find(x=>x.activo&&x.nombre===e.target.value),servicio=cat.servicios?.find(x=>x.activo&&x.nombre===e.target.value);const precio=articulo?.precio_venta??servicio?.precio;if(precio!=null){fila.querySelector('[name=precio]').value=aEntradaDinero(precio);if(articulo){fila.querySelector('[name=tipo]').value='repuesto';fila.querySelector('[name=unidad]').value=articulo.unidad;}}}}total();});
        fp.querySelector('[data-calcular-linea]').onclick=()=>{
          const horas=numeroEntrada(fp.elements.horasCalculo.value),tarifa=numeroEntrada(fp.elements.tarifaCalculo.value);
          const error=fp.querySelector('[data-calculo-error]');
          if(!Number.isFinite(horas)||!Number.isFinite(tarifa)||horas<=0||tarifa<=0){error.textContent='Completá horas y tarifa con números mayores a cero.';return;}
          error.textContent='';
          const l={tipo:'mano_obra',descripcion:fp.elements.trabajoCalculo.value||'Mano de obra',cantidad:String(horas).replace('.',','),unidad:'h',precio:String(tarifa).replace('.',',')};
          const vacia=[...cont.children].find(x=>!x.querySelector('[name="descripcion"]').value&&!x.querySelector('[name="precio"]').value);
          if(vacia)vacia.outerHTML=formLinea(cont.children.length,l);else cont.insertAdjacentHTML('beforeend',formLinea(cont.children.length,l));
          enlazarQuitar();total();fp.dataset.sucio='1';
        };
        enlazarQuitar();
        alEnviar(fp, async () => {
          const filas = [...cont.querySelectorAll('[data-linea]')].map((x) => Object.fromEntries(['tipo', 'descripcion', 'cantidad', 'unidad', 'precio'].map((k) => [k, x.querySelector(`[name="${k}"]`).value]))).filter((x) => x.descripcion.trim() || x.precio.trim());
          const incompleta=[...cont.querySelectorAll('[data-linea]')].find(x=>(x.querySelector('[name=descripcion]').value.trim()||x.querySelector('[name=precio]').value.trim())&&!x.querySelector('[name=precio]').value.trim());
          if(incompleta){incompleta.querySelector('[name=precio]').focus();throw new Error('Completá el precio de cada línea. Si es sin cargo, indicá 0.');}
          await post(`/api/visitas/${v.id}/presupuesto`, { lineas: filas, nota: fp.querySelector('[name="nota"]').value }, { idempotencia: claveDeEnvio(fp) });
          toast('Presupuesto guardado. Falta la respuesta del cliente.');
          app.recargar();
        });
      }
    }
  };
}
const chipTexto = (r) => ({ autoriza: 'autorizado', rechaza: 'no autorizado', posterga: 'para más adelante' }[r] || 'sin respuesta');

// ---------------- Trabajo y repuestos ----------------
export function seccionTrabajo(v, app, cat, stock, {soloRepuestos=false}={}) {
  const lineas = (v.presupuesto?.lineas || []).filter((l) => l.estado === 'vigente');
  const ejecutables = lineas.filter((l) => resp(l) === 'autoriza');
  const noEjec = lineas.filter((l) => resp(l) && resp(l) !== 'autoriza');
  const yo = app.sesion.usuario;
  const asignado = yo.rol !== 'mecanico' || !v.responsable_id || v.responsable_id === yo.id;
  const ejecuta = app.puede('trabajo.ejecutar') && !cerrada(v) && asignado;
  const gestiona = app.puede('repuestos.gestionar') && !cerrada(v);
  const coloca = app.puede('repuestos.colocar') && asignado;
  const controlado = v.controles.some((c) => c.vigente);
  const repuestoHTML = (r) => {
    const sig = { falta_pedir: ['pedido', 'Registrar que se pidió'], pedido: ['llego', 'Registrar que llegó'], llego: ['colocado', 'Registrar que se colocó'] }[r.etapa];
    const puedeSig = sig && !cerrada(v) && (sig[0] === 'colocado' ? coloca : gestiona);
    return `<li class="bloque" style="gap:6px"><div class="fila"><span class="fila__izq"><strong>${esc(r.descripcion)}</strong><span class="muted small">× ${esc(cant(r.cantidad_m, r.unidad))} · ${r.origen === 'cliente' ? 'la trae el cliente' : 'del taller'}${r.proveedor ? ' · ' + esc(r.proveedor) : ''}</span></span>${chipEtapa(r.etapa)}</div>
      <p class="small muted">${r.etapa === 'pedido' ? (r.fecha_prevista ? 'Llegada prevista: ' + esc(fecha(r.fecha_prevista)) : 'Sin fecha de llegada confirmada') : ''}${r.articulo ? ` · Stock: ${esc(r.articulo)}${r.reserva ? (r.reserva.estado === 'activa' ? ' (reservado, se descuenta al colocar)' : ' (descontado al colocar)') : ''}` : ''}</p>
      <div class="acciones">${puedeSig ? `<button type="button" class="btn btn-chico ${sig[0] === 'colocado' ? 'btn-oscuro' : ''}" data-etapa="${r.id}" data-a="${sig[0]}" data-version="${r.version}">${icono(sig[0] === 'colocado' ? 'check' : sig[0] === 'llego' ? 'caja' : 'camion')}${sig[1]}</button>` : ''}
        ${r.origen==='taller'&&r.etapa!=='colocado'&&app.puede('compras.gestionar')?`<a class="btn btn-chico btn-texto" href="#/compras?nueva=1&descripcion=${encodeURIComponent(r.descripcion)}&cantidad=${encodeURIComponent(aEntradaCant(r.cantidad_m))}&proveedor=${r.proveedor_id||''}&volver=${v.id}">${icono('camion')}Comprar esta pieza</a>`:''}
        ${r.etapa === 'falta_pedir' && gestiona ? `<button type="button" class="btn btn-chico btn-texto" data-etapa="${r.id}" data-a="llego" data-version="${r.version}">Ya está en el taller</button>` : ''}
        ${r.origen === 'taller' && !r.reserva && r.etapa !== 'colocado' && app.puede('stock.reservar') && stock?.length ? `<button type="button" class="btn btn-chico btn-texto" data-reservar="${r.id}">${icono('stock')}Reservar del stock</button>` : ''}
        ${r.reserva?.estado === 'activa' && app.puede('stock.reservar') ? `<button type="button" class="btn btn-chico btn-texto" data-liberar="${r.reserva.id}">Liberar reserva</button>` : ''}
        ${r.etapa === 'pedido' && gestiona ? `<button type="button" class="btn btn-chico btn-texto" data-fecha="${r.id}" data-version="${r.version}">${icono('calendario')}Fecha de llegada</button>` : ''}
        ${app.sesion.usuario.rol === 'dueno' && r.etapa !== 'falta_pedir' && !cerrada(v) ? `<button type="button" class="btn btn-chico btn-texto" data-atras="${r.id}" data-version="${r.version}">Corregir etapa</button>` : ''}</div></li>`;
  };
  const formRepuesto = (lineaId) => `<details class="mas"><summary>Agregar repuesto a este trabajo</summary><div class="mas__cuerpo"><form class="form" data-f-repuesto="${lineaId || ''}" novalidate>
    <div class="fila-campos">${campo({ nombre: 'descripcion', etiqueta: 'Repuesto', requerido: true })}${campo({ nombre: 'cantidad', etiqueta: 'Cantidad', valor: '1', attrs: 'inputmode="decimal"' })}${campo({ nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', opciones: UNIDADES })}</div>
    ${opcionesRadio('origen', [['taller', 'Lo pone el taller'], ['cliente', 'Lo trae el cliente']], 'taller', '¿Quién lo pone?')}
    <div class="fila-campos">${campo({ nombre: 'etapa', etiqueta: 'Estado actual', tipo: 'select', opciones: [['falta_pedir', 'Falta pedir'], ['pedido', 'Ya se pidió'], ['llego', 'Ya está en el taller']] })}
      ${campo({ nombre: 'proveedorId', etiqueta: 'Proveedor', tipo: 'select', opciones: [['', 'Sin indicar'], ...(cat.proveedores || []).map((p) => [p.id, p.nombre])] })}
      ${campo({ nombre: 'fechaPrevista', etiqueta: 'Llegada prevista', tipo: 'date' })}
      ${stock?.length ? campo({ nombre: 'articuloId', etiqueta: 'Artículo del stock', tipo: 'select', ayuda: 'Si sale del stock, se descuenta al colocarlo.', opciones: [['', 'No sale del stock'], ...stock.map((a) => [a.id, `${a.nombre} (${cant(a.disponible, a.unidad)} disponibles)`])] }) : ''}</div>
    <p class="muted small">Agregar un repuesto no cambia el presupuesto ni la autorización. Si cambia el alcance o el importe, agregalo primero al presupuesto.</p>
    <button class="btn btn-primario" type="submit">${icono('mas')}Agregar repuesto</button></form></div></details>`;
  const tareas = v.tareas;
  return {
    html: `<section class="bloque" aria-labelledby="t-tra">
      <div class="bloque__cab"><h2 id="t-tra">${soloRepuestos?'Repuestos':'Trabajos'}</h2><p>Llegó no es lo mismo que colocado. El trabajo se marca aparte.</p></div>
      ${!asignado && app.puede('trabajo.ejecutar') ? aviso(`Esta visita está asignada a ${esc(v.responsable)}. Pedí que te la asignen para registrar avances.`, 'gris') : ''}
      ${!soloRepuestos&&tareas.length ? `<div class="panel"><div class="panel__cab"><h3>Tareas del service</h3><span class="muted small">${tareas.filter((t) => t.estado !== 'pendiente').length} de ${tareas.length} confirmadas</span></div>
        <ul class="lista tareas-pos">${tareas.map((t) => `<li><div class="fila"><span>${esc(t.descripcion)}</span>${t.estado === 'hecho' ? chip('Hecho', 'verde', 'check') : t.estado === 'no_aplica' ? chip('No aplica', '', 'menos') : chip('Pendiente', 'violeta', 'reloj')}</div>
          ${t.explicacion ? `<p class="small muted">${esc(t.explicacion)}</p>` : ''}${t.por ? `<p class="xs muted">${esc(t.por)} · ${esc(cuando(t.actualizado_at))}</p>` : ''}
          ${ejecuta && !controlado ? `<div class="acciones">${t.estado !== 'hecho' ? `<button type="button" class="btn btn-chico" data-tarea="${t.id}" data-e="hecho">${icono('check')}Marcar hecho</button>` : ''}${t.estado !== 'no_aplica' ? `<button type="button" class="btn btn-chico" data-tarea="${t.id}" data-e="no_aplica">No aplica</button>` : ''}${t.estado !== 'pendiente' ? `<button type="button" class="btn btn-chico btn-texto" data-tarea="${t.id}" data-e="pendiente">Volver a pendiente</button>` : ''}</div>` : ''}</li>`).join('')}</ul>
        ${ejecuta && !controlado ? `<div class="panel__cuerpo"><form class="form" id="f-tarea" novalidate><div class="fila-campos">${campo({ nombre: 'descripcion', etiqueta: 'Agregar una tarea', placeholder: 'Ej.: revisar correa' })}</div><button class="btn btn-chico" type="submit">${icono('mas')}Agregar tarea</button></form></div>` : ''}</div>` : ''}
      ${ejecutables.length ? ejecutables.map((l) => {
        const reps = v.repuestos.filter((r) => r.linea_id === l.id);
        const cambio = (v.presupuesto?.lineas || []).find((x) => x.origen_linea_id === l.id && x.estado === 'vigente');
        const bloqueos = [
          ...(cambio && !resp(cambio) ? ['Hay un cambio pendiente de respuesta del cliente.'] : []),
          ...(reps.some(r => r.etapa !== 'colocado') ? ['Falta colocar: ' + reps.filter(r => r.etapa !== 'colocado').map(r => r.descripcion).join(', ') + '.'] : []),
          ...(v.tipo === 'service' && l.autorizada_ingreso && tareas.some(t => t.estado === 'pendiente') ? ['Confirmá las tareas del service antes de marcarlo realizado.'] : [])
        ];
        return `<article class="panel"><div class="panel__cuerpo bloque">
          <div class="fila"><h3>${esc(l.descripcion)}</h3>${l.realizado_at ? chip('Realizado', 'verde', 'check') : chip('Por hacer', 'teal', 'llave')}</div>
          ${l.realizado_at ? `<p class="small muted">Realizado por ${esc(l.realizado_por_nombre || '')} · ${esc(cuando(l.realizado_at))}</p>` : ''}
          ${cambio ? aviso('Hay un cambio de este trabajo esperando la respuesta del cliente.', 'ambar', 'reloj') : ''}
          ${reps.length ? `<ul class="lista">${reps.map(repuestoHTML).join('')}</ul>` : '<p class="muted small">Sin repuestos cargados para este trabajo.</p>'}
          ${!l.realizado_at && ejecuta && bloqueos.length ? `<p id="bloqueo-trabajo-${l.id}" class="small muted">${bloqueos.map(esc).join(' ')}</p>` : ''}
          <div class="acciones">${!soloRepuestos && !l.realizado_at && ejecuta ? `<button type="button" class="btn btn-primario btn-chico" data-realizado="${l.id}" ${bloqueos.length ? `disabled aria-describedby="bloqueo-trabajo-${l.id}"` : ''}>${icono('check')}Marcar trabajo realizado</button>` : ''}
            ${l.realizado_at && app.sesion.usuario.rol === 'dueno' && !l.cargo_id && !controlado && !cerrada(v) ? `<button type="button" class="btn btn-chico btn-texto" data-deshacer="${l.id}">Corregir: no está realizado</button>` : ''}</div>
          ${gestiona && !l.realizado_at ? formRepuesto(l.id) : ''}
        </div></article>`;
      }).join('') : `<p class="muted">${lineas.length ? 'Todavía no hay trabajos autorizados por el cliente.' : 'Todavía no hay trabajos en el presupuesto.'}</p>`}
      ${v.repuestos.filter((r) => !r.linea_id).length ? `<div class="panel"><div class="panel__cab"><h3>Repuestos sin trabajo asignado</h3></div><ul class="lista">${v.repuestos.filter((r) => !r.linea_id).map(repuestoHTML).join('')}</ul></div>` : ''}
      ${noEjec.length ? `<details class="mas"><summary>Trabajos que no se hacen en esta visita (${noEjec.length})</summary><div class="mas__cuerpo"><ul>${noEjec.map((l) => `<li>${esc(l.descripcion)} · ${esc(chipTexto(resp(l)))}</li>`).join('')}</ul></div></details>` : ''}
      ${!soloRepuestos && (v.tipo === 'service' || v.productos.length) ? `<div class="panel"><div class="panel__cab"><h3>Productos usados</h3><span class="muted small">Lo que realmente se usó, con cantidad</span></div>
        ${v.productos.length ? `<ul class="lista">${v.productos.map((p) => `<li><div class="fila"><span><strong>${esc(p.descripcion)}</strong> × ${esc(cant(p.cantidad_m, p.unidad))}</span>${ejecuta ? `<button type="button" class="btn btn-chico btn-texto" data-anular-prod="${p.id}">Anular</button>` : ''}</div><p class="xs muted">${p.origen === 'cliente' ? 'Lo trajo el cliente' : p.articulo_id ? 'Descontado del stock' : 'Del taller'} · ${esc(p.por || '')}</p></li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted small">Todavía no se registraron productos.</p></div>'}
        ${ejecuta ? `<div class="panel__cuerpo"><form class="form" id="f-producto" novalidate><div class="fila-campos">
          ${campo({ nombre: 'descripcion', etiqueta: 'Producto', requerido: true, attrs: 'list="dl-productos"', placeholder: 'Como figura en el envase' })}${campo({ nombre: 'cantidad', etiqueta: 'Cantidad', requerido: true, attrs: 'inputmode="decimal"', placeholder: 'Ej.: 4,2' })}${campo({ nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', valor: 'L', opciones: UNIDADES })}
          ${stock?.length ? campo({ nombre: 'articuloId', etiqueta: 'Sale del stock', tipo: 'select', opciones: [['', 'No'], ...stock.map((a) => [a.id, `${a.nombre} (${cant(a.disponible, a.unidad)})`])] }) : ''}</div>
          <datalist id="dl-productos">${(window.TALLERES_CATALOGOS?.productos || []).map((x) => `<option value="${esc(x.nombre)}">`).join('')}</datalist>
          <button class="btn btn-chico" type="submit">${icono('mas')}Registrar producto usado</button></form></div>` : ''}</div>` : ''}
      ${gestiona && !ejecutables.length && lineas.length === 0 ? formRepuesto(null) : ''}
    </section>`,
    enlazar(raiz) {
      raiz.querySelectorAll('[data-tarea]').forEach((b) => b.addEventListener('click', async () => {
        let explicacion = '';
        if (b.dataset.e === 'no_aplica') {
          const r = await confirmar({ titulo: 'La tarea no aplica', texto: 'Contá por qué no corresponde hacerla en este auto.', aceptar: 'Guardar', pedir: { etiqueta: 'Explicación' } });
          if (!r.ok) return;
          explicacion = r.valor;
        }
        acc(app, () => post(`/api/tareas/${b.dataset.tarea}`, { estado: b.dataset.e, explicacion }), 'Tarea actualizada.');
      }));
      raiz.querySelectorAll('[data-etapa]').forEach((b) => b.addEventListener('click', () => acc(app, () => post(`/api/repuestos/${b.dataset.etapa}/etapa`, { etapa: b.dataset.a, version: Number(b.dataset.version) }),
        { pedido: 'Repuesto registrado como pedido.', llego: 'Repuesto registrado como llegado (todavía falta colocarlo).', colocado: 'Repuesto colocado. El trabajo se marca aparte.' }[b.dataset.a])));
      raiz.querySelectorAll('[data-fecha]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Fecha de llegada prevista', aceptar: 'Guardar', pedir: { etiqueta: 'Fecha', tipo: 'date' } });
        if (r.ok) acc(app, () => put(`/api/repuestos/${b.dataset.fecha}`, { fechaPrevista: r.valor, version: Number(b.dataset.version) }), 'Fecha guardada.');
      }));
      raiz.querySelectorAll('[data-atras]').forEach((b) => b.addEventListener('click', async () => {
        const rp = v.repuestos.find((x) => x.id === Number(b.dataset.atras));
        const anterior = { pedido: 'falta_pedir', llego: 'pedido', colocado: 'llego' }[rp.etapa];
        const r = await confirmar({ titulo: 'Corregir la etapa del repuesto', texto: `Vuelve de «${ETAPAS[rp.etapa][0]}» a «${ETAPAS[anterior][0]}».`, efecto: rp.etapa === 'colocado' && rp.reserva ? 'Si se había descontado del stock, se reintegra con un movimiento.' : '', aceptar: 'Corregir', peligro: true, pedir: { etiqueta: 'Motivo de la corrección' } });
        if (r.ok) acc(app, () => post(`/api/repuestos/${rp.id}/etapa`, { etapa: anterior, motivo: r.valor, version: rp.version }), 'Etapa corregida.');
      }));
      raiz.querySelectorAll('[data-reservar]').forEach((b) => b.addEventListener('click', async () => {
        const rp = v.repuestos.find((x) => x.id === Number(b.dataset.reservar));
        const opciones = (stock || []).filter((a) => a.unidad === rp.unidad);
        if (!opciones.length) return toast(`No hay artículos de stock que se cuenten en «${rp.unidad}».`, { error: true });
        const d = document.createElement('dialog');
        d.className = 'dialogo';
        d.innerHTML = `<form method="dialog" class="form"><div class="dialogo__cuerpo"><h2>Reservar del stock</h2><p>${esc(rp.descripcion)} × ${esc(cant(rp.cantidad_m, rp.unidad))}. Se aparta ahora y se descuenta al colocarlo.</p>
          ${campo({ nombre: 'articuloId', etiqueta: 'Artículo', tipo: 'select', opciones: opciones.map((a) => [a.id, `${a.nombre} (${cant(a.disponible, a.unidad)} disponibles)`]) })}</div>
          <div class="dialogo__pie"><button type="button" class="btn" data-no>Volver</button><button class="btn btn-primario" value="si">Reservar</button></div></form>`;
        document.body.appendChild(d);
        d.querySelector('[data-no]').onclick = () => d.close();
        d.addEventListener('close', () => { const val = d.querySelector('select').value; const ok = d.returnValue === 'si'; d.remove(); if (ok) acc(app, () => post(`/api/repuestos/${rp.id}/reservar`, { articuloId: Number(val) }), 'Stock reservado.'); });
        d.showModal();
      }));
      raiz.querySelectorAll('[data-liberar]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Liberar la reserva', aceptar: 'Liberar', pedir: { etiqueta: 'Motivo' } });
        if (r.ok) acc(app, () => post(`/api/reservas/${b.dataset.liberar}/liberar`, { motivo: r.valor }), 'Reserva liberada.');
      }));
      raiz.querySelectorAll('[data-realizado]').forEach((b) => b.addEventListener('click', () => acc(app, () => post(`/api/visitas/${v.id}/lineas/${b.dataset.realizado}/realizado`, {}), 'Trabajo marcado como realizado.')));
      raiz.querySelectorAll('[data-deshacer]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Corregir trabajo realizado', texto: 'El trabajo vuelve a pendiente. Queda registrado quién y por qué.', aceptar: 'Corregir', peligro: true, pedir: { etiqueta: 'Motivo' } });
        if (r.ok) acc(app, () => post(`/api/visitas/${v.id}/lineas/${b.dataset.deshacer}/realizado`, { realizado: false, motivo: r.valor }), 'Corrección guardada.');
      }));
      raiz.querySelectorAll('[data-anular-prod]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Anular el producto registrado', texto: 'El registro se conserva tachado. Si se había descontado del stock, se reintegra.', aceptar: 'Anular', peligro: true, pedir: { etiqueta: 'Motivo' } });
        if (r.ok) acc(app, () => post(`/api/productos/${b.dataset.anularProd}/anular`, { motivo: r.valor }), 'Producto anulado.');
      }));
      raiz.querySelectorAll('[data-f-repuesto]').forEach((f) => alEnviar(f, async (d) => { await post(`/api/visitas/${v.id}/repuestos`, { ...d, lineaId: f.dataset.fRepuesto ? Number(f.dataset.fRepuesto) : null }); toast('Repuesto agregado.'); app.recargar(); }));
      const ft = raiz.querySelector('#f-tarea');
      if (ft) alEnviar(ft, async (d) => { await post(`/api/visitas/${v.id}/tareas`, d); toast('Tarea agregada.'); app.recargar(); });
      const fpr = raiz.querySelector('#f-producto');
      if (fpr) alEnviar(fpr, async (d) => { await post(`/api/visitas/${v.id}/productos`, d); toast('Producto registrado.'); app.recargar(); });
    }
  };
}

// ---------------- Control y entrega ----------------
export function seccionControl(v, app) {
  const sinLiquidar = (v.presupuesto?.lineas || []).some((l) => l.estado === 'vigente' && resp(l) === 'autoriza' && l.realizado_at && l.importe > 0 && !l.cargo_id);
  const vigente = v.controles.find((c) => c.vigente);
  const anteriores = v.controles.filter((c) => !c.vigente);
  const yo = app.sesion.usuario;
  const asignado = yo.rol !== 'mecanico' || !v.responsable_id || v.responsable_id === yo.id;
  const lineas = (v.presupuesto?.lineas || []).filter((l) => l.estado === 'vigente');
  const bloqueos = [];
  if (lineas.some((l) => !resp(l))) bloqueos.push('Hay trabajos sin respuesta del cliente.');
  const pend = lineas.filter((l) => resp(l) === 'autoriza' && !l.realizado_at);
  if (pend.length) bloqueos.push(`Faltan trabajos autorizados: ${pend.map((l) => l.descripcion).join(', ')}.`);
  if (v.tareas.some((t) => t.estado === 'pendiente')) bloqueos.push('Hay tareas del service sin confirmar.');
  const postergados = lineas.filter((l) => resp(l) === 'posterga');
  const pendientesEntrega = postergados.length || (vigente && vigente.resultado !== 'resuelto');
  const metodos = window.TALLERES_CATALOGOS?.metodosControl || [];
  const proximo = v.seguimientos.find((s) => s.tipo === 'service' && s.estado === 'pendiente');
  const saldo = v.totales?.saldo || 0;
  const reglaSaldo = app.sesion.taller?.entregaSaldo || { regla: 'recepcion', puedo: true };
  const irCobros = `<a class="btn btn-chico" href="#/visitas/${v.id}/cobros">${icono('dinero')}Ir a Cobros</a>`;
  const bloqueoSaldo = saldo > 0 && !reglaSaldo.puedo
    ? (reglaSaldo.regla === 'ninguno' ? 'La regla de este taller es no entregar con saldo: registrá el pago antes de la entrega.' : 'En este taller solo el dueño autoriza entregar con saldo. Pedile que registre la entrega o cobrá el saldo.')
    : '';
  return {
    html: `<section class="bloque" aria-labelledby="t-ctl">
      <div class="bloque__cab"><h2 id="t-ctl">Control y entrega</h2><p>Comprobado, listo, entregado y pagado son pasos distintos.</p></div>
      ${vigente ? `<div class="panel panel__cuerpo bloque"><div class="fila"><h3>Resultado comprobado</h3>${chip(RES_TXT[vigente.resultado], vigente.resultado === 'resuelto' ? 'verde' : vigente.resultado === 'pendiente' ? 'rojo' : 'ambar', vigente.resultado === 'resuelto' ? 'check' : 'alerta')}</div>
          <p><strong>Cómo se comprobó:</strong> ${esc(vigente.como)}</p>${vigente.nota ? `<p class="muted">${esc(vigente.nota)}</p>` : ''}<p class="xs muted">${esc(vigente.por || '')} · ${esc(cuando(vigente.creado_at))}</p></div>`
        : (v.entregada_at ? '' : bloqueos.length ? aviso(`<strong>Todavía no se puede comprobar el resultado.</strong> ${bloqueos.map(esc).join(' ')}`, 'gris') :
          app.puede('control.registrar') && asignado && !cerrada(v) ? `<div class="panel panel__cuerpo"><form class="form" id="f-control" novalidate><h3>Comprobar el resultado</h3>
            ${opcionesRadio('resultado', RESULTADOS, '', 'Resultado')}
            ${campo({ nombre: 'metodo', etiqueta: 'Cómo se comprobó', tipo: 'select', opciones: [['', 'Elegí una forma…'], ...metodos.map((m) => [m, m])] })}
            ${campo({ nombre: 'como', etiqueta: 'Detalle de la comprobación', requerido: true, placeholder: 'Ej.: prueba de ruta 10 km con lomos de burro' })}
            ${campo({ nombre: 'nota', etiqueta: 'Observación para el cliente', tipo: 'textarea' })}
            <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('escudo')}Guardar resultado</button></div></form></div>` : aviso('El resultado lo comprueba el mecánico asignado o el dueño.', 'gris'))}
      ${anteriores.length ? `<details class="mas"><summary>Controles anteriores (${anteriores.length})</summary><div class="mas__cuerpo">${anteriores.map((c) => `<p class="small"><strong>${esc(RES_TXT[c.resultado])}</strong> · ${esc(c.como)} · ${esc(fechaHora(c.creado_at))}<br><span class="muted">${esc(c.reemplazado_motivo || '')}</span></p>`).join('')}</div></details>` : ''}
      ${v.tipo === 'service' || proximo ? `<div class="panel panel__cuerpo bloque"><h3>Próximo service</h3>
        ${proximo ? `<p><strong>${[proximo.km_objetivo != null ? km(proximo.km_objetivo) : null, proximo.fecha_objetivo ? fecha(proximo.fecha_objetivo) : null].filter(Boolean).join(' o ')}</strong> · ${esc(proximo.criterio || '')}</p>` : '<p class="muted">Todavía no se indicó el próximo service.</p>'}
        ${app.puede('trabajo.ejecutar') && asignado && !v.anulada_at ? `<details class="mas"><summary>${proximo ? 'Cambiar el próximo service' : 'Indicar el próximo service'}</summary><div class="mas__cuerpo"><form class="form" id="f-proximo" novalidate>
          <div class="fila-campos">${campo({ nombre: 'km', etiqueta: 'A los kilómetros', attrs: 'inputmode="numeric"' })}${campo({ nombre: 'fecha', etiqueta: 'O en la fecha', tipo: 'date' })}</div>
          ${campo({ nombre: 'criterio', etiqueta: 'Criterio', valor: 'Lo que ocurra primero.' })}
          ${casilla('confirma', 'Lo definí como técnico para este auto (el sistema no calcula intervalos solo)')}
          <button class="btn btn-primario" type="submit">Guardar próximo service</button></form></div></details>` : ''}</div>` : ''}
      ${!cerrada(v) && vigente && !v.lista_at && app.puede('visita.lista') ? `<div class="panel panel__cuerpo fila"><p>El resultado está comprobado. Marcar listo no lo entrega: sigue en Hoy hasta registrar la entrega.</p><button type="button" class="btn btn-primario" data-lista>${icono('check')}Marcar listo para retirar</button></div>` : ''}
      ${!cerrada(v) && v.lista_at && app.puede('visita.entregar') && sinLiquidar ? `<div class="panel panel__cuerpo fila"><p><strong>Antes de entregar falta liquidar.</strong> Hay trabajos realizados sin liquidar: en Cobros se fija el importe a cobrar.</p>${irCobros}</div>` : ''}
      ${!cerrada(v) && v.lista_at && app.puede('visita.entregar') && !sinLiquidar && bloqueoSaldo ? `<div class="panel panel__cuerpo fila"><p><strong>Queda un saldo de ${pesos(saldo)}.</strong> ${bloqueoSaldo}</p>${irCobros}</div>` : ''}
      ${!cerrada(v) && v.lista_at && app.puede('visita.entregar') && !sinLiquidar && !bloqueoSaldo ? `<div class="panel panel__cuerpo"><form class="form" id="f-entrega" novalidate><h3>Registrar entrega</h3>
          ${pendientesEntrega ? `${aviso(`Queda pendiente: ${[...postergados.map((l) => esc(l.descripcion)), vigente && vigente.resultado !== 'resuelto' ? 'el resultado no está resuelto del todo' : ''].filter(Boolean).join(', ')}.`, 'ambar', 'alerta')}${casilla('pendientesInformados', 'Le expliqué al cliente lo que queda pendiente')}` : ''}
          ${saldo > 0 ? `${aviso(`Queda un saldo de <strong>${pesos(saldo)}</strong>. Entregar no marca pagado: el saldo sigue en la cuenta del cliente.`, 'ambar', 'dinero')}${casilla('conSaldo', 'El cliente retira con saldo pendiente')}` : ''}
          ${campo({ nombre: 'nota', etiqueta: saldo > 0 ? 'Motivo y lo acordado sobre el saldo' : 'Nota de la entrega', tipo: 'textarea', requerido: saldo > 0, placeholder: saldo > 0 ? 'Ej.: cliente habitual, paga el viernes por transferencia' : '' })}
          <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Registrar entrega</button></div></form></div>` : ''}
      ${v.entregada_at ? `${aviso(`<strong>Entregado</strong> ${esc(fechaHora(v.entregada_at))}.${v.entrega_saldo ? ` Retiró con saldo pendiente de <strong>${pesos(v.entrega_saldo)}</strong>.` : ''}${v.entrega_nota ? ' ' + esc(v.entrega_nota) : ''}`, v.entrega_saldo ? 'ambar' : 'verde', v.entrega_saldo ? 'dinero' : 'check')}
        ${app.puede('visita.recibir') ? `<p><a class="btn" href="#/recibir?vehiculo=${v.vehiculo.id}&relacionada=${v.id}">${icono('historial')}Vuelve por el mismo problema</a></p><p class="muted small">Crea una visita nueva vinculada a esta. No aplica garantía automáticamente.</p>` : ''}` : ''}
    </section>`,
    enlazar(raiz) {
      const fc = raiz.querySelector('#f-control');
      if (fc) alEnviar(fc, async (d) => { await post(`/api/visitas/${v.id}/control`, { resultado: d.resultado, como: [d.metodo, d.como].filter(Boolean).join(': '), nota: d.nota }); toast('Resultado guardado.'); app.recargar(); });
      const fp = raiz.querySelector('#f-proximo');
      if (fp) alEnviar(fp, async (d) => { await post(`/api/visitas/${v.id}/proximo`, d); toast('Próximo service guardado. Aparece en Pendientes.'); app.recargar(); });
      raiz.querySelector('[data-lista]')?.addEventListener('click', () => acc(app, () => post(`/api/visitas/${v.id}/lista`, {}), 'Listo para retirar. Sigue en Hoy hasta la entrega.'));
      const fe = raiz.querySelector('#f-entrega');
      if (fe) alEnviar(fe, async (d) => { await post(`/api/visitas/${v.id}/entrega`, d); toast('Entrega registrada. La visita queda en el historial.'); app.recargar(); });
    }
  };
}

// ---------------- Cobros ----------------
export function seccionCobros(v, app) {
  const t = v.totales;
  const realizadoSinLiquidar = (v.presupuesto?.lineas || []).filter((l) => l.estado === 'vigente' && resp(l) === 'autoriza' && l.realizado_at && !l.cargo_id);
  const anulados = new Set(v.cuenta.filter((m) => m.anula_id).map((m) => m.anula_id));
  const clave = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const TIPO = { cargo: 'Liquidación', pago: 'Pago', devolucion_dinero: 'Devolución de dinero', nota_credito: 'Nota de crédito', anulacion: 'Anulación' };
  return {
    html: `<section class="bloque" aria-labelledby="t-cob">
      <div class="bloque__cab"><h2 id="t-cob">Cobros de esta visita</h2><p>Documentos internos, sin validez fiscal.</p></div>
      <div class="montos">
        <div class="monto"><span>Autorizado</span><b class="num">${pesos(t.autorizado)}</b></div>
        <div class="monto"><span>Realizado</span><b class="num">${pesos(t.realizado)}</b><small>Trabajos terminados</small></div>
        <div class="monto"><span>Liquidado</span><b class="num">${t.liquidado?pesos(t.liquidado):'Sin liquidar'}</b><small>Importe a cobrar fijado</small></div>
        <div class="monto"><span>Cobrado</span><b class="num">${pesos(t.cobrado)}</b></div>
        <div class="monto"><span>${!t.liquidado?'Saldo final':t.aFavor?'Saldo a favor':'Saldo pendiente'}</span><b class="num">${!t.liquidado?'Por fijar':pesos(t.aFavor||t.saldo)}</b>${!t.liquidado?'<small>Se fija al liquidar lo realizado</small>':t.aFavor?'<small>Dinero a favor del cliente</small>':''}</div>
      </div>
      ${realizadoSinLiquidar.length && app.puede('visita.liquidar') && !v.anulada_at ? `<div class="panel panel__cuerpo fila"><div><p><strong>Hay trabajos realizados sin liquidar:</strong> ${realizadoSinLiquidar.map((l) => esc(l.descripcion)).join(', ')} (${pesos(realizadoSinLiquidar.reduce((n, l) => n + l.importe, 0))}).</p><p class="muted small">Se liquida solo lo realizado. Lo postergado o rechazado nunca se suma.</p></div>
        <div class="bloque">${v.controles.some((c) => c.vigente) || v.entregada_at ? '' : `<p id="bloqueo-liquidar" class="small">Primero comprobá el resultado en <a href="#/visitas/${v.id}/control">Control y entrega</a>.</p>`}<button type="button" class="btn btn-oscuro" data-liquidar ${v.controles.some((c) => c.vigente) || v.entregada_at ? '' : 'disabled aria-disabled="true" aria-describedby="bloqueo-liquidar"'}>${icono('dinero')}Liquidar</button></div></div>` : ''}
      ${app.puede('caja.registrar') && !v.anulada_at && Math.max(t.liquidado, t.autorizado) > t.cobrado ? `<div class="panel panel__cuerpo"><form class="form" id="f-pago" novalidate data-clave="${clave}"><h3>${t.liquidado ? 'Registrar pago' : 'Registrar seña o anticipo'}</h3>
        <div class="fila-campos">${campo({ nombre: 'importe', etiqueta: 'Importe recibido', requerido: true, attrs: 'inputmode="decimal"', valor: t.saldo ? (t.saldo / 100).toFixed(t.saldo % 100 ? 2 : 0).replace('.', ',') : '' })}
          ${campo({ nombre: 'medio', etiqueta: 'Medio de pago', tipo: 'select', requerido: true, opciones: [['', 'Elegí…'], ...Object.entries(MEDIOS)] })}
          </div><details class="mas"><summary>Referencia y nota (opcional)</summary><div class="mas__cuerpo">${campo({ nombre: 'referencia', etiqueta: 'Referencia', placeholder: 'N.º de operación o comprobante' })}${campo({ nombre: 'nota', etiqueta: 'Nota' })}</div></details>
        <p class="muted small">Si el botón tarda, no lo toques dos veces: el sistema evita registrar el mismo pago dos veces.</p>
        <button class="btn btn-primario" type="submit">${icono('dinero')}Revisar cobro</button></form></div>` : ''}
      <div class="panel"><div class="panel__cab"><h3>Movimientos</h3></div>
        ${v.cuenta.length ? `<ul class="lista">${v.cuenta.map((m) => `<li><div class="fila"><span class="fila__izq"><strong>${esc(TIPO[m.tipo])}${m.tipo === 'anulacion' ? ' de ' + esc((TIPO[m.anula_tipo] || '').toLowerCase()) : ''}</strong>${m.medio ? `<span class="muted">${esc(MEDIOS[m.medio])}</span>` : ''}${anulados.has(m.id) ? chip('Anulado', 'rojo', 'ban') : ''}</span><strong class="num">${pesos(m.importe)}</strong></div>
          <p class="small muted">${esc(fechaHora(m.fecha))}${m.referencia ? ' · ' + esc(m.referencia) : ''}${m.motivo ? ' · ' + esc(m.motivo) : ''}</p>
          <div class="acciones">${m.tipo === 'pago' && !anulados.has(m.id) && app.puede('documentos.emitir') ? `<button type="button" class="btn btn-chico btn-texto" data-recibo="${m.id}">${icono('documento')}Recibo</button>` : ''}
          ${m.tipo !== 'anulacion' && !anulados.has(m.id) && app.puede('caja.anular') ? `<button type="button" class="btn btn-chico btn-texto" data-anular-mov="${m.id}">${icono('historial')}Anular</button>` : ''}</div></li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Sin movimientos de dinero.</p></div>'}</div>
      ${app.puede('caja.anular') && t.cobrado > 0 ? `<details class="mas"><summary>Devolver dinero al cliente</summary><div class="mas__cuerpo"><form class="form" id="f-devolucion" novalidate>
        <div class="fila-campos">${campo({ nombre: 'importe', etiqueta: 'Importe devuelto', requerido: true, attrs: 'inputmode="decimal"' })}${campo({ nombre: 'medio', etiqueta: 'Cómo se devolvió', tipo: 'select', opciones: Object.entries(MEDIOS) })}</div>
        ${campo({ nombre: 'motivo', etiqueta: 'Motivo', requerido: true })}<button class="btn btn-peligro" type="submit">${icono('historial')}Registrar devolución</button></form></div></details>` : ''}
    </section>`,
    enlazar(raiz) {
      raiz.querySelector('[data-liquidar]')?.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Liquidar la visita', texto: `Se fija el importe a cobrar con los trabajos realizados: ${realizadoSinLiquidar.map((l) => esc(l.descripcion)).join(', ')}.`, efecto: 'Lo postergado o rechazado no se suma. Si después se realiza otro trabajo autorizado, se liquida aparte.', aceptar: 'Liquidar' });
        if (r.ok) acc(app, () => post(`/api/visitas/${v.id}/liquidar`, {}), 'Liquidación creada.');
      });
      const fp = raiz.querySelector('#f-pago');
      if (fp) alEnviar(fp, async (d) => { if(!await revisarPago({importe:d.importe,medio:d.medio,destino:`Orden N.º ${v.numero} · ${v.vehiculo.patente} · ${v.contacto_nombre||'Sin contacto'}`,efecto:t.liquidado?'Registra el pago en la cuenta y en Caja. No entrega el vehículo.':'Registra un anticipo hasta el importe autorizado. La orden sigue sin liquidar.'}))return false; const r = await post(`/api/visitas/${v.id}/pagos`, d, { idempotencia: fp.dataset.clave }); toast(r.repetido ? 'Ese pago ya había quedado registrado: no se duplicó.' : 'Pago registrado.'); app.recargar(); });
      raiz.querySelectorAll('[data-anular-mov]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmar({ titulo: 'Anular el movimiento', texto: 'El movimiento original se conserva y se agrega una anulación que lo compensa.', aceptar: 'Anular', peligro: true, pedir: { etiqueta: 'Motivo de la anulación' } });
        if (r.ok) acc(app, () => post(`/api/movimientos/${b.dataset.anularMov}/anular`, { motivo: r.valor }), 'Movimiento anulado.');
      }));
      raiz.querySelectorAll('[data-recibo]').forEach((b) => b.addEventListener('click', async () => {
        try { const r = await post('/api/documentos', { tipo: 'recibo', refTipo: 'movimiento', refId: Number(b.dataset.recibo) }); app.ir('#/documentos/' + r.id); } catch (e) { toast(e.message, { error: true }); }
      }));
      const fd = raiz.querySelector('#f-devolucion');
      if (fd) alEnviar(fd, async (d) => { await post(`/api/visitas/${v.id}/devolucion`, d); toast('Devolución registrada.'); app.recargar(); });
    }
  };
}

// ---------------- Archivos, documentos, mensajes y QR ----------------
export function seccionArchivos(v, app, avisos) {
  const urlVisita = `${location.origin}/#/visitas/${v.id}`;
  const documentos = app.puede('documentos.emitir');
  const TIPOS_DOC = { presupuesto: 'Presupuesto', informe: 'Informe de trabajo', entrega: 'Resumen de entrega', recibo: 'Recibo', venta: 'Comprobante de venta' };
  const ESTADO_AVISO = { preparado: ['Preparado · no enviado', 'violeta', 'reloj'], abierto: ['Abierto para enviar · sin confirmar', 'ambar', 'mensaje'], enviado: ['Enviado (confirmado)', 'verde', 'check'], respondido: ['Respondió', 'verde', 'check'], fallido: ['No se pudo enviar', 'rojo', 'alerta'], descartado: ['Descartado', '', 'ban'] };
  const texto = v.lista_at ? `Hola ${v.contacto_nombre?.split(' ')[0] || ''}, te escribimos de ${app.sesion.taller.nombre}. Tu ${v.vehiculo.marca || 'auto'} ${v.vehiculo.modelo || ''} (${v.vehiculo.patente}) está listo para retirar.`
    : v.situacion.clave === 'autorizacion' ? `Hola ${v.contacto_nombre?.split(' ')[0] || ''}, te escribimos de ${app.sesion.taller.nombre}. Ya tenemos el presupuesto de tu ${v.vehiculo.marca || 'auto'} ${v.vehiculo.modelo || ''} (${v.vehiculo.patente}). ¿Te lo explicamos por teléfono?`
      : `Hola ${v.contacto_nombre?.split(' ')[0] || ''}, te escribimos de ${app.sesion.taller.nombre} por tu ${v.vehiculo.marca || 'auto'} ${v.vehiculo.modelo || ''} (${v.vehiculo.patente}).`;
  return {
    html: `<section class="bloque" aria-labelledby="t-arc">
      <div class="bloque__cab"><h2 id="t-arc">Fotos, videos e informes</h2><p>Privados del taller. Solo los ven usuarios con sesión.</p></div>
      ${v.adjuntos.length ? `<div class="grupos" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${v.adjuntos.map((a) => `<figure class="panel" style="margin:0;overflow:hidden">${a.mime.startsWith('image/') ? `<a href="/api/adjuntos/${a.id}" target="_blank" rel="noopener"><img src="/api/adjuntos/${a.id}" alt="${esc(a.descripcion || a.nombre_original)}" loading="lazy" width="400" height="300" style="width:100%;aspect-ratio:4/3;object-fit:cover;background:var(--surface-3)"></a>` : `<a class="panel__cuerpo fila" href="/api/adjuntos/${a.id}" target="_blank" rel="noopener">${icono(a.mime.startsWith('video/') ? 'camara' : 'documento')}<span>${esc(a.nombre_original)}</span></a>`}
        <figcaption class="panel__cuerpo small" style="padding:10px"><strong>${esc(a.descripcion || a.nombre_original)}</strong><br><span class="muted xs">${esc(a.por || '')} · ${esc(fechaHora(a.creado_at))}</span></figcaption></figure>`).join('')}</div>` : '<p class="muted">Todavía no hay archivos en esta visita.</p>'}
      ${app.puede('adjuntos.subir') && !v.anulada_at ? `<form class="form panel panel__cuerpo" id="f-archivo" novalidate><div class="fila-campos">
          <div class="campo" data-campo="archivo"><label for="arc-in">Foto, video o PDF (hasta 15 MB)</label><input id="arc-in" type="file" name="archivo" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf" required></div>
          ${campo({ nombre: 'descripcion', etiqueta: 'Qué muestra', placeholder: 'Ej.: pérdida en amortiguador trasero izquierdo' })}</div>
        <button class="btn btn-primario" type="submit">${icono('subir')}Subir archivo</button></form>` : ''}
    </section>
    ${documentos ? `<section class="bloque" aria-labelledby="t-docs"><div class="bloque__cab"><h2 id="t-docs">Documentos de la visita</h2><p>Se guarda una copia con fecha. No son facturas.</p></div>
      <div class="acciones">${v.presupuesto ? `<button type="button" class="btn" data-doc="presupuesto">${icono('documento')}Preparar presupuesto</button>` : ''}<button type="button" class="btn" data-doc="informe">${icono('documento')}Preparar informe de trabajo</button>${v.lista_at || v.entregada_at ? `<button type="button" class="btn" data-doc="entrega">${icono('documento')}Preparar resumen de entrega</button>` : ''}</div>
      ${(v.hallazgos||[]).some(h=>h.adjunto_id&&!h.foto_archivada)?`<label class="check"><input type="checkbox" data-fotos-informe><span>Incluir una copia de las fotos de hallazgos en el informe y resumen de entrega. Se verán si compartís ese documento con el cliente.</span></label>`:''}
      ${v.documentos.length ? `<ul class="lista panel">${v.documentos.map((d) => `<li><a class="fila" href="#/documentos/${d.id}"><span>${esc(TIPOS_DOC[d.tipo])} N.º ${esc(d.numero)}</span><span class="muted small">${esc(fechaHora(d.creado_at))}${d.anulado_at ? ' · anulado' : ''}</span></a></li>`).join('')}</ul>` : ''}</section>` : ''}
    ${app.puede('avisos.preparar') ? `<section class="bloque" aria-labelledby="t-msj"><div class="bloque__cab"><h2 id="t-msj">Mensajes al cliente</h2><p>Preparar no es enviar.</p></div>
      ${avisos.length ? `<ul class="lista panel">${avisos.map((a) => `<li><div class="fila"><span class="small">${esc(a.texto.slice(0, 90))}${a.texto.length > 90 ? '…' : ''}</span>${chip(...ESTADO_AVISO[a.estado])}</div><p class="xs muted">${esc(a.canal)} · ${esc(a.por || '')} · ${esc(fechaHora(a.actualizado_at))}</p>
        <div class="acciones">${a.estado === 'preparado' || a.estado === 'abierto' ? `${a.canal === 'whatsapp' && a.telefono ? `<button type="button" class="btn btn-chico" data-abrir-wa="${a.id}">${icono('mensaje')}Abrir WhatsApp</button>` : ''}<button type="button" class="btn btn-chico" data-copiar-aviso="${a.id}">${icono('copiar')}Copiar texto</button><button type="button" class="btn btn-chico" data-aviso-estado="${a.id}" data-e="enviado">Ya lo envié</button><button type="button" class="btn btn-chico btn-texto" data-aviso-estado="${a.id}" data-e="descartado">Descartar</button>` : ''}
          ${a.estado === 'enviado' ? `<button type="button" class="btn btn-chico" data-aviso-estado="${a.id}" data-e="respondido">El cliente respondió</button>` : ''}</div></li>`).join('')}</ul>` : ''}
      <details class="mas"><summary>Preparar un mensaje</summary><div class="mas__cuerpo"><form class="form" id="f-aviso" novalidate>
        ${campo({ nombre: 'canal', etiqueta: 'Por dónde', tipo: 'select', opciones: [['whatsapp', 'WhatsApp (lo enviás vos)'], ['telefono', 'Llamada'], ['correo', 'Correo'], ['presencial', 'En persona']] })}
        ${campo({ nombre: 'texto', etiqueta: 'Mensaje', tipo: 'textarea', requerido: true, valor: texto })}
        <button class="btn btn-primario" type="submit">Preparar mensaje</button></form></div></details></section>` : ''}
    <section class="bloque" aria-labelledby="t-qr"><div class="bloque__cab"><h2 id="t-qr">Etiqueta para la llave</h2><p>El QR abre esta visita solo para usuarios del taller.</p></div>
      <div class="etiqueta-llave" id="etiqueta"><div style="width:110px">${qrSVG(urlVisita)}</div><div><span class="patente">${esc(v.vehiculo.patente)}</span><p style="margin-top:6px"><strong>Visita N.º ${esc(v.numero)}</strong></p><p class="small">${esc(fecha(v.ingreso_at))}</p></div></div>
      <div class="acciones no-imprimir"><button type="button" class="btn btn-chico" data-imprimir-etiqueta>${icono('imprimir')}Imprimir etiqueta</button></div></section>`,
    enlazar(raiz) {
      const fa = raiz.querySelector('#f-archivo');
      if (fa) alEnviar(fa, async (d) => {
        const archivo = fa.querySelector('#arc-in').files[0];
        if (!archivo) throw Object.assign(new Error('Elegí un archivo.'), { campo: 'archivo' });
        if (archivo.size > 15 * 1024 * 1024) throw Object.assign(new Error('El archivo supera los 15 MB. Probá con una foto más liviana.'), { campo: 'archivo' });
        await api('POST', `/api/adjuntos?ambito=visita&visitaId=${v.id}&descripcion=${encodeURIComponent(d.descripcion || '')}`, undefined, { archivo, cabeceras: { 'X-Nombre-Archivo': encodeURIComponent(archivo.name) } });
        toast('Archivo guardado en la visita.');
        app.recargar();
      });
      raiz.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', async () => {
        b.classList.add('cargando');
        try { const r = await post('/api/documentos', { tipo: b.dataset.doc, refTipo: 'visita', refId: v.id, incluirFotos:!!raiz.querySelector('[data-fotos-informe]:checked') }); app.ir('#/documentos/' + r.id); } catch (e) { toast(e.message, { error: true }); } finally { b.classList.remove('cargando'); }
      }));
      const fv = raiz.querySelector('#f-aviso');
      if (fv) alEnviar(fv, async (d) => { await post('/api/avisos', { visitaId: v.id, canal: d.canal, texto: d.texto }); toast('Mensaje preparado. Todavía no se envió.'); app.recargar(); });
      raiz.querySelectorAll('[data-abrir-wa]').forEach((b) => b.addEventListener('click', async () => {
        const a = avisos.find((x) => x.id === Number(b.dataset.abrirWa));
        const d = String(a.telefono || '').replace(/\D/g, '').replace(/^0+/, '');
        const n = d.startsWith('54') ? d : d.length === 10 ? '549' + d : d;
        window.open(`https://wa.me/${n}?text=${encodeURIComponent(a.texto)}`, '_blank', 'noopener');
        acc(app, () => post(`/api/avisos/${a.id}/estado`, { estado: 'abierto' }), 'WhatsApp abierto. Cuando lo envíes, tocá «Ya lo envié».');
      }));
      raiz.querySelectorAll('[data-copiar-aviso]').forEach((b) => b.addEventListener('click', () => copiar(avisos.find((x) => x.id === Number(b.dataset.copiarAviso)).texto)));
      raiz.querySelectorAll('[data-aviso-estado]').forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.e === 'enviado') {
          const r = await confirmar({ titulo: '¿El mensaje salió?', texto: 'Confirmá solo si lo enviaste o viste que se envió. Abrir WhatsApp no alcanza.', aceptar: 'Sí, se envió' });
          if (!r.ok) return;
        }
        acc(app, () => post(`/api/avisos/${b.dataset.avisoEstado}/estado`, { estado: b.dataset.e, confirmo: true }), 'Estado del mensaje actualizado.');
      }));
      raiz.querySelector('[data-imprimir-etiqueta]')?.addEventListener('click', () => {
        document.body.classList.add('modo-etiqueta');
        const fin = () => { document.body.classList.remove('modo-etiqueta'); window.removeEventListener('afterprint', fin); };
        window.addEventListener('afterprint', fin);
        window.print();
        setTimeout(fin, 1000);
      });
    }
  };
}
