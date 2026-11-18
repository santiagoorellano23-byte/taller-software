// Arranque del panel: sesión, navegación, rutas, ayuda contextual y aviso de cambios sin guardar.
import { api, get, post, configurarApi } from './api.js?v=0.1.0';
import { esc, icono, toast, confirmar, hayCambiosSinGuardar, fijarZona, campo, alEnviar } from './ui.js?v=0.1.0';
import { abrirAyuda } from './ayuda.js?v=0.1.0';
import { selectorTema, enlazarTema, aplicarTema } from './tema.js?v=0.1.0';
import { ic } from './diseno.js?v=0.1.0';
import { borrarBorrador } from './recepcion-modelo.js?v=0.1.0';
import { entrada, detenerMovimiento } from './movimiento.js?v=0.1.0';
import { cssApariencia } from './marca.js?v=0.1.0';
import { islaHTML, enlazarIsla, colocarIndicador } from './isla.js?v=0.1.0';

// Colores del taller sobre los tokens de marca. La hoja solo contiene colores calculados por marca.js.
function aplicarApariencia(apariencia) {
  let hoja = document.getElementById('apariencia-taller');
  if (!hoja) { hoja = document.createElement('style'); hoja.id = 'apariencia-taller'; document.head.append(hoja); }
  hoja.textContent = cssApariencia(apariencia);
}

// [patrón, módulo, permiso, sección del menú]
const RUTAS = [
  ['hoy', 'hoy', null, 'hoy'],
  ['autos', 'autos', null, 'autos'],
  ['autos/:id', 'ficha', null, 'autos'],
  ['recibir', 'recibir', 'visita.recibir', 'hoy'],
  ['trabajos', 'trabajos', null, 'trabajos'],
  ['visitas/:id', 'visita', null, 'trabajos'],
  ['visitas/:id/:seccion', 'visita', null, 'trabajos'],
  ['pendientes', 'pendientes', null, 'pendientes'],
  ['mas', 'mas', null, 'mas'],
  ['agenda', 'agenda', 'agenda.ver', 'mas'],
  ['caja', 'caja', 'ver.dinero', 'mas'],
  ['cuentas', 'cuentas', 'ver.dinero', 'mas'],
  ['cuentas/:id', 'cuentas', 'ver.dinero', 'mas'],
  ['mostrador', 'mostrador', 'ventas.registrar', 'mas'],
  ['mostrador/:id', 'mostrador', 'ventas.registrar', 'mas'],
  ['stock', 'stock', 'stock.ver', 'mas'],
  ['stock/:id', 'stock', 'stock.ver', 'mas'],
  ['compras', 'compras', 'compras.gestionar', 'mas'],
  ['compras/:id', 'compras', 'compras.gestionar', 'mas'],
  ['proveedores', 'proveedores', 'stock.ver', 'mas'],
  ['reportes', 'reportes', 'reportes.ver', 'mas'],
  ['archivo', 'archivo', 'documentos.emitir', 'mas'],
  ['documentos/:id', 'documento', null, 'mas'],
  ['biblioteca', 'biblioteca', 'biblioteca.ver', 'mas'],
  ['calculadora', 'calculadora', 'calculadora.usar', 'mas'],
  ['qr', 'qr', null, 'mas'],
  ['ayuda', 'ayuda-vista', null, 'mas'],
  ['ayuda/:id', 'ayuda-vista', null, 'mas'],
  ['ajustes', 'ajustes', 'config.taller', 'mas'],
  ['ajustes/:seccion', 'ajustes', 'ver.taller', 'mas']
];
const MENU = [
  ['hoy', 'Hoy', 'hoy', null], ['trabajos', 'Taller', 'llave', null],
  ['recibir', 'Recibir un auto', 'mas', 'visita.recibir'], ['autos', 'Clientes', 'auto', null]
];
const GRUPOS = {
  repuestos: [['stock','Inventario','stock.ver'],['compras','Compras','compras.gestionar'],['proveedores','Proveedores','stock.ver']],
  caja: [['caja','Movimientos','ver.dinero'],['cuentas','Cuentas de clientes','ver.dinero'],['mostrador','Mostrador','ventas.registrar']],
  taller: [['trabajos','Órdenes',null],['pendientes','Services y trabajos postergados',null]],
  ajustes: [['ajustes','Taller','config.taller'],['ajustes/usuarios','Usuarios','usuarios.gestionar'],['ajustes/datos','Exportación y respaldo','exportar'],['ajustes/registro','Registro','auditoria.ver'],['ajustes/integraciones','Conexiones','config.taller']]
};
function grupoRuta(r) {
  if (['stock','compras','proveedores'].includes(r.modulo)) return 'repuestos';
  if (['caja','cuentas','mostrador'].includes(r.modulo)) return 'caja';
  if (['trabajos','pendientes','visita'].includes(r.modulo)) return 'taller';
  return r.modulo==='ajustes'?'ajustes':null;
}
function submenu(r) {
  const g=grupoRuta(r); if(!g || g==='taller' || r.modulo==='ajustes') return '';
  const actual=location.hash.replace(/^#\//,'').split('?')[0];
  return `<nav class="subnav" aria-label="${g==='taller'?'Taller':g==='caja'?'Caja':g==='ajustes'?'Ajustes':'Repuestos'}">${GRUPOS[g].filter(x=>!x[2]||app.puede(x[2])).map(([ruta,nombre])=>`<a href="#/${ruta}" ${actual===ruta?'aria-current="page"':''}>${nombre}</a>`).join('')}</nav>`;
}
const memoriaVistas=new Map(); let vistaActual=''; let turnoRender=0;
function recordarVista() {
  if(!vistaActual) return;
  const campos=[...document.querySelectorAll('#contenido input[type="search"]')].map(x=>({id:x.id,valor:x.value})).filter(x=>x.id);
  memoriaVistas.set(vistaActual,{scroll:window.scrollY,campos});
}


export const app = {
  sesion: null,
  permisos: new Set(),
  puede(p) { return this.permisos.has(p); },
  ir(hash) { if (location.hash === hash) mostrar(); else location.hash = hash; },
  recargar: () => mostrar({ conservarScroll: true }),
  aplicarApariencia: (a) => aplicarApariencia(a),
  ayuda: (tema) => abrirAyuda(tema, app),
  salir: (todas) => salir(todas),
  pantalla: ''
};
window.__app = app; // para depurar en el navegador; no expone datos adicionales

const raiz = document.getElementById('raiz');
let hashAnterior = location.hash;
let saltarAviso = false;

function interpretar() {
  const h = location.hash.replace(/^#\/?/, '').split('#')[0];
  const [camino, consulta = ''] = h.split('?');
  const partes = camino.split('/').filter(Boolean);
  for (const [patron, modulo, permiso, seccion] of RUTAS) {
    const pp = patron.split('/');
    if (pp.length !== partes.length) continue;
    const params = {};
    if (pp.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(partes[i])), true) : p === partes[i]))) {
      return { modulo, permiso, seccion, params, query: Object.fromEntries(new URLSearchParams(consulta)), patron };
    }
  }
  return null;
}

