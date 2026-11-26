// Más (diseño final, B): grupos de funciones según los permisos de cada persona, tu sesión y ayuda.
import { esc } from '../ui.js?v=0.1.0';
import { ic, ibtn } from '../diseno.js?v=0.1.0';
export const GRUPOS_MAS = [
 ['Agenda y clientes', [
  ['agenda', 'calendar_month', 'Agenda de turnos', 'agenda.ver'],
  ['cuentas', 'account_balance_wallet', 'Cuentas de clientes', 'ver.dinero']]],
 ['Repuestos y compras', [
  ['stock', 'inventory_2', 'Stock y reservas', 'stock.ver'],
  ['compras', 'local_shipping', 'Compras y proveedores', 'compras.gestionar'],
  ['mostrador', 'storefront', 'Mostrador', 'ventas.registrar']]],
 ['Dinero', [
  ['caja', 'payments', 'Caja', 'ver.dinero'],
  ['reportes', 'bar_chart', 'Reportes', 'reportes.ver']]],
 ['Consulta', [
  ['archivo', 'description', 'Documentos', 'documentos.emitir'],
  ['biblioteca', 'menu_book', 'Biblioteca técnica', 'biblioteca.ver'],
  ['calculadora', 'calculate', 'Calculadora de mano de obra', 'calculadora.usar'],
  ['qr', 'qr_code_scanner', 'Leer o generar QR', null]]],
 ['Administración', [
  ['ajustes/plan', 'handshake', 'Mi plan', 'servicio.gestionar'],
  ['ajustes', 'settings', 'Ajustes, servicios y plantillas', 'config.taller'],
  ['ajustes/usuarios', 'manage_accounts', 'Usuarios y permisos', 'usuarios.gestionar'],
  ['ajustes/integraciones', 'link', 'Conexiones externas', 'config.taller'],
  ['ajustes/registro', 'history', 'Registro de acciones', 'auditoria.ver'],
  ['ajustes/datos', 'download', 'Exportación y respaldo', 'exportar']]]
];
export const gruposPermitidos = (app) => GRUPOS_MAS.map(([t, items]) => [t, items.filter((i) => !i[3] || app.puede(i[3]))]).filter(([, items]) => items.length);
// Valor actual junto al nombre, solo con datos que ya trae la sesión.
const TEMA = { claro: 'Claro', oscuro: 'Oscuro', automatico: 'Automático' };
function valor(ruta, t) {
  const s = t.servicio;
  if (ruta === 'ajustes/plan' && s) return s.diasRestantes != null && s.diasRestantes <= 7 && ['activa', 'prueba'].includes(s.estado) ? `Quedan ${s.diasRestantes} día${s.diasRestantes === 1 ? '' : 's'}` : (s.estadoTexto || '');
  return '';
}
export default async function mas({ app }) {
  const u = app.sesion.usuario, t = app.sesion.taller;
  const tema = TEMA[document.documentElement.dataset.tema] || 'Automático';
  return {
    titulo: 'Más',
    html: `<header class="cab-mod mas-cab"><div><p class="mas-ctx" translate="no">${esc(t.nombre)}</p><h1 tabindex="-1">Más</h1></div>${ibtn('help', 'Ayuda', { attrs: 'data-ayuda="guia"' })}</header>
      <div class="mas-b">${gruposPermitidos(app).map(([titulo, items], i) => `<section class="mas-g" aria-labelledby="mas-g-${i}"><h2 id="mas-g-${i}">${titulo}</h2><ul class="lista-d densa mas-l">${items.map(([ruta, icono, n]) => { const v = valor(ruta, t); return `<li><a class="li-b" href="#/${ruta}"><span class="li-ic">${ic(icono)}</span><span class="li-t"><b>${n}</b></span>${v ? `<span class="li-v">${esc(v)}</span>` : ''}${ic('chevron_right')}</a></li>`; }).join('')}</ul></section>`).join('')}
        <section class="mas-g" aria-labelledby="mas-sesion" id="tu-sesion"><h2 id="mas-sesion">Tu sesión</h2><ul class="lista-d densa mas-l"><li><button type="button" class="li-b" data-sesion aria-haspopup="dialog"><span class="av" aria-hidden="true">${esc(u.nombre.slice(0, 1).toUpperCase())}</span><span class="li-t"><b>${esc(u.nombre)}</b><small>${esc(u.rolTexto)} · tema ${tema.toLowerCase()} · salir</small></span>${ic('expand_more', 'ic-hoja')}</button></li></ul></section>
        <p class="mas-ayuda"><a class="btn btn-texto" href="#/ayuda">${ic('help')}Ayuda</a></p></div>`
  };
}
