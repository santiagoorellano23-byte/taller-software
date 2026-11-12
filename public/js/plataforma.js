// Panel central de Growth Labs: talleres, altas, plan, suscripción, pagos conciliados a mano y registro.
// Todas las reglas las aplica el servidor (server/routes/plataforma.js); esta pantalla solo las presenta.
import { api, get, post, put, claveDeEnvio } from './api.js?v=0.1.0';
import { esc, icono, chip, campo, casilla, alEnviar, toast, aviso, copiar, fechaHora } from './ui.js?v=0.1.0';

const main = document.getElementById('contenido');
const G = '<svg viewBox="272 272 384 384" aria-hidden="true"><path fill="currentColor" d="M464 272A192 192 0 1 0 652.2 502H572.5A115 115 0 1 1 464 349ZM464 426H656V502H464Z"/><path fill="var(--marca-texto)" d="M580 272H656V348H580Z"/></svg>';
const marca = `<span class="marca-producto" translate="no">${G}<span><strong>Growth Labs</strong><span>Panel de talleres</span></span></span>`;
const f = (d) => d ? d.split('-').reverse().join('/') : '—';
const COLOR = { prueba: 'azul', activa: 'verde', vencida: 'ambar', suspendida: '', cancelada: '' };
const MODALIDADES = [['manual', 'Manual'], ['transferencia', 'Transferencia'], ['sin_cargo', 'Sin cargo']];
let sesion = null, planes = [], elegido = null;

function caja(html) { main.innerHTML = `<div class="ingreso"><div class="ingreso__caja">${marca}${html}</div></div>`; }

async function iniciar() {
  const token = (location.hash.match(/acceso=([\w-]+)/) || [])[1];
  if (token) return pantallaAcceso(token);
  try { sesion = await get('/api/plataforma/sesion'); } catch (e) { if (e.estado === 401) return pantallaIngreso(); throw e; }
  planes = (await get('/api/plataforma/planes')).planes;
  pantallaPanel();
}

function pantallaIngreso() {
  document.title = 'Ingresar · Panel Growth Labs';
  caja(`<h1>Panel de Growth Labs</h1><p class="muted small">Acceso solo para el equipo de Growth Labs. Las cuentas de los talleres no sirven aquí.</p>
    <form class="form" id="f-in" novalidate data-sin-aviso>${campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email', requerido: true, attrs: 'autocomplete="username"' })}${campo({ nombre: 'clave', etiqueta: 'Contraseña', tipo: 'password', requerido: true, attrs: 'autocomplete="current-password"' })}
    <button class="btn btn-primario btn-ancho" type="submit">Ingresar</button></form>`);
  alEnviar(main.querySelector('#f-in'), async (d) => { await post('/api/plataforma/ingresar', d); iniciar(); });
  main.querySelector('input').focus();
}

function pantallaAcceso(token) {
  caja(`<h1>Crear tu contraseña del panel</h1><p class="muted small">Al menos 10 caracteres. Puede ser una frase.</p>
    <form class="form" id="f-acc" novalidate data-sin-aviso>${campo({ nombre: 'clave', etiqueta: 'Contraseña nueva', tipo: 'password', requerido: true, attrs: 'autocomplete="new-password"' })}
    <button class="btn btn-primario btn-ancho" type="submit">Guardar contraseña</button></form>`);
  alEnviar(main.querySelector('#f-acc'), async (d) => {
    await post(`/api/plataforma/acceso/${encodeURIComponent(token)}`, d);
    history.replaceState(null, '', location.pathname);
    toast('Contraseña guardada. Ya podés ingresar.');
    pantallaIngreso();
  });
}

function pantallaPanel() {
  document.title = 'Panel · Growth Labs Talleres';
  main.innerHTML = `<div class="pagina panel-gl__pagina">
    <header class="panel-gl__cab">${marca}<span class="panel-gl__quien">${esc(sesion.admin.nombre)} <button type="button" class="btn btn-chico btn-texto" data-salir>${icono('salir')}Salir</button></span></header>
    <div class="cab"><h1 tabindex="-1">Talleres</h1><button type="button" class="btn btn-primario" data-nuevo>${icono('mas')}Nuevo taller</button></div>
    <div data-salud></div>
    <section class="panel panel__cuerpo bloque" data-alta hidden></section>
    <form class="buscador" role="search" data-sin-aviso>${icono('buscar')}<input type="search" name="q" aria-label="Buscar taller por nombre o identificador" placeholder="Buscar por nombre o identificador"></form>
    <div class="panel-gl__cuerpo"><section class="panel" aria-label="Lista de talleres"><ul class="lista" data-lista><li class="muted">Cargando…</li></ul></section><section data-detalle aria-live="polite"></section></div>
    <section class="panel panel__cuerpo bloque"><h2>Registro de acciones</h2><ul class="lista" data-registro></ul></section></div>`;
  main.querySelector('[data-salir]').onclick = async () => { await post('/api/plataforma/salir', {}); location.reload(); };
  main.querySelector('[data-nuevo]').onclick = formAlta;
  main.querySelector('.buscador').addEventListener('submit', (e) => e.preventDefault());
  const q = main.querySelector('input[name="q"]');
  let espera;
  q.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => cargarLista(q.value), 250); });
  cargarLista('');
  cargarRegistro();
  cargarSalud();
}