// Estado de la suscripción del taller a Growth Labs. Lo decide el servidor; este aviso solo lo explica.
const fechaLarga = (f) => f ? f.split('-').reverse().join('/') : '';
// Línea discreta de Hoy para quien administra el servicio, cuando faltan 7 días o menos.
export function lineaPlan() {
  const s = app.sesion?.taller.servicio;
  if (!s || !app.puede('servicio.gestionar') || !['activa', 'prueba'].includes(s.estado) || s.diasRestantes == null || s.diasRestantes > 7) return '';
  const cuando = s.diasRestantes === 0 ? 'hoy es el último día' : `quedan ${s.diasRestantes} día${s.diasRestantes === 1 ? '' : 's'}`;
  return `<p class="plan-linea">${ic('schedule')}<span title="Acceso hasta el ${fechaLarga(s.periodoHasta)}">Acceso: ${cuando}</span><a href="#/ajustes/plan">Renovar acceso</a></p>`;
}
function avisoServicio(s) {
  if (!s) return '';
  const responsable = app.puede('servicio.gestionar');
  const renovar = responsable ? ' <a href="#/ajustes/plan">Renovar acceso</a>' : ' Avisale al dueño del taller.';
  if (s.estado === 'activa' || s.estado === 'prueba') return ''; // el recordatorio va en Hoy: lineaPlan()
  const texto = s.estado === 'vencida'
    ? `El período venció el ${fechaLarga(s.periodoHasta)}. El acceso completo sigue hasta el ${fechaLarga(s.graciaHasta)}; después solo se podrá consultar y exportar.`
    : `${esc(s.estadoTexto)}. No se pueden registrar cambios; todo lo cargado se conserva y se puede consultar y exportar.`;
  return `<div class="aviso aviso--${s.estado === 'vencida' ? 'ambar' : 'gris'} aviso-servicio" role="status">${icono('info')}<div><strong>Servicio del taller.</strong> ${texto}${renovar}</div></div>`;
}

