// Arranque del panel: sesión, navegación, rutas, ayuda contextual y aviso de cambios sin guardar.
import { api, get, post, configurarApi } from './api.js?v=0.1.0';
import { esc, icono, toast, confirmar, hayCambiosSinGuardar, fijarZona, campo, alEnviar } from './ui.js?v=0.1.0';
import { abrirAyuda } from './ayuda.js?v=0.1.0';
import { selectorTema, enlazarTema } from './tema.js?v=0.1.0';
import {material,borrarBorrador} from './recepcion-modelo.js?v=0.1.0';
import { entrada, detenerMovimiento } from './movimiento.js?v=0.1.0';
import { cssApariencia } from './marca.js?v=0.1.0';

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
  const g=grupoRuta(r); if(!g || r.modulo==='visita'||r.modulo==='ajustes') return '';
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
function avisoServicio(s) {
  if (!s || s.estado === 'activa' || s.estado === 'prueba') return '';
  const texto = s.estado === 'vencida'
    ? `La suscripción venció el ${fechaLarga(s.periodoHasta)}. El acceso completo sigue ${s.graciaHasta ? 'hasta el ' + fechaLarga(s.graciaHasta) : 'por ahora'}; después solo se podrá consultar y exportar.`
    : `${esc(s.estadoTexto)}. No se pueden registrar cambios; todo lo cargado se conserva y se puede consultar y exportar desde Ajustes.`;
  return `<div class="aviso aviso--${s.estado === 'vencida' ? 'ambar' : 'gris'} aviso-servicio" role="status">${icono('info')}<div><strong>Suscripción del taller.</strong> ${texto} ${app.puede('config.taller') ? 'Para regularizarla, contactá a Growth Labs.' : 'Avisale al dueño del taller.'}</div></div>`;
}

function marcaHTML(t) {
  const logo = t.logoId ? `<img src="/api/adjuntos/${Number(t.logoId)}" alt="" width="600" height="202">` : '';
  // Nombre completo: cortarlo en la primera palabra deja «Taller…» o «Mecánica…» sin identificar.
  return `<a class="marca" href="#/hoy" aria-label="${esc(t.nombre)}, ir a Hoy" title="${esc(t.nombre)}"><span class="marca__nombre${logo ? ' marca__nombre--logo' : ''}" translate="no">${logo || `<span class="marca__texto">${esc(t.nombre)}</span>`}</span></a>`;
}