async function cargarSalud() {
  const { respaldos: r } = await get('/api/plataforma/salud');
  const cont = main.querySelector('[data-salud]');
  // Solo se muestra lo medido en la carpeta de respaldos; si no hay mediciones, se dice.
  cont.innerHTML = r?.ultimo
    ? aviso(`Último respaldo encontrado: ${esc(fechaHora(r.ultimo.creado || r.ultimo))}. ${esc(r.mensaje || '')}`, r.ok === false ? 'ambar' : 'gris')
    : aviso('Respaldos: sin verificar. No se encontró ningún respaldo en la carpeta configurada.', 'ambar');
}

async function cargarLista(texto) {
  const { talleres } = await get(`/api/plataforma/talleres?q=${encodeURIComponent(texto)}`);
  const ul = main.querySelector('[data-lista]');
  ul.innerHTML = talleres.map((t) => {
    const s = t.servicio, u = s.uso, l = s.limites;
    return `<li><button type="button" class="panel-gl__taller${elegido === t.id ? ' es-elegido' : ''}" data-taller="${t.id}" aria-pressed="${elegido === t.id}">
      <span><strong>${esc(t.nombre)}</strong><br><span class="muted small">${esc(t.slug)} · ${esc(s.plan?.nombre || 'sin plan')} · vigente hasta ${f(s.periodoHasta)}</span></span>
      <span class="panel-gl__estado">${chip(s.estadoTexto, COLOR[s.estado], s.soloLectura ? 'ban' : 'check')}${t.altaIncompleta ? chip('Alta incompleta', 'ambar', 'info') : ''}
      <span class="small muted">${u.usuarios_activos}${l.usuarios_activos != null ? '/' + l.usuarios_activos : ''} usuarios · ${u.almacenamiento_mb}${l.almacenamiento_mb != null ? '/' + l.almacenamiento_mb : ''} MB</span></span></button></li>`;
  }).join('') || '<li class="muted">No hay talleres que coincidan.</li>';
  ul.querySelectorAll('[data-taller]').forEach((b) => b.addEventListener('click', () => { elegido = Number(b.dataset.taller); cargarDetalle(); ul.querySelectorAll('[data-taller]').forEach((x) => { x.classList.toggle('es-elegido', x === b); x.setAttribute('aria-pressed', x === b); }); }));
}

async function cargarRegistro() {
  const { registro } = await get('/api/plataforma/registro');
  main.querySelector('[data-registro]').innerHTML = registro.slice(0, 40).map((r) => `<li><span class="small muted">${esc(fechaHora(r.fecha))} · ${esc(r.por || 'Proceso automático')}${r.taller ? ' · ' + esc(r.taller) : ''}</span><br>${esc(r.accion)}${r.detalle ? `<br><span class="small muted">${esc(r.detalle)}</span>` : ''}</li>`).join('') || '<li class="muted">Sin acciones registradas.</li>';
}

function mostrarEnlace(cont, r, quien) {
  const url = location.origin + r.enlace;
  cont.innerHTML = `<div class="bloque">${aviso(`Enviale este enlace a ${esc(quien)} por un medio seguro. Sirve una sola vez y vence el ${esc(fechaHora(r.expira))}. No se vuelve a mostrar.`, 'verde', 'check')}
    <div class="campo"><label for="enlace-${r.expira}">Enlace de invitación</label><input id="enlace-${r.expira}" type="text" readonly value="${esc(url)}"></div><button type="button" class="btn btn-chico" data-copiar>${icono('copiar')}Copiar enlace</button></div>`;
  cont.querySelector('[data-copiar]').onclick = () => copiar(url);
}