// Marca del taller: su logo si lo cargó; si no, la inicial sobre su color.
export function marcaTaller(t) {
  return `<span class="tm" aria-hidden="true">${t.logoId ? `<img src="/api/adjuntos/${Number(t.logoId)}" alt="">` : esc((t.nombre || '·').trim().slice(0, 1).toUpperCase())}</span>`;
}
const iniciales = (n) => n.split(/\s+/).filter((x) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(x)).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '·';

function armarEsqueleto() {
  const s = app.sesion;
  const u = s.usuario;
  const destinos = [['hoy', 'Hoy', 'home'], ['trabajos', 'Taller', 'garage'], ['autos', 'Clientes', 'group'], ['mas', 'Más', 'apps']];
  raiz.innerHTML = `
    <aside class="riel" aria-label="Menú principal">
      <a class="riel-marca" href="#/hoy" aria-label="${esc(s.taller.nombre)}, ir a Hoy">${marcaTaller(s.taller)}<span><b translate="no">${esc(s.taller.nombre)}</b><small>Growth Labs Talleres</small></span></a>
      ${app.puede('visita.recibir') ? `<a class="btn btn-primario riel-rec" href="#/recibir" aria-label="Recibir un auto">${ic('add')}<span>Recibir un auto</span></a>` : ''}
      <nav aria-label="Apartados">${destinos.map(([r, t, i]) => `<a class="riel-b" href="#/${r}" data-seccion="${r}">${ic(i)}<span>${t}</span></a>`).join('')}</nav>
      <button type="button" class="riel-yo" data-sesion aria-label="Tu sesión: ${esc(u.nombre)}"><span class="av">${esc(iniciales(u.nombre).slice(0, 1))}</span><span><b>${esc(u.nombre)}</b><small>${esc(u.rolTexto)}</small></span></button>
    </aside>
    <main class="principal" id="contenido" tabindex="-1"></main>
    ${islaHTML({ recibir: app.puede('visita.recibir') })}
    <dialog class="hoja-dlg" id="hoja-sesion" aria-labelledby="hoja-sesion-t">
      <header><h2 id="hoja-sesion-t">Tu sesión</h2><button type="button" class="ibtn" data-cerrar aria-label="Cerrar">${ic('close')}</button></header>
      <div class="hoja-c">
        <div class="bloque-d"><div class="li-b" style="padding:0;min-height:0;cursor:default"><span class="av-b" aria-hidden="true">${esc(iniciales(u.nombre).slice(0, 1))}</span><span class="li-t"><b>${esc(u.nombre)}</b><small>${esc(u.rolTexto)} · <span translate="no">${esc(s.taller.nombre)}</span></small></span></div>
          <p class="nota">${ic('info')}Cada persona usa su propia cuenta. Salí al terminar si compartís el dispositivo.</p></div>
        <div class="sec-h"><h2 id="tema-t">Tema</h2></div><div class="seg" role="group" aria-labelledby="tema-t">${[['claro', 'Claro', 'light_mode'], ['oscuro', 'Oscuro', 'dark_mode'], ['automatico', 'Automático', 'contrast']].map(([m, t, i]) => `<button type="button" data-tema-modo="${m}">${ic(i)}${t}</button>`).join('')}</div>
        <a class="btn" href="#/ayuda" data-cerrar>${ic('help')}Ayuda</a>
        <button type="button" class="btn" data-salir>${ic('logout')}Salir</button>
        <button type="button" class="btn btn-texto" data-salir-todas>Salir en todos mis dispositivos</button>
      </div>
    </dialog>`;
  raiz.removeAttribute('aria-busy');
  enlazarIsla(raiz.querySelector('[data-isla]'));
  const hoja = raiz.querySelector('#hoja-sesion');
  let origen = null;
  const marcarTema = () => hoja.querySelectorAll('[data-tema-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.temaModo === (document.documentElement.dataset.tema || 'automatico'))));
  document.addEventListener('click', (e) => {
    const abrir = e.target.closest('[data-sesion]');
    if (abrir && !hoja.open) { origen = abrir; marcarTema(); hoja.showModal(); }
  });
  hoja.addEventListener('click', (e) => {
    if (e.target === hoja || e.target.closest('[data-cerrar]')) hoja.close();
    const t = e.target.closest('[data-tema-modo]');
    if (t) { aplicarTema(t.dataset.temaModo); try { localStorage.setItem('talleres-tema', t.dataset.temaModo); } catch { /* se conserva en esta página */ } marcarTema(); }
  });
  hoja.addEventListener('close', () => { if (origen?.isConnected) origen.focus(); });
  hoja.querySelector('[data-salir]').addEventListener('click', () => { hoja.close(); salir(); });
  hoja.querySelector('[data-salir-todas]').addEventListener('click', () => { hoja.close(); salir(true); });
}

// Recuerda en esta pestaña que la persona salió de la demostración, para no volver a entrar sola.
function demoSalio() { try { return sessionStorage.getItem('talleres-demo-salio') === '1'; } catch { return false; } }
function marcarDemoSalio(si) { try { if (si) sessionStorage.setItem('talleres-demo-salio', '1'); else sessionStorage.removeItem('talleres-demo-salio'); } catch { /* sin almacenamiento: no importa */ } }

async function salir(todas = false) {
  if (hayCambiosSinGuardar()) {
    const r = await confirmar({ titulo: 'Tenés cambios sin guardar', texto: 'Si salís ahora, lo que escribiste en el formulario abierto se pierde.', aceptar: 'Salir igual', peligro: true });
    if (!r.ok) return;
  }
  try { await post(todas ? '/api/sesion/salir-todas' : '/api/sesion/salir', {}); } catch (e) {
    if (todas) { toast(e.message, { error: true }); return; }
    /* sin conexión: igual se limpia la pantalla */
  }
  borrarBorrador(app);
  marcarDemoSalio(true);
  app.sesion = null;
  location.hash = '#/hoy';
  location.reload();
}

function pantallaIngreso(mensaje) {
  document.title = 'Ingresar · Growth Labs Talleres';
  raiz.className = '';
  raiz.removeAttribute('aria-busy');
  // Sin sesión no se conoce el taller: se muestra la marca del producto, no la de un cliente.
  raiz.innerHTML = `<main class="ingreso" id="contenido" tabindex="-1"><div class="ingreso__caja"><div class="ingreso-tema"><span class="marca-producto" translate="no"><svg viewBox="272 272 384 384" aria-hidden="true"><path fill="currentColor" d="M464 272A192 192 0 1 0 652.2 502H572.5A115 115 0 1 1 464 349ZM464 426H656V502H464Z"/><path fill="var(--marca-texto)" d="M580 272H656V348H580Z"/></svg><span><strong>Growth Labs</strong><span>Talleres</span></span></span>${selectorTema()}</div>
    <div><h1>Ingresar al panel del taller</h1><p class="muted small" style="margin-top:6px">Usá el correo y la contraseña que te dio el dueño del taller.</p></div>
    ${mensaje ? `<div class="aviso aviso--ambar">${icono('info')}<div>${esc(mensaje)}</div></div>` : ''}
    <form class="form" id="f-ingreso" novalidate data-sin-aviso>
      ${campo({ nombre: 'email', etiqueta: 'Correo', tipo: 'email', requerido: true, attrs: 'autocomplete="username" inputmode="email"' })}
      ${campo({ nombre: 'clave', etiqueta: 'Contraseña', tipo: 'password', requerido: true, attrs: 'autocomplete="current-password"' })}
      <button class="btn btn-primario btn-ancho" type="submit">Ingresar</button>
      <p class="muted small">¿No recordás la contraseña? Pedile al dueño del taller un enlace para crear una nueva.</p>
    </form></div></main>`;
  const f = document.getElementById('f-ingreso');
  enlazarTema();
  f.querySelector('input').setAttribute('autocomplete', 'username');
  alEnviar(f, async (d) => {
    await api('POST', '/api/sesion/ingresar', { email: d.email, clave: d.clave });
    marcarDemoSalio(false);
    await iniciar();
  });
  f.querySelector('input').focus();
  entrada(raiz.querySelector('h1'));
}

async function mostrar({ conservarScroll = false } = {}) {
  recordarVista();
  const renderId=++turnoRender;
  const r = interpretar();
  if (!r) { location.replace('#/hoy'); return; }
  const main = document.getElementById('contenido');
  detenerMovimiento(main);
  const scroll = window.scrollY;
  raiz.querySelectorAll('[data-seccion]').forEach((a) => { if (a.dataset.seccion === r.seccion) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  // La isla y la columna lateral agrupan los destinos secundarios en Más.
  const movil = r.modulo==='recibir'?'recibir':r.modulo==='hoy' ? 'hoy'
    : ['trabajos','visita','pendientes'].includes(r.modulo) ? 'trabajos'
    : ['autos','ficha'].includes(r.modulo) ? 'autos'
    : 'mas';
  raiz.querySelectorAll('[data-seccion]').forEach(a=>{
    const seleccionado = movil;
    if(a.dataset.seccion===seleccionado)a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  app.pantalla = r.modulo;
  raiz.dataset.modo=r.modulo==='recibir'?'enfoque':'general'; // la orden muestra la isla, como en el diseño final
  colocarIndicador(raiz.querySelector('[data-isla]'));
  if (r.permiso && !app.puede(r.permiso)) {
    main.removeAttribute('aria-busy');
    document.title = `Sin acceso · ${app.sesion.taller.nombre}`;
    main.innerHTML = `<div class="pagina"><h1 tabindex="-1">Esta función no está habilitada para tu usuario</h1><p>Tu perfil (${esc(app.sesion.usuario.rolTexto)}) no tiene acceso a esta parte. Si la necesitás, pedile al dueño que revise tus permisos.</p><p><a class="btn" href="#/hoy">${icono('hoy')}Ir a Hoy</a></p></div>`;
    main.querySelector('h1').focus();
    return;
  }
  if (!conservarScroll) main.setAttribute('aria-busy', 'true');
  try {
    const mod = await import(`./views/${r.modulo}.js?v=0.1.0`);
    const v = await mod.default({ params: r.params, query: r.query, app });
    if(renderId!==turnoRender) return;
    if (!v) { main.removeAttribute('aria-busy'); return; }
    main.innerHTML = avisoServicio(app.sesion.taller.servicio)+submenu(r)+v.html;
    main.dataset.pantalla=r.modulo;
    // Encabezado de módulo del diseño final: «volver» como ícono junto al título (a Más si el módulo no trae otro).
    const cab=main.querySelector('.pagina > .cab');
    if(cab&&r.seccion==='mas'&&r.modulo!=='mas'){
      const v0=main.querySelector('.pagina > .volver');
      const href=v0?.getAttribute('href')||'#/mas';
      v0?.remove();
      cab.classList.add('cab-modulo');
      cab.insertAdjacentHTML('afterbegin',`<a class="ibtn" data-volver href="${esc(href)}" aria-label="Volver" title="Volver">${ic('arrow_back')}</a>`);
      const sub=main.querySelector(':scope > .subnav'); if(sub) cab.after(sub); // los apartados del grupo van debajo del título
    }
    vistaActual=location.hash;
    document.title = `${v.titulo} · ${app.sesion.taller.nombre}`;
    main.removeAttribute('aria-busy');
    if (v.despues) v.despues(main);
    main.querySelectorAll('.contexto-toggle').forEach(d=>d.open=matchMedia('(min-width:1360px)').matches);
    const mem=memoriaVistas.get(vistaActual);
    if(mem) for(const x of mem.campos){const el=document.getElementById(x.id);if(el&&el.value!==x.valor){el.value=x.valor;el.dispatchEvent(new Event('input',{bubbles:true}));}}
    if (conservarScroll) window.scrollTo(0, scroll);
    else if(mem) { window.scrollTo(0,mem.scroll); (main.querySelector('h1') || main).focus({preventScroll:true}); }
    else { window.scrollTo(0, 0); (main.querySelector('h1') || main).focus({ preventScroll: true }); }
    // En la orden cambia el contenido de la solapa; la identidad y las barras sticky quedan quietas.
    // Es una entrada de opacidad, nunca una transición de posición de datos o importes.
    if (!conservarScroll) entrada(main.querySelector('[data-seccion-cuerpo]') || main.querySelector('h1'));
  } catch (e) {
    if(renderId!==turnoRender) return;
    main.removeAttribute('aria-busy');
    if (e?.estado === 401) return;
    main.innerHTML = `<div class="pagina"><h1 tabindex="-1">${e?.estado === 404 ? 'No encontramos lo que buscabas' : 'No se pudo abrir esta pantalla'}</h1>
      <p>${esc(e?.message || 'Error inesperado.')}</p><div class="acciones">${e?.estado === 404 ? `<a class="btn btn-primario" href="#/autos">Buscar por patente</a>` : '<button class="btn btn-primario" type="button" data-reintentar>Probar de nuevo</button>'}<a class="btn" href="#/hoy">Ir a Hoy</a></div></div>`;
    main.querySelector('[data-reintentar]')?.addEventListener('click', () => mostrar());
    main.querySelector('h1').focus();
    if (!e?.estado) console.error(e);
  }
}

// Aviso de cambios sin guardar al navegar dentro del panel o cerrar la pestaña.
window.addEventListener('hashchange', async () => {
  if (saltarAviso) { saltarAviso = false; hashAnterior = location.hash; return; }
  if (hayCambiosSinGuardar()) {
    const destino = location.hash;
    saltarAviso = true;
    location.hash = hashAnterior;
    const r = await confirmar({ titulo: 'Tenés cambios sin guardar', texto: 'Si cambiás de pantalla, lo que escribiste en el formulario se pierde. Guardalo antes o seguí igual.', aceptar: 'Salir sin guardar', peligro: true });
    if (!r.ok) return;
    document.querySelectorAll('form[data-sucio]').forEach((f) => delete f.dataset.sucio);
    location.hash = destino;
    return;
  }
  hashAnterior = location.hash;
  mostrar();
});
window.addEventListener('beforeunload', (e) => { if (hayCambiosSinGuardar()) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-salto]');
  if (s) { e.preventDefault(); document.getElementById('contenido')?.focus(); }
  const a = e.target.closest('[data-ayuda]');
  if (a) { e.preventDefault(); app.ayuda(a.dataset.ayuda); }
});

async function iniciar(probarDemo = true) {
  try {
    app.sesion = await get('/api/sesion');
  } catch (e) {
    if (e.estado === 401) {
      // Demostración sin contraseña: el servidor decide si corresponde. Después de «Salir» se muestra el ingreso
      // para poder entrar con otro perfil (recepción, mecánico) en esta pestaña.
      if (probarDemo && !demoSalio() && (await api('POST', '/api/sesion/demo', {}).catch(() => null))?.ok) return iniciar(false);
      return pantallaIngreso();
    }
    raiz.innerHTML = `<main class="principal" id="contenido"><h1>No se pudo conectar con el servidor</h1><p>${esc(e.message)}</p><p><button class="btn btn-primario" type="button" data-recargar>Probar de nuevo</button></p></main>`;
    raiz.querySelector('[data-recargar]').addEventListener('click', () => location.reload());
    return;
  }
  app.permisos = new Set(app.sesion.permisos);
  aplicarApariencia(app.sesion.taller.apariencia);
  fijarZona(app.sesion.taller.zona);
  raiz.className = 'app';
  armarEsqueleto();
  if (!location.hash || location.hash === '#' || location.hash === '#/') history.replaceState(null, '', '#/hoy');
  hashAnterior = location.hash;
  mostrar();
}

configurarApi({
  sesionPerdida() {
    if (!app.sesion) return;
    toast('Tu sesión terminó. Volvé a ingresar; lo que estabas escribiendo sigue en esta pantalla hasta que recargues.', { error: true, accion: { texto: 'Ingresar', fn: () => location.reload() } });
  }
});
// El resumen también se adapta al redimensionar una pantalla ya abierta.
matchMedia('(min-width:1360px)').addEventListener('change', e => {
  document.querySelectorAll('.contexto-toggle').forEach(d => { d.open=e.matches; });
});
iniciar();
