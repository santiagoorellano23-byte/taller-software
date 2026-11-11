// Movimiento como mejora progresiva: ninguna operación espera a que termine un efecto.
const activos = new Map();
let iniciado = false, teclado = false, preferencia;
const curva = 'cubic-bezier(.23,1,.32,1)';

export function iniciarMovimiento() {
  if (iniciado || typeof document === 'undefined') return;
  iniciado = true;
  preferencia = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  document.documentElement.dataset.movimiento = 'listo';
  document.addEventListener('keydown', () => {
    teclado = true; document.documentElement.dataset.entrada = 'teclado'; detenerMovimiento();
  }, {capture:true});
  document.addEventListener('pointerdown', () => {
    teclado = false; document.documentElement.dataset.entrada = 'puntero';
  }, {capture:true, passive:true});
  // Un único listener sobre un evento semántico, sin observar inserciones de tablas/formularios.
  document.addEventListener('toggle', (evento) => {
    const detalle = evento.target;
    if (detalle.matches?.('details.mas') && detalle.open) entrada(detalle.querySelector('.mas__cuerpo'));
  }, {capture:true});
  preferencia?.addEventListener?.('change', () => { if (preferencia.matches) detenerMovimiento(); });
}

export function detenerMovimiento(contenedor = null) {
  for (const [elemento, efecto] of activos) {
    if (!contenedor || !elemento.isConnected || contenedor === elemento || contenedor.contains(elemento)) {
      activos.delete(elemento);
      efecto.cancel();
    }
  }
}

function reproducir(elemento, cuadros, duracion, easing = curva, token = '--respuesta') {
  iniciarMovimiento();
  if (!elemento?.isConnected || preferencia?.matches || teclado || typeof elemento.animate !== 'function') return null;
  detenerMovimiento(elemento);
  try {
    // CSS es la fuente de tiempos/curvas; el fallback mantiene la mejora progresiva sin esa hoja.
    const estilo = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
    const tiempo = estilo?.getPropertyValue?.(token)?.trim() || '';
    const ms = parseFloat(tiempo) * (tiempo.endsWith('ms') ? 1 : tiempo.endsWith('s') ? 1000 : NaN);
    if (Number.isFinite(ms) && ms >= 0) duracion = ms;
    easing = estilo?.getPropertyValue?.(easing === curva ? '--respuesta-curva' : '--respuesta-curva-panel')?.trim() || easing;
    const efecto = elemento.animate(cuadros, {duration:duracion, easing, fill:'none'});
    activos.set(elemento, efecto);
    const limpiar = () => { if (activos.get(elemento) === efecto) activos.delete(elemento); };
    efecto.finished.then(limpiar, limpiar);
    return efecto;
  } catch { return null; } // Navegadores sin WAAPI conservan toda la interacción.
}

export function entrada(elemento, {tipo = 'cabecera', direccion = 1} = {}) {
  let desde = {opacity:.35};
  if (tipo === 'paso') desde = {opacity:.45, transform:`translateX(${direccion < 0 ? -6 : 6}px)`};
  if (tipo === 'aviso') desde = {opacity:0, transform:'translateY(6px)'};
  if (tipo === 'ayuda') desde = {opacity:.5, transform:matchMedia('(min-width:1024px)').matches ? 'translateX(18px)' : 'translateY(18px)'};
  return reproducir(elemento, [desde, {opacity:1, transform:'none'}], tipo === 'ayuda' ? 240 : 180,
    tipo === 'ayuda' ? 'cubic-bezier(.32,.72,0,1)' : curva, tipo === 'ayuda' ? '--respuesta-panel' : '--respuesta');
}

// Retira la interacción inmediatamente. Solo la representación visual sale durante un máximo de 160 ms.
// El resultado de guardar, cobrar, cerrar o cancelar nunca depende de esta promesa.
export function retirar(elemento, {tipo = 'aviso'} = {}) {
  if (!elemento || elemento.dataset.retirando) return;
  elemento.dataset.retirando = '1';
  elemento.inert = true;
  elemento.setAttribute('aria-hidden', 'true');
  elemento.style.pointerEvents = 'none';
  const transform = tipo === 'ayuda'
    ? (matchMedia('(min-width:1024px)').matches ? 'translateX(18px)' : 'translateY(18px)') : 'translateY(6px)';
  // Lectura antes de cancelar: cerrar durante la entrada no debe saltar al estado final.
  const opacidad = typeof getComputedStyle === 'function' ? getComputedStyle(elemento).opacity : '1';
  const posicion = typeof getComputedStyle === 'function' ? getComputedStyle(elemento).transform : 'none';
  const efecto = reproducir(elemento, [{opacity:opacidad, transform:posicion}, {opacity:0, transform}], 120, curva, '--respuesta-rapida');
  if (!efecto) { detenerMovimiento(elemento); elemento.remove(); return; }
  let timer;
  const finalizar = () => { clearTimeout(timer); detenerMovimiento(elemento); elemento.remove(); };
  // Fallback incluso si el navegador no resuelve finished tras suspender una pestaña.
  timer = setTimeout(finalizar, 160);
  efecto.finished.then(finalizar, finalizar);
}
