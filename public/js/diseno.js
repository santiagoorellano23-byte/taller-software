// Piezas de presentación del diseño final (GrowthLabs-Talleres-App-Final, 18/11/2026): íconos, patentes, marca del
// vehículo, etiquetas de estado y encabezados de pantalla. Solo arman HTML; los datos y las acciones son los reales.
import { esc } from './ui.js?v=0.1.0';

// Material Symbols locales (/iconos-material, Apache 2.0) pintados con el color del texto.
export const ic = (n, cls = '') => `<span class="material-icon ic${cls ? ' ' + cls : ''}" style="--icono:url('/iconos-material/${n}.svg')" aria-hidden="true"></span>`;

// Patente: Mercosur (blanca con franja azul), formato anterior (negra) o sin patente.
export function placa(p, { grande = false } = {}) {
  const t = String(p || '').trim();
  if (!t) return `<span class="placa sinpat${grande ? ' grande' : ''}" translate="no">Sin patente</span>`;
  const vieja = /^[A-Z]{3}\s?\d{3}$/i.test(t);
  return `<span class="placa${vieja ? ' vieja' : ''}${grande ? ' grande' : ''}" translate="no">${esc(t.toUpperCase())}</span>`;
}

// Logo de la marca del vehículo cuando el producto lo tiene; si no, un ícono neutro.
const LOGOS = { fiat: 'svg', volkswagen: 'svg', toyota: 'svg', chevrolet: 'png', ford: 'png', renault: 'svg', peugeot: 'svg' };
export function logoMarca(marca, { grande = false } = {}) {
  const k = String(marca || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/)[0];
  const cls = `logo${grande ? ' grande' : ''}`;
  return LOGOS[k] ? `<span class="${cls}" aria-hidden="true"><img src="/marcas/${k}.${LOGOS[k]}" alt="" width="34" height="34" loading="lazy"></span>`
    : `<span class="${cls} neutro" aria-hidden="true">${ic('directions_car')}</span>`;
}

// Etiqueta de estado (cuadrada, con ícono): info, ok, warn, err, neutro o marca.
export const etiqueta = (texto, tipo = 'neutro', icono = '') => `<span class="chip ${tipo}">${icono ? ic(icono) : ''}${esc(texto)}</span>`;
// Colores del producto (estadoDimension, chip) a los tipos del diseño.
export const TIPO = { verde: 'ok', ambar: 'warn', rojo: 'err', azul: 'info', teal: 'info', violeta: 'neutro', gris: 'neutro', '': 'neutro' };

export const ibtn = (icono, etiquetaAccesible, { href = '', attrs = '', cls = '' } = {}) => href
  ? `<a class="ibtn${cls ? ' ' + cls : ''}" href="${href}" aria-label="${esc(etiquetaAccesible)}" title="${esc(etiquetaAccesible)}" ${attrs}>${ic(icono)}</a>`
  : `<button type="button" class="ibtn${cls ? ' ' + cls : ''}" aria-label="${esc(etiquetaAccesible)}" title="${esc(etiquetaAccesible)}" ${attrs}>${ic(icono)}</button>`;

// Encabezado de módulo: volver (enlace real a la pantalla anterior), título, subtítulo y ayuda contextual.
export function cabecera({ titulo, sub = '', volver = '', ayuda = 'guia', acciones = '' }) {
  return `<header class="cab-mod">${volver ? ibtn('arrow_back', 'Volver', { href: volver, attrs: 'data-volver' }) : ''}<div><h1 tabindex="-1">${titulo}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${acciones}${ayuda ? ibtn('help', 'Ayuda', { attrs: `data-ayuda="${esc(ayuda)}"` }) : ''}</header>`;
}

// Barra de cinco segmentos con la etapa real de la orden (0 a 4); -1 si está anulada.
export const ETAPAS_ORDEN = ['Ingreso', 'Revisión', 'Presupuesto', 'Trabajo', 'Entrega'];
export function etapas(e, { entregada = false } = {}) {
  return `<span class="etapas" aria-hidden="true">${ETAPAS_ORDEN.map((_, i) => `<i class="${entregada || i < e ? 'h' : i === e ? 'a' : ''}"></i>`).join('')}</span>`;
}

export const vacioD = (icono, titulo, texto = '', accion = '') => `<div class="vacio-d">${ic(icono)}<p class="vt">${esc(titulo)}</p>${texto ? `<p class="vx">${texto}</p>` : ''}${accion}</div>`;
