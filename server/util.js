// Utilidades compartidas: errores con mensaje para la persona, validación y fechas.

export class ErrorUsuario extends Error {
  // estado HTTP + mensaje en lenguaje del taller + campo opcional para marcar el formulario
  constructor(estado, mensaje, campo, datos) {
    super(mensaje);
    this.estado = estado;
    this.campo = campo;
    this.datos = datos;
  }
}
export const falla = (mensaje, campo) => { throw new ErrorUsuario(400, mensaje, campo); };
export const prohibido = (mensaje = 'Tu usuario no tiene permiso para esta acción.') => { throw new ErrorUsuario(403, mensaje); };
export const noEncontrado = (mensaje = 'No encontramos ese dato en este taller.') => { throw new ErrorUsuario(404, mensaje); };
export const conflicto = (mensaje = 'Otra persona cambió este dato mientras lo editabas. Recargá para ver la versión actual; lo que escribiste sigue en pantalla.') => { throw new ErrorUsuario(409, mensaje); };

// ---------- Reloj ----------
// TALLERES_RELOJ permite fijar la hora en pruebas automáticas. En uso normal es la hora real.
export function ahora() {
  return process.env.TALLERES_RELOJ ? new Date(process.env.TALLERES_RELOJ) : new Date();
}
export const isoAhora = () => ahora().toISOString();

const fmtCache = new Map();
function partes(fecha, zona) {
  let f = fmtCache.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    fmtCache.set(zona, f);
  }
  const p = Object.fromEntries(f.formatToParts(fecha).map((x) => [x.type, x.value]));
  return p;
}
// Hora local del taller como 'AAAA-MM-DDTHH:MM'
export function localAhora(zona) {
  const p = partes(ahora(), zona);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export const hoyLocal = (zona) => localAhora(zona).slice(0, 10);
export function aLocal(iso, zona) {
  const p = partes(new Date(iso), zona);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function fechaValida(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(f + 'T12:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === f;
}
export function fechaHoraValida(f) {
  return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(f) && fechaValida(f.slice(0, 10));
}
export const minutosDe = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const diaSemana = (fecha) => new Date(fecha + 'T12:00:00Z').getUTCDay(); // 0 domingo
export function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- Texto ----------
export const texto = (v, max = 2000) => {
  const s = String(v ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
};
export function requerido(v, mensaje, campo, max = 2000) {
  const s = texto(v, max);
  if (!s) falla(mensaje, campo);
  if (String(v).trim().length > max) falla(`Este dato admite hasta ${max} caracteres.`, campo);
  return s;
}
export const opcional = (v, max = 2000) => texto(v, max) || null;
export const normPatente = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const normTexto = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');

export function enLista(v, lista, mensaje, campo) {
  if (!lista.includes(v)) falla(mensaje, campo);
  return v;
}

// ---------- Números ----------
// Importe escrito por una persona → centavos. Acepta "36000", "36.000", "36.000,50", "$ 1.234".
export function parseDinero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
  let s = String(v ?? '').trim().replace(/^\$\s*/, '').replace(/\s/g, '');
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+(\.\d{1,2})$/.test(s)) return null;
  if (/^\d+\.\d{1,2}$/.test(s) && !/^\d{1,3}\.\d{3}$/.test(s)) {
    return Math.round(Number(s) * 100);           // 1234.5 (punto decimal)
  }
  s = s.replace(/\./g, '').replace(',', '.');
  const n = Math.round(Number(s) * 100);
  return Number.isSafeInteger(n) ? n : null;
}
export function dinero(v, mensaje, campo, { cero = false } = {}) {
  const c = parseDinero(v);
  if (c === null || c < 0 || (!cero && c === 0)) falla(mensaje, campo);
  if (c > 100_000_000_000) falla('El importe es demasiado alto. Revisalo.', campo);
  return c;
}
// Cantidad → milésimas. Acepta "1", "4,2", "0.5".
export function parseCantidad(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1000) : null;
  const s = String(v ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  return Math.round(Number(s) * 1000);
}
export function cantidad(v, mensaje, campo) {
  const c = parseCantidad(v);
  if (c === null || c <= 0) falla(mensaje, campo);
  if (c > 1_000_000_000) falla('La cantidad es demasiado alta. Revisala.', campo);
  return c;
}
// Kilómetros: entero sin puntos o con puntos de miles. Nunca se convierte "desconocido" en 0.
export function parseKm(v) {
  const s = String(v ?? '').trim().replace(/\s/g, '');
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(s)) return null;
  const n = Number(s.replace(/\./g, ''));
  return Number.isSafeInteger(n) && n < 5_000_000 ? n : null;
}
export const importeLinea = (cantidadM, precioUnit) => Math.round((cantidadM * precioUnit) / 1000);
export const idEntero = (v) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
export const json = (s, def) => {
  try { return s ? JSON.parse(s) : def; } catch { return def; }
};
