// Secciones de la visita. Cada una devuelve { html, enlazar(raiz) } y vuelve a dibujar con datos del servidor tras cada acción.
import { api, get, post, put, claveDeEnvio } from '../api.js?v=0.1.0';
import {
  esc, icono, pesos, cant, km, fecha, fechaHora, cuando, chip, chipRespuesta, chipEtapa, ETAPAS, TIPO_LINEA, MEDIOS, UNIDADES, CANALES, campo, opcionesRadio, casilla,
  alEnviar, toast, confirmar, aviso, aEntradaDinero, aEntradaCant, copiar, numeroEntrada, revisarPago
} from '../ui.js?v=0.1.0';
import { qrSVG } from '../qr-util.js?v=0.1.0';
import {catalogoPresupuesto,enlazarCatalogoPresupuesto} from '../presupuesto-pos.js?v=0.1.0';
import {normalizar} from '../seleccion-rapida.js?v=0.1.0';
import {vistaHallazgos,enlazarHallazgos} from '../hallazgos.js?v=0.1.0';

const resp = (l) => l.respuesta?.respuesta || (l.autorizada_ingreso ? 'autoriza' : null);
const RESULTADOS = [['resuelto', 'Resuelto y comprobado', 'check'], ['mejoro', 'Mejoró, pero falta resolver', 'alerta'], ['no_reproducido', 'No se pudo reproducir el problema', 'info'], ['pendiente', 'Sigue pendiente', 'reloj']];
const RES_TXT = Object.fromEntries(RESULTADOS.map(([k, t]) => [k, t]));
const ESTADO_REV = { en_revision: ['En revisión', 'teal', 'buscar'], sin_falla: ['Sin falla encontrada', 'azul', 'info'], confirmado: ['Diagnóstico confirmado', 'verde', 'check'] };
const cerrada = (v) => !!(v.entregada_at || v.anulada_at);
const acc = async (app, fn, ok) => { try { await fn(); if (ok) toast(ok); app.recargar(); } catch (e) { toast(e.message, { error: true }); } };