function armarEsqueleto() {
  const s = app.sesion;
  const u = s.usuario;
  const iniciales = u.nombre.split(/\s+/).filter((x) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(x)).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
  const primerNombre = u.nombre.split(/\s+/)[0];
  const corto = { dueno: 'Dueño', recepcion: 'Recepción', mecanico: 'Mecánico' }[u.rol] || u.rolTexto;
  const demo = s.taller.demo ? '<p class="demo-marca" title="Personas, autos e importes inventados para mostrar el sistema">Demostración · datos ficticios</p>' : '';
  raiz.innerHTML = `
    <aside class="rail" aria-label="Menú principal">
      ${marcaHTML(s.taller)}${demo}
      <nav class="nav" aria-label="Apartados">
        ${MENU.filter(x=>!x[3]||app.puede(x[3])).map(([r, t, i]) => `<a href="#/${r}" data-seccion="${r}">${icono(i)}<span>${t}</span></a>`).join('')}
        <div class="nav__sep" role="presentation"></div>
        <a href="#/mas" data-seccion="mas">${icono('mas_funciones')}<span>Más</span></a>
        ${app.puede('config.taller')?`<a href="#/ajustes" data-seccion="ajustes">${icono('ajustes')}<span>Ajustes</span></a>`:''}
        <a href="#/ayuda" data-seccion="ayuda">${icono('ayuda')}<span>Ayuda</span></a>
      </nav>
      <div class="rail__pie">
        <div class="usuario"><span class="avatar" aria-hidden="true">${esc(iniciales || '·')}</span><div><strong>${esc(u.nombre)}</strong><span>${esc(u.rolTexto)}</span></div></div>
        <button type="button" class="btn btn-chico btn-salir" data-salir>${icono('salir')}Salir</button>
      </div>
    </aside>
    <header class="topbar">
      ${marcaHTML(s.taller)}${s.taller.demo ? '<span class="topbar__demo" title="Personas, autos e importes inventados para mostrar el sistema">DEMO<span class="topbar__demo-detalle"> · datos ficticios</span></span>' : ''}
      <div class="topbar__acciones">
        ${selectorTema()}<a class="topbar__ayuda" href="#/ayuda" aria-label="Ayuda" title="Ayuda">${icono('ayuda')}</a><span class="topbar__sep" aria-hidden="true"></span>
        <a class="topbar__usuario" href="#/mas" aria-label="${esc(u.nombre)}, ${esc(u.rolTexto)}. Ver tu sesión y salir"><span class="topbar__quien"><strong>${esc(primerNombre)}</strong><small>${esc(corto !== primerNombre ? corto : s.taller.nombre)}</small></span><span class="avatar" aria-hidden="true">${esc(iniciales || '·')}</span></a>
      </div>
    </header>
    ${s.taller.demo ? '<p class="demo-movil">Demostración · datos ficticios</p>' : ''}
    <div class="workspacebar"><span>Panel del taller <span class="muted">/</span> <strong data-ruta-titulo>Hoy</strong></span>${s.taller.demo ? '<span class="preview-label">Demostración · datos ficticios</span>' : ''}${selectorTema()}<a href="#/ayuda">${icono('ayuda')}Ayuda</a></div>
    <main class="principal" id="contenido" tabindex="-1"></main>
    <nav class="tabbar tabbar--isla" aria-label="Navegación principal móvil">
      ${[['hoy','Hoy','home'],['trabajos','Taller','garage'],...(app.puede('visita.recibir')?[['recibir','Recibir','add']]:[]),['autos','Clientes','group'],['mas','Más','apps']].map(([r,t,i])=>`<a href="#/${r}" data-seccion="${r}" ${r==='recibir'?'class="isla-recibir"':''}><span class="isla-icono" aria-hidden="true">${material(i)}</span><span>${t}</span></a>`).join('')}
    </nav>`;
  raiz.removeAttribute('aria-busy');
  enlazarTema();
  raiz.querySelector('[data-salir]').addEventListener('click', () => salir());
}

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
  const grupo=grupoRuta(r);
  const activo=grupo==='repuestos'?'stock':grupo==='taller'?'trabajos':grupo==='caja'?'caja':grupo==='ajustes'?'ajustes':['ficha'].includes(r.modulo)?'autos':r.modulo;
  // La barra móvil agrupa los destinos secundarios en Más; el lateral conserva sus grupos.
  const movil = r.modulo==='recibir'?'recibir':r.modulo==='hoy' ? 'hoy'
    : ['trabajos','visita','pendientes'].includes(r.modulo) ? 'trabajos'
    : ['autos','ficha'].includes(r.modulo) ? 'autos'
    : 'mas';
  raiz.querySelectorAll('[data-seccion]').forEach(a=>{
    const seleccionado = a.closest('.tabbar') ? movil : activo;
    if(a.dataset.seccion===seleccionado)a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  app.pantalla = r.modulo;
  raiz.dataset.modo=['recibir','visita'].includes(r.modulo)?'enfoque':'general';
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
    main.querySelectorAll('.volver[href="#/mas"]').forEach(x=>x.remove());
    const rt=raiz.querySelector('[data-ruta-titulo]'); if(rt)rt.textContent=v.titulo;
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

async function iniciar() {
  try {
    app.sesion = await get('/api/sesion');
  } catch (e) {
    if (e.estado === 401) return pantallaIngreso();
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
