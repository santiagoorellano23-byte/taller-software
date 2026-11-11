import {esc,icono} from '../ui.js?v=0.1.0';
import {material} from '../recepcion-modelo.js?v=0.1.0';
export const GRUPOS_MAS=[
 ['Agenda y clientes',[
  ['agenda','calendar_month','Agenda de turnos','agenda.ver'],
  ['cuentas','account_balance_wallet','Cuentas de clientes','ver.dinero']]],
 ['Repuestos y compras',[
  ['stock','inventory_2','Stock y reservas','stock.ver'],
  ['compras','local_shipping','Compras y proveedores','compras.gestionar'],
  ['mostrador','storefront','Mostrador','ventas.registrar']]],
 ['Dinero',[
  ['caja','payments','Caja','ver.dinero'],
  ['reportes','bar_chart','Reportes','reportes.ver']]],
 ['Consulta',[
  ['archivo','description','Documentos','documentos.emitir'],
  ['biblioteca','menu_book','Biblioteca técnica','biblioteca.ver'],
  ['calculadora','calculate','Calculadora de mano de obra','calculadora.usar'],
  ['qr','qr_code_scanner','Leer o generar QR',null]]],
 ['Administración',[
  ['ajustes','settings','Ajustes, servicios y plantillas','config.taller'],
  ['ajustes/usuarios','manage_accounts','Usuarios y permisos','usuarios.gestionar'],
  ['ajustes/integraciones','link','Conexiones externas','config.taller'],
  ['ajustes/registro','history','Registro de acciones','auditoria.ver'],
  ['ajustes/datos','download','Exportación y respaldo','exportar']]]
];
export const gruposPermitidos=app=>GRUPOS_MAS.map(([t,items])=>[t,items.filter(i=>!i[3]||app.puede(i[3]))]).filter(([,items])=>items.length);
export default async function mas({app}){
 return {titulo:'Más',html:`<div class="pagina mas-propuesta"><div class="cab"><h1 tabindex="-1">Más</h1><a class="btn btn-texto" href="#/ayuda">${icono('ayuda')}Ayuda</a></div><div class="mas-grupos">${gruposPermitidos(app).map(([t,items])=>`<section class="mas-seccion"><h2>${t}</h2><ul class="mas-tarjeta">${items.map(([ruta,ic,n])=>`<li><a href="#/${ruta}">${material(ic)}<span>${n}</span>${material('chevron_right')}</a></li>`).join('')}</ul></section>`).join('')}</div><section class="sesion-panel" id="tu-sesion"><h2>Tu sesión</h2><p>${esc(app.sesion.usuario.nombre)} · ${esc(app.sesion.usuario.rolTexto)}</p><p class="small muted">Cada persona usa su propia cuenta. Salí al terminar si compartís el dispositivo.</p><div class="acciones"><button type="button" class="btn" data-salir-aqui>${icono('salir')}Salir</button><button type="button" class="btn btn-texto" data-salir-todas>Salir en todos mis dispositivos</button></div></section></div>`,despues(raiz){raiz.querySelector('[data-salir-aqui]').onclick=()=>app.salir();raiz.querySelector('[data-salir-todas]').onclick=()=>app.salir(true);}};
}