function formAlta() {
  const s = main.querySelector('[data-alta]');
  s.hidden = false;
  s.innerHTML = `<h2>Nuevo taller</h2><form class="form" id="f-alta" novalidate>
    <div class="fila-campos">${campo({ nombre: 'nombre', etiqueta: 'Nombre del taller', requerido: true })}${campo({ nombre: 'slug', etiqueta: 'Identificador', requerido: true, ayuda: 'Minúsculas, números y guiones. Se usa en la página pública.', attrs: 'autocapitalize="none" spellcheck="false"' })}</div>
    <div class="fila-campos">${campo({ nombre: 'duenoNombre', etiqueta: 'Responsable', requerido: true })}${campo({ nombre: 'duenoEmail', etiqueta: 'Correo del responsable', tipo: 'email', requerido: true })}</div>
    <div class="fila-campos">${campo({ nombre: 'plan', etiqueta: 'Plan', tipo: 'select', valor: 'profesional', opciones: [...new Set(planes.filter((p) => p.activo).map((p) => p.clave))].map((k) => [k, planes.filter((p) => p.clave === k).at(-1).nombre]) })}${campo({ nombre: 'periodoHasta', etiqueta: 'Fin de la prueba', tipo: 'date', ayuda: 'Sin fecha, la prueba queda abierta hasta que la definas.' })}</div>
    <div class="acciones"><button class="btn btn-primario" type="submit">Crear taller e invitación</button><button type="button" class="btn" data-cancelar>Cancelar</button></div></form><div data-enlace-alta></div>`;
  s.querySelector('[data-cancelar]').onclick = () => { s.hidden = true; s.innerHTML = ''; };
  const nombre = s.querySelector('[name="nombre"]'), slug = s.querySelector('[name="slug"]');
  nombre.addEventListener('input', () => { if (!slug.dataset.tocado) slug.value = nombre.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); });
  slug.addEventListener('input', () => { slug.dataset.tocado = '1'; });
  alEnviar(s.querySelector('#f-alta'), async (d) => {
    const r = await post('/api/plataforma/talleres', d);
    s.querySelector('#f-alta').remove();
    mostrarEnlace(s.querySelector('[data-enlace-alta]'), r, d.duenoNombre);
    elegido = r.id;
    cargarLista(''); cargarRegistro(); cargarDetalle();
  });
  nombre.focus();
}

