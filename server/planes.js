// Servicio de Growth Labs: plan contratado, capacidades, límites y estado de la suscripción de cada taller.
// Es independiente de los permisos del usuario (server/permisos.js): una acción necesita las dos cosas.
import { uno, todos, ejecutar, insertar } from './db.js';
import { ErrorUsuario, json, hoyLocal, isoAhora } from './util.js';

export const MODULOS = { stock: 'Repuestos, compras, proveedores y mostrador', cuentas: 'Cuentas corrientes', reportes: 'Reportes' };
export const LIMITES = { usuarios_activos: 'Usuarios activos', almacenamiento_mb: 'Almacenamiento (MB)' };
export const ESTADOS = {
  prueba: 'En prueba', activa: 'Activa', vencida: 'Vencida, en período de gracia',
  suspendida: 'Suspendida: solo consulta y exportación', cancelada: 'Cancelada: solo consulta y exportación'
};
const ZONA = 'America/Argentina/Mendoza';

// Rutas de cada módulo. «escritura»: sin el módulo se consulta lo ya cargado pero no se registra nada nuevo.
// «todo»: vistas calculadas que se ocultan completas; los datos de origen siguen intactos y en la exportación.
const RUTAS_MODULO = [
  { re: /^\/api\/(articulos|proveedores|compras|pagos-proveedor|ventas|reservas)(\/|$)/, modulo: 'stock', alcance: 'escritura' },
  { re: /^\/api\/repuestos\/\d+\/reservar$/, modulo: 'stock', alcance: 'escritura' },
  { re: /^\/api\/cuentas(\/|$)/, modulo: 'cuentas', alcance: 'todo' },
  { re: /^\/api\/reportes(\/|$)/, modulo: 'reportes', alcance: 'todo' }
];
// Con la suscripción suspendida o cancelada solo se permite salir, cambiar la propia contraseña y consultar.
const PERMITIDAS_SIN_SERVICIO = [/^\/api\/sesion\//, /^\/api\/acceso\//];

// Estado según las fechas, sin depender de que alguien abra una pantalla. `hoy` es AAAA-MM-DD local.
export function estadoEfectivo(s, hoy) {
  if (!s) return 'suspendida';
  let estado = s.estado;
  if ((estado === 'prueba' || estado === 'activa') && s.periodo_hasta && hoy > s.periodo_hasta) estado = s.cancela_al_cierre ? 'cancelada' : 'vencida';
  if (estado === 'vencida' && (!s.gracia_hasta || hoy > s.gracia_hasta)) estado = 'suspendida';
  return estado;
}
export const conServicio = (estado) => estado === 'prueba' || estado === 'activa' || estado === 'vencida';

export function suscripcionDe(db, tallerId) {
  const s = uno(db, `SELECT s.*, p.clave AS plan_clave, p.version AS plan_version, p.nombre AS plan_nombre, p.capacidades, p.de_prueba
    FROM suscripciones s JOIN planes p ON p.id = s.plan_id WHERE s.taller_id = ?`, tallerId);
  if (!s) return null;
  const cap = json(s.capacidades, {});
  return { ...s, capacidades: { modulos: cap.modulos || {}, limites: cap.limites || {} } };
}

export function usoDe(db, tallerId) {
  const usuarios = uno(db, 'SELECT COUNT(*) AS n FROM usuarios WHERE taller_id = ? AND activo = 1', tallerId).n;
  const bytes = uno(db, 'SELECT COALESCE(SUM(bytes), 0) AS b FROM adjuntos WHERE taller_id = ?', tallerId).b;
  return { usuarios_activos: usuarios, almacenamiento_mb: Math.ceil(bytes / 1048576), bytes };
}

// Resumen para la sesión del taller y para el panel central.
export function resumenServicio(db, tallerId, hoy = hoyLocal(ZONA)) {
  const s = suscripcionDe(db, tallerId);
  const estado = estadoEfectivo(s, hoy);
  return {
    estado, estadoTexto: ESTADOS[estado], soloLectura: !conServicio(estado),
    plan: s ? { clave: s.plan_clave, version: s.plan_version, nombre: s.plan_nombre, dePrueba: !!s.de_prueba } : null,
    periodoHasta: s?.periodo_hasta || null, graciaHasta: s?.gracia_hasta || null, cancelaAlCierre: !!s?.cancela_al_cierre,
    modulos: s?.capacidades.modulos || {}, limites: s?.capacidades.limites || {}, uso: usoDe(db, tallerId)
  };
}

const sinServicio = (estado) => new ErrorUsuario(403, estado === 'cancelada'
  ? 'La suscripción del taller está cancelada. Podés consultar y exportar los datos, pero no registrar cambios. Para reactivarla, contactá a Growth Labs.'
  : 'La suscripción del taller está suspendida por vencimiento. Podés consultar y exportar los datos, pero no registrar cambios. Para reactivarla, contactá a Growth Labs.',
null, { motivo: 'suscripcion', estado });

// Se llama en cada solicitud autenticada de un taller, antes del manejador.
export function exigirServicio(db, tallerId, metodo, ruta) {
  const s = suscripcionDe(db, tallerId);
  const estado = estadoEfectivo(s, hoyLocal(ZONA));
  const muta = metodo !== 'GET';
  if (muta && !conServicio(estado) && !PERMITIDAS_SIN_SERVICIO.some((re) => re.test(ruta))) throw sinServicio(estado);
  const regla = RUTAS_MODULO.find((x) => x.re.test(ruta));
  if (regla && !s?.capacidades.modulos[regla.modulo] && (muta || regla.alcance === 'todo')) {
    throw new ErrorUsuario(403, `${MODULOS[regla.modulo]} no está incluido en el plan del taller. Lo que ya está cargado se conserva${regla.alcance === 'escritura' ? ' y se puede consultar' : ' y sale en la exportación'}.`, null, { motivo: 'plan', modulo: regla.modulo });
  }
}

// Límites contables. Se comprueban dentro de la misma transacción que crea el registro (BEGIN IMMEDIATE),
// así dos solicitudes simultáneas no pueden superar el cupo.
export function exigirLimite(db, tallerId, limite, agregar = 1) {
  const s = suscripcionDe(db, tallerId);
  const max = s?.capacidades.limites[limite];
  if (max == null) return;
  const usoTotal = usoDe(db, tallerId);
  const uso = usoTotal[limite];
  // El almacenamiento se compara en bytes: `agregar` es el tamaño del archivo nuevo.
  const supera = limite === 'almacenamiento_mb' ? usoTotal.bytes + agregar > max * 1048576 : uso + agregar > max;
  if (supera) {
    const textos = {
      usuarios_activos: `El plan permite ${max} usuarios activos y el taller tiene ${uso}. Desactivá a alguien que ya no use el sistema o pedí a Growth Labs un cambio de plan. No se borra a nadie.`,
      almacenamiento_mb: `El plan permite ${max} MB de archivos y el taller usa ${uso} MB. Los archivos cargados se conservan; para subir más, pedí a Growth Labs ampliar el espacio.`
    };
    throw new ErrorUsuario(403, textos[limite], null, { motivo: 'limite', limite, maximo: max, uso });
  }
}

export const planesVigentes = (db) => todos(db, 'SELECT * FROM planes ORDER BY clave, version').map((p) => ({ ...p, capacidades: json(p.capacidades, {}) }));

export function crearSuscripcion(db, tallerId, { planId, estado = 'prueba', periodoDesde = hoyLocal(ZONA), periodoHasta = null, modalidad = 'manual', nota = null }) {
  return insertar(db, 'INSERT INTO suscripciones (taller_id, plan_id, estado, periodo_desde, periodo_hasta, modalidad, nota, actualizado_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    tallerId, planId, estado, periodoDesde, periodoHasta, modalidad, nota, isoAhora());
}

export function auditarPlataforma(db, adminId, tallerId, accion, detalle) {
  insertar(db, 'INSERT INTO plataforma_auditoria (admin_id, taller_id, accion, detalle, fecha) VALUES (?, ?, ?, ?, ?)',
    adminId ?? null, tallerId ?? null, accion, detalle == null ? null : (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)), isoAhora());
}

// Proceso periódico: guarda el estado que corresponde por fecha y deja registro de cada cambio.
// Es idempotente: correrlo dos veces no duplica registros. El acceso ya se calcula en cada solicitud;
// esto deja el estado persistido y auditado aunque nadie entre.
export function evaluarVencimientos(db, hoy = hoyLocal(ZONA)) {
  const cambios = [];
  for (const s of todos(db, "SELECT * FROM suscripciones WHERE estado IN ('prueba','activa','vencida')")) {
    const nuevo = estadoEfectivo(s, hoy);
    if (nuevo === s.estado) continue;
    ejecutar(db, 'UPDATE suscripciones SET estado = ?, version = version + 1, actualizado_at = ? WHERE id = ? AND estado = ?', nuevo, isoAhora(), s.id, s.estado);
    auditarPlataforma(db, null, s.taller_id, `Suscripción: ${ESTADOS[s.estado]} → ${ESTADOS[nuevo]}`, `evaluación automática del ${hoy}; período hasta ${s.periodo_hasta || '—'}, gracia hasta ${s.gracia_hasta || '—'}`);
    cambios.push({ tallerId: s.taller_id, de: s.estado, a: nuevo });
  }
  return cambios;
}
