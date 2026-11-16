// Servicio de Growth Labs: plan contratado, capacidades, límites y estado de la suscripción de cada taller.
// Es independiente de los permisos del usuario (server/permisos.js): una acción necesita las dos cosas.
import { uno, todos, ejecutar, insertar } from './db.js';
import { ErrorUsuario, json, hoyLocal, isoAhora } from './util.js';
import { config } from './config.js';

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
// Con la suscripción suspendida o cancelada solo se permite salir, cambiar la propia contraseña, consultar
// y pedir la renovación (pedirla no habilita nada: Growth Labs confirma el pago).
const PERMITIDAS_SIN_SERVICIO = [/^\/api\/sesion\//, /^\/api\/acceso\//, /^\/api\/plan\/solicitudes(\/|$)/];

// Períodos que el taller puede pedir, en meses calendario. Otros (3, 6, 12) se agregan acá cuando Growth Labs
// los apruebe; el importe es siempre precio mensual × meses, sin descuentos que no estén cargados.
export const PERIODOS_MESES = [1];

// Último día incluido de un período de `meses` meses calendario que empieza en `desde` (AAAA-MM-DD).
// 17/11 + 1 mes → 16/12. Si el mes de destino no tiene ese día (31/01 + 1 mes), termina el último día de ese mes.
export function finDePeriodo(desde, meses) {
  const [a, m, d] = desde.split('-').map(Number);
  const indice = a * 12 + (m - 1) + meses;
  const anio = Math.floor(indice / 12), mes = indice % 12;
  const diasMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  if (d > diasMes) return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;
  const fin = new Date(Date.UTC(anio, mes, d - 1));
  return fin.toISOString().slice(0, 10);
}
const diaSiguiente = (f) => new Date(Date.parse(f + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);

// Próximo período al renovar: si quedan días pagados (o de prueba), empieza al día siguiente del vencimiento
// y los conserva; si ya venció, empieza hoy.
export function periodoRenovacion(s, meses, hoy = hoyLocal(ZONA)) {
  const desde = s?.periodo_hasta && s.periodo_hasta >= hoy ? diaSiguiente(s.periodo_hasta) : hoy;
  return { desde, hasta: finDePeriodo(desde, meses) };
}
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
// Aviso al responsable cuando faltan 7 días o menos.
export const DIAS_AVISO_VENCIMIENTO = 7;

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
    diasRestantes: s?.periodo_hasta && conServicio(estado) && s.periodo_hasta >= hoy ? diasEntre(hoy, s.periodo_hasta) : null,
    modulos: s?.capacidades.modulos || {}, limites: s?.capacidades.limites || {}, uso: usoDe(db, tallerId)
  };
}

// «Mi plan» del taller: servicio, pagos confirmados por Growth Labs, solicitud pendiente y opciones para renovar.
// Solo datos del servicio de Growth Labs; nunca se mezclan con los cobros del taller a sus clientes.
export function miPlan(db, tallerId, hoy = hoyLocal(ZONA)) {
  const servicio = resumenServicio(db, tallerId, hoy);
  const s = suscripcionDe(db, tallerId);
  const plan = s && uno(db, 'SELECT id, clave, nombre, precio_centavos, moneda FROM planes WHERE id = ?', s.plan_id);
  const opciones = s ? PERIODOS_MESES.map((meses) => {
    const p = periodoRenovacion(s, meses, hoy);
    return { meses, desde: p.desde, hasta: p.hasta, importe: plan.precio_centavos == null ? null : plan.precio_centavos * meses, moneda: plan.moneda };
  }) : [];
  const planes = todos(db, 'SELECT id, clave, nombre, capacidades, precio_centavos, moneda, de_prueba FROM planes WHERE activo = 1 ORDER BY clave, version')
    .map((p) => ({ id: p.id, clave: p.clave, nombre: p.nombre, capacidades: json(p.capacidades, {}), precio: p.precio_centavos, moneda: p.moneda, dePrueba: !!p.de_prueba, actual: p.id === s?.plan_id }));
  return {
    servicio, planId: s?.plan_id ?? null, precio: plan?.precio_centavos ?? null, moneda: plan?.moneda || 'ARS', opciones, planes,
    renovacionAutomatica: false, modalidad: s?.modalidad || 'manual', avisarDesde: DIAS_AVISO_VENCIMIENTO,
    datosTransferencia: config.transferencia || null,
    pagos: todos(db, 'SELECT id, importe_centavos, medio, referencia, periodo_desde, periodo_hasta, registrado_at FROM pagos_suscripcion WHERE taller_id = ? ORDER BY periodo_hasta DESC, id DESC', tallerId),
    solicitudes: todos(db, `SELECT q.id, q.tipo, q.meses, q.periodo_desde, q.periodo_hasta, q.importe_centavos, q.moneda, q.aviso_pago, q.estado, q.creado_at, q.resuelta_at, q.resolucion, p.nombre AS plan
      FROM solicitudes_servicio q JOIN planes p ON p.id = q.plan_id WHERE q.taller_id = ? ORDER BY q.id DESC LIMIT 20`, tallerId)
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