async function cargarDetalle() {
  const cont = main.querySelector('[data-detalle]');
  const d = await get(`/api/plataforma/talleres/${elegido}`);
  const s = d.suscripcion, sv = d.servicio;
  const opcionesPlan = planes.filter((p) => p.activo || p.id === s?.planId).map((p) => [String(p.id), `${p.nombre} · v${p.version}${p.precio_centavos == null ? ' · sin precio' : ''}`]);
  cont.innerHTML = `<div class="panel panel__cuerpo bloque"><h2>${esc(d.taller.nombre)}</h2>
      <p>${chip(sv.estadoTexto, COLOR[sv.estado], sv.soloLectura ? 'ban' : 'check')}</p>
      <dl class="datos-plan"><div><dt>Plan</dt><dd>${esc(sv.plan?.nombre || '—')}</dd></div><div><dt>Vigente hasta</dt><dd>${f(sv.periodoHasta)}</dd></div><div><dt>Gracia hasta</dt><dd>${f(sv.graciaHasta)}</dd></div><div><dt>Usuarios</dt><dd>${sv.uso.usuarios_activos}${sv.limites.usuarios_activos != null ? ' de ' + sv.limites.usuarios_activos : ''}</dd></div><div><dt>Archivos</dt><dd>${sv.uso.almacenamiento_mb}${sv.limites.almacenamiento_mb != null ? ' de ' + sv.limites.almacenamiento_mb : ''} MB</dd></div></dl>
      <h3>Responsables</h3><ul class="lista">${d.duenos.map((u) => `<li class="fila"><span>${esc(u.nombre)}<br><span class="small muted">${esc(u.email)}</span></span>${u.pendiente ? chip('Todavía no creó su contraseña', 'ambar', 'info') : chip('Activo', 'verde', 'check')}</li>`).join('')}</ul>
      ${d.duenos.some((u) => u.activo && u.pendiente) ? `<button type="button" class="btn" data-reinvitar>${icono('enlace')}Generar invitación nueva</button><div data-enlace-re></div>` : ''}</div>
    <div class="panel panel__cuerpo bloque"><h2>Suscripción</h2>
      <form class="form" id="f-sus" novalidate>
        <div class="fila-campos">${campo({ nombre: 'planId', etiqueta: 'Plan', tipo: 'select', requerido: true, valor: String(s.planId), opciones: opcionesPlan })}${campo({ nombre: 'estado', etiqueta: 'Estado', tipo: 'select', requerido: true, valor: s.estadoGuardado, opciones: Object.entries(sesion.estados) })}${campo({ nombre: 'modalidad', etiqueta: 'Modalidad de cobro', tipo: 'select', requerido: true, valor: s.modalidad, opciones: MODALIDADES })}</div>
        <div class="fila-campos">${campo({ nombre: 'periodoDesde', etiqueta: 'Período desde', tipo: 'date', valor: s.periodoDesde || '' })}${campo({ nombre: 'periodoHasta', etiqueta: 'Período hasta (incluido)', tipo: 'date', valor: s.periodoHasta || '' })}${campo({ nombre: 'graciaHasta', etiqueta: 'Gracia hasta (incluido)', tipo: 'date', valor: s.graciaHasta || '' })}</div>
        <p class="muted small">El estado efectivo también cambia solo por fecha: al pasar «Período hasta» queda vencida; sin gracia o al pasar «Gracia hasta» queda en solo lectura. Nunca se borran datos.</p>
        ${casilla('cancelaAlCierre', 'Cancelar al cierre del período (mantiene el acceso hasta esa fecha)', s.cancelaAlCierre)}
        ${campo({ nombre: 'motivo', etiqueta: 'Motivo del cambio', requerido: true, ayuda: 'Queda en el registro con tu nombre.' })}
        <button class="btn btn-primario" type="submit">Guardar suscripción</button></form></div>
    <div class="panel panel__cuerpo bloque"><h2>Registrar pago confirmado</h2>
      <p class="muted small">Conciliación manual: registrá solo pagos que ya verificaste (por ejemplo, una transferencia acreditada). No cobra nada ni consulta a ningún banco.</p>
      <form class="form" id="f-pago" novalidate>
        <div class="fila-campos">${campo({ nombre: 'importe', etiqueta: 'Importe recibido', requerido: true, attrs: 'inputmode="decimal"' })}${campo({ nombre: 'medio', etiqueta: 'Medio', requerido: true, valor: 'transferencia' })}${campo({ nombre: 'referencia', etiqueta: 'Referencia del comprobante', requerido: true })}</div>
        <div class="fila-campos">${campo({ nombre: 'periodoDesde', etiqueta: 'Cubre desde', tipo: 'date', requerido: true })}${campo({ nombre: 'periodoHasta', etiqueta: 'Cubre hasta (incluido)', tipo: 'date', requerido: true })}${campo({ nombre: 'nota', etiqueta: 'Nota' })}</div>
        <button class="btn" type="submit">Registrar pago</button></form>
      ${d.pagos.length ? `<h3>Pagos registrados</h3><ul class="lista">${d.pagos.map((p) => `<li class="fila"><span>${(p.importe_centavos / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} · ${esc(p.medio)} · ref. ${esc(p.referencia)}<br><span class="small muted">cubre ${f(p.periodo_desde)} a ${f(p.periodo_hasta)} · registró ${esc(p.por)} el ${esc(fechaHora(p.registrado_at))}</span></span></li>`).join('')}</ul>` : ''}</div>
    <div class="panel panel__cuerpo bloque"><h2>Historial del taller</h2><ul class="lista">${d.registro.map((r) => `<li><span class="small muted">${esc(fechaHora(r.fecha))} · ${esc(r.por || 'Proceso automático')}</span><br>${esc(r.accion)}${r.detalle ? `<br><span class="small muted">${esc(r.detalle)}</span>` : ''}</li>`).join('') || '<li class="muted">Sin acciones.</li>'}</ul></div>`;
  alEnviar(cont.querySelector('#f-sus'), async (v) => {
    await put(`/api/plataforma/talleres/${elegido}/suscripcion`, { ...v, version: s.version, cancelaAlCierre: !!v.cancelaAlCierre });
    toast('Suscripción guardada.'); cargarDetalle(); cargarLista(main.querySelector('input[name="q"]').value); cargarRegistro();
  });
  const fp = cont.querySelector('#f-pago');
  alEnviar(fp, async (v) => {
    const r = await post(`/api/plataforma/talleres/${elegido}/pagos`, v, { idempotencia: claveDeEnvio(fp) });
    toast(r.repetido ? 'Ese pago ya estaba registrado: no se duplicó.' : 'Pago registrado y vigencia actualizada.');
    cargarDetalle(); cargarLista(main.querySelector('input[name="q"]').value); cargarRegistro();
  });
  cont.querySelector('[data-reinvitar]')?.addEventListener('click', async () => {
    try { const r = await post(`/api/plataforma/talleres/${elegido}/invitacion`, {}); mostrarEnlace(cont.querySelector('[data-enlace-re]'), r, 'el responsable'); cargarRegistro(); }
    catch (e) { toast(e.message, { error: true }); }
  });
}

iniciar().catch((e) => { main.innerHTML = `<div class="pagina"><h1>No se pudo abrir el panel</h1><p>${esc(e.message)}</p><p><button class="btn" data-reintentar>Reintentar</button></p></div>`; main.querySelector('[data-reintentar]').addEventListener('click', () => location.reload()); });