// ---------------- Revisión ----------------
export function seccionRevision(v, app) {
  const r = v.revision;
  const puede = app.puede('revision.registrar') && !cerrada(v) && !v.controles.some((c) => c.vigente) && (app.sesion.usuario.rol !== 'mecanico' || !v.responsable_id || v.responsable_id === app.sesion.usuario.id);
  const ver = (t, x) => x ? `<div class="dato"><span>${t}</span><p>${esc(x).replace(/\n/g, '<br>')}</p></div>` : '';
  return {
    html: `${vistaHallazgos(v,app,puede)}<section class="bloque" aria-labelledby="t-rev">
      <div class="bloque__cab"><h2 id="t-rev">Revisión técnica</h2>${r ? `<p>Versión ${r.version_num} · ${esc(r.por || '')} · ${esc(fechaHora(r.creado_at))}</p>` : ''}</div>
      ${v.autorizacion_ingreso ? aviso(esc(v.autorizacion_ingreso), 'gris', 'escudo') : ''}
      ${r ? `<div class="panel panel__cuerpo bloque">${chip(...ESTADO_REV[r.estado])}
          ${ver('Lo que cuenta el cliente', r.relato)}${ver('Lo que se observó', r.hallazgos)}${ver('Lo que podría ser (sin confirmar)', r.hipotesis)}${ver('Pruebas realizadas', r.pruebas)}${ver('Diagnóstico confirmado', r.diagnostico)}${ver('Recomendación', r.recomendacion)}
          <p class="muted small">Registrar la revisión no autoriza trabajos.</p></div>`
        : `<p class="muted">Todavía no se registró la revisión.${v.tipo === 'service' ? ' En un service autorizado no hace falta un diagnóstico extenso.' : ''}</p>`}
      ${v.revisionesAnteriores.length ? `<details class="mas"><summary>Versiones anteriores (${v.revisionesAnteriores.length})</summary><div class="mas__cuerpo">${v.revisionesAnteriores.slice().reverse().map((x) => `<div class="bloque"><p><strong>Versión ${x.version_num}</strong> · ${esc(x.por || '')} · ${esc(fechaHora(x.creado_at))} · ${esc(ESTADO_REV[x.estado][0])}</p><p class="small">${esc(x.hallazgos)}</p>${x.diagnostico ? `<p class="small">Diagnóstico: ${esc(x.diagnostico)}</p>` : ''}</div>`).join('')}</div></details>` : ''}
      ${puede ? `<details class="mas" ${!r ? 'open' : ''}><summary>${r ? 'Actualizar la revisión (crea una versión nueva)' : 'Registrar la revisión'}</summary><div class="mas__cuerpo">
        <form class="form" id="f-revision" novalidate>
          ${campo({ nombre: 'relato', etiqueta: 'Lo que cuenta el cliente', tipo: 'textarea', requerido: true, valor: r?.relato || v.motivo })}
          ${campo({ nombre: 'hallazgos', etiqueta: 'Observaciones generales', tipo: 'textarea', requerido: !(v.hallazgos||[]).length, valor: r?.hallazgos || '', ayuda: (v.hallazgos||[]).length ? 'Los hallazgos de arriba ya se incluyen por separado en el informe; no hace falta repetirlos.' : 'También podés registrar observaciones por separado en Hallazgos.' })}
          ${campo({ nombre: 'hipotesis', etiqueta: 'Lo que podría ser (todavía sin confirmar)', tipo: 'textarea', valor: r?.hipotesis || '' })}
          ${campo({ nombre: 'pruebas', etiqueta: 'Pruebas realizadas', tipo: 'textarea', valor: r?.pruebas || '', ayuda: 'Necesarias para concluir.' })}
          ${opcionesRadio('estado', [['en_revision', 'Sigue en revisión'], ['sin_falla', 'Sin falla encontrada'], ['confirmado', 'Diagnóstico confirmado']], r?.estado || 'en_revision', '¿Cómo está la revisión?')}
          <div data-diag ${r?.estado === 'confirmado' ? '' : 'hidden'} class="bloque">
            ${campo({ nombre: 'diagnostico', etiqueta: 'Diagnóstico confirmado', tipo: 'textarea', valor: r?.diagnostico || '' })}
            ${casilla('confirma', 'Confirmo que lo comprobé con las pruebas registradas')}
          </div>
          ${campo({ nombre: 'recomendacion', etiqueta: 'Recomendación para el presupuesto', tipo: 'textarea', valor: r?.recomendacion || '' })}
          <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Guardar revisión</button></div>
        </form></div></details>` : ''}
    </section>`,
    enlazar(raiz) {
      enlazarHallazgos(raiz,v,app);
      const f = raiz.querySelector('#f-revision');
      if (!f) return;
      const diag = f.querySelector('[data-diag]');
      f.querySelectorAll('[name="estado"]').forEach((x) => x.addEventListener('change', () => { diag.hidden = f.querySelector('[name="estado"]:checked').value !== 'confirmado'; }));
      alEnviar(f, async (d) => {
        await post(`/api/visitas/${v.id}/revision`, { ...d, diagnostico: d.estado === 'confirmado' ? d.diagnostico : '', versionActual: r?.version_num || 0 });
        toast('Revisión guardada como versión nueva.');
        app.ir(`#/visitas/${v.id}/revision`);
      });
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

export function seccionPresupuesto(v, app, cat) {
  const dinero = app.puede('ver.dinero');
  const p = v.presupuesto;
  const lineas = p?.lineas || [];
  const vigentes = lineas.filter((l) => l.estado === 'vigente');
  const otras = lineas.filter((l) => l.estado !== 'vigente');
  const sinResp = vigentes.filter((l) => !resp(l));
  const conResp = vigentes.filter((l) => l.respuesta && !l.realizado_at);
  const puedePrep = app.puede('presupuesto.preparar') && !cerrada(v);
  const puedeResp = app.puede('presupuesto.respuesta') && !cerrada(v);
  const t = v.totales;
  const lineaHTML = (l) => {
    const reemplazo = lineas.find((x) => x.origen_linea_id === l.id && x.estado === 'vigente');
    const origen = l.origen_linea_id ? lineas.find((x) => x.id === l.origen_linea_id) : null;
    return `<div class="linea ${l.estado !== 'vigente' ? 'linea--reemplazada' : ''}">
      <div class="linea__top"><div><p class="linea__desc">${esc(l.descripcion)}</p>
        <p class="linea__meta">${esc(TIPO_LINEA[l.tipo])} · ${esc(cant(l.cantidad_m, l.unidad))}${dinero ? ' × ' + pesos(l.precio_unit) : ''} · versión ${l.version_num}${l.autorizada_ingreso ? ' · autorizado al recibir' : ''}</p></div>
        ${dinero ? `<span class="linea__importe num">${pesos(l.importe)}</span>` : ''}</div>
      <div class="acciones">${l.estado === 'vigente' ? chipRespuesta(resp(l), !!l.origen_linea_id) : l.estado === 'reemplazada' ? chip(reemplazo ? 'Reemplazada por un cambio' : 'Reemplazada', '', 'historial') : chip('Cambio rechazado: no rige', '', 'ban')}
        ${l.realizado_at ? chip('Realizado', 'verde', 'llave') : ''}
        ${l.respuesta ? `<span class="muted small">${esc(l.respuesta.persona)} · ${esc(CANALES[l.respuesta.canal] || l.respuesta.canal)} · ${esc(cuando(l.respuesta.fecha_respuesta))}</span>` : ''}
        ${l.estado === 'vigente' && puedePrep && !l.realizado_at && !l.cargo_id && !reemplazo ? `<button type="button" class="btn btn-chico btn-texto" data-cambiar="${l.id}">${icono('lapiz', 'i-sm')}Cambiar</button>` : ''}</div>
      ${origen ? `<p class="small muted">Cambio sobre «${esc(origen.descripcion)}»${dinero ? ` (antes ${pesos(origen.importe)})` : ''}. ${resp(origen) === 'autoriza' ? 'La autorización anterior se conserva mientras el cliente responde.' : ''}</p>` : ''}
      ${l.respuesta?.nota ? `<p class="small muted">Nota: ${esc(l.respuesta.nota)}</p>` : ''}
      <div data-form-cambio="${l.id}" hidden></div>
    </div>`;
  };
  return {
    html: `<section class="bloque" aria-labelledby="t-pre">
      <div class="bloque__cab"><h2 id="t-pre">Presupuesto y respuesta del cliente</h2>${p ? `<p>Versión ${p.versiones.at(-1).numero} · válido hasta ${esc(fecha(p.versiones.at(-1).validez_hasta))}</p>` : ''}</div>
      ${dinero && t && p ? `<div class="montos">
        <div class="monto"><span>${icono('documento', 'i-sm')}Presupuestado</span><b class="num">${pesos(t.presupuestado)}</b><small>Total de lo vigente</small></div>
        <div class="monto"><span style="color:var(--green)">${icono('check', 'i-sm')}Autorizado</span><b class="num">${pesos(t.autorizado)}</b><small>Se hace en esta visita</small></div>
        ${t.postergado ? `<div class="monto"><span style="color:var(--amber)">${icono('pausa', 'i-sm')}Para más adelante</span><b class="num">${pesos(t.postergado)}</b><small>No se incluye ni se cobra</small></div>` : ''}
        ${t.sinRespuesta ? `<div class="monto"><span style="color:var(--purple)">${icono('reloj', 'i-sm')}Sin respuesta</span><b class="num">${pesos(t.sinRespuesta)}</b><small>Falta que el cliente responda</small></div>` : ''}
      </div>` : ''}
      ${!dinero ? aviso('Ves qué está autorizado y qué no. Los importes los ve recepción o el dueño.', 'gris') : ''}
      ${vigentes.length ? `<div class="panel">${vigentes.map(lineaHTML).join('')}</div>` : `<p class="muted">${v.tipo === 'revision' ? 'Todavía no hay presupuesto. Se prepara con lo que surge de la revisión.' : 'Sin líneas de presupuesto. Si el importe del service se acordó, podés cargarlo acá.'}</p>`}
      ${otras.length ? `<details class="mas"><summary>Líneas reemplazadas o rechazadas (${otras.length})</summary><div class="mas__cuerpo panel" style="padding:0">${otras.map(lineaHTML).join('')}</div></details>` : ''}
      ${puedeResp && sinResp.length ? `<div class="panel panel__cuerpo bloque" id="respuesta"><h3>Registrar respuesta del cliente</h3>
        <form class="form" id="f-respuesta" novalidate>
          ${sinResp.map((l) => `<fieldset class="grupo" data-campo="r-${l.id}"><legend>${esc(l.descripcion)}${dinero ? ' · ' + pesos(l.importe) : ''}${l.origen_linea_id ? ' <span class="estado estado--violeta">Cambio</span>' : ''}</legend>
            <div class="opciones">${[['autoriza', 'Autoriza', 'check'], ['rechaza', 'No autoriza', 'ban'], ...(l.origen_linea_id ? [] : [['posterga', 'Para más adelante', 'pausa']])].map(([k, tx, ic]) => `<label class="opcion"><input type="radio" name="r-${l.id}" value="${k}"><span>${icono(ic)}${tx}</span></label>`).join('')}</div>
            <input type="text" name="n-${l.id}" class="sr" aria-hidden="true" tabindex="-1"></fieldset>`).join('')}
          <div class="fila-campos">${campo({ nombre: 'persona', etiqueta: '¿Quién respondió?', requerido: true, valor: v.contacto_nombre || '' })}
            ${campo({ nombre: 'canal', etiqueta: '¿Por dónde?', tipo: 'select', opciones: [['telefono', 'Teléfono'], ['whatsapp', 'WhatsApp'], ['presencial', 'En persona'], ['correo', 'Correo'], ['otro', 'Otro']] })}
            ${campo({ nombre: 'fecha', etiqueta: 'Cuándo', tipo: 'datetime-local', ayuda: 'Vacío = ahora.' })}</div>
          ${campo({ nombre: 'nota', etiqueta: 'Nota (por ejemplo, por qué lo deja para después)' })}
          <p class="muted small">Podés responder solo algunas líneas: lo autorizado se habilita y el resto sigue esperando.</p>
          <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Guardar respuesta</button></div>
        </form></div>` : ''}
      ${puedeResp && conResp.length ? `<details class="mas"><summary>Corregir una respuesta ya registrada</summary><div class="mas__cuerpo"><form class="form" id="f-corregir-resp" novalidate>
        ${campo({ nombre: 'lineaId', etiqueta: 'Trabajo', tipo: 'select', opciones: conResp.map((l) => [l.id, `${l.descripcion} (${chipTexto(resp(l))})`]) })}
        ${campo({ nombre: 'respuesta', etiqueta: 'Respuesta correcta', tipo: 'select', opciones: [['autoriza', 'Autoriza'], ['rechaza', 'No autoriza'], ['posterga', 'Para más adelante']] })}
        <div class="fila-campos">${campo({ nombre: 'persona', etiqueta: '¿Quién respondió?', requerido: true, valor: v.contacto_nombre || '' })}${campo({ nombre: 'canal', etiqueta: '¿Por dónde?', tipo: 'select', opciones: [['telefono', 'Teléfono'], ['whatsapp', 'WhatsApp'], ['presencial', 'En persona'], ['otro', 'Otro']] })}</div>
        ${campo({ nombre: 'nota', etiqueta: 'Motivo de la corrección', requerido: true })}
        <button class="btn" type="submit">Guardar corrección</button></form></div></details>` : ''}
      ${puedePrep ? `<details class="mas" ${!vigentes.length ? 'open' : ''}><summary>${vigentes.length ? 'Agregar trabajos (versión nueva, no cambia lo respondido)' : 'Preparar el presupuesto'}</summary><div class="mas__cuerpo">
        <datalist id="dl-trabajos">${[...(cat?.servicios||[]).filter(x=>x.activo).map(x=>x.nombre),...(cat?.articulos||[]).filter(x=>x.activo).map(x=>x.nombre),...(cat?.trabajos || []).map((x) => x.nombre), ...(window.TALLERES_CATALOGOS?.productos || []).map((x) => x.nombre)].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
        <form class="form presupuesto-editor" id="f-presupuesto" novalidate>
          ${catalogoPresupuesto(cat)}
          <div class="fila"><h3 data-borrador-titulo tabindex="-1">Líneas del borrador</h3><span class="small muted">Revisá cantidades y precios</span></div>
          <div class="lineas-form" data-lineas>${formLinea(0)}</div>
          <div class="acciones"><button type="button" class="btn btn-chico" data-otra>${icono('mas')}Agregar otra línea</button></div>
          <details class="calculadora-inline"><summary>${icono('calculadora')}Calcular mano de obra acá</summary><div><div class="fila-campos">${campo({nombre:'horasCalculo',etiqueta:'Horas estimadas',attrs:'inputmode="decimal"',valor:'1'})}${campo({nombre:'tarifaCalculo',etiqueta:'Valor por hora',attrs:'inputmode="decimal"',valor:aEntradaDinero(cat.valorHora),ayuda:'Tarifa del taller; podés ajustarla para este cálculo.'})}${campo({nombre:'trabajoCalculo',etiqueta:'Trabajo',valor:'Mano de obra',attrs:'list="dl-trabajos"'})}</div><p class="small muted">Horas × tarifa. El responsable decide el importe y el cliente debe autorizarlo.</p><button type="button" class="btn" data-calcular-linea>Agregar mano de obra al editor</button><p data-calculo-error role="alert" class="small"></p></div></details>
          <div class="presupuesto-total"><span>Esta versión · todavía sin guardar</span><strong data-total>$0</strong></div>
          ${campo({ nombre: 'nota', etiqueta: 'Nota de la versión', placeholder: vigentes.length ? 'Ej.: trabajo adicional encontrado al desarmar' : '' })}
          <div class="form-pie"><button class="btn btn-primario" type="submit">${icono('check')}Guardar presupuesto</button></div>
        </form></div></details>` : ''}
      ${p ? `<details class="mas"><summary>Versiones del presupuesto (${p.versiones.length})</summary><div class="mas__cuerpo"><ol class="actividad">${p.versiones.slice().reverse().map((x) => `<li><div><time>${esc(fechaHora(x.creado_at))} · ${esc(x.por || '')}</time><p><strong>Versión ${x.numero}</strong> · ${esc(x.nota || '')}</p>${x.cambios ? `<p class="small muted">${JSON.parse(x.cambios).map(esc).join('; ')}</p>` : ''}</div></li>`).join('')}</ol>
        <p class="small muted">Las versiones anteriores y sus respuestas no se modifican.</p></div></details>` : ''}
    </section>`,
    enlazar(raiz) {
      const fr = raiz.querySelector('#f-respuesta');
      if (fr) alEnviar(fr, async (d) => {
        const respuestas = sinResp.filter((l) => d[`r-${l.id}`]).map((l) => ({ lineaId: l.id, respuesta: d[`r-${l.id}`], nota: d.nota }));
        if (!respuestas.length) throw Object.assign(new Error('Elegí la respuesta de al menos un trabajo.'), { campo: `r-${sinResp[0].id}` });
        await post(`/api/visitas/${v.id}/respuestas`, { persona: d.persona, canal: d.canal, fecha: d.fecha || null, respuestas });
        toast('Respuesta del cliente guardada.');
        app.recargar();
      });
      const fc = raiz.querySelector('#f-corregir-resp');
      if (fc) alEnviar(fc, async (d) => { await post(`/api/visitas/${v.id}/respuestas`, { persona: d.persona, canal: d.canal, respuestas: [{ lineaId: Number(d.lineaId), respuesta: d.respuesta, nota: d.nota, corrige: true }] }); toast('Respuesta corregida. La anterior queda registrada.'); app.recargar(); });
      raiz.querySelectorAll('[data-cambiar]').forEach((b) => b.addEventListener('click', () => {
        const l = lineas.find((x) => x.id === Number(b.dataset.cambiar));
        const cont = raiz.querySelector(`[data-form-cambio="${l.id}"]`);
        cont.hidden = false;
        cont.innerHTML = `<form class="form panel panel__cuerpo" novalidate>
          ${resp(l) === 'autoriza' ? aviso('Este trabajo ya está autorizado. El cambio crea una versión nueva y necesita la respuesta del cliente; mientras tanto se conserva lo autorizado.', 'ambar', 'alerta') : ''}
          <div class="fila-campos">${campo({ nombre: 'descripcion', etiqueta: 'Detalle', valor: l.descripcion })}${campo({ nombre: 'cantidad', etiqueta: 'Cantidad', valor: aEntradaCant(l.cantidad_m), attrs: 'inputmode="decimal"' })}${campo({ nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', valor: l.unidad, opciones: UNIDADES })}${dinero ? campo({ nombre: 'precio', etiqueta: 'Precio unitario', valor: aEntradaDinero(l.precio_unit), attrs: 'inputmode="decimal"' }) : ''}</div>
          ${campo({ nombre: 'motivo', etiqueta: 'Motivo del cambio', requerido: true, placeholder: 'Ej.: el proveedor actualizó el precio' })}
          <div class="form-pie"><button class="btn btn-primario" type="submit">Guardar cambio</button><button type="button" class="btn" data-cancelar>Cancelar</button></div></form>`;
        const f = cont.querySelector('form');
        f.querySelector('[data-cancelar]').onclick = () => { cont.hidden = true; cont.innerHTML = ''; };
        alEnviar(f, async (d) => { await post(`/api/visitas/${v.id}/lineas/${l.id}/modificar`, d); toast('Cambio guardado en una versión nueva. Falta la respuesta del cliente.'); app.recargar(); });
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
    <button class="btn btn-primario" type="submit">Agregar repuesto</button></form></div></details>`;
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
          ${m.tipo !== 'anulacion' && !anulados.has(m.id) && app.puede('caja.anular') ? `<button type="button" class="btn btn-chico btn-texto" data-anular-mov="${m.id}">Anular</button>` : ''}</div></li>`).join('')}</ul>` : '<div class="panel__cuerpo"><p class="muted">Sin movimientos de dinero.</p></div>'}</div>
      ${app.puede('caja.anular') && t.cobrado > 0 ? `<details class="mas"><summary>Devolver dinero al cliente</summary><div class="mas__cuerpo"><form class="form" id="f-devolucion" novalidate>
        <div class="fila-campos">${campo({ nombre: 'importe', etiqueta: 'Importe devuelto', requerido: true, attrs: 'inputmode="decimal"' })}${campo({ nombre: 'medio', etiqueta: 'Cómo se devolvió', tipo: 'select', opciones: Object.entries(MEDIOS) })}</div>
        ${campo({ nombre: 'motivo', etiqueta: 'Motivo', requerido: true })}<button class="btn btn-peligro" type="submit">Registrar devolución</button></form></div></details>` : ''}
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
