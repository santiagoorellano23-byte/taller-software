// Permisos por acción. El servidor los comprueba en cada operación; la interfaz solo los usa
// para no mostrar botones que no corresponden.
import { prohibido } from './util.js';

export const ROLES = { dueno: 'Dueño o administración', recepcion: 'Recepción', mecanico: 'Mecánico' };

const MATRIZ = {
  // Consulta
  'ver.taller': ['dueno', 'recepcion', 'mecanico'],
  'ver.dinero': ['dueno', 'recepcion'],            // importes, cobros y saldos
  'ver.contactos': ['dueno', 'recepcion', 'mecanico'],
  // Autos, clientes y visitas
  'vehiculos.editar': ['dueno', 'recepcion'],
  'vehiculos.archivar': ['dueno'],
  'visita.recibir': ['dueno', 'recepcion'],
  'visita.editar': ['dueno', 'recepcion'],
  'visita.anular': ['dueno'],
  'revision.registrar': ['dueno', 'mecanico'],
  'presupuesto.preparar': ['dueno', 'recepcion'],
  'presupuesto.respuesta': ['dueno', 'recepcion'],
  'repuestos.gestionar': ['dueno', 'recepcion', 'mecanico'],
  'repuestos.colocar': ['dueno', 'mecanico'],
  'trabajo.ejecutar': ['dueno', 'mecanico'],
  'control.registrar': ['dueno', 'mecanico'],
  'visita.lista': ['dueno', 'recepcion', 'mecanico'],
  'visita.entregar': ['dueno', 'recepcion'],
  'adjuntos.subir': ['dueno', 'recepcion', 'mecanico'],
  'adjuntos.archivar': ['dueno'],
  'seguimientos.gestionar': ['dueno', 'recepcion'],
  'avisos.preparar': ['dueno', 'recepcion'],
  // Agenda
  'agenda.ver': ['dueno', 'recepcion', 'mecanico'],
  'agenda.gestionar': ['dueno', 'recepcion'],
  // Dinero
  'caja.registrar': ['dueno', 'recepcion'],
  'caja.anular': ['dueno'],
  'visita.liquidar': ['dueno', 'recepcion'],
  // Compras, stock y mostrador
  'stock.ver': ['dueno', 'recepcion', 'mecanico'],
  'stock.articulos': ['dueno', 'recepcion'],
  'stock.ajustar': ['dueno'],
  'stock.reservar': ['dueno', 'recepcion'],
  'compras.gestionar': ['dueno', 'recepcion'],
  'compras.anular': ['dueno'],
  'compras.pagar': ['dueno'],
  'proveedores.gestionar': ['dueno', 'recepcion'],
  'ventas.registrar': ['dueno', 'recepcion'],
  'ventas.anular': ['dueno'],
  // Documentos
  'documentos.emitir': ['dueno', 'recepcion'],
  'documentos.anular': ['dueno'],
  'documentos.compartir': ['dueno', 'recepcion'],
  // Gestión
  'reportes.ver': ['dueno'],
  'exportar': ['dueno'],
  'config.taller': ['dueno'],
  'usuarios.gestionar': ['dueno'],
  'auditoria.ver': ['dueno'],
  'biblioteca.ver': ['dueno', 'recepcion', 'mecanico'],
  'biblioteca.cargar': ['dueno', 'mecanico'],
  'calculadora.usar': ['dueno', 'recepcion'],
  'calculadora.configurar': ['dueno']
};

export const puede = (usuario, permiso) => !!usuario && (MATRIZ[permiso] || []).includes(usuario.rol);
export function exigir(usuario, permiso, mensaje) {
  if (!puede(usuario, permiso)) prohibido(mensaje);
}
export const permisosDe = (rol) => Object.keys(MATRIZ).filter((p) => MATRIZ[p].includes(rol));
