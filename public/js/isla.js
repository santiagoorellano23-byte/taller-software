// Isla de navegación móvil, variante C «Deslizador invertido» con Recibir en lengüeta (decisión del 17/11/2026).
// Los destinos son enlaces a las pantallas reales; Recibir es un botón que abre la recepción guiada de siempre.
// Una superficie clara (el indicador) se desliza hasta el destino actual. Cambiar de destino solo mueve el
// indicador y el aria-current: la isla no se vuelve a dibujar.

// Íconos de trazo de la propuesta C. `.f` es el relleno tenue del destino actual.
const ICONOS = {
  home: '<path class="f" d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5H5.5A1.5 1.5 0 0 1 4 19z"/>',
  garage: '<rect class="f" x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M7.5 16v-3.2l1.4-3.3h6.2l1.4 3.3V16z"/><path d="M7.5 13h9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  users: '<circle class="f" cx="9" cy="7.5" r="3.5"/><path class="f" d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20z"/><path d="M16 4.2a3.5 3.5 0 0 1 0 6.6"/><path d="M21 20v-1.5a4.5 4.5 0 0 0-3-4.2"/>',
  dots: [5, 12, 19].map((y) => [5, 12, 19].map((x) => `<circle class="punto" cx="${x}" cy="${y}" r="1.5"/>`).join('')).join('')
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONOS[n]}</svg>`;
const destino = (seccion, texto, ic) => `<li><a class="isla__tab" href="#/${seccion}" data-seccion="${seccion}"><span class="isla__ic">${svg(ic)}</span><span class="isla__tx">${texto}</span></a></li>`;

export function islaHTML({ recibir }) {
  return `<nav class="isla" data-isla aria-label="Navegación principal móvil"><span class="isla__indicador" aria-hidden="true"></span><ul class="isla__lista">
    ${destino('hoy', 'Hoy', 'home')}${destino('trabajos', 'Taller', 'garage')}
    ${recibir ? `<li class="isla__r"><button type="button" class="isla__tab isla__rec" data-isla-recibir><span class="isla__ic">${svg('plus')}</span><span class="isla__tx">Recibir</span></button></li>` : ''}
    ${destino('autos', 'Clientes', 'users')}${destino('mas', 'Más', 'dots')}
  </ul></nav>`;
}

// Lleva el indicador al destino con aria-current. Sin destino actual (por ejemplo, en la recepción) no se muestra.
export function colocarIndicador(nav) {
  if (!nav?.offsetWidth) return; // oculta en escritorio o en modo enfoque
  const ind = nav.querySelector('.isla__indicador');
  const t = nav.querySelector('.isla__tab[aria-current="page"]');
  if (!t) { ind.style.opacity = '0'; return; }
  const n = nav.getBoundingClientRect(), r = t.getBoundingClientRect();
  ind.style.width = `${r.width}px`;
  ind.style.transform = `translateX(${r.left - n.left - nav.clientLeft}px)`;
  ind.style.opacity = '';
  // La primera ubicación no se anima: así no se ve deslizarse desde la izquierda al cargar.
  if (!nav.dataset.listo) requestAnimationFrame(() => requestAnimationFrame(() => { nav.dataset.listo = '1'; }));
}

export function enlazarIsla(nav) {
  if (!nav) return;
  nav.querySelector('[data-isla-recibir]')?.addEventListener('click', () => { location.hash = '#/recibir'; });
  // Ancho, orientación, tamaño de letra o volver a mostrarse después del modo enfoque cambian el tamaño de los destinos.
  const ro = new ResizeObserver(() => { if (!nav.isConnected) { ro.disconnect(); return; } colocarIndicador(nav); });
  ro.observe(nav);
  nav.querySelectorAll('.isla__tab').forEach((t) => ro.observe(t));
  document.fonts?.ready.then(() => colocarIndicador(nav));
}
